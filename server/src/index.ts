import "dotenv/config";
import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import { verifyAzureAccessToken, exchangeSharedAppToken, signAppToken } from "./auth.js";
import { verifyIntranetLinkOtp } from "./bi-users.js";
import { requireAuth, requirePolicyCreatorApp, requirePolicyViewerPortal } from "./auth-middleware.js";
import {
  hasPolicyCreatorMenuAccess,
  hasPolicyViewerPortalAccess,
} from "./policy-creator-access.js";
import { canDeleteAnyPolicy, canDeletePolicy } from "./policy-delete-access.js";
import { normalizePolicyCompanies } from "./policy-companies.js";
import {
  canCreateNewVersionFrom,
  canDeactivatePolicy,
  clonePolicyForNewVersion,
  deactivatePolicyRecord,
  getNextFamilyVersion,
  resolvePolicyFamilyId,
} from "./policy-family.js";
import {
  buildLoginErrorRedirect,
  buildMicrosoftLoginUrl,
  completeMicrosoftLogin,
  consumeMicrosoftLogin,
  sanitizeReturnTo,
} from "./microsoft-oauth.js";
import {
  deleteApprovalSetup,
  ensureApprovalSetupStore,
  getApprovalSetupById,
  listApprovalSetups,
  newApprovalSetupId,
  saveApprovalSetup,
} from "./approval-setup-store.js";
import {
  canManageApprovalSetup,
  previewDepartmentEmployees,
} from "./approval-setup-access.js";
import { notifyPoliciesOnApprovalSetupChange } from "./approval-setup-change.js";
import { normalizeSetupCompanies } from "./approval-setup-companies.js";
import type { PolicyApprovalSetup, SubmitterLevelMode } from "./approval-setup-types.js";
import { fetchDepartments, resolveCompaniesForUser } from "./hana.js";
import {
  deletePolicy,
  ensurePolicyStore,
  getPolicyById,
  listPolicies,
  savePolicy,
} from "./policies-store.js";
import {
  deleteTemplate,
  ensureTemplateStore,
  getTemplateById,
  listTemplates,
  saveTemplate,
} from "./templates-store.js";
import { parseWordDocument } from "./word-parser.js";
import type { StoredTemplate } from "./template-types.js";
import { mapPolicy } from "./policy-mapper.js";
import type { StoredPolicy } from "./workflow-types.js";
import { getDefaultSubmitterLevelMode } from "./approval-chain-builder.js";
import {
  approveMatrixChange,
  canProposeMatrixChange,
  canReviewMatrixChange,
  proposeMatrixChange,
  rejectMatrixChange,
} from "./matrix-change.js";
import {
  addPolicyComment,
  approvePolicyStep,
  buildApprovalChain,
  canUserApprovePolicy,
  canUserEditPolicy,
  escalatePolicyStep,
  getEscalationTargetsForPolicy,
  getEscalationTargetsForUser,
  grantPolicyAccess,
  getCurrentApprovers,
  notifyNextApprovers,
  publishPolicy,
  refreshPolicyApprovalFromSetup,
  canRefreshPolicyFromSetup,
  rejectPolicyStep,
  submitPolicyForApproval,
} from "./workflow.js";
import {
  buildViewerScopeLabel,
  canUserViewPolicy,
  resolveViewerContext,
  type ViewerContext,
} from "./policy-access.js";
import {
  listProcessFunctionsForDepartment,
  listProcessesForFunction,
  listSubProcessesForProcess,
} from "./bpm-catalog.js";
import { searchCompanyEmployees } from "./bi-users.js";
import { answerPolicyQuestion } from "./policy-chat.js";
import type { AdditionalApproverInput } from "./workflow-types.js";

const app = express();
const port = Number(process.env.PORT ?? 4025);

app.use(
  cors({
    origin: [
      "https://policycreator.neweast.cloud",
      "http://policycreator.neweast.cloud",
      "https://mis.neweast.cloud",
      "http://mis.neweast.cloud",
      "http://localhost:5181",
      "http://127.0.0.1:5181",
    ],
  }),
);
app.use(express.json({ limit: "5mb" }));

function getUserEmail(req: express.Request) {
  return req.user?.email?.trim() ?? "";
}

function getUserName(req: express.Request) {
  return req.user?.name?.trim() || getUserEmail(req);
}

function parseSubProcesses(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      id: String(item?.id ?? "").trim(),
      code: String(item?.code ?? "").trim(),
      name: String(item?.name ?? "").trim(),
    }))
    .filter((item) => item.id && item.name);
}

function applyBpmFields(
  body: Record<string, unknown>,
  existing?: StoredPolicy,
): Pick<
  StoredPolicy,
  | "bpmDepartmentId"
  | "bpmDepartmentName"
  | "processId"
  | "processCode"
  | "processName"
  | "subProcesses"
> {
  return {
    bpmDepartmentId:
      body.bpmDepartmentId !== undefined
        ? String(body.bpmDepartmentId || "").trim() || undefined
        : existing?.bpmDepartmentId,
    bpmDepartmentName:
      body.bpmDepartmentName !== undefined
        ? String(body.bpmDepartmentName || "").trim() || undefined
        : existing?.bpmDepartmentName,
    processId:
      body.processId !== undefined
        ? String(body.processId || "").trim() || undefined
        : existing?.processId,
    processCode:
      body.processCode !== undefined
        ? String(body.processCode || "").trim() || undefined
        : existing?.processCode,
    processName:
      body.processName !== undefined
        ? String(body.processName || "").trim() || undefined
        : existing?.processName,
    subProcesses:
      body.subProcesses !== undefined
        ? parseSubProcesses(body.subProcesses)
        : existing?.subProcesses ?? [],
  };
}

function parseSubmitterLevelMode(value: unknown): SubmitterLevelMode {
  if (value === "one" || value === "top" || value === "all") return value;
  return "all";
}

function parseAdditionalApprovers(value: unknown): AdditionalApproverInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      groupOrder: Number(item?.groupOrder),
      assigneeEmail: String(item?.assigneeEmail ?? "").trim(),
      assigneeName: String(item?.assigneeName ?? "").trim(),
      assigneeUserId: item?.assigneeUserId
        ? String(item.assigneeUserId).trim()
        : undefined,
    }))
    .filter(
      (item) =>
        Number.isFinite(item.groupOrder) &&
        item.groupOrder >= 1 &&
        item.assigneeEmail.length > 0,
    );
}

function parseMatrixChanges(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      stepId: String(item?.stepId ?? "").trim(),
      assigneeEmail: String(item?.assigneeEmail ?? "").trim(),
      assigneeName: String(item?.assigneeName ?? "").trim(),
      assigneeUserId: item?.assigneeUserId
        ? String(item.assigneeUserId).trim()
        : undefined,
    }))
    .filter((item) => item.stepId && item.assigneeEmail);
}

async function getAccessiblePolicy(id: string, email: string, context?: ViewerContext | null) {
  const policy = await getPolicyById(id);
  if (!policy) return null;
  const viewerContext = context ?? (await resolveViewerContext(email));
  if (!canUserViewPolicy(policy, email, viewerContext)) return undefined;
  return policy;
}

async function getViewerAccessiblePolicy(
  id: string,
  email: string,
  context?: ViewerContext | null,
) {
  const policy = await getAccessiblePolicy(id, email, context);
  if (!policy) return policy;
  if (policy.status !== "published") return null;
  if (policy.isActive === false) return null;
  return policy;
}

function filterViewerPolicies(
  policies: StoredPolicy[],
  email: string,
  context: ViewerContext,
) {
  return policies.filter(
    (policy) =>
      policy.status === "published" &&
      policy.isActive !== false &&
      canUserViewPolicy(policy, email, context),
  );
}

function isViewersReturnTo(returnTo?: string) {
  try {
    const url = new URL(sanitizeReturnTo(returnTo));
    const normalized = url.pathname.replace(/\/+$/, "") || "/";
    return normalized === "/viewer";
  } catch {
    return false;
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "policy-creator-api" });
});

app.post("/api/auth/azure", async (req, res) => {
  try {
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    if (!token) {
      res.status(400).json({ error: "token is required" });
      return;
    }

    const result = await verifyAzureAccessToken(token);
    res.json({
      success: true,
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(401).json({ error: message });
  }
});

app.get("/api/auth/profile", requireAuth, (req, res) => {
  res.json({
    user: req.user,
    email: req.user?.email,
    name: req.user?.name,
    isAuthenticated: true,
  });
});

app.post("/api/auth/sso", async (req, res) => {
  try {
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    if (!token) {
      res.status(400).json({ error: "token is required" });
      return;
    }

    const result = exchangeSharedAppToken(token);
    res.json({
      success: true,
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(401).json({ error: message });
  }
});

app.post("/api/auth/intranet-link", async (req, res) => {
  try {
    const userId =
      typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
    const otp =
      req.body?.otp != null && String(req.body.otp).trim()
        ? String(req.body.otp).trim()
        : "";
    const companyCode =
      typeof req.body?.companyCode === "string"
        ? req.body.companyCode.trim()
        : "";

    if (!userId || !otp || !companyCode) {
      res.status(400).json({ error: "userId, otp, and companyCode are required" });
      return;
    }

    const biUser = await verifyIntranetLinkOtp(userId, otp, companyCode);
    if (!biUser) {
      res.status(401).json({ error: "Invalid Intranet login link" });
      return;
    }

    const email = biUser.USER_EMAIL?.trim();
    if (!email) {
      res.status(401).json({ error: "User email not found" });
      return;
    }

    const user = {
      email,
      name:
        biUser.EMP_FULLNAME?.trim() ||
        biUser.USER_NAME?.trim() ||
        email,
      authSource: "intranet" as const,
    };

    res.json({
      success: true,
      token: signAppToken(user, "intranet"),
      user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(401).json({ error: message });
  }
});

app.get("/api/auth/microsoft/login", (req, res) => {
  const returnTo =
    typeof req.query.returnTo === "string" ? req.query.returnTo : undefined;
  if (isViewersReturnTo(returnTo)) {
    res.redirect(
      buildLoginErrorRedirect(
        "Policy Viewer requires Intranet login",
        returnTo,
      ),
    );
    return;
  }
  const silent = req.query.silent === "1" || req.query.silent === "true";
  const loginHint =
    typeof req.query.login_hint === "string" ? req.query.login_hint : undefined;
  res.redirect(buildMicrosoftLoginUrl(returnTo ?? "", { silent, loginHint }));
});

app.get("/api/auth/microsoft/callback", async (req, res) => {
  const returnTo =
    typeof req.query.returnTo === "string" ? req.query.returnTo : undefined;
  const error =
    typeof req.query.error === "string" ? req.query.error : undefined;
  const errorDescription =
    typeof req.query.error_description === "string"
      ? req.query.error_description
      : undefined;
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;

  if (error) {
    const pending = state ? consumeMicrosoftLogin(state) : null;
    const safeReturnTo = pending?.returnTo ?? returnTo;
    const silentRetryErrors = new Set([
      "login_required",
      "interaction_required",
      "consent_required",
    ]);

    if (pending?.silent && silentRetryErrors.has(error)) {
      res.redirect(buildMicrosoftLoginUrl(safeReturnTo ?? "", { silent: false }));
      return;
    }

    res.redirect(buildLoginErrorRedirect(errorDescription || error, safeReturnTo));
    return;
  }

  if (!code || !state) {
    res.redirect(buildLoginErrorRedirect("Missing Microsoft login code", returnTo));
    return;
  }

  try {
    const { accessToken, returnTo: safeReturnTo } = await completeMicrosoftLogin(
      code,
      state,
    );
    if (isViewersReturnTo(safeReturnTo)) {
      res.redirect(
        buildLoginErrorRedirect(
          "Policy Viewer requires Intranet login",
          safeReturnTo,
        ),
      );
      return;
    }
    const result = await verifyAzureAccessToken(accessToken);
    const redirectUrl = new URL(sanitizeReturnTo(safeReturnTo));
    redirectUrl.hash = [
      `token=${encodeURIComponent(result.token)}`,
      `email=${encodeURIComponent(result.user.email)}`,
      `name=${encodeURIComponent(result.user.name)}`,
    ].join("&");
    res.redirect(redirectUrl.toString());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Microsoft login failed";
    console.error("[Microsoft OAuth]", message);
    res.redirect(buildLoginErrorRedirect(message, returnTo));
  }
});

app.use("/api", requireAuth);

app.get("/api/access", async (req, res) => {
  try {
    const email = req.user?.email?.trim() ?? "";
    const [policyCreator, policyViewer, canManageIt] = await Promise.all([
      hasPolicyCreatorMenuAccess(email),
      hasPolicyViewerPortalAccess(email),
      canManageApprovalSetup(email),
    ]);

    res.json({
      policyCreator,
      policyViewer,
      canDeleteAnyPolicy: canDeleteAnyPolicy(email),
      canDeactivateAnyPolicy: canManageIt,
      authSource: req.user?.authSource ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.use("/api", requirePolicyCreatorApp);

app.get("/api/companies", async (req, res) => {
  try {
    const queryEmail =
      typeof req.query.email === "string" ? req.query.email.trim() : "";
    const candidates = [
      queryEmail,
      req.user?.email?.trim() ?? "",
      req.user?.preferred_username?.trim() ?? "",
      process.env.DEFAULT_BI_EMAIL?.trim() ?? "",
    ];

    const { companies } = await resolveCompaniesForUser(candidates);
    res.json({
      result: companies.map((row) => ({
        USER_ID: row.USER_ID,
        USER_NAME: row.USER_NAME,
        BRANCH: row.BRANCH,
        COMPANY: row.COMPANY,
        LEGISLATIONCODE: row.LEGISLATIONCODE,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/departments", async (req, res) => {
  try {
    const companyCode =
      typeof req.query.companyCode === "string" && req.query.companyCode.trim()
        ? req.query.companyCode.trim()
        : process.env.SAP_HANA_SCHEMA || "BI_NEGT";

    const departments = await fetchDepartments(companyCode);
    res.json(
      departments.map((dept) => ({
        code: dept.DEPTCODE,
        name: dept.DEPARTMENT?.trim() ?? "",
      })),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/bpm/processes", async (req, res) => {
  try {
    const companyCode = String(req.query.companyCode ?? "").trim();
    const departmentName = String(req.query.departmentName ?? "").trim();
    if (!companyCode || !departmentName) {
      res.status(400).json({ error: "companyCode and departmentName are required" });
      return;
    }

    const functions = await listProcessFunctionsForDepartment(companyCode, departmentName);
    const processFunction = functions[0] ?? null;
    const processes = processFunction
      ? await listProcessesForFunction(processFunction.id)
      : [];

    res.json({
      processFunction,
      processes: processes.map((process) => ({
        id: process.id,
        code: process.code,
        name: process.processName || process.name,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/bpm/processes/:processId/sub-processes", async (req, res) => {
  try {
    const subProcesses = await listSubProcessesForProcess(req.params.processId);
    res.json(
      subProcesses.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.activityName,
        parentActivityId: item.parentActivityId,
      })),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/employees", async (req, res) => {
  try {
    const companyCode = String(req.query.companyCode ?? "").trim();
    const query = String(req.query.q ?? "").trim();
    if (!companyCode) {
      res.status(400).json({ error: "companyCode is required" });
      return;
    }

    const departmentCode =
      typeof req.query.departmentCode === "string" && req.query.departmentCode.trim()
        ? Number(req.query.departmentCode)
        : undefined;

    const rows = await searchCompanyEmployees(
      companyCode,
      query,
      40,
      Number.isFinite(departmentCode) ? departmentCode : undefined,
    );
    res.json(
      rows.map((row) => ({
        userId: row.USER_ID,
        name: row.EMP_FULLNAME || row.USER_NAME,
        email: row.USER_EMAIL,
        department: row.DEPARTMENT,
      })),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.post("/api/policies/approval-preview", async (req, res) => {
  try {
    const companyCode = String(req.body?.companyCode ?? "").trim();
    const departmentCode = Number(req.body?.departmentCode);
    const departmentName = String(req.body?.departmentName ?? "").trim();
    const additionalApprovers = parseAdditionalApprovers(req.body?.additionalApprovers);

    if (!companyCode || !Number.isFinite(departmentCode)) {
      res.status(400).json({ error: "companyCode and departmentCode are required" });
      return;
    }

    const steps = await buildApprovalChain(
      getUserEmail(req),
      getUserName(req),
      companyCode,
      departmentCode,
      additionalApprovers,
      departmentName,
      parseSubmitterLevelMode(req.body?.submitterLevelMode),
    );

    const defaultSubmitterLevelMode = await getDefaultSubmitterLevelMode(
      companyCode,
      departmentCode,
      departmentName,
    );

    res.json({ steps, defaultSubmitterLevelMode });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/approval-setup/access", async (req, res) => {
  try {
    const canManage = await canManageApprovalSetup(getUserEmail(req));
    res.json({ canManage });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/approval-setup", async (req, res) => {
  try {
    if (!(await canManageApprovalSetup(getUserEmail(req)))) {
      res.status(403).json({ error: "Only IT can manage approval setup" });
      return;
    }
    const companyCode =
      typeof req.query.companyCode === "string" ? req.query.companyCode.trim() : undefined;
    const sourceDepartmentCode =
      typeof req.query.sourceDepartmentCode === "string"
        ? Number(req.query.sourceDepartmentCode)
        : undefined;
    const setups = await listApprovalSetups({
      companyCode,
      sourceDepartmentCode: Number.isFinite(sourceDepartmentCode)
        ? sourceDepartmentCode
        : undefined,
    });
    res.json(setups);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/approval-setup/department-employees", async (req, res) => {
  try {
    if (!(await canManageApprovalSetup(getUserEmail(req)))) {
      res.status(403).json({ error: "Only IT can manage approval setup" });
      return;
    }
    const companyCode = String(req.query.companyCode ?? "").trim();
    const departmentCode = Number(req.query.departmentCode);
    if (!companyCode || !Number.isFinite(departmentCode)) {
      res.status(400).json({ error: "companyCode and departmentCode are required" });
      return;
    }
    res.json(await previewDepartmentEmployees(companyCode, departmentCode));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/approval-setup/hierarchy", async (req, res) => {
  try {
    if (!(await canManageApprovalSetup(getUserEmail(req)))) {
      res.status(403).json({ error: "Only IT can manage approval setup" });
      return;
    }
    const companyCode = String(req.query.companyCode ?? "").trim();
    const departmentCode = Number(req.query.departmentCode);
    if (!companyCode || !Number.isFinite(departmentCode)) {
      res.status(400).json({ error: "companyCode and departmentCode are required" });
      return;
    }
    res.json(await previewDepartmentEmployees(companyCode, departmentCode));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/approval-setup/:id", async (req, res) => {
  try {
    if (!(await canManageApprovalSetup(getUserEmail(req)))) {
      res.status(403).json({ error: "Only IT can manage approval setup" });
      return;
    }
    const setup = await getApprovalSetupById(req.params.id);
    if (!setup) {
      res.status(404).json({ error: "Approval setup not found" });
      return;
    }
    res.json(setup);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

function parseApprovalSetupBody(body: Record<string, unknown>, existing?: PolicyApprovalSetup) {
  const now = new Date().toISOString();
  const stages = Array.isArray(body.stages)
    ? body.stages
    : Array.isArray(body.downstreamStages)
      ? body.downstreamStages
      : (existing?.stages ?? []);
  const submitterLevelMode =
    body.submitterLevelMode === "one" ||
    body.submitterLevelMode === "top" ||
    body.submitterLevelMode === "all"
      ? body.submitterLevelMode
      : (existing?.submitterLevelMode ?? "all");

  const companies = normalizeSetupCompanies(
    Array.isArray(body.companies)
      ? body.companies.map((item) => {
          const row = item as { companyCode?: string; companyName?: string };
          return {
            companyCode: String(row.companyCode ?? "").trim(),
            companyName: String(row.companyName ?? "").trim(),
          };
        })
      : undefined,
    {
      companyCode: String(body.companyCode ?? existing?.companyCode ?? "").trim(),
      companyName: String(body.companyName ?? existing?.companyName ?? "").trim(),
    },
  );

  if (companies.length === 0) {
    throw new Error("Select at least one company");
  }

  const primaryCompany = companies[0];

  return {
    id: existing?.id ?? newApprovalSetupId(),
    companyCode: String(
      primaryCompany?.companyCode ?? body.companyCode ?? existing?.companyCode ?? "",
    ).trim(),
    companyName: String(
      primaryCompany?.companyName ?? body.companyName ?? existing?.companyName ?? "",
    ).trim(),
    companies,
    sourceDepartmentCode: Number(body.sourceDepartmentCode ?? existing?.sourceDepartmentCode),
    sourceDepartmentName: String(
      body.sourceDepartmentName ?? existing?.sourceDepartmentName ?? "",
    ).trim(),
    submitterLevelMode,
    hodSkipInternalLevels:
      body.hodSkipInternalLevels !== undefined
        ? Boolean(body.hodSkipInternalLevels)
        : (existing?.hodSkipInternalLevels ?? true),
    stages,
    createdByEmail: existing?.createdByEmail ?? "",
    createdByName: existing?.createdByName ?? "",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  } satisfies PolicyApprovalSetup;
}

app.post("/api/approval-setup", async (req, res) => {
  try {
    if (!(await canManageApprovalSetup(getUserEmail(req)))) {
      res.status(403).json({ error: "Only IT can manage approval setup" });
      return;
    }
    const payload = parseApprovalSetupBody(req.body ?? {});
    payload.createdByEmail = getUserEmail(req);
    payload.createdByName = getUserName(req);
    const saved = await saveApprovalSetup(payload);
    res.status(201).json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.put("/api/approval-setup/:id", async (req, res) => {
  try {
    if (!(await canManageApprovalSetup(getUserEmail(req)))) {
      res.status(403).json({ error: "Only IT can manage approval setup" });
      return;
    }
    const existing = await getApprovalSetupById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Approval setup not found" });
      return;
    }
    const payload = parseApprovalSetupBody(req.body ?? {}, existing);
    payload.id = existing.id;
    payload.createdByEmail = existing.createdByEmail;
    payload.createdByName = existing.createdByName;
    payload.createdAt = existing.createdAt;
    const saved = await saveApprovalSetup(payload);
    await notifyPoliciesOnApprovalSetupChange(existing, saved);
    res.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.delete("/api/approval-setup/:id", async (req, res) => {
  try {
    if (!(await canManageApprovalSetup(getUserEmail(req)))) {
      res.status(403).json({ error: "Only IT can manage approval setup" });
      return;
    }
    await deleteApprovalSetup(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/dashboard/summary", async (req, res) => {
  try {
    const email = getUserEmail(req);
    const context = await resolveViewerContext(email);
    const rows = await listPolicies();
    const visible = rows.filter((policy) => canUserViewPolicy(policy, email, context));

    res.json({
      myPolicies: visible.filter(
        (policy) => policy.createdByEmail.toLowerCase() === email.toLowerCase(),
      ).length,
      pendingMyApproval: visible.filter((policy) => canUserApprovePolicy(policy, email)).length,
      inApproval: visible.filter((policy) => policy.status === "in_approval").length,
      approved: visible.filter((policy) => policy.status === "approved").length,
      returned: visible.filter((policy) => policy.status === "returned").length,
      published: visible.filter((policy) => policy.status === "published").length,
      draft: visible.filter((policy) => policy.status === "draft").length,
      rejected: visible.filter((policy) => policy.status === "rejected").length,
      totalVisible: visible.length,
      viewerScope: {
        isGlobalViewer: context.isGlobalViewer,
        label: buildViewerScopeLabel(context),
        departments: context.scopes.map((scope) => ({
          companyCode: scope.companyCode,
          companyName: scope.companyName,
          departmentCode: scope.departmentCode,
          departmentName: scope.departmentName,
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/policies", async (req, res) => {
  try {
    const email = getUserEmail(req);
    const context = await resolveViewerContext(email);
    const companyCode =
      typeof req.query.companyCode === "string"
        ? req.query.companyCode.trim()
        : undefined;
    const departmentCode =
      typeof req.query.departmentCode === "string"
        ? Number(req.query.departmentCode)
        : undefined;

    const rows = await listPolicies({
      companyCode,
      departmentCode: Number.isFinite(departmentCode)
        ? departmentCode
        : undefined,
    });
    res.json(
      rows
        .filter((policy) => canUserViewPolicy(policy, email, context))
        .map(mapPolicy),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/policies/:id", async (req, res) => {
  try {
    const email = getUserEmail(req);
    const context = await resolveViewerContext(email);
    const policy = await getAccessiblePolicy(req.params.id, email, context);
    if (policy === null) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    if (policy === undefined) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    res.json(mapPolicy(policy));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.post("/api/viewers/policies/:id/ask", requirePolicyViewerPortal, async (req, res) => {
  try {
    const email = getUserEmail(req);
    const context = await resolveViewerContext(email);
    const policy = await getViewerAccessiblePolicy(req.params.id, email, context);
    if (policy === null) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    if (policy === undefined) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const question =
      typeof req.body?.question === "string" ? req.body.question.trim() : "";
    if (!question) {
      res.status(400).json({ error: "Question is required" });
      return;
    }

    const result = await answerPolicyQuestion(policy, question);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/viewers/policies", requirePolicyViewerPortal, async (req, res) => {
  try {
    const email = getUserEmail(req);
    const context = await resolveViewerContext(email);
    const companyCode =
      typeof req.query.companyCode === "string"
        ? req.query.companyCode.trim()
        : undefined;
    const departmentCode =
      typeof req.query.departmentCode === "string"
        ? Number(req.query.departmentCode)
        : undefined;

    const rows = await listPolicies({
      companyCode,
      departmentCode: Number.isFinite(departmentCode)
        ? departmentCode
        : undefined,
    });
    res.json(filterViewerPolicies(rows, email, context).map(mapPolicy));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/viewers/policies/:id", requirePolicyViewerPortal, async (req, res) => {
  try {
    const email = getUserEmail(req);
    const context = await resolveViewerContext(email);
    const policy = await getViewerAccessiblePolicy(req.params.id, email, context);
    if (policy === null) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    if (policy === undefined) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    res.json(mapPolicy(policy));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/viewers/summary", requirePolicyViewerPortal, async (req, res) => {
  try {
    const email = getUserEmail(req);
    const context = await resolveViewerContext(email);
    const rows = await listPolicies();
    const visible = filterViewerPolicies(rows, email, context);

    res.json({
      myPolicies: visible.filter(
        (policy) => policy.createdByEmail.toLowerCase() === email.toLowerCase(),
      ).length,
      pendingMyApproval: 0,
      inApproval: 0,
      approved: 0,
      returned: 0,
      published: visible.length,
      draft: 0,
      rejected: 0,
      totalVisible: visible.length,
      viewerScope: {
        isGlobalViewer: context.isGlobalViewer,
        label: buildViewerScopeLabel(context),
        departments: context.scopes.map((scope) => ({
          companyCode: scope.companyCode,
          companyName: scope.companyName,
          departmentCode: scope.departmentCode,
          departmentName: scope.departmentName,
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.post("/api/policies", async (req, res) => {
  try {
    const {
      name,
      companyCode,
      companyName,
      companies,
      visibilityScope,
      departmentCode,
      departmentName,
      sections,
      version,
    } = req.body ?? {};
    const bpmFields = applyBpmFields(req.body ?? {});

    const normalizedCompanies = normalizePolicyCompanies(
      Array.isArray(companies)
        ? companies.map((item: { companyCode?: string; companyName?: string }) => ({
            companyCode: String(item.companyCode ?? "").trim(),
            companyName: String(item.companyName ?? "").trim(),
          }))
        : undefined,
      {
        companyCode: String(companyCode ?? "").trim(),
        companyName: String(companyName ?? "").trim(),
      },
    );

    if (
      !name ||
      normalizedCompanies.length === 0 ||
      !departmentCode ||
      !departmentName ||
      !Array.isArray(sections)
    ) {
      res.status(400).json({ error: "Missing required policy fields" });
      return;
    }

    const primary = normalizedCompanies[0];
    const now = new Date().toISOString();
    const policyId = randomUUID();
    const policy: StoredPolicy = {
      id: policyId,
      name: String(name).trim(),
      companyCode: primary.companyCode,
      companyName: primary.companyName,
      companies: normalizedCompanies,
      visibilityScope: visibilityScope === "general" ? "general" : "department",
      policyFamilyId: policyId,
      isActive: true,
      departmentCode: Number(departmentCode),
      departmentName: String(departmentName),
      ...bpmFields,
      sections,
      version: Number(version ?? 1),
      status: "draft",
      createdByEmail: getUserEmail(req),
      createdByName: getUserName(req),
      sharedWith: [],
      approvalSteps: [],
      comments: [],
      createdAt: now,
      updatedAt: now,
    };

    await savePolicy(policy);
    res.status(201).json(mapPolicy(policy));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.put("/api/policies/:id", async (req, res) => {
  try {
    const existing = await getAccessiblePolicy(req.params.id, getUserEmail(req));
    if (existing === null) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    if (existing === undefined || !canUserEditPolicy(existing, getUserEmail(req))) {
      res.status(403).json({ error: "You cannot edit this policy in its current state" });
      return;
    }

    const {
      name,
      companyCode,
      companyName,
      companies,
      visibilityScope,
      departmentCode,
      departmentName,
      sections,
      version,
    } = req.body ?? {};
    const bpmFields = applyBpmFields(req.body ?? {}, existing);

    const normalizedCompanies = normalizePolicyCompanies(
      Array.isArray(companies)
        ? companies.map((item: { companyCode?: string; companyName?: string }) => ({
            companyCode: String(item.companyCode ?? "").trim(),
            companyName: String(item.companyName ?? "").trim(),
          }))
        : undefined,
      {
        companyCode: String(companyCode ?? existing.companyCode).trim(),
        companyName: String(companyName ?? existing.companyName).trim(),
      },
    );

    const primary = normalizedCompanies[0] ?? {
      companyCode: existing.companyCode,
      companyName: existing.companyName,
    };

    const nextVersion = Number(version ?? existing.version);
    const isVersionDraft = Boolean(existing.parentPolicyId) && existing.status === "draft";
    const policy: StoredPolicy = isVersionDraft
      ? {
          ...existing,
          sections: sections ?? existing.sections,
          updatedAt: new Date().toISOString(),
        }
      : {
          ...existing,
          name: String(name ?? existing.name).trim(),
          companyCode: primary.companyCode,
          companyName: primary.companyName,
          companies: normalizedCompanies,
          visibilityScope:
            visibilityScope === "general" || visibilityScope === "department"
              ? visibilityScope
              : existing.visibilityScope === "general"
                ? "general"
                : "department",
          departmentCode: Number(departmentCode ?? existing.departmentCode),
          departmentName: String(departmentName ?? existing.departmentName),
          ...bpmFields,
          sections: sections ?? existing.sections,
          version: nextVersion,
          updatedAt: new Date().toISOString(),
        };

    await savePolicy(policy);
    res.json(mapPolicy(policy));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.post("/api/policies/:id/submit", async (req, res) => {
  try {
    const existing = await getAccessiblePolicy(req.params.id, getUserEmail(req));
    if (existing === null) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    if (existing === undefined) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    if (existing.createdByEmail.toLowerCase() !== getUserEmail(req).toLowerCase()) {
      res.status(403).json({ error: "Only the requester can submit this policy" });
      return;
    }
    if (!["draft", "returned"].includes(existing.status)) {
      res.status(400).json({ error: "Policy cannot be submitted in its current state" });
      return;
    }

    const submitted = await submitPolicyForApproval(
      existing,
      getUserEmail(req),
      getUserName(req),
      parseAdditionalApprovers(req.body?.additionalApprovers),
      parseSubmitterLevelMode(req.body?.submitterLevelMode),
    );
    await savePolicy(submitted);
    res.json(mapPolicy(submitted));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.post("/api/policies/:id/matrix-change", async (req, res) => {
  try {
    const existing = await getAccessiblePolicy(req.params.id, getUserEmail(req));
    if (existing === null) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    if (existing === undefined) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    if (!canProposeMatrixChange(existing, getUserEmail(req))) {
      res.status(403).json({ error: "You cannot update the approval matrix for this policy" });
      return;
    }

    const updated = await proposeMatrixChange(
      existing,
      getUserEmail(req),
      getUserName(req),
      parseMatrixChanges(req.body?.changes),
    );
    await savePolicy(updated);
    res.json(mapPolicy(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: message });
  }
});

app.post("/api/policies/:id/matrix-change/approve", async (req, res) => {
  try {
    const existing = await getAccessiblePolicy(req.params.id, getUserEmail(req));
    if (existing === null) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    if (existing === undefined) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    if (!canReviewMatrixChange(existing, getUserEmail(req))) {
      res.status(403).json({ error: "You are not allowed to approve this matrix change" });
      return;
    }

    const updated = await approveMatrixChange(
      existing,
      getUserEmail(req),
      getUserName(req),
    );
    await savePolicy(updated);
    res.json(mapPolicy(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: message });
  }
});

app.post("/api/policies/:id/matrix-change/reject", async (req, res) => {
  try {
    const existing = await getAccessiblePolicy(req.params.id, getUserEmail(req));
    if (existing === null) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    if (existing === undefined) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    if (!canReviewMatrixChange(existing, getUserEmail(req))) {
      res.status(403).json({ error: "You are not allowed to reject this matrix change" });
      return;
    }

    const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
    const updated = rejectMatrixChange(
      existing,
      getUserEmail(req),
      getUserName(req),
      reason,
    );
    await savePolicy(updated);
    res.json(mapPolicy(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: message });
  }
});

app.post("/api/policies/:id/approve", async (req, res) => {
  try {
    const existing = await getAccessiblePolicy(req.params.id, getUserEmail(req));
    if (existing === null) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    if (existing === undefined || !canUserApprovePolicy(existing, getUserEmail(req))) {
      res.status(403).json({ error: "You are not allowed to approve this policy" });
      return;
    }

    const signatureText =
      typeof req.body?.signatureText === "string" ? req.body.signatureText : "";
    const comment = typeof req.body?.comment === "string" ? req.body.comment : "";

    let updated = approvePolicyStep(existing, getUserEmail(req), {
      signatureText,
      comment,
    });
    await savePolicy(updated);

    if (updated.status === "in_approval") {
      await notifyNextApprovers(updated, existing.createdByName);
    }

    res.json(mapPolicy(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.post("/api/policies/:id/publish", async (req, res) => {
  try {
    const existing = await getAccessiblePolicy(req.params.id, getUserEmail(req));
    if (existing === null) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    if (existing === undefined) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const updated = publishPolicy(existing, getUserEmail(req));
    const familyId = resolvePolicyFamilyId(updated);
    const allPolicies = await listPolicies();
    for (const sibling of allPolicies) {
      if (sibling.id === updated.id) continue;
      if (resolvePolicyFamilyId(sibling) !== familyId) continue;
      if (sibling.status === "published" && sibling.isActive !== false) {
        await savePolicy(deactivatePolicyRecord(sibling, "superseded"));
      }
    }
    await savePolicy(updated);
    res.json(mapPolicy(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.post("/api/policies/:id/new-version", async (req, res) => {
  try {
    const email = getUserEmail(req);
    const existing = await getAccessiblePolicy(req.params.id, email);
    if (existing === null) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    if (existing === undefined) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    if (!canCreateNewVersionFrom(existing)) {
      res.status(400).json({
        error: "New versions can only be created from published policies",
      });
      return;
    }

    const allPolicies = await listPolicies();
    const familyId = resolvePolicyFamilyId(existing);
    const nextVersion = getNextFamilyVersion(allPolicies, familyId);
    const draft = clonePolicyForNewVersion(
      existing,
      nextVersion,
      email,
      getUserName(req),
    );
    await savePolicy(draft);
    res.status(201).json(mapPolicy(draft));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.post("/api/policies/:id/deactivate", async (req, res) => {
  try {
    const email = getUserEmail(req);
    const existing = await getAccessiblePolicy(req.params.id, email);
    if (existing === null) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    if (existing === undefined) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    if (!(await canDeactivatePolicy(existing, email))) {
      res.status(403).json({
        error: "Only the policy owner or IT can deactivate a published active policy",
      });
      return;
    }

    const updated = deactivatePolicyRecord(existing, "manual");
    await savePolicy(updated);
    res.json(mapPolicy(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.post("/api/policies/:id/refresh-approval-setup", async (req, res) => {
  try {
    const existing = await getAccessiblePolicy(req.params.id, getUserEmail(req));
    if (existing === null) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    if (existing === undefined) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    if (!canRefreshPolicyFromSetup(existing, getUserEmail(req))) {
      res.status(403).json({ error: "No pending approval setup update for this policy" });
      return;
    }

    const updated = await refreshPolicyApprovalFromSetup(existing);
    await savePolicy(updated);
    res.json(mapPolicy(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.post("/api/policies/:id/reject", async (req, res) => {
  try {
    const existing = await getAccessiblePolicy(req.params.id, getUserEmail(req));
    if (existing === null) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    if (existing === undefined || !canUserApprovePolicy(existing, getUserEmail(req))) {
      res.status(403).json({ error: "You are not allowed to reject this policy" });
      return;
    }

    const comment = typeof req.body?.comment === "string" ? req.body.comment : "";
    const updated = rejectPolicyStep(existing, getUserEmail(req), comment);
    await savePolicy(updated);
    res.json(mapPolicy(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/policies/:id/escalation-targets", async (req, res) => {
  try {
    const existing = await getAccessiblePolicy(req.params.id, getUserEmail(req));
    if (existing === null) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    if (existing === undefined || !canUserApprovePolicy(existing, getUserEmail(req))) {
      res.status(403).json({ error: "You are not allowed to escalate this policy" });
      return;
    }

    const managerTargets = await getEscalationTargetsForPolicy(
      existing,
      getUserEmail(req),
    );
    res.json({ targets: managerTargets });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.post("/api/policies/:id/escalate", async (req, res) => {
  try {
    const existing = await getAccessiblePolicy(req.params.id, getUserEmail(req));
    if (existing === null) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    if (existing === undefined || !canUserApprovePolicy(existing, getUserEmail(req))) {
      res.status(403).json({ error: "You are not allowed to escalate this policy" });
      return;
    }

    const targetEmail = String(req.body?.targetEmail ?? "").trim();
    const targetName = String(req.body?.targetName ?? "").trim();
    const targetUserId =
      typeof req.body?.targetUserId === "string" ? req.body.targetUserId.trim() : undefined;
    const reason = String(req.body?.reason ?? "").trim();

    const updated = await escalatePolicyStep(
      existing,
      getUserEmail(req),
      getUserName(req),
      { targetEmail, targetName, targetUserId, reason },
    );
    await savePolicy(updated);
    await notifyNextApprovers(updated, existing.createdByName);
    res.json(mapPolicy(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: message });
  }
});

app.post("/api/policies/:id/comments", async (req, res) => {
  try {
    const existing = await getAccessiblePolicy(req.params.id, getUserEmail(req));
    if (existing === null) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    if (existing === undefined) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const text = typeof req.body?.text === "string" ? req.body.text : "";
    const updated = addPolicyComment(
      existing,
      getUserEmail(req),
      getUserName(req),
      text,
    );
    await savePolicy(updated);
    res.json(mapPolicy(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.post("/api/policies/:id/share", async (req, res) => {
  try {
    const existing = await getAccessiblePolicy(req.params.id, getUserEmail(req));
    if (existing === null) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    if (existing === undefined) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    if (!canUserApprovePolicy(existing, getUserEmail(req))) {
      res.status(403).json({ error: "Only the current approver can grant access" });
      return;
    }

    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    if (!email) {
      res.status(400).json({ error: "email is required" });
      return;
    }

    const updated = grantPolicyAccess(existing, email);
    await savePolicy(updated);
    res.json(mapPolicy(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/templates/section-catalog", (_req, res) => {
  res.json([
    "Purpose",
    "Scope",
    "Definitions",
    "Policy Statement",
    "Roles & Responsibilities",
    "Procedures",
    "Compliance & Monitoring",
    "Exceptions",
    "Related Documents",
    "Review & Updates",
    "Information Security Policy",
    "User Access Management",
    "Password Management",
    "Data Privacy & Protection",
    "Asset Management",
    "Acceptable Use",
    "Remote Work",
    "Incident Management",
    "Change Management",
    "Business Continuity",
  ]);
});

app.get("/api/templates", async (req, res) => {
  try {
    const departmentCode = req.query.departmentCode
      ? Number(req.query.departmentCode)
      : undefined;
    const rows = await listTemplates(
      departmentCode != null && !Number.isNaN(departmentCode)
        ? { departmentCode }
        : undefined,
    );
    res.json(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/templates/:id", async (req, res) => {
  try {
    const template = await getTemplateById(req.params.id);
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json(template);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.post("/api/templates/parse-word", async (req, res) => {
  try {
    const fileName =
      typeof req.body?.fileName === "string" ? req.body.fileName.trim() : "";
    const dataBase64 =
      typeof req.body?.dataBase64 === "string" ? req.body.dataBase64.trim() : "";

    if (!dataBase64) {
      res.status(400).json({ error: "dataBase64 is required" });
      return;
    }

    if (fileName && !/\.docx$/i.test(fileName)) {
      res.status(400).json({ error: "Only .docx Word files are supported" });
      return;
    }

    const buffer = Buffer.from(dataBase64, "base64");
    if (buffer.length === 0) {
      res.status(400).json({ error: "Invalid file data" });
      return;
    }
    if (buffer.length > 8 * 1024 * 1024) {
      res.status(400).json({ error: "File exceeds 8MB limit" });
      return;
    }

    const parsed = await parseWordDocument(buffer);
    res.json({
      fileName,
      sections: parsed.sections,
      warnings: parsed.warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.post("/api/templates", async (req, res) => {
  try {
    const { name, description, departmentCode, departmentName, sections, source } =
      req.body ?? {};

    if (!name?.trim() || !departmentCode || !departmentName?.trim()) {
      res.status(400).json({ error: "name, departmentCode, and departmentName are required" });
      return;
    }

    if (!Array.isArray(sections) || sections.length === 0) {
      res.status(400).json({ error: "At least one section is required" });
      return;
    }

    const now = new Date().toISOString();
    const template: StoredTemplate = {
      id: randomUUID(),
      name: String(name).trim(),
      description: String(description ?? "").trim(),
      departmentCode: Number(departmentCode),
      departmentName: String(departmentName).trim(),
      sections: sections.map((section: { id?: string; title: string; content?: string }) => ({
        id: section.id ?? randomUUID(),
        title: String(section.title).trim(),
        content: String(section.content ?? "<p></p>"),
      })),
      source: source === "word" ? "word" : "manual",
      createdByEmail: getUserEmail(req),
      createdByName: getUserName(req),
      createdAt: now,
      updatedAt: now,
    };

    await saveTemplate(template);
    res.status(201).json(template);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.put("/api/templates/:id", async (req, res) => {
  try {
    const existing = await getTemplateById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if (existing.createdByEmail.toLowerCase() !== getUserEmail(req).toLowerCase()) {
      res.status(403).json({ error: "Only the template creator can edit this template" });
      return;
    }

    const { name, description, departmentCode, departmentName, sections, source } =
      req.body ?? {};

    const template: StoredTemplate = {
      ...existing,
      name: String(name ?? existing.name).trim(),
      description: String(description ?? existing.description).trim(),
      departmentCode: Number(departmentCode ?? existing.departmentCode),
      departmentName: String(departmentName ?? existing.departmentName).trim(),
      sections: Array.isArray(sections)
        ? sections.map((section: { id?: string; title: string; content?: string }) => ({
            id: section.id ?? randomUUID(),
            title: String(section.title).trim(),
            content: String(section.content ?? "<p></p>"),
          }))
        : existing.sections,
      source: source === "word" ? "word" : existing.source,
      updatedAt: new Date().toISOString(),
    };

    await saveTemplate(template);
    res.json(template);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.delete("/api/templates/:id", async (req, res) => {
  try {
    const existing = await getTemplateById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if (existing.createdByEmail.toLowerCase() !== getUserEmail(req).toLowerCase()) {
      res.status(403).json({ error: "Only the template creator can delete this template" });
      return;
    }

    await deleteTemplate(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.delete("/api/policies/:id", async (req, res) => {
  try {
    const existing = await getAccessiblePolicy(req.params.id, getUserEmail(req));
    if (existing === null) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    if (
      existing === undefined ||
      !canDeletePolicy(existing, getUserEmail(req))
    ) {
      res.status(403).json({ error: "You are not allowed to delete this policy" });
      return;
    }

    await deletePolicy(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

async function start() {
  await ensurePolicyStore();
  await ensureTemplateStore();
  await ensureApprovalSetupStore();
  app.listen(port, "0.0.0.0", () => {
    console.log(`Policy Creator API listening on http://0.0.0.0:${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start Policy Creator API:", error);
  process.exit(1);
});
