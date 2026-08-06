import { fetchCompanies, fetchIntranetMenu, type IntranetMenuItem } from "./hana.js";
import { getBiUserByEmail, normalizeEmail } from "./bi-users.js";

function isPolicyCreatorMenuItem(item: IntranetMenuItem) {
  const address = (item.ADDRESS ?? "").trim().toLowerCase();
  const name = (item.GROUPNAME ?? "").trim().toLowerCase();

  const urlHints = (process.env.POLICY_CREATOR_MENU_URLS ?? "policycreator.neweast.cloud")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const nameHints = (process.env.POLICY_CREATOR_MENU_NAMES ?? "Policy Creator")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return (
    urlHints.some((hint) => address.includes(hint)) ||
    nameHints.some((hint) => name === hint || name.includes(hint))
  );
}

export async function hasPolicyCreatorMenuAccess(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;

  const companies = await fetchCompanies(normalizedEmail);
  for (const company of companies) {
    const profile = await getBiUserByEmail(normalizedEmail, company.BRANCH);
    if (!profile?.USER_ID) continue;

    const menuItems = await fetchIntranetMenu(profile.USER_ID, company.BRANCH);
    if (menuItems.some(isPolicyCreatorMenuItem)) {
      return true;
    }
  }

  return false;
}

export async function hasPolicyViewerPortalAccess(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;

  const companies = await fetchCompanies(normalizedEmail);
  return companies.length > 0;
}
