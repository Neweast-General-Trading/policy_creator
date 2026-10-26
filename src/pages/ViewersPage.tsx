import { useQuery } from "@tanstack/react-query";
import { Loader2, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useRef, useState } from "react";
import PolicyDocumentView from "@/components/viewer/PolicyDocumentView";
import PolicyAiAssistant from "@/components/viewers/PolicyAiAssistant";
import ViewerTreeSidebar from "@/components/viewers/ViewerTreeSidebar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/context/AuthContext";
import { useScopedCopyProtection } from "@/hooks/useScopedCopyProtection";
import { fetchViewerPolicies, fetchViewerPolicy, fetchViewerSummary } from "@/lib/api";

export default function ViewersPage() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const policiesQuery = useQuery({
    queryKey: ["viewer-policies"],
    queryFn: () => fetchViewerPolicies(),
  });

  const scopeQuery = useQuery({
    queryKey: ["viewer-scope"],
    queryFn: () => fetchViewerSummary(),
  });

  const policyQuery = useQuery({
    queryKey: ["viewer-policy", selectedPolicyId],
    queryFn: () => fetchViewerPolicy(selectedPolicyId!),
    enabled: Boolean(selectedPolicyId),
  });

  useScopedCopyProtection(contentRef, Boolean(policyQuery.data));

  const policies = policiesQuery.data ?? [];
  const selectedPolicy = policyQuery.data ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <ViewerTreeSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        policies={policies}
        isLoading={policiesQuery.isLoading}
        selectedPolicyId={selectedPolicyId}
        scopeLabel={scopeQuery.data?.viewerScope?.label}
        onSelectPolicy={(policy) => setSelectedPolicyId(policy.id)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setSidebarOpen((current) => !current)}
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div>
              <div className="text-sm font-semibold text-slate-900">Policy Viewer</div>
              <div className="text-xs text-slate-500">
                {user?.name || user?.email || "Signed in"}
              </div>
            </div>
          </div>

          <Button type="button" variant="outline" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 border-r border-slate-200 bg-white">
            {!selectedPolicyId ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
                Select a policy from the sidebar to view its full content.
              </div>
            ) : policyQuery.isLoading ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading policy...
              </div>
            ) : policyQuery.isError ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-600">
                {policyQuery.error instanceof Error
                  ? policyQuery.error.message
                  : "Unable to load policy"}
              </div>
            ) : selectedPolicy ? (
              <ScrollArea className="h-full">
                <div
                  ref={contentRef}
                  className="no-copy mx-auto max-w-[880px] px-6 py-8"
                >
                  <PolicyDocumentView policy={selectedPolicy} />
                </div>
              </ScrollArea>
            ) : null}
          </main>

          <PolicyAiAssistant key={selectedPolicyId ?? "none"} policy={selectedPolicy} />
        </div>
      </div>
    </div>
  );
}
