const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "/api";

import {
  clearAuthSession,
  loadAuthToken,
  type AuthStorageScope,
} from "./auth-storage";

import { isViewersAppMode } from "@/lib/viewer-routes";
import { getPolicyTreePlacements } from "@/lib/policy-companies";

function getRequestScope(): AuthStorageScope {
  return isViewersAppMode() ? "viewer" : "default";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const scope = getRequestScope();
  const token = loadAuthToken(scope);
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (response.status === 401) {
    clearAuthSession(scope);
    window.dispatchEvent(new Event("policy-creator-auth-expired"));
    throw new Error("Session expired. Please sign in again.");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
    };
    const message = payload.error || `Request failed (${response.status})`;
    const error = new Error(message) as Error & { code?: string; status?: number };
    error.code = payload.code;
    error.status = response.status;
    throw error;
  }

  return response.json() as Promise<T>;
}

export function fetchAuthProfile(token?: string, scope?: AuthStorageScope) {
  const authToken = token ?? loadAuthToken(scope ?? getRequestScope());
  return fetch(`${API_BASE}/auth/profile`, {
    headers: {
      Accept: "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  }).then(async (response) => {
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `Request failed (${response.status})`);
    }
    return response.json() as Promise<{
      user: {
        email: string;
        name: string;
        oid?: string;
        preferred_username?: string;
        authSource?: import("./auth-storage").AuthSource;
      };
      email: string;
      name: string;
      isAuthenticated: boolean;
    }>;
  });
}

export async function exchangeSsoToken(sharedToken: string) {
  const response = await fetch(`${API_BASE}/auth/sso`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token: sharedToken }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `SSO failed (${response.status})`);
  }

  return response.json() as Promise<{
    success: boolean;
    token: string;
    user: { email: string; name: string; oid?: string; preferred_username?: string };
  }>;
}

export async function exchangeIntranetLink(params: {
  userId: string;
  otp: string;
  companyCode: string;
}) {
  const response = await fetch(`${API_BASE}/auth/intranet-link`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Intranet login failed (${response.status})`);
  }

  return response.json() as Promise<{
    success: boolean;
    token: string;
    user: {
      email: string;
      name: string;
      authSource?: import("./auth-storage").AuthSource;
    };
  }>;
}

export function refreshApprovalSetupApi(id: string) {
  return request<import("./types").Policy>(`/policies/${id}/refresh-approval-setup`, {
    method: "POST",
  });
}

export function fetchAppAccess() {
  return request<{
    policyCreator: boolean;
    policyViewer: boolean;
    canDeleteAnyPolicy?: boolean;
    canDeactivateAnyPolicy?: boolean;
    canCreateForAnyScope?: boolean;
    canEditAnyPolicy?: boolean;
    authSource: "intranet" | "microsoft" | null;
  }>("/access");
}

export function isPolicyCreatorAccessDeniedError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "policy_creator_access_denied" ||
    candidate.message?.toLowerCase().includes("policy creator access is not assigned") ===
      true
  );
}

export function fetchDashboardSummary() {
  return request<import("./types").DashboardSummary>("/dashboard/summary");
}

export function fetchCompanies() {
  return request<{ result: Array<{
    USER_ID: string;
    USER_NAME: string;
    BRANCH: string;
    COMPANY: string;
    LEGISLATIONCODE: string;
  }> }>("/companies");
}

export function fetchDepartments(companyCode?: string) {
  const params = new URLSearchParams();
  if (companyCode) params.set("companyCode", companyCode);
  const query = params.toString();
  return request<Array<{ code: number; name: string }>>(
    `/departments${query ? `?${query}` : ""}`,
  );
}

export function fetchPolicies(filters?: {
  companyCode?: string;
  departmentCode?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.companyCode) params.set("companyCode", filters.companyCode);
  if (filters?.departmentCode) {
    params.set("departmentCode", String(filters.departmentCode));
  }
  const query = params.toString();
  return request<import("./types").Policy[]>(`/policies${query ? `?${query}` : ""}`);
}

export function fetchPolicy(id: string) {
  return request<import("./types").Policy>(`/policies/${id}`);
}

export function askPolicyAssistantApi(id: string, question: string) {
  return request<{ answer: string; source: "openai" | "local" }>(
    `/viewers/policies/${id}/ask`,
    {
      method: "POST",
      body: JSON.stringify({ question }),
    },
  );
}

export function fetchViewerPolicies(filters?: {
  companyCode?: string;
  departmentCode?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.companyCode) params.set("companyCode", filters.companyCode);
  if (filters?.departmentCode) {
    params.set("departmentCode", String(filters.departmentCode));
  }
  const query = params.toString();
  return request<import("./types").Policy[]>(
    `/viewers/policies${query ? `?${query}` : ""}`,
  );
}

export function fetchViewerPolicy(id: string) {
  return request<import("./types").Policy>(`/viewers/policies/${id}`);
}

export function fetchViewerSummary() {
  return request<import("./types").DashboardSummary>("/viewers/summary");
}

export function isViewerAccessDeniedError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "viewer_access_denied" ||
    candidate.message?.toLowerCase().includes("not authorized to access policy viewer") ===
      true
  );
}

export function savePolicyApi(
  policy: {
    id?: string;
    name: string;
    companyCode: string;
    companyName: string;
    companies?: import("./types").PolicyCompany[];
    visibilityScope?: import("./types").PolicyVisibilityScope;
    departmentCode: number;
    departmentName: string;
    bpmDepartmentId?: string;
    bpmDepartmentName?: string;
    processId?: string;
    processCode?: string;
    processName?: string;
    subProcesses?: import("./types").PolicySubProcessLink[];
    businessRole?: string;
    sections: import("./types").PolicySection[];
    version: number;
  },
) {
  const payload = {
    name: policy.name,
    companyCode: policy.companyCode,
    companyName: policy.companyName,
    companies: policy.companies,
    visibilityScope: policy.visibilityScope,
    departmentCode: policy.departmentCode,
    departmentName: policy.departmentName,
    bpmDepartmentId: policy.bpmDepartmentId,
    bpmDepartmentName: policy.bpmDepartmentName,
    processId: policy.processId,
    processCode: policy.processCode,
    processName: policy.processName,
    subProcesses: policy.subProcesses ?? [],
    businessRole: policy.businessRole ?? "",
    sections: policy.sections,
    version: policy.version,
  };

  if (policy.id) {
    return request<import("./types").Policy>(`/policies/${policy.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  return request<import("./types").Policy>("/policies", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function submitPolicyApi(
  id: string,
  additionalApprovers: import("./types").AdditionalApproverDraft[] = [],
  submitterLevelMode: import("./types").SubmitterLevelMode = "all",
) {
  return request<import("./types").Policy>(`/policies/${id}/submit`, {
    method: "POST",
    body: JSON.stringify({ additionalApprovers, submitterLevelMode }),
  });
}

export function proposeMatrixChangeApi(
  id: string,
  changes: Array<{
    stepId: string;
    assigneeEmail: string;
    assigneeName: string;
    assigneeUserId?: string;
  }>,
) {
  return request<import("./types").Policy>(`/policies/${id}/matrix-change`, {
    method: "POST",
    body: JSON.stringify({ changes }),
  });
}

export function approveMatrixChangeApi(id: string) {
  return request<import("./types").Policy>(`/policies/${id}/matrix-change/approve`, {
    method: "POST",
  });
}

export function rejectMatrixChangeApi(id: string, reason?: string) {
  return request<import("./types").Policy>(`/policies/${id}/matrix-change/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function fetchBpmProcesses(companyCode: string, departmentName: string) {
  const params = new URLSearchParams({
    companyCode,
    departmentName,
  });
  return request<{
    processFunction: { id: string; code: string; name: string } | null;
    processes: import("./types").BpmProcessOption[];
  }>(`/bpm/processes?${params.toString()}`);
}

export function fetchBpmApplications() {
  return request<import("./types").PolicyApplicationLink[]>("/bpm/applications");
}

export function fetchBpmSubProcesses(processId: string) {
  return request<import("./types").BpmSubProcessOption[]>(
    `/bpm/processes/${encodeURIComponent(processId)}/sub-processes`,
  );
}

export function searchEmployees(companyCode: string, query: string, departmentCode?: number) {
  const params = new URLSearchParams({ companyCode, q: query });
  if (departmentCode != null) params.set("departmentCode", String(departmentCode));
  return request<import("./types").EmployeeOption[]>(`/employees?${params.toString()}`);
}

export function fetchApprovalSetupAccess() {
  return request<{ canManage: boolean }>("/approval-setup/access");
}

export interface DepartmentEmployeesPreview {
  departmentCode: number;
  hierarchyTiers: import("./types").HierarchyTierPreview[];
  employees: Array<
    import("./types").EmployeeOption & {
      department?: string;
      reportingToId?: string;
      directReportsInDept?: number;
    }
  >;
}

export function fetchDepartmentEmployees(companyCode: string, departmentCode: number) {
  const params = new URLSearchParams({
    companyCode,
    departmentCode: String(departmentCode),
  });
  return request<DepartmentEmployeesPreview>(
    `/approval-setup/department-employees?${params.toString()}`,
  );
}

export function fetchApprovalSetups(filters?: {
  companyCode?: string;
  sourceDepartmentCode?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.companyCode) params.set("companyCode", filters.companyCode);
  if (filters?.sourceDepartmentCode != null) {
    params.set("sourceDepartmentCode", String(filters.sourceDepartmentCode));
  }
  const query = params.toString();
  return request<import("./types").PolicyApprovalSetupRecord[]>(
    `/approval-setup${query ? `?${query}` : ""}`,
  );
}

export function fetchApprovalSetup(id: string) {
  return request<import("./types").PolicyApprovalSetupRecord>(`/approval-setup/${id}`);
}

export function saveApprovalSetupApi(
  setup: import("./types").PolicyApprovalSetup,
  id?: string,
) {
  if (id) {
    return request<import("./types").PolicyApprovalSetupRecord>(`/approval-setup/${id}`, {
      method: "PUT",
      body: JSON.stringify(setup),
    });
  }
  return request<import("./types").PolicyApprovalSetupRecord>("/approval-setup", {
    method: "POST",
    body: JSON.stringify(setup),
  });
}

export function deleteApprovalSetupApi(id: string) {
  return request<{ ok: boolean }>(`/approval-setup/${id}`, { method: "DELETE" });
}

export function previewApprovalChain(payload: {
  companyCode: string;
  departmentCode: number;
  departmentName?: string;
  submitterLevelMode?: import("./types").SubmitterLevelMode;
  additionalApprovers?: import("./types").AdditionalApproverDraft[];
}) {
  return request<{
    steps: import("./types").ApprovalStep[];
    defaultSubmitterLevelMode: import("./types").SubmitterLevelMode;
    guruOnly?: boolean;
  }>("/policies/approval-preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchEscalationTargets(policyId: string) {
  return request<{ targets: import("./types").EscalationTargetOption[] }>(
    `/policies/${policyId}/escalation-targets`,
  );
}

export function escalatePolicyApi(
  id: string,
  payload: {
    targetEmail: string;
    targetName: string;
    targetUserId?: string;
    reason: string;
  },
) {
  return request<import("./types").Policy>(`/policies/${id}/escalate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function approvePolicyApi(
  id: string,
  payload: { signatureText: string; comment?: string },
) {
  return request<import("./types").Policy>(`/policies/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function rejectPolicyApi(id: string, comment: string) {
  return request<import("./types").Policy>(`/policies/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export function commentPolicyApi(id: string, text: string) {
  return request<import("./types").Policy>(`/policies/${id}/comments`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function sharePolicyApi(id: string, email: string) {
  return request<import("./types").Policy>(`/policies/${id}/share`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function publishPolicyApi(id: string) {
  return request<import("./types").Policy>(`/policies/${id}/publish`, {
    method: "POST",
  });
}

export function newVersionPolicyApi(id: string) {
  return request<import("./types").Policy>(`/policies/${id}/new-version`, {
    method: "POST",
  });
}

export function deactivatePolicyApi(id: string) {
  return request<import("./types").Policy>(`/policies/${id}/deactivate`, {
    method: "POST",
  });
}

export function activatePolicyApi(id: string) {
  return request<import("./types").Policy>(`/policies/${id}/activate`, {
    method: "POST",
  });
}

export function deletePolicyApi(id: string) {
  return request<{ ok: boolean }>(`/policies/${id}`, { method: "DELETE" });
}

export function fetchTemplateSectionCatalog() {
  return request<string[]>("/templates/section-catalog");
}

export function fetchTemplates(departmentCode?: number) {
  const query =
    departmentCode != null ? `?departmentCode=${encodeURIComponent(String(departmentCode))}` : "";
  return request<import("./types").PolicyTemplate[]>(`/templates${query}`);
}

export function fetchTemplate(id: string) {
  return request<import("./types").PolicyTemplate>(`/templates/${id}`);
}

export function parseWordTemplateApi(fileName: string, dataBase64: string) {
  return request<import("./types").ParsedWordTemplate>("/templates/parse-word", {
    method: "POST",
    body: JSON.stringify({ fileName, dataBase64 }),
  });
}

export function saveTemplateApi(
  template: {
    id?: string;
    name: string;
    description: string;
    departmentCode: number;
    departmentName: string;
    sections: Array<{ id?: string; title: string; content: string }>;
    source: "manual" | "word";
  },
) {
  const payload = {
    name: template.name,
    description: template.description,
    departmentCode: template.departmentCode,
    departmentName: template.departmentName,
    sections: template.sections,
    source: template.source,
  };

  if (template.id) {
    return request<import("./types").PolicyTemplate>(`/templates/${template.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  return request<import("./types").PolicyTemplate>("/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteTemplateApi(id: string) {
  return request<{ ok: boolean }>(`/templates/${id}`, { method: "DELETE" });
}

export function groupPoliciesTree(policies: import("./types").Policy[]) {
  const companies = new Map<
    string,
    {
      companyCode: string;
      companyName: string;
      departments: Map<
        string,
        {
          departmentCode: number;
          departmentName: string;
          policies: import("./types").Policy[];
        }
      >;
    }
  >();

  for (const policy of policies) {
    for (const placement of getPolicyTreePlacements(policy)) {
      const companyKey = placement.companyCode;
      if (!companies.has(companyKey)) {
        companies.set(companyKey, {
          companyCode: placement.companyCode,
          companyName: placement.companyName,
          departments: new Map(),
        });
      }

      const company = companies.get(companyKey)!;
      const deptKey = String(placement.departmentCode);
      if (!company.departments.has(deptKey)) {
        company.departments.set(deptKey, {
          departmentCode: placement.departmentCode,
          departmentName: placement.departmentName,
          policies: [],
        });
      }

      company.departments.get(deptKey)!.policies.push(policy);
    }
  }

  return Array.from(companies.values())
    .sort((a, b) => a.companyName.localeCompare(b.companyName))
    .map((company) => ({
      ...company,
      departments: Array.from(company.departments.values()).sort((a, b) =>
        a.departmentName.localeCompare(b.departmentName),
      ),
    }));
}
