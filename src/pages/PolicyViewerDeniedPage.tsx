import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { POLICY_VIEWER_URL } from "@/lib/viewer-routes";
import { assetUrl } from "@/lib/utils";

interface PolicyViewerDeniedPageProps {
  email?: string | null;
}

export default function PolicyViewerDeniedPage({ email }: PolicyViewerDeniedPageProps) {
  const { logout } = useAuth();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-red-50/30 p-4">
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-xl backdrop-blur md:p-10">
        <div className="text-center">
          <img
            src={assetUrl("logo.png")}
            alt="NEWEAST"
            className="mx-auto h-16 w-auto"
          />
          <div className="mt-2 text-xs text-slate-500">Policy Viewer</div>
        </div>

        <div className="mt-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
            <ShieldX className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Access denied</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {email
              ? `${email} has no BI company access for Policy Viewer.`
              : "Your account has no BI company access for Policy Viewer."}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Sign in through the Intranet to view policies for your assigned companies.
          </p>
        </div>

        <div className="mt-8 space-y-2">
          <Button type="button" className="h-11 w-full" variant="outline" onClick={logout}>
            Sign out
          </Button>
          <p className="text-center text-[11px] text-slate-400">{POLICY_VIEWER_URL}</p>
        </div>
      </div>
    </div>
  );
}
