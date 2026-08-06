export type AuthSource = "intranet" | "microsoft";

export interface AuthUser {
  email: string;
  name: string;
  oid?: string;
  preferred_username?: string;
  authSource?: AuthSource;
}

export type AuthStorageScope = "default" | "viewer";

const STORAGE_KEYS = {
  default: {
    token: "policy_creator_jwt",
    user: "policy_creator_user",
    source: "policy_creator_auth_source",
  },
  viewer: {
    token: "policy_creator_viewer_jwt",
    user: "policy_creator_viewer_user",
    source: "policy_creator_viewer_auth_source",
  },
} as const;

function keys(scope: AuthStorageScope) {
  return STORAGE_KEYS[scope];
}

export function loadAuthToken(scope: AuthStorageScope = "default") {
  return localStorage.getItem(keys(scope).token)?.trim() ?? "";
}

export function loadAuthUser(scope: AuthStorageScope = "default"): AuthUser | null {
  const raw = localStorage.getItem(keys(scope).user);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as AuthUser;
    const authSource =
      user.authSource ??
      (localStorage.getItem(keys(scope).source) as AuthSource | null) ??
      undefined;
    return { ...user, authSource };
  } catch {
    return null;
  }
}

export function storeAuthSession(
  token: string,
  user: AuthUser,
  scope: AuthStorageScope = "default",
) {
  localStorage.setItem(keys(scope).token, token);
  localStorage.setItem(keys(scope).user, JSON.stringify(user));
  if (user.authSource) {
    localStorage.setItem(keys(scope).source, user.authSource);
  }
}

export function clearAuthSession(scope: AuthStorageScope = "default") {
  localStorage.removeItem(keys(scope).token);
  localStorage.removeItem(keys(scope).user);
  localStorage.removeItem(keys(scope).source);
}

export function decodeAuthSourceFromToken(token: string): AuthSource | undefined {
  try {
    const payload = token.split(".")[1];
    if (!payload) return undefined;
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      authSource?: AuthSource;
    };
    return decoded.authSource;
  } catch {
    return undefined;
  }
}
