import type { PolicyApprovalSetup, PolicyApprovalSetupCompany } from "./approval-setup-types.js";

export function getSetupCompanies(setup: PolicyApprovalSetup): PolicyApprovalSetupCompany[] {
  if (setup.companies?.length) {
    return setup.companies.map((item) => ({
      companyCode: item.companyCode.trim(),
      companyName: item.companyName.trim() || item.companyCode.trim(),
    }));
  }
  if (setup.companyCode?.trim()) {
    return [
      {
        companyCode: setup.companyCode.trim(),
        companyName: setup.companyName.trim() || setup.companyCode.trim(),
      },
    ];
  }
  return [];
}

export function normalizeSetupCompanies(
  companies: PolicyApprovalSetupCompany[] | undefined,
  fallback?: Pick<PolicyApprovalSetup, "companyCode" | "companyName">,
): PolicyApprovalSetupCompany[] {
  const seen = new Set<string>();
  const normalized: PolicyApprovalSetupCompany[] = [];

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

export function setupMatchesDepartment(
  setup: PolicyApprovalSetup,
  companyCode: string,
  sourceDepartmentCode: number,
  sourceDepartmentName = "",
) {
  const normalizedCompany = companyCode.trim();
  if (!getSetupCompanies(setup).some((item) => item.companyCode === normalizedCompany)) {
    return false;
  }

  if (Number(setup.sourceDepartmentCode) === Number(sourceDepartmentCode)) {
    return true;
  }

  const policyDeptName = sourceDepartmentName.trim().toLowerCase();
  const setupDeptName = setup.sourceDepartmentName.trim().toLowerCase();
  return !!policyDeptName && !!setupDeptName && policyDeptName === setupDeptName;
}

export function formatSetupCompaniesLabel(setup: PolicyApprovalSetup) {
  const companies = getSetupCompanies(setup);
  if (companies.length <= 1) return companies[0]?.companyName ?? setup.companyName;
  if (companies.length === 2) {
    return `${companies[0].companyName}, ${companies[1].companyName}`;
  }
  return `${companies[0].companyName} +${companies.length - 1} more`;
}
