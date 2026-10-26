import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import Footer from "@/components/layout/Footer";
import PolicyTreeSidebar from "@/components/layout/PolicyTreeSidebar";
import TopBar from "@/components/layout/TopBar";
import CreatePolicyWizard from "@/components/wizard/CreatePolicyWizard";
import PolicyViewer from "@/components/viewer/PolicyViewer";
import SetupRefreshDialog from "@/components/workflow/SetupRefreshDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/context/AuthContext";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import TemplatesPage from "@/pages/TemplatesPage";
import PoliciesListPage from "@/pages/PoliciesListPage";
import CreatePolicyEntryPage from "@/pages/CreatePolicyEntryPage";
import ApprovalSetupPage from "@/pages/ApprovalSetupPage";
import type { PolicyListFilter } from "@/lib/policy-list-filters";
import type { Policy, PolicyTemplate } from "@/lib/types";
import {
  deletePolicyApi,
  fetchAppAccess,
  fetchApprovalSetupAccess,
  fetchPolicies,
  fetchPolicy,
  newVersionPolicyApi,
  activatePolicyApi,
  deactivatePolicyApi,
  savePolicyApi,
} from "@/lib/api";
import PolicyCreatorDeniedPage from "@/pages/PolicyCreatorDeniedPage";
import { generateId } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type AppPage =
  | "dashboard"
  | "policies-list"
  | "templates"
  | "approval-setup"
  | "create-entry"
  | "create"
  | "edit"
  | "view"
  | "duplicate";

function readPolicyIdFromUrl() {
  return new URLSearchParams(window.location.search).get("policy");
}

function readSetupRefreshFromUrl() {
  return new URLSearchParams(window.location.search).get("setupRefresh") === "1";
}

function setPolicyUrl(policyId: string | null, options?: { setupRefresh?: boolean }) {
  const url = new URL(window.location.href);
  if (policyId) {
    url.searchParams.set("policy", policyId);
  } else {
    url.searchParams.delete("policy");
  }
  if (options?.setupRefresh) {
    url.searchParams.set("setupRefresh", "1");
  } else {
    url.searchParams.delete("setupRefresh");
  }
  window.history.replaceState({}, "", url.toString());
}

export default function App() {
  const queryClient = useQueryClient();
  const { isAuthenticated, isBootstrapping, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [page, setPage] = useState<AppPage>("dashboard");
  const [prefillTemplate, setPrefillTemplate] = useState<PolicyTemplate | null>(null);
  const [policyListFilter, setPolicyListFilter] = useState<PolicyListFilter>("all");
  const [setupRefreshOpen, setSetupRefreshOpen] = useState(false);

  const { data: appAccess, isLoading: isAccessLoading } = useQuery({
    queryKey: ["app-access"],
    queryFn: fetchAppAccess,
    enabled: isAuthenticated,
    retry: false,
  });

  const {
    data: policies = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["policies"],
    queryFn: () => fetchPolicies(),
    enabled: isAuthenticated && appAccess?.policyCreator === true,
  });

  const { data: approvalSetupAccess } = useQuery({
    queryKey: ["approval-setup-access"],
    queryFn: fetchApprovalSetupAccess,
    enabled: isAuthenticated && appAccess?.policyCreator === true,
  });

  useEffect(() => {
    if (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load policies");
    }
  }, [error]);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;

    const policyId = readPolicyIdFromUrl();
    if (!policyId) return;

    const fromList = policies.find((item) => item.id === policyId);
    if (fromList) {
      setSelectedPolicy(fromList);
      setPage("view");
      return;
    }

    fetchPolicy(policyId)
      .then((policy) => {
        setSelectedPolicy(policy);
        setPage("view");
      })
      .catch(() => {
        toast.error("Policy not found or access denied");
        setPolicyUrl(null);
      });
  }, [isAuthenticated, isLoading, policies]);

  useEffect(() => {
    if (!selectedPolicy || page !== "view") return;
    const isOwner =
      selectedPolicy.createdByEmail.toLowerCase() === (user?.email?.toLowerCase() ?? "");
    const shouldOpen =
      isOwner &&
      (readSetupRefreshFromUrl() || Boolean(selectedPolicy.pendingSetupRefresh));
    setSetupRefreshOpen(shouldOpen);
  }, [selectedPolicy, page, user?.email]);

  const openPolicy = (policy: Policy) => {
    setSelectedPolicy(policy);
    setPage("view");
    setPolicyUrl(policy.id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const goDashboard = () => {
    setSelectedPolicy(null);
    setPage("dashboard");
    setPolicyUrl(null);
  };

  const handleCreateNew = () => {
    setSelectedPolicy(null);
    setPrefillTemplate(null);
    setPage("create-entry");
    setPolicyUrl(null);
  };

  const handleCreateBlank = () => {
    setSelectedPolicy(null);
    setPrefillTemplate(null);
    setPage("create");
    setPolicyUrl(null);
  };

  const handleCreateFromExisting = async (policy: Policy) => {
    try {
      const draft = await newVersionPolicyApi(policy.id);
      await queryClient.invalidateQueries({ queryKey: ["policies"] });
      setSelectedPolicy(draft);
      setPage("edit");
      setPolicyUrl(draft.id);
      toast.success(`Version ${draft.version} draft created`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create new version");
    }
  };

  const handleNewVersion = async (policy: Policy) => {
    await handleCreateFromExisting(policy);
  };

  const handleDeactivatePolicy = async (policy: Policy) => {
    if (
      !window.confirm(
        `Deactivate "${policy.name}" v${policy.version}? It will be hidden from the Policy Viewer.`,
      )
    ) {
      return;
    }
    try {
      const updated = await deactivatePolicyApi(policy.id);
      await queryClient.invalidateQueries({ queryKey: ["policies"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setSelectedPolicy(updated);
      toast.success("Policy deactivated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to deactivate policy");
    }
  };

  const handleActivatePolicy = async (policy: Policy) => {
    if (
      !window.confirm(
        `Activate "${policy.name}" v${policy.version}? It will appear again in the Policy Viewer. Other active versions of the same policy will be deactivated.`,
      )
    ) {
      return;
    }
    try {
      const updated = await activatePolicyApi(policy.id);
      await queryClient.invalidateQueries({ queryKey: ["policies"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setSelectedPolicy(updated);
      toast.success("Policy activated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to activate policy");
    }
  };

  const handleNavigateTemplates = () => {
    setSelectedPolicy(null);
    setPrefillTemplate(null);
    setPage("templates");
    setPolicyUrl(null);
  };

  const handleNavigateApprovalSetup = () => {
    setSelectedPolicy(null);
    setPrefillTemplate(null);
    setPage("approval-setup");
    setPolicyUrl(null);
  };

  const handleUseTemplate = (template: PolicyTemplate) => {
    setSelectedPolicy(null);
    setPrefillTemplate(template);
    setPage("create");
    setPolicyUrl(null);
  };

  const handleBrowsePolicies = (filter: PolicyListFilter) => {
    setSelectedPolicy(null);
    setPolicyListFilter(filter);
    setPage("policies-list");
    setPolicyUrl(null);
  };

  const handleSaved = async (
    policy: Partial<Policy> &
      Pick<
        Policy,
        | "name"
        | "companyCode"
        | "companyName"
        | "companies"
        | "visibilityScope"
        | "departmentCode"
        | "departmentName"
        | "businessRole"
        | "sections"
        | "version"
      >,
  ) => {
    const saved = await savePolicyApi({
      id: policy.id,
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
      subProcesses: policy.subProcesses,
      businessRole: policy.businessRole,
      sections: policy.sections,
      version: policy.version,
    });
    await queryClient.invalidateQueries({ queryKey: ["policies"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    setSelectedPolicy(saved);
    return saved;
  };

  const handleSubmitted = async (policy: Policy) => {
    setSelectedPolicy(policy);
    setPage("view");
    setPolicyUrl(policy.id);
  };

  const handleDuplicatePolicy = (policy: Policy) => {
    setSelectedPolicy({
      ...policy,
      id: "",
      name: `${policy.name} (Copy)`,
      status: "draft",
      version: 1,
      approvalSteps: [],
      comments: [],
      currentApprovers: [],
      sharedWith: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sections: policy.sections.map((section) => ({
        ...section,
        id: generateId(),
      })),
    });
    setPage("duplicate");
    setPolicyUrl(null);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleDeletePolicy = async (policyId: string) => {
    const policy = policies.find((item) => item.id === policyId);
    const policyName = policy?.name ?? "this policy";
    const confirmed = window.confirm(
      `Delete "${policyName}"?\n\nThis action cannot be undone.`,
    );
    if (!confirmed) return;

    await deletePolicyApi(policyId);
    await queryClient.invalidateQueries({ queryKey: ["policies"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    if (selectedPolicy?.id === policyId) {
      setSelectedPolicy(null);
      setPage("dashboard");
      setPolicyUrl(null);
    }
    toast.success("Policy deleted");
  };

  const handleSetupRefreshClose = () => {
    setSetupRefreshOpen(false);
    if (selectedPolicy) {
      setPolicyUrl(selectedPolicy.id);
    }
  };

  const handleSetupRefreshUpdated = async (policy: Policy) => {
    setSelectedPolicy(policy);
    await queryClient.invalidateQueries({ queryKey: ["policies"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    setPolicyUrl(policy.id);
    setSetupRefreshOpen(false);
  };

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Toaster richColors position="top-right" />
        <LoginPage />
      </>
    );
  }

  if (isAccessLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (appAccess && !appAccess.policyCreator) {
    return (
      <>
        <Toaster richColors position="top-right" />
        <PolicyCreatorDeniedPage
          email={user?.email}
          canOpenViewer={appAccess.policyViewer}
        />
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Toaster richColors position="top-right" />
      <div className="flex flex-1">
        <PolicyTreeSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          policies={policies}
          isLoading={isLoading}
          selectedPolicyId={selectedPolicy?.id ?? null}
          userEmail={user?.email ?? ""}
          canDeleteAnyPolicy={appAccess?.canDeleteAnyPolicy ?? false}
          onSelectPolicy={openPolicy}
          onCreateNew={handleCreateNew}
          onDeletePolicy={handleDeletePolicy}
          onDuplicatePolicy={handleDuplicatePolicy}
        />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((open) => !open)}
            currentPage={page}
            canManageApprovalSetup={approvalSetupAccess?.canManage ?? false}
            onNavigateDashboard={goDashboard}
            onNavigateCreate={handleCreateNew}
            onNavigateTemplates={handleNavigateTemplates}
            onNavigateApprovalSetup={handleNavigateApprovalSetup}
          />

          <ScrollArea className="app-page h-[calc(100vh-64px)]">
            <div className={page === "view" ? "w-full" : "w-full p-4 md:p-6 lg:p-8"}>
              {page === "dashboard" && (
                <DashboardPage
                  onCreateNew={handleCreateNew}
                  onOpenPolicy={openPolicy}
                  onBrowsePolicies={handleBrowsePolicies}
                />
              )}

              {page === "policies-list" && (
                <PoliciesListPage
                  filter={policyListFilter}
                  userEmail={user?.email ?? ""}
                  onBack={goDashboard}
                  onOpenPolicy={openPolicy}
                />
              )}

              {page === "templates" && (
                <TemplatesPage onUseTemplate={handleUseTemplate} />
              )}

              {page === "approval-setup" && <ApprovalSetupPage />}

              {page === "create-entry" && (
                <CreatePolicyEntryPage
                  policies={policies}
                  onCancel={goDashboard}
                  onCreateNew={handleCreateBlank}
                  onCreateFromExisting={(policy) => void handleCreateFromExisting(policy)}
                />
              )}

              {page === "create" && (
                <CreatePolicyWizard
                  initialTemplate={prefillTemplate}
                  onCancel={goDashboard}
                  onSaved={handleSaved}
                  onSubmitted={handleSubmitted}
                />
              )}

              {page === "edit" && selectedPolicy && (
                <CreatePolicyWizard
                  initialPolicy={selectedPolicy}
                  onCancel={() => setPage("view")}
                  onSaved={handleSaved}
                  onSubmitted={handleSubmitted}
                />
              )}

              {page === "duplicate" && selectedPolicy && (
                <CreatePolicyWizard
                  initialPolicy={selectedPolicy}
                  isDuplicate
                  onCancel={goDashboard}
                  onSaved={handleSaved}
                  onSubmitted={handleSubmitted}
                />
              )}

              {page === "view" && selectedPolicy && (
                <PolicyViewer
                  policy={selectedPolicy}
                  onEdit={() => setPage("edit")}
                  onDuplicate={() => handleDuplicatePolicy(selectedPolicy)}
                  onNewVersion={() => void handleNewVersion(selectedPolicy)}
                  onDeactivate={() => void handleDeactivatePolicy(selectedPolicy)}
                  onActivate={() => void handleActivatePolicy(selectedPolicy)}
                  onUpdated={setSelectedPolicy}
                  canDeleteAnyPolicy={appAccess?.canDeleteAnyPolicy ?? false}
                  canDeactivateAnyPolicy={appAccess?.canDeactivateAnyPolicy ?? false}
                  canEditAnyPolicy={appAccess?.canEditAnyPolicy ?? false}
                  onDelete={() => handleDeletePolicy(selectedPolicy.id)}
                />
              )}
            </div>
          </ScrollArea>
        </main>
      </div>

      {selectedPolicy && setupRefreshOpen ? (
        <SetupRefreshDialog
          open={setupRefreshOpen}
          policy={selectedPolicy}
          onClose={handleSetupRefreshClose}
          onUpdated={handleSetupRefreshUpdated}
        />
      ) : null}

      <Footer />
    </div>
  );
}
