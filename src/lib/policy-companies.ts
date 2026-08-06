import {
  GENERAL_POLICY_DEPARTMENT_CODE,
  GENERAL_POLICY_DEPARTMENT_NAME,
  type CompanyOption,
  type Policy,
  type PolicyVisibilityScope,
} from "@/lib/types";

export function getPolicyCompanies(policy: Policy): CompanyOption[] {
  if (policy.companies?.length) {
    return policy.companies.map((item) => ({
      code: item.companyCode,
      name: item.companyName,
    }));
  }
  if (policy.companyCode) {
    return [{ code: policy.companyCode, name: policy.companyName }];
  }
  return [];
}

export function getPolicyVisibilityScope(policy: Policy): PolicyVisibilityScope {
  return policy.visibilityScope === "general" ? "general" : "department";
}

export function formatPolicyCompaniesLabel(policy: Policy) {
  const companies = getPolicyCompanies(policy);
  if (companies.length <= 1) return companies[0]?.name ?? policy.companyName;
  if (companies.length === 2) return `${companies[0].name}, ${companies[1].name}`;
  return `${companies[0].name} +${companies.length - 1} more`;
}

export function formatPolicyScopeLabel(policy: Policy) {
  const visibility = getPolicyVisibilityScope(policy);
  if (visibility === "general") {
    return `General · ${formatPolicyCompaniesLabel(policy)}`;
  }
  return `${policy.departmentName} · ${formatPolicyCompaniesLabel(policy)}`;
}

export function getPolicyTreePlacements(policy: Policy) {
  const companies = getPolicyCompanies(policy);
  const visibility = getPolicyVisibilityScope(policy);

  return companies.map((company) => ({
    companyCode: company.code,
    companyName: company.name,
    departmentCode:
      visibility === "general" ? GENERAL_POLICY_DEPARTMENT_CODE : policy.departmentCode,
    departmentName:
      visibility === "general" ? GENERAL_POLICY_DEPARTMENT_NAME : policy.departmentName,
  }));
}

export { GENERAL_POLICY_DEPARTMENT_CODE, GENERAL_POLICY_DEPARTMENT_NAME };
