import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StoredPolicy } from "./workflow-types.js";
import { getPolicyCompanies, normalizePolicyCompanies } from "./policy-companies.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "policies.json");

function migratePolicy(raw: Partial<StoredPolicy> & { id: string }): StoredPolicy {
  const now = new Date().toISOString();
  const companies = normalizePolicyCompanies(raw.companies, {
    companyCode: raw.companyCode ?? "",
    companyName: raw.companyName ?? "",
  });
  const primary = companies[0];

  return {
    id: raw.id,
    name: raw.name ?? "Untitled Policy",
    companyCode: primary?.companyCode ?? raw.companyCode ?? "",
    companyName: primary?.companyName ?? raw.companyName ?? "",
    companies,
    visibilityScope: raw.visibilityScope === "general" ? "general" : "department",
    policyFamilyId: String(raw.policyFamilyId ?? raw.id ?? "").trim() || raw.id,
    parentPolicyId: raw.parentPolicyId ? String(raw.parentPolicyId).trim() : undefined,
    isActive: raw.isActive !== false,
    deactivatedAt: raw.deactivatedAt,
    deactivatedReason: raw.deactivatedReason,
    departmentCode: Number(raw.departmentCode ?? 0),
    departmentName: raw.departmentName ?? "",
    businessRole: raw.businessRole ?? "",
    sections: (raw.sections ?? []).map((section) => ({
      ...section,
      businessRules: Array.isArray(section.businessRules)
        ? section.businessRules.map((rule) => String(rule ?? "").trim()).filter(Boolean)
        : [],
      applyToApplications: Array.isArray(section.applyToApplications)
        ? section.applyToApplications
            .map((item) => ({
              id: String(item?.id ?? "").trim(),
              name: String(item?.name ?? "").trim(),
            }))
            .filter((item) => item.id && item.name)
        : [],
    })),
    version: Number(raw.version ?? 1),
    status: raw.status ?? "draft",
    createdByEmail: raw.createdByEmail ?? "",
    createdByName: raw.createdByName ?? "",
    sharedWith: raw.sharedWith ?? [],
    approvalSteps: raw.approvalSteps ?? [],
    comments: raw.comments ?? [],
    pendingMatrixChange: raw.pendingMatrixChange ?? null,
    pendingSetupRefresh: raw.pendingSetupRefresh ?? null,
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
    submittedAt: raw.submittedAt,
    approvedAt: raw.approvedAt,
    publishedAt: raw.publishedAt,
  };
}

async function readAll(): Promise<StoredPolicy[]> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Array<Partial<StoredPolicy> & { id: string }>;
    return (parsed ?? []).map(migratePolicy);
  } catch {
    return [];
  }
}

async function writeAll(policies: StoredPolicy[]) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(policies, null, 2), "utf8");
}

export async function listPolicies(filters?: {
  companyCode?: string;
  departmentCode?: number;
}) {
  let policies = await readAll();
  if (filters?.companyCode) {
    policies = policies.filter((item) =>
      getPolicyCompanies(item).some((company) => company.companyCode === filters.companyCode),
    );
  }
  if (filters?.departmentCode) {
    policies = policies.filter((item) => item.departmentCode === filters.departmentCode);
  }
  return policies.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function getPolicyById(id: string) {
  const policies = await readAll();
  const policy = policies.find((item) => item.id === id);
  return policy ? migratePolicy(policy) : null;
}

export async function savePolicy(input: StoredPolicy) {
  const policies = await readAll();
  const policy = migratePolicy(input);
  const index = policies.findIndex((item) => item.id === policy.id);
  if (index >= 0) policies[index] = policy;
  else policies.unshift(policy);
  await writeAll(policies);
  return policy.id;
}

export async function deletePolicy(id: string) {
  const policies = await readAll();
  await writeAll(policies.filter((item) => item.id !== id));
}

export async function ensurePolicyStore() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(DATA_FILE, "utf8");
  } catch {
    await writeAll([]);
  }
}

export type { StoredPolicy };
