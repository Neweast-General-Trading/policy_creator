export const SSO_ATTEMPT_KEY = "policy_creator_sso_attempted";

export function consumeAuthRedirect(): {
  token: string;
  user: { email: string; name: string };
} | null {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const token = params.get("token")?.trim();
  if (!token) return null;

  const user = {
    email: params.get("email")?.trim() || "",
    name: params.get("name")?.trim() || "",
  };

  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return { token, user };
}

export function consumeTokenFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token")?.trim() || params.get("jwt")?.trim();
  if (!token) return null;

  params.delete("token");
  params.delete("jwt");
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
  );
  return token;
}

export function readLoginErrorFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const message = params.get("loginError")?.trim();
  if (!message) return null;

  window.history.replaceState(null, "", window.location.pathname);
  return message;
}

function currentReturnTo() {
  return `${window.location.origin}${window.location.pathname}${window.location.search}`;
}

export function isIntranetReferrer() {
  const referrer = document.referrer.trim();
  if (!referrer) return false;

  try {
    const hostname = new URL(referrer).hostname.toLowerCase();
    return (
      hostname === "mis.neweast.cloud" ||
      hostname.endsWith(".mis.neweast.cloud") ||
      hostname.includes("intranet")
    );
  } catch {
    return false;
  }
}

export function shouldTrySilentSso() {
  if (sessionStorage.getItem(SSO_ATTEMPT_KEY)) return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get("sso") === "0") return false;

  return params.get("sso") === "1" || isIntranetReferrer() || true;
}

export function markSilentSsoAttempted() {
  sessionStorage.setItem(SSO_ATTEMPT_KEY, "1");
}

export function startMicrosoftLogin(options?: {
  silent?: boolean;
  returnTo?: string;
  loginHint?: string;
}) {
  const params = new URLSearchParams({
    returnTo: options?.returnTo ?? currentReturnTo(),
  });
  if (options?.silent) params.set("silent", "1");
  if (options?.loginHint?.trim()) params.set("login_hint", options.loginHint.trim());
  window.location.href = `/api/auth/microsoft/login?${params.toString()}`;
}
