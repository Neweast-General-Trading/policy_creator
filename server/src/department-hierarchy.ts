import type { BiUser } from "./bi-users.js";

export interface HierarchyTierPreview {
  tier: number;
  label: string;
  employees: Array<{
    userId: string;
    email: string;
    name: string;
    directReportsInDept: number;
  }>;
}

export function hierarchyTierLabel(tierIndex: number, totalTiers: number) {
  if (totalTiers <= 1) return "Department approvers";
  if (tierIndex === 0) return "Staff — no direct reports in department";
  if (tierIndex === totalTiers - 1) return "Managers / department leadership";
  return `Management tier ${tierIndex + 1}`;
}

/** Build org tiers from bottom (staff) to top (leadership) using REPORTINGTOID within the department. */
export function buildDepartmentHierarchyTiers(users: BiUser[]): BiUser[][] {
  if (users.length === 0) return [];

  const byId = new Map(users.map((user) => [user.USER_ID, user]));
  const directReports = new Map<string, BiUser[]>();

  for (const user of users) {
    const managerId = user.REPORTINGTOID?.trim();
    if (!managerId || !byId.has(managerId)) continue;
    const list = directReports.get(managerId) ?? [];
    list.push(user);
    directReports.set(managerId, list);
  }

  const tiers: BiUser[][] = [];
  const assigned = new Set<string>();

  let currentTier = users.filter(
    (user) => (directReports.get(user.USER_ID)?.length ?? 0) === 0,
  );

  if (currentTier.length === 0) {
    currentTier = [users[0]];
  }

  while (currentTier.length > 0) {
    const batch = currentTier.filter((user) => !assigned.has(user.USER_ID));
    if (batch.length === 0) break;

    tiers.push(batch);
    for (const user of batch) assigned.add(user.USER_ID);

    const nextTier: BiUser[] = [];
    for (const user of users) {
      if (assigned.has(user.USER_ID)) continue;
      const reports = directReports.get(user.USER_ID) ?? [];
      if (reports.length === 0) continue;
      if (reports.every((report) => assigned.has(report.USER_ID))) {
        nextTier.push(user);
      }
    }

    currentTier = nextTier;
  }

  const remaining = users.filter((user) => !assigned.has(user.USER_ID));
  if (remaining.length > 0) {
    if (tiers.length === 0) tiers.push(remaining);
    else tiers[0] = [...tiers[0], ...remaining];
  }

  return tiers.length > 0 ? tiers : [users];
}

export function getManagerIdsInDepartment(users: BiUser[]) {
  const byId = new Map(users.map((user) => [user.USER_ID, user]));
  const managerIds = new Set<string>();
  for (const user of users) {
    const managerId = user.REPORTINGTOID?.trim();
    if (managerId && byId.has(managerId)) {
      managerIds.add(managerId);
    }
  }
  return managerIds;
}

export function getDirectReportIdsInDepartment(
  users: BiUser[],
  managerUserIds: Set<string>,
): Set<string> {
  const reportIds = new Set<string>();
  for (const user of users) {
    const managerId = user.REPORTINGTOID?.trim();
    if (managerId && managerUserIds.has(managerId)) {
      reportIds.add(user.USER_ID);
    }
  }
  return reportIds;
}

export function blockUserAndDirectReports(
  users: BiUser[],
  userId: string,
  blocked: Set<string>,
) {
  blocked.add(userId);
  for (const reportId of getDirectReportIdsInDepartment(users, new Set([userId]))) {
    blocked.add(reportId);
  }
}

/** True when a configured level includes at least one manager approver. */
export function levelConfigIncludesManager(
  users: BiUser[],
  assignees: BiUser[],
  audience: "tier" | "managers_only" | "staff_only",
  poolWhenAll: BiUser[],
  assigneeMode: "all" | "selected",
): boolean {
  const managerIds = getManagerIdsInDepartment(users);
  if (assigneeMode === "all") {
    if (audience === "staff_only") return false;
    if (audience === "managers_only") return poolWhenAll.length > 0;
    return poolWhenAll.some((user) => managerIds.has(user.USER_ID));
  }
  return assignees.some((user) => managerIds.has(user.USER_ID));
}

export function resolveLevelPool(
  users: BiUser[],
  levelIndex: number,
  totalConfiguredLevels: number,
  audience: "tier" | "managers_only" | "staff_only" = "tier",
): BiUser[] {
  if (users.length === 0) return [];

  const managerIds = getManagerIdsInDepartment(users);

  if (audience === "managers_only") {
    return users.filter((user) => managerIds.has(user.USER_ID));
  }

  if (audience === "staff_only") {
    return users.filter((user) => !managerIds.has(user.USER_ID));
  }

  return resolveStageLevelUsers(users, levelIndex, totalConfiguredLevels);
}

export function resolveLevelPoolLabel(
  levelIndex: number,
  totalConfiguredLevels: number,
  users: BiUser[],
  audience: "tier" | "managers_only" | "staff_only" = "tier",
) {
  if (audience === "managers_only") {
    return "Only reporting — managers with direct reports in department";
  }
  if (audience === "staff_only") {
    return "Staff only — no direct reports in department";
  }
  return resolveStageLevelLabel(levelIndex, totalConfiguredLevels, users);
}

/** Map configured stage level index to employees (0 = first approval step in that department). */
export function resolveStageLevelUsers(
  users: BiUser[],
  levelIndex: number,
  totalConfiguredLevels: number,
): BiUser[] {
  if (users.length === 0) return [];

  const managerIds = getManagerIdsInDepartment(users);
  const staff = users.filter((user) => !managerIds.has(user.USER_ID));
  const managers = users.filter((user) => managerIds.has(user.USER_ID));

  if (totalConfiguredLevels === 2) {
    return levelIndex === 0 ? staff : managers;
  }

  const tiers = buildDepartmentHierarchyTiers(users);
  return tiers[levelIndex] ?? [];
}

export function resolveStageLevelLabel(
  levelIndex: number,
  totalConfiguredLevels: number,
  users: BiUser[],
) {
  if (totalConfiguredLevels === 2) {
    return levelIndex === 0
      ? "Staff — no direct reports in department"
      : "Managers — employees with direct reports in department";
  }

  const tiers = buildDepartmentHierarchyTiers(users);
  return hierarchyTierLabel(levelIndex, tiers.length);
}

function directReportsCount(users: BiUser[], userId: string) {
  return users.filter((item) => item.REPORTINGTOID?.trim() === userId).length;
}

export function previewHierarchyTiers(users: BiUser[]): HierarchyTierPreview[] {
  const tiers = buildDepartmentHierarchyTiers(users);

  return tiers.map((tierUsers, index) => ({
    tier: index + 1,
    label: hierarchyTierLabel(index, tiers.length),
    employees: tierUsers.map((user) => ({
      userId: user.USER_ID,
      email: user.USER_EMAIL,
      name: user.EMP_FULLNAME || user.USER_NAME,
      directReportsInDept: directReportsCount(users, user.USER_ID),
    })),
  }));
}

export function previewStageLevel(
  users: BiUser[],
  levelIndex: number,
  totalConfiguredLevels: number,
): HierarchyTierPreview {
  const levelUsers = resolveStageLevelUsers(users, levelIndex, totalConfiguredLevels);

  return {
    tier: levelIndex + 1,
    label: resolveStageLevelLabel(levelIndex, totalConfiguredLevels, users),
    employees: levelUsers.map((user) => ({
      userId: user.USER_ID,
      email: user.USER_EMAIL,
      name: user.EMP_FULLNAME || user.USER_NAME,
      directReportsInDept: directReportsCount(users, user.USER_ID),
    })),
  };
}
