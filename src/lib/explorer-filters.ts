import type { Policy, PolicyStatus } from "@/lib/types";
import {
  getPolicyCompanies,
  getPolicyTreePlacements,
} from "@/lib/policy-companies";

export interface PolicyExplorerFilters {
  search: string;
  status: PolicyStatus | "all";
  companyCode: string;
  departmentCode: string;
}

export const DEFAULT_EXPLORER_FILTERS: PolicyExplorerFilters = {
  search: "",
  status: "all",
  companyCode: "all",
  departmentCode: "all",
};

export function applyExplorerFilters(
  policies: Policy[],
  filters: PolicyExplorerFilters,
) {
  const query = filters.search.trim().toLowerCase();

  return policies.filter((policy) => {
    if (filters.status !== "all" && policy.status !== filters.status) {
      return false;
    }
    if (
      filters.companyCode !== "all" &&
      !getPolicyCompanies(policy).some((company) => company.code === filters.companyCode)
    ) {
      return false;
    }
    if (filters.departmentCode !== "all") {
      const placements = getPolicyTreePlacements(policy);
      if (
        !placements.some(
          (placement) =>
            (filters.companyCode === "all" ||
              placement.companyCode === filters.companyCode) &&
            String(placement.departmentCode) === filters.departmentCode,
        )
      ) {
        return false;
      }
    }
    if (!query) return true;

    return (
      policy.name.toLowerCase().includes(query) ||
      policy.companyName.toLowerCase().includes(query) ||
      policy.departmentName.toLowerCase().includes(query) ||
      policy.createdByName.toLowerCase().includes(query)
    );
  });
}

export function buildExplorerFilterOptions(policies: Policy[]) {
  const companies = new Map<string, string>();
  const departments = new Map<string, { code: number; name: string; companyCode: string }>();

  for (const policy of policies) {
    const policyCompanies = getPolicyCompanies(policy);
    for (const company of policyCompanies) {
      companies.set(company.code, company.name);
    }

    for (const placement of getPolicyTreePlacements(policy)) {
      departments.set(`${placement.companyCode}:${placement.departmentCode}`, {
        code: placement.departmentCode,
        name: placement.departmentName,
        companyCode: placement.companyCode,
      });
    }
  }

  return {
    companies: [...companies.entries()]
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    departments: [...departments.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  };
}
