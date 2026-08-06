import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { buildPolicyAppendixHtml } from "./policy-document-appendix";
import { absoluteAssetUrl } from "./utils";
import type { Policy } from "./types";

function buildPolicyHtml(policy: Policy) {
  const sections = policy.sections
    .map(
      (section, index) => `
      <section style="margin-bottom: 18px;">
        <h2 style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
          <span style="color: #dc2626; font-size: 11px;">${String(index + 1).padStart(2, "0")}</span>
          ${section.title}
        </h2>
        <div class="policy-body" style="font-size: 13px; line-height: 1.6; color: #334155;">
          ${section.content}
        </div>
      </section>
    `,
    )
    .join("");

  const appendix = buildPolicyAppendixHtml(policy);

  return `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 680px; margin: 0 auto; padding: 28px 32px; background: white; color: #0f172a;">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
        <div style="min-width: 0;">
          <h1 style="font-size: 16px; font-weight: 700; margin: 0; color: #0f172a; line-height: 1.35;">${policy.name}</h1>
          <p style="font-size: 11px; color: #64748b; margin: 8px 0 0;">
            ${policy.companyName} · ${policy.departmentName} · Version ${policy.version}
          </p>
        </div>
        <img src="${absoluteAssetUrl("logo.png")}" alt="NEWEAST" style="height: 28px; width: auto; object-fit: contain; flex-shrink: 0;" />
      </div>
      <style>
        .policy-body img { max-height: 48px; max-width: 160px; object-fit: contain; margin: 8px 0; }
        .policy-body p { margin: 0 0 8px; }
        .policy-body h1, .policy-body h2, .policy-body h3 { font-size: 13px; margin: 0 0 6px; }
      </style>
      ${sections}
      ${appendix}
      <div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 10px; color: #94a3b8;">
        Confidential Policy Document · © NEWEAST
      </div>
    </div>
  `;
}

export async function downloadPolicyPdf(policy: Policy) {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px";
  container.innerHTML = buildPolicyHtml(policy);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${policy.name.replace(/[^a-z0-9-_ ]/gi, "_")}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

export function openPolicyInBrowser(policy: Policy) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${policy.name}</title>
  <style>
    * { user-select: none !important; -webkit-user-select: none !important; }
    body { margin: 0; background: #f8fafc; }
  </style>
</head>
<body class="no-copy">
  ${buildPolicyHtml(policy)}
  <script>
    ['copy','cut','paste','contextmenu','selectstart','dragstart'].forEach(function(evt) {
      document.addEventListener(evt, function(e) { e.preventDefault(); return false; });
    });
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && ['c','x','a','s','p','u'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    });
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function renderPolicyDocument(policy: Policy) {
  return buildPolicyHtml(policy);
}
