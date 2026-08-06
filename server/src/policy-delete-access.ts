import { normalizeEmail } from "./bi-users.js";

const DEFAULT_POLICY_DELETE_ADMINS = ["Rahul@neweast.co"];

function listPolicyDeleteAdmins() {
  const fromEnv = (process.env.POLICY_DELETE_ADMINS ?? "")
    .split(",")
    .map((value) => normalizeEmail(value.trim()))
    .filter(Boolean);

  if (fromEnv.length > 0) return fromEnv;

  return DEFAULT_POLICY_DELETE_ADMINS.map((email) => normalizeEmail(email));
}

export function canDeleteAnyPolicy(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return listPolicyDeleteAdmins().includes(normalized);
}

export function canDeletePolicy(
  policy: { createdByEmail: string; status: string },
  email: string,
) {
  if (canDeleteAnyPolicy(email)) return true;
  return (
    normalizeEmail(policy.createdByEmail) === normalizeEmail(email) &&
    policy.status === "draft"
  );
}
