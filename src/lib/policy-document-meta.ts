import { formatPolicyCompaniesLabel, getPolicyVisibilityScope } from "./policy-companies";
import { formatDocumentDate, getApprovalColumns } from "./policy-document-appendix";
import type { Policy } from "./types";

export function formatPolicyVersionLabel(version: number) {
  return Number.isFinite(version) ? `${version}.0` : "1.0";
}

export function buildPolicyDocumentCode(policy: Policy) {
  const dept = (policy.departmentName || "GEN")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase()
    .slice(0, 18);
  const slug = (policy.name || "Policy")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `NEWEAST-${dept || "GEN"}-POL-${slug}_v${formatPolicyVersionLabel(policy.version)}`;
}

export function buildDistributionList(policy: Policy) {
  const companies = formatPolicyCompaniesLabel(policy);
  if (getPolicyVisibilityScope(policy) === "general") {
    return `All employees of ${companies}`;
  }
  return `${policy.departmentName} employees · ${companies}`;
}

export function buildDocumentSubtitle(policy: Policy) {
  return [
    formatPolicyCompaniesLabel(policy),
    policy.departmentName,
    `Version ${formatPolicyVersionLabel(policy.version)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function getDocumentAuthorisers(policy: Policy) {
  const columns = getApprovalColumns(policy);
  return [
    {
      label: "Changes & Reviewed By",
      name: policy.createdByName || "—",
      role: "Document owner",
      signature: "",
    },
    ...columns.map((column) => ({
      label: column.label || "Approved By",
      name: column.assigneeName,
      role: column.step?.levelLabel || column.step?.departmentName || column.label,
      signature: column.step?.signatureText?.trim() || "",
    })),
  ];
}

export function getLatestApproverName(policy: Policy) {
  const columns = getApprovalColumns(policy);
  const signed = [...columns].reverse().find((column) => column.step?.signatureText?.trim());
  return signed?.assigneeName || columns[columns.length - 1]?.assigneeName || policy.createdByName;
}

export function buildVersionHistoryRows(policy: Policy) {
  const approvedBy = getLatestApproverName(policy);
  const rows = [
    {
      version: "1.0",
      date: formatDocumentDate(policy.createdAt),
      approvedBy: policy.createdByName || "—",
      reason: "Initial formulation",
    },
  ];
  if (policy.version > 1) {
    rows.push({
      version: formatPolicyVersionLabel(policy.version),
      date: formatDocumentDate(policy.publishedAt ?? policy.approvedAt ?? policy.updatedAt),
      approvedBy,
      reason: `Version ${policy.version} update`,
    });
  } else if (policy.publishedAt || policy.approvedAt) {
    rows[0] = {
      version: formatPolicyVersionLabel(policy.version),
      date: formatDocumentDate(policy.publishedAt ?? policy.approvedAt ?? policy.createdAt),
      approvedBy,
      reason: "Initial formulation",
    };
  }
  return rows;
}
