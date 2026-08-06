import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  getSetupCompanies,
  normalizeSetupCompanies,
  setupMatchesDepartment,
} from "./approval-setup-companies.js";
import type {
  ApprovalStageConfig,
  ApprovalStageLevelConfig,
  PolicyApprovalSetup,
  StageAssigneeMode,
  StageLevelAudience,
  SubmitterLevelMode,
} from "./approval-setup-types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "approval-setups.json");

function migrateLevel(
  raw: Partial<ApprovalStageLevelConfig> & {
    label?: string;
    designation?: string;
    designations?: string[];
    assigneeMode?: string;
    audience?: string;
    replacementDesignation?: string;
  },
  _tierIndex: number,
): ApprovalStageLevelConfig {
  const assignees = Array.isArray(raw.assignees)
    ? raw.assignees.map((item) => ({
        userId: String(item.userId ?? ""),
        email: String(item.email ?? ""),
        name: String(item.name ?? ""),
      }))
    : [];
  const assigneeMode: StageAssigneeMode =
    raw.assigneeMode === "selected" || assignees.length > 0 ? "selected" : "all";

  const audience: StageLevelAudience =
    raw.audience === "managers_only" || raw.audience === "staff_only"
      ? raw.audience
      : "tier";

  return {
    audience,
    assigneeMode,
    assignees: assigneeMode === "selected" ? assignees : [],
  };
}

function migrateStage(raw: Partial<ApprovalStageConfig>): ApprovalStageConfig {
  return {
    departmentCode: Number(raw.departmentCode ?? 0),
    departmentName: String(raw.departmentName ?? "").trim(),
    levels: Array.isArray(raw.levels)
      ? raw.levels.map((level, index) => migrateLevel(level, index))
      : [],
  };
}

function migrateSetup(raw: Record<string, unknown> & { id: string }): PolicyApprovalSetup {
  const now = new Date().toISOString();
  const legacyStages =
    (Array.isArray(raw.stages) ? raw.stages : null) ??
    (Array.isArray(raw.downstreamStages) ? raw.downstreamStages : []);
  const submitterLevelMode =
    raw.submitterLevelMode === "one" ||
    raw.submitterLevelMode === "top" ||
    raw.submitterLevelMode === "all"
      ? raw.submitterLevelMode
      : "all";

  const companies = normalizeSetupCompanies(
    Array.isArray(raw.companies)
      ? (raw.companies as Array<{ companyCode?: string; companyName?: string }>).map(
          (item) => ({
            companyCode: String(item.companyCode ?? ""),
            companyName: String(item.companyName ?? ""),
          }),
        )
      : undefined,
    {
      companyCode: String(raw.companyCode ?? ""),
      companyName: String(raw.companyName ?? ""),
    },
  );

  const primary = companies[0];

  return {
    id: raw.id,
    companyCode: primary?.companyCode ?? String(raw.companyCode ?? "").trim(),
    companyName: primary?.companyName ?? String(raw.companyName ?? "").trim(),
    companies,
    sourceDepartmentCode: Number(raw.sourceDepartmentCode ?? 0),
    sourceDepartmentName: String(raw.sourceDepartmentName ?? "").trim(),
    submitterLevelMode,
    hodSkipInternalLevels: raw.hodSkipInternalLevels !== false,
    stages: (legacyStages as Partial<ApprovalStageConfig>[]).map(migrateStage),
    createdByEmail: String(raw.createdByEmail ?? ""),
    createdByName: String(raw.createdByName ?? ""),
    createdAt: String(raw.createdAt ?? now),
    updatedAt: String(raw.updatedAt ?? now),
  };
}

function assertNoCompanyDepartmentConflict(
  setups: PolicyApprovalSetup[],
  setup: PolicyApprovalSetup,
) {
  const companies = getSetupCompanies(setup);
  for (const other of setups) {
    if (other.id === setup.id) continue;
    for (const company of companies) {
      if (
        getSetupCompanies(other).some((item) => item.companyCode === company.companyCode) &&
        setupMatchesDepartment(
          other,
          company.companyCode,
          setup.sourceDepartmentCode,
          setup.sourceDepartmentName,
        )
      ) {
        throw new Error(
          `${company.companyName} already has an approval setup for ${setup.sourceDepartmentName}`,
        );
      }
    }
  }
}

async function readAll(): Promise<PolicyApprovalSetup[]> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Array<Record<string, unknown> & { id: string }>;
    return (parsed ?? []).map(migrateSetup);
  } catch {
    return [];
  }
}

async function writeAll(setups: PolicyApprovalSetup[]) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(setups, null, 2), "utf8");
}

export async function listApprovalSetups(filters?: {
  companyCode?: string;
  sourceDepartmentCode?: number;
}) {
  let setups = await readAll();
  if (filters?.companyCode) {
    setups = setups.filter((item) =>
      getSetupCompanies(item).some((company) => company.companyCode === filters.companyCode),
    );
  }
  if (filters?.sourceDepartmentCode != null) {
    setups = setups.filter(
      (item) => item.sourceDepartmentCode === filters.sourceDepartmentCode,
    );
  }
  return setups.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function getApprovalSetupById(id: string) {
  const setups = await readAll();
  return setups.find((item) => item.id === id) ?? null;
}

export async function getApprovalSetupForDepartment(
  companyCode: string,
  sourceDepartmentCode: number,
  sourceDepartmentName = "",
) {
  const setups = await readAll();
  return (
    setups.find((item) =>
      setupMatchesDepartment(item, companyCode, sourceDepartmentCode, sourceDepartmentName),
    ) ?? null
  );
}

export async function saveApprovalSetup(input: PolicyApprovalSetup) {
  const setups = await readAll();
  const setup = migrateSetup({ ...input } as Record<string, unknown> & { id: string });
  assertNoCompanyDepartmentConflict(setups, setup);

  const byIdIndex = setups.findIndex((item) => item.id === setup.id);

  if (byIdIndex >= 0) {
    setup.createdAt = setups[byIdIndex].createdAt;
    setup.createdByEmail = setups[byIdIndex].createdByEmail;
    setup.createdByName = setups[byIdIndex].createdByName;
    setups[byIdIndex] = setup;
  } else {
    setups.unshift(setup);
  }

  await writeAll(setups);
  return setup;
}

export async function deleteApprovalSetup(id: string) {
  const setups = await readAll();
  await writeAll(setups.filter((item) => item.id !== id));
}

export async function ensureApprovalSetupStore() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(DATA_FILE, "utf8");
  } catch {
    await writeAll([]);
  }
}

export function newApprovalSetupId() {
  return randomUUID();
}

export type { PolicyApprovalSetup };
