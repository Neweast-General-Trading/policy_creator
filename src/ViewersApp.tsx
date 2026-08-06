import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import IntranetAccessPage from "@/pages/IntranetAccessPage";
import PolicyViewerDeniedPage from "@/pages/PolicyViewerDeniedPage";
import ViewersPage from "@/pages/ViewersPage";
import { useAuth } from "@/context/AuthContext";
import { fetchViewerSummary, isViewerAccessDeniedError } from "@/lib/api";

export default function ViewersApp() {
  const { isAuthenticated, isBootstrapping, user } = useAuth();

  const accessQuery = useQuery({
    queryKey: ["viewer-access"],
    queryFn: () => fetchViewerSummary(),
    enabled: isAuthenticated,
    retry: false,
  });

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <IntranetAccessPage />;
  }

  if (accessQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Checking access...
      </div>
    );
  }

  if (accessQuery.isError && isViewerAccessDeniedError(accessQuery.error)) {
    return <PolicyViewerDeniedPage email={user?.email} />;
  }

  if (accessQuery.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-center text-sm text-red-600">
        {accessQuery.error instanceof Error
          ? accessQuery.error.message
          : "Unable to verify Policy Viewer access"}
      </div>
    );
  }

  return <ViewersPage />;
}
