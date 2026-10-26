import { APPROVAL_STEP_LABELS, type ApprovalStep, type Policy } from "@/lib/types";

export interface ApprovalColumn {
  label: string;
  step: ApprovalStep | null;
  assigneeName: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatDocumentDate(date?: string) {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function getApprovalColumns(policy: Policy): ApprovalColumn[] {
  const grouped = new Map<number, ApprovalStep[]>();

  for (const step of policy.approvalSteps) {
    if (step.type === "requester") continue;
    const list = grouped.get(step.groupOrder) ?? [];
    list.push(step);
    grouped.set(step.groupOrder, list);
  }

  const columns: ApprovalColumn[] = [];

  for (const [, steps] of [...grouped.entries()].sort(([a], [b]) => a - b)) {
    const type = steps[0]?.type;
    if (!type) continue;

    if (type === "audit_team") {
      const approver = steps.find((step) => step.status === "approved") ?? steps[0];
      columns.push({
        label: APPROVAL_STEP_LABELS.audit_team,
        step: approver.status === "approved" ? approver : null,
        assigneeName: approver.assigneeName,
      });
      continue;
    }

    const step = steps[0];
    columns.push({
      label: APPROVAL_STEP_LABELS[type],
      step: step.status === "approved" ? step : null,
      assigneeName: step.assigneeName,
    });
  }

  return columns;
}

export function buildRevisionRows(policy: Policy) {
  const rows: Array<{
    revisionNo: number;
    revisionDate: string;
    description: string;
    pageNo: string;
  }> = [];

  rows.push({
    revisionNo: 0,
    revisionDate: formatDocumentDate(policy.createdAt),
    description: "Initial policy creation",
    pageNo: "All",
  });

  if (policy.submittedAt) {
    rows.push({
      revisionNo: policy.version,
      revisionDate: formatDocumentDate(policy.submittedAt),
      description: `Version ${policy.version} submitted for approval`,
      pageNo: "All",
    });
  }

  if (policy.approvedAt) {
    rows.push({
      revisionNo: policy.version,
      revisionDate: formatDocumentDate(policy.approvedAt),
      description: `Version ${policy.version} approved by all reviewers`,
      pageNo: "All",
    });
  }

  if (policy.publishedAt) {
    rows.push({
      revisionNo: policy.version,
      revisionDate: formatDocumentDate(policy.publishedAt),
      description: `Version ${policy.version} published`,
      pageNo: "All",
    });
  }

  return rows;
}

function tableStyle() {
  return `
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    color: #0f172a;
  `;
}

function cellStyle(extra = "") {
  return `
    border: 1px solid #334155;
    padding: 10px 12px;
    vertical-align: middle;
    text-align: center;
    ${extra}
  `;
}

function headerCellStyle() {
  return cellStyle("background: #f8fafc; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;");
}

function signatureMarkup(signature?: string) {
  if (!signature?.trim()) {
    return `<span style="color:#94a3b8; font-size: 12px;">Pending</span>`;
  }
  return `<div style="font-family: 'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive; font-size: 22px; line-height: 1.2; color: #1d4ed8; min-height: 32px;">${escapeHtml(signature.trim())}</div>`;
}

export function buildApprovalTableHtml(policy: Policy) {
  const columns = getApprovalColumns(policy);
  if (columns.length === 0) return "";

  const approvalDate = formatDocumentDate(
    policy.publishedAt ?? policy.approvedAt ?? policy.submittedAt,
  );

  const headerCells = columns
    .map((column) => `<th style="${headerCellStyle()}">${escapeHtml(column.label)}</th>`)
    .join("");

  const nameCells = columns
    .map(
      (column) =>
        `<td style="${cellStyle("font-weight: 600;")}">${escapeHtml(column.assigneeName)}</td>`,
    )
    .join("");

  const signatureCells = columns
    .map(
      (column) =>
        `<td style="${cellStyle()}">${signatureMarkup(column.step?.signatureText)}</td>`,
    )
    .join("");

  return `
    <div style="margin-top: 48px; page-break-inside: avoid;">
      <h2 style="font-size: 14px; font-weight: 700; color: #dc2626; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.06em;">
        Approval
      </h2>
      <table style="${tableStyle()}">
        <thead>
          <tr>
            <th style="${headerCellStyle()}">Date</th>
            <th style="${headerCellStyle()}">Department</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="${cellStyle()}">${approvalDate}</td>
            <td style="${cellStyle("font-weight: 600;")}">${escapeHtml(policy.departmentName)}</td>
            ${nameCells}
          </tr>
          <tr>
            <td style="${cellStyle()}"></td>
            <td style="${cellStyle()}"></td>
            ${signatureCells}
          </tr>
        </tbody>
      </table>
      <p style="margin: 8px 0 0; font-size: 11px; color: #64748b;">
        Requester: ${escapeHtml(policy.createdByName)} · Policy version ${policy.version}
      </p>
    </div>
  `;
}

export function buildRevisionHistoryHtml(policy: Policy) {
  const rows = buildRevisionRows(policy);

  const bodyRows = rows
    .map(
      (row) => `
      <tr>
        <td style="${cellStyle()}">${row.revisionNo}</td>
        <td style="${cellStyle()}">${row.revisionDate}</td>
        <td style="${cellStyle("text-align: left;")}">${escapeHtml(row.description)}</td>
        <td style="${cellStyle()}">${escapeHtml(row.pageNo)}</td>
      </tr>
    `,
    )
    .join("");

  return `
    <div style="margin-top: 36px; page-break-inside: avoid;">
      <h2 style="font-size: 14px; font-weight: 700; color: #dc2626; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.06em;">
        Document Revision History
      </h2>
      <table style="${tableStyle()}">
        <thead>
          <tr>
            <th style="${headerCellStyle()}">Revision No</th>
            <th style="${headerCellStyle()}">Revision Date</th>
            <th style="${headerCellStyle()}">Description</th>
            <th style="${headerCellStyle()}">Page No</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;
}

export function buildPolicyAppendixHtml(policy: Policy) {
  if (policy.approvalSteps.length === 0) return "";
  return `${buildApprovalTableHtml(policy)}${buildRevisionHistoryHtml(policy)}`;
}

export function shouldShowPolicyAppendix(policy: Policy) {
  return policy.approvalSteps.some((step) => step.type !== "requester");
}
