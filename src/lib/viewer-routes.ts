export const POLICY_VIEWER_URL = "https://policycreator.neweast.cloud/viewer";

export function isViewersPath(pathname = window.location.pathname) {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === "/viewer";
}

export function isViewersAppMode() {
  return isViewersPath();
}
