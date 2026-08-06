import jwt from "jsonwebtoken";

export type AuthSource = "intranet" | "microsoft";

export interface AuthUser {
  email: string;
  name: string;
  oid?: string;
  tid?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  authSource?: AuthSource;
}

function getJwtSecret() {
  const secret = process.env.APP_JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("APP_JWT_SECRET is not configured");
  }
  return secret;
}

export function signAppToken(user: AuthUser, authSource: AuthSource = user.authSource ?? "microsoft") {
  return jwt.sign({ ...user, authSource }, getJwtSecret(), { expiresIn: "8h" });
}

export function verifyAppToken(token: string): AuthUser {
  const payload = jwt.verify(token, getJwtSecret()) as AuthUser;
  return {
    email: payload.email,
    name: payload.name,
    oid: payload.oid,
    tid: payload.tid,
    preferred_username: payload.preferred_username,
    given_name: payload.given_name,
    family_name: payload.family_name,
    authSource: payload.authSource,
  };
}

/** Accept a JWT signed with the shared APP_JWT_SECRET (e.g. from Intranet) and issue a fresh session. */
export function exchangeSharedAppToken(token: string) {
  const payload = verifyAppToken(token);
  const email = payload.email?.trim();
  if (!email) {
    throw new Error("Invalid token payload");
  }

  const user: AuthUser = {
    email,
    name: payload.name?.trim() || email,
    oid: payload.oid,
    tid: payload.tid,
    preferred_username: payload.preferred_username,
    given_name: payload.given_name,
    family_name: payload.family_name,
    authSource: "intranet",
  };

  return { user, token: signAppToken(user, "intranet") };
}

export async function verifyAzureAccessToken(accessToken: string) {
  const response = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Invalid Microsoft access token");
  }

  const account = (await response.json()) as {
    id: string;
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
    givenName?: string;
    surname?: string;
    jobTitle?: string;
    department?: string;
  };

  const email = (account.mail || account.userPrincipalName || "").trim();
  if (!email) {
    throw new Error("Microsoft account email is missing");
  }

  const user: AuthUser = {
    email,
    name: account.displayName?.trim() || email,
    oid: account.id,
    preferred_username: account.userPrincipalName,
    given_name: account.givenName,
    family_name: account.surname,
    authSource: "microsoft",
  };

  return {
    user,
    account,
    token: signAppToken(user, "microsoft"),
  };
}
