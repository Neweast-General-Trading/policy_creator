import type { StoredPolicy } from "./workflow-types.js";

export interface PolicyCompany {
  companyCode: string;
  companyName: string;
}

export type PolicyVisibilityScope = "general" | "department";

export const GENERAL_POLICY_DEPARTMENT_CODE = 0;
export const GENERAL_POLICY_DEPARTMENT_NAME = "General";

export function getPolicyCompanies(policy: StoredPolicy): PolicyCompany[] {
  if (policy.companies?.length) {
    return policy.companies.map((item) => ({
      companyCode: item.companyCode.trim(),
      companyName: item.companyName.trim() || item.companyCode.trim(),
    }));
  }
  if (policy.companyCode?.trim()) {
    return [
      {
        companyCode: policy.companyCode.trim(),
        companyName: policy.companyName.trim() || policy.companyCode.trim(),
      },
    ];
  }
  return [];
}

export function normalizePolicyCompanies(
  companies: PolicyCompany[] | undefined,
  fallback?: Pick<StoredPolicy, "companyCode" | "companyName">,
): PolicyCompany[] {
  const seen = new Set<string>();
  const normalized: PolicyCompany[] = [];

  for (const item of companies ?? []) {
    const companyCode = String(item.companyCode ?? "").trim();
    if (!companyCode || seen.has(companyCode)) continue;
    seen.add(companyCode);
    normalized.push({
      companyCode,
      companyName: String(item.companyName ?? "").trim() || companyCode,
    });
  }

  if (normalized.length === 0 && fallback?.companyCode?.trim()) {
    normalized.push({
      companyCode: fallback.companyCode.trim(),
      companyName: fallback.companyName.trim() || fallback.companyCode.trim(),
    });
  }

  return normalized;
}

export function getPolicyVisibilityScope(policy: StoredPolicy): PolicyVisibilityScope {
  return policy.visibilityScope === "general" ? "general" : "department";
}

export function policyAppliesToCompany(policy: StoredPolicy, companyCode: string) {
  const normalized = companyCode.trim();
  return getPolicyCompanies(policy).some((item) => item.companyCode === normalized);
}

export function departmentNamesMatch(
  policyDepartmentName: string,
  scopeDepartmentName: string,
) {
  const policyName = policyDepartmentName.trim().toLowerCase();
  const scopeName = scopeDepartmentName.trim().toLowerCase();
  return !!policyName && !!scopeName && policyName === scopeName;
}

export function policyVisibleToScope(
  policy: StoredPolicy,
  scope: {
    companyCode: string;
    departmentCode: number;
    departmentName?: string;
  },
) {
  if (!policyAppliesToCompany(policy, scope.companyCode)) {
    return false;
  }

  const visibilityScope = getPolicyVisibilityScope(policy);
  if (policy.status === "published" && visibilityScope === "general") {
    return true;
  }

  if (Number(scope.departmentCode) === Number(policy.departmentCode)) {
    return true;
  }

  return departmentNamesMatch(
    policy.departmentName,
    scope.departmentName ?? "",
  );
}

export function formatPolicyCompaniesLabel(policy: StoredPolicy) {
  const companies = getPolicyCompanies(policy);
  if (companies.length <= 1) return companies[0]?.companyName ?? policy.companyName;
  if (companies.length === 2) {
    return `${companies[0].companyName}, ${companies[1].companyName}`;
  }
  return `${companies[0].companyName} +${companies.length - 1} more`;
}
