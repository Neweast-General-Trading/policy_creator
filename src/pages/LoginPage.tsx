import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { assetUrl } from "@/lib/utils";

function MicrosoftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 23 23" className="h-4 w-4">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

interface LoginPageProps {
  title?: string;
  description?: string;
  badge?: string;
}

export default function LoginPage({
  title = "Hey, Hello 👋",
  description = "Sign in with your NEWEAST Microsoft account to create and manage policy documents.",
  badge = "Policy Creator (v2.0.0)",
}: LoginPageProps = {}) {
  const { loginWithMicrosoft, isLoggingIn } = useAuth();

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
          <div className="mt-2 text-xs text-slate-500">{badge}</div>
        </div>

        <div className="mt-8">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>

        <Button
          type="button"
          className="mt-8 h-11 w-full"
          onClick={() => loginWithMicrosoft()}
          disabled={isLoggingIn}
        >
          {isLoggingIn ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MicrosoftIcon />
          )}
          {isLoggingIn ? "Signing in..." : "Login with Microsoft"}
        </Button>
      </div>
    </div>
  );
}
