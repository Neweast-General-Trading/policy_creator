import { fetchCompanies } from "./hana.js";
import { getBiUserByEmail, normalizeEmail } from "./bi-users.js";
import type { StoredPolicy } from "./workflow-types.js";
import {
  getPolicyCompanies,
  normalizePolicyCompanies,
  policyVisibleToScope,
} from "./policy-companies.js";

export interface ViewerScope {
  companyCode: string;
  companyName: string;
  departmentCode: number;
  departmentName: string;
}

export interface ViewerContext {
  email: string;
  scopes: ViewerScope[];
  isGlobalViewer: boolean;
}

const viewerCache = new Map<string, { expiresAt: number; context: ViewerContext }>();
const VIEWER_CACHE_TTL_MS = 5 * 60 * 1000;

function parseGlobalDeptCodes() {
  const raw = process.env.GLOBAL_VIEW_DEPT_CODES?.trim();
  if (!raw) {
    const auditCode = Number(process.env.AUDIT_DEPT_CODE ?? 4);
    return Number.isFinite(auditCode) ? [auditCode] : [];
  }
  return raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
}

function departmentMatchesKeyword(departmentName: string, keyword: string) {
  const normalized = departmentName.trim().toUpperCase();
  const key = keyword.trim().toUpperCase();
  if (!normalized || !key) return false;
  if (normalized === key) return true;

  if (key.length <= 3) {
    return new RegExp(`(^|[\\s/\\-])${key}($|[\\s/\\-])`).test(normalized);
  }

  return normalized.includes(key);
}

function isGlobalViewerDepartment(departmentName: string, departmentCode: number) {
  const codes = parseGlobalDeptCodes();
  if (codes.includes(Number(departmentCode))) return true;

  const keywords = (process.env.GLOBAL_VIEW_DEPT_NAMES ?? "HR,AUDIT,IT")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return keywords.some((keyword) => departmentMatchesKeyword(departmentName, keyword));
}

export async function resolveViewerContext(email: string): Promise<ViewerContext> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { email: "", scopes: [], isGlobalViewer: false };
  }

  const cached = viewerCache.get(normalizedEmail);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.context;
  }

  const scopes: ViewerScope[] = [];
  let isGlobalViewer = false;

  try {
    const companies = await fetchCompanies(normalizedEmail);
    for (const company of companies) {
      const profile = await getBiUserByEmail(normalizedEmail, company.BRANCH);
      if (!profile) continue;

      scopes.push({
        companyCode: company.BRANCH,
        companyName: company.COMPANY?.trim() || company.BRANCH,
        departmentCode: Number(profile.DEPTCODE),
        departmentName: profile.DEPARTMENT?.trim() || "",
      });

      if (isGlobalViewerDepartment(profile.DEPARTMENT, profile.DEPTCODE)) {
        isGlobalViewer = true;
      }
    }
  } catch (error) {
    console.error("[policy-access] Failed to resolve viewer context:", error);
  }

  const context: ViewerContext = {
    email: normalizedEmail,
    scopes,
    isGlobalViewer,
  };

  viewerCache.set(normalizedEmail, {
    context,
    expiresAt: Date.now() + VIEWER_CACHE_TTL_MS,
  });

  return context;
}

export function canUserViewPolicy(
  policy: StoredPolicy,
  email: string,
  context?: ViewerContext | null,
) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  if (normalizeEmail(policy.createdByEmail) === normalized) return true;
  if (policy.sharedWith.map(normalizeEmail).includes(normalized)) return true;
  if (
    policy.approvalSteps.some(
      (step) => normalizeEmail(step.assigneeEmail) === normalized,
    )
  ) {
    return true;
  }

  if (context?.isGlobalViewer) return true;

  if (context?.scopes?.length) {
    return context.scopes.some((scope) => policyVisibleToScope(policy, scope));
  }

  return false;
}

export function buildViewerScopeLabel(context: ViewerContext) {
  if (context.isGlobalViewer) {
    return "HR / Audit / IT — all policies";
  }

  if (context.scopes.length === 0) {
    return "Limited access — policies you created or approve";
  }

  if (context.scopes.length === 1) {
    const scope = context.scopes[0];
    return `${scope.departmentName || "Your department"} · ${scope.companyName}`;
  }

  const departments = [...new Set(context.scopes.map((scope) => scope.departmentName).filter(Boolean))];
  const companies = [...new Set(context.scopes.map((scope) => scope.companyName).filter(Boolean))];
  return `${departments.join(", ") || "Your departments"} · ${companies.join(", ")}`;
}
