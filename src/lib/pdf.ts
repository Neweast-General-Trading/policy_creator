import { normalizeBusinessRules } from "./business-rules";
import { formatPolicyCompaniesLabel, getPolicyVisibilityScope } from "./policy-companies";
import { formatDocumentDate } from "./policy-document-appendix";
import {
  buildDistributionList,
  buildPolicyDocumentCode,
  buildVersionHistoryRows,
  formatPolicyVersionLabel,
  getDocumentAuthorisers,
} from "./policy-document-meta";
import { normalizeApplyToApplications } from "./policy-applications";
import { htmlHasText, normalizePolicyHtml } from "./policy-html";
import { absoluteAssetUrl } from "./utils";
import type { Policy } from "./types";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function printStyles() {
  return `
    @page { size: A4; margin: 16mm 16mm 18mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      color: #0f172a;
      font-family: Calibri, "Segoe UI", Arial, sans-serif;
    }
    .sheet {
      max-width: 860px;
      margin: 24px auto;
      background: #fff;
      padding: 40px 48px 48px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
    }
    .kicker {
      margin: 0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #dc2626;
    }
    .header { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 18px; border-bottom: 1px solid #e2e8f0; margin-bottom: 28px; }
    .title { font-size: 20px; font-weight: 700; line-height: 1.3; margin: 4px 0 0; }
    .logo { height: 36px; width: auto; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 32px; margin-top: 16px; font-size: 12.5px; }
    .meta-row { display: grid; grid-template-columns: 88px 1fr; gap: 8px; }
    .meta-row dt { color: #94a3b8; margin: 0; }
    .meta-row dd { color: #1e293b; margin: 0; }
    h2 { font-size: 15px; margin: 0 0 12px; line-height: 1.35; page-break-after: avoid; }
    .num { color: #dc2626; margin-right: 6px; }
    table { width: 100%; border-collapse: collapse; }
    .toc, .auth, .history, .apply, .body table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #94a3b8;
    }
    .toc th, .auth th, .history th, .apply th, .body th,
    .toc td, .auth td, .history td, .apply td, .body td {
      border: 1px solid #94a3b8;
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    .toc th, .auth th, .history th, .apply th, .body th {
      background: #f8fafc;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
    }
    .toc td { font-size: 13px; }
    .doc-name { display: grid; grid-template-columns: 140px 1fr; gap: 16px; font-size: 13px; margin: 0 0 18px; }
    .doc-name dt { font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: #64748b; }
    .doc-name dd { font-weight: 500; margin: 0; }
    .block { margin: 0 0 32px; }
    .auth td, .history td { font-size: 12.5px; }
    .sig { font-family: "Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive; color: #1e40af; font-size: 13px; }
    .muted { color: #94a3b8; }
    .section { margin: 0 0 28px; page-break-inside: avoid; }
    .body { font-size: 13.5px; line-height: 1.7; color: #334155; margin-top: 8px; }
    .body p { margin: 0 0 8px; }
    .body p:last-child { margin-bottom: 0; }
    .body ul { margin: 4px 0 8px; padding-left: 18px; }
    .body li { margin: 0 0 4px; }
    .body p.policy-bullet { padding-left: 16px; position: relative; }
    .body p.policy-bullet::before { content: "•"; position: absolute; left: 0; color: #0f172a; }
    .topic-tree { margin: 8px 0 0 20px; padding-left: 14px; border-left: 2px solid #e2e8f0; }
    .rules-label {
      margin: 12px 0 6px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
      color: #1e293b;
    }
    .rule-list { margin: 0; padding: 0 0 0 14px; border-left: 2px solid #e2e8f0; list-style: none; }
    .rule { display: flex; gap: 12px; margin: 8px 0; page-break-inside: avoid; }
    .rule-no { width: 36px; flex-shrink: 0; font-size: 13px; font-weight: 700; padding-top: 2px; }
    .rule-text { font-size: 13.5px; line-height: 1.7; color: #334155; }
    .empty-note { font-size: 13px; color: #94a3b8; font-style: italic; margin: 4px 0 0; }
    .apply-block { margin-top: 14px; page-break-inside: avoid; }
    .apply { margin-top: 6px; }
    .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; }
    .body table { margin: 8px 0; }
    @media print {
      html, body { background: #fff; }
      .sheet { max-width: none; margin: 0; padding: 0; box-shadow: none; }
      .toc th, .auth th, .history th, .apply th, .body th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `;
}

export function buildPolicyHtml(policy: Policy) {
  const toc = [
    { no: 1, title: "Table of Contents" },
    { no: 2, title: "Document Control" },
    ...policy.sections.map((section, index) => ({ no: index + 3, title: section.title })),
  ];
  const people = getDocumentAuthorisers(policy);
  const history = buildVersionHistoryRows(policy);
  const processLabel = [policy.processCode, policy.processName].filter(Boolean).join(" · ");
  const visibility = getPolicyVisibilityScope(policy) === "general" ? "General" : "Department-specific";
  const versionLabel = formatPolicyVersionLabel(policy.version);

  const tocRows = toc
    .map(
      (item) =>
        `<tr><td style="width:42px;color:#64748b;">${item.no}</td><td>${escapeHtml(item.title)}</td></tr>`,
    )
    .join("");

  const authRows = people
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td><strong>${escapeHtml(item.name)}</strong></td>
          <td>${escapeHtml(item.role)}</td>
          <td>${item.signature ? `<span class="sig">${escapeHtml(item.signature)}</span>` : `<span class="muted">—</span>`}</td>
        </tr>
      `,
    )
    .join("");

  const historyRows = history
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.version)}</td>
          <td>${escapeHtml(row.date)}</td>
          <td>${escapeHtml(row.approvedBy)}</td>
          <td>${escapeHtml(row.reason)}</td>
        </tr>
      `,
    )
    .join("");

  const sections = policy.sections
    .map((section, index) => {
      const number = index + 3;
      const rules = normalizeBusinessRules(section.businessRules);
      const content = normalizePolicyHtml(section.content);
      const rulesHtml = rules.length
        ? `<ol class="rule-list">${rules
            .map(
              (rule, ruleIndex) => `
            <li class="rule">
              <div class="rule-no">${number}.${ruleIndex + 1}</div>
              <div class="rule-text">${escapeHtml(rule)}</div>
            </li>
          `,
            )
            .join("")}</ol>`
        : `<p class="empty-note">No business rules added</p>`;
      const applications = normalizeApplyToApplications(section.applyToApplications);
      const applyHtml = applications.length
        ? `<table class="apply">
            <thead><tr><th style="width:42px;">No.</th><th>Application</th></tr></thead>
            <tbody>
              ${applications
                .map(
                  (application, appIndex) =>
                    `<tr><td style="width:42px;color:#64748b;">${appIndex + 1}</td><td><strong>${escapeHtml(application.name)}</strong></td></tr>`,
                )
                .join("")}
            </tbody>
          </table>`
        : `<p class="empty-note">No applications selected</p>`;
      return `
        <section class="section">
          <h2><span class="num">${number}.</span>${escapeHtml(section.title)}</h2>
          <div class="topic-tree">
            ${htmlHasText(content) ? `<div class="body">${content}</div>` : `<p class="empty-note">No topic content</p>`}
            <p class="rules-label">Business Rules</p>
            ${rulesHtml}
            <div class="apply-block">
              <p class="rules-label">Apply to</p>
              ${applyHtml}
            </div>
          </div>
        </section>
      `;
    })
    .join("");

  return `
    <div class="sheet">
      <header class="header">
        <div>
          <p class="kicker">Policy document</p>
          <h1 class="title">${escapeHtml(buildPolicyDocumentCode(policy))}</h1>
          <dl class="meta">
            <div class="meta-row"><dt>Company</dt><dd>${escapeHtml(formatPolicyCompaniesLabel(policy))}</dd></div>
            <div class="meta-row"><dt>Department</dt><dd>${escapeHtml(policy.departmentName || "—")}</dd></div>
            <div class="meta-row"><dt>Visibility</dt><dd>${visibility}</dd></div>
            <div class="meta-row"><dt>Version</dt><dd>v${escapeHtml(versionLabel)}</dd></div>
          </dl>
        </div>
        <img class="logo" src="${absoluteAssetUrl("logo.png")}" alt="NEWEAST" />
      </header>

      <section class="block">
        <h2><span class="num">1.</span>Table of Contents</h2>
        <table class="toc">
          <thead><tr><th style="width:42px;">No.</th><th>Contents</th></tr></thead>
          <tbody>${tocRows}</tbody>
        </table>
      </section>

      <section class="block">
        <h2><span class="num">2.</span>Document Control</h2>
        <dl class="doc-name">
          <dt>Document name</dt>
          <dd>${escapeHtml(policy.name)}</dd>
        </dl>
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#1e293b;">Authorisation</p>
        <table class="auth">
          <thead>
            <tr>
              <th>Role</th>
              <th>Name</th>
              <th>Title</th>
              <th>Signature</th>
            </tr>
          </thead>
          <tbody>${authRows}</tbody>
        </table>
        <p style="margin:16px 0 18px;font-size:13px;">
          <strong>Distribution list:</strong> ${escapeHtml(buildDistributionList(policy))}
        </p>
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#1e293b;">Version history</p>
        <table class="history">
          <thead>
            <tr>
              <th>Version</th>
              <th>Date</th>
              <th>Approved By</th>
              <th>Changes &amp; Reason for Change</th>
            </tr>
          </thead>
          <tbody>${historyRows}</tbody>
        </table>
        ${
          policy.publishedAt
            ? `<p style="margin:10px 0 0;font-size:11px;color:#64748b;">Effective date: ${formatDocumentDate(policy.publishedAt)}</p>`
            : ""
        }
      </section>

      ${
        processLabel
          ? `<p style="margin:0 0 18px;font-size:12.5px;"><strong>Linked process:</strong> ${escapeHtml(processLabel)}</p>`
          : ""
      }

      ${sections}

      <div class="footer">
        Confidential · Internal use only · © NEWEAST · Version ${escapeHtml(versionLabel)}
      </div>
    </div>
  `;
}

function buildPrintDocument(policy: Policy) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(buildPolicyDocumentCode(policy))}</title>
  <style>${printStyles()}</style>
</head>
<body>
  ${buildPolicyHtml(policy)}
</body>
</html>`;
}

function openPrintFrame(html: string, autoPrint: boolean) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    throw new Error("Unable to open print preview");
  }
  doc.open();
  doc.write(html);
  doc.close();
  const finish = () => {
    if (autoPrint) {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    }
    window.setTimeout(() => frame.remove(), autoPrint ? 60_000 : 1_000);
  };
  const images = Array.from(doc.images);
  if (images.length === 0) {
    window.setTimeout(finish, 250);
    return;
  }
  Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }
          image.onload = () => resolve();
          image.onerror = () => resolve();
        }),
    ),
  ).then(() => window.setTimeout(finish, 150));
}

export async function downloadPolicyPdf(policy: Policy) {
  openPrintFrame(buildPrintDocument(policy), true);
}

export function openPolicyInBrowser(policy: Policy) {
  const html = buildPrintDocument(policy);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function renderPolicyDocument(policy: Policy) {
  return buildPolicyHtml(policy);
}
