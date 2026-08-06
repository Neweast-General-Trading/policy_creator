import { previewHierarchyTiers } from "./department-hierarchy.js";
import { getUsersInDepartment } from "./bi-users.js";

export function departmentMatchesKeyword(departmentName: string, keyword: string) {
  const normalized = departmentName.trim().toUpperCase();
  const key = keyword.trim().toUpperCase();
  if (!normalized || !key) return false;
  if (normalized === key) return true;
  if (key.length <= 3) {
    return new RegExp(`(^|[\\s/\\-])${key}($|[\\s/\\-])`).test(normalized);
  }
  return normalized.includes(key);
}

export async function canManageApprovalSetup(email: string): Promise<boolean> {
  const { resolveViewerContext } = await import("./policy-access.js");
  const context = await resolveViewerContext(email);
  if (!context.scopes.length) return false;

  return context.scopes.some((scope) =>
    departmentMatchesKeyword(scope.departmentName, "IT"),
  );
}

export async function previewDepartmentEmployees(
  companyCode: string,
  departmentCode: number,
) {
  const users = await getUsersInDepartment(companyCode, departmentCode);
  const hierarchyTiers = previewHierarchyTiers(users);

  return {
    departmentCode,
    hierarchyTiers,
    employees: users.map((user) => ({
      userId: user.USER_ID,
      email: user.USER_EMAIL,
      name: user.EMP_FULLNAME || user.USER_NAME,
      department: user.DEPARTMENT,
      reportingToId: user.REPORTINGTOID?.trim() || undefined,
      directReportsInDept: users.filter(
        (item) => item.REPORTINGTOID?.trim() === user.USER_ID,
      ).length,
    })),
  };
}
