import { ALL_POLICY_COMPANIES } from "./company-catalog.js";
import type { CompanyRow } from "./hana.js";
import { getBiUserByEmail, getBiUserByIdentifier, normalizeEmail } from "./bi-users.js";
import type { BiUser } from "./bi-users.js";

export function isBusinessItDepartment(departmentName: string) {
  const normalized = departmentName.trim().toUpperCase();
  if (!normalized) return false;
  if (normalized.includes("BUSINESS SYSTEM")) return true;
  if (normalized.includes("BUSINESS & IT")) return true;
  if (normalized.includes("BUSINESS AND IT")) return true;
  return false;
}

export async function isBusinessItCreator(email: string): Promise<boolean> {
  const { resolveViewerContext } = await import("./policy-access.js");
  const context = await resolveViewerContext(email);
  return context.scopes.some((scope) => isBusinessItDepartment(scope.departmentName));
}

export function catalogCompaniesAsRows(): CompanyRow[] {
  return ALL_POLICY_COMPANIES.map((company) => ({
    USER_ID: "",
    USER_NAME: "",
    BRANCH: company.code,
    COMPANY: company.name,
    LEGISLATIONCODE: "",
  }));
}

export function mergeCompanyRows(primary: CompanyRow[], extra: CompanyRow[]): CompanyRow[] {
  const seen = new Set<string>();
  const merged: CompanyRow[] = [];
  for (const row of [...primary, ...extra]) {
    const code = String(row.BRANCH ?? "").trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    merged.push(row);
  }
  return merged;
}

export function guruEmail() {
  return normalizeEmail(process.env.POLICY_GURU_EMAIL?.trim() || "guru@neweast.com");
}

export function guruUserId() {
  return process.env.POLICY_GURU_USER_ID?.trim() || "SAP02";
}

export async function resolveGuruApprover(companyCode: string): Promise<BiUser | null> {
  const fallbackSchema = process.env.SAP_HANA_SCHEMA?.trim() || "BI_NEGT";
  const schemas = [...new Set([companyCode.trim(), fallbackSchema].filter(Boolean))];
  const email = guruEmail();
  const userId = guruUserId();

  for (const schema of schemas) {
    const byEmail = await getBiUserByEmail(email, schema);
    if (byEmail) return byEmail;
    const byId = await getBiUserByIdentifier(userId, schema);
    if (byId) return byId;
  }

  return null;
}
