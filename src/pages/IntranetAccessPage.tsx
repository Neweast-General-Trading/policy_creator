import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assetUrl } from "@/lib/utils";

import { POLICY_VIEWER_URL } from "@/lib/viewer-routes";

const INTRANET_HOME =
  import.meta.env.VITE_INTRANET_URL?.trim() || "https://intranet.neweast.cloud";

export default function IntranetAccessPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.08),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_30%)]" />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-xl backdrop-blur md:p-10">
        <div className="text-center">
          <img
            src={assetUrl("logo.png")}
            alt="NEWEAST"
            className="mx-auto h-16 w-auto"
          />
          <div className="mt-2 text-xs text-slate-500">Policy Viewer</div>
        </div>

        <div className="mt-8">
          <h1 className="text-2xl font-bold text-slate-900">Intranet access only</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Policy Viewer opens from the NEWEAST Intranet only. Sign in there first,
            then open{" "}
            <span className="font-medium text-slate-700">{POLICY_VIEWER_URL}</span>{" "}
            from the Intranet menu.
          </p>
        </div>

        <Button
          type="button"
          className="mt-8 h-11 w-full"
          onClick={() => {
            window.location.href = INTRANET_HOME;
          }}
        >
          <ExternalLink className="h-4 w-4" />
          Go to Intranet
        </Button>
      </div>
    </div>
  );
}
