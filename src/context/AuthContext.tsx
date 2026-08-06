import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  clearAuthSession,
  decodeAuthSourceFromToken,
  loadAuthToken,
  loadAuthUser,
  storeAuthSession,
  type AuthStorageScope,
  type AuthUser,
} from "@/lib/auth-storage";
import { exchangeIntranetLink, exchangeSsoToken, fetchAuthProfile } from "@/lib/api";
import { consumeIntranetLinkFromQuery } from "@/lib/intranet-link-auth";
import {
  consumeAuthRedirect,
  consumeTokenFromQuery,
  markSilentSsoAttempted,
  readLoginErrorFromUrl,
  shouldTrySilentSso,
  startMicrosoftLogin,
} from "@/lib/microsoft-login";

export type AuthMode = "default" | "intranet-only";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  isLoggingIn: boolean;
  loginWithMicrosoft: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  authMode?: AuthMode;
}

function storageScopeForMode(authMode: AuthMode): AuthStorageScope {
  return authMode === "intranet-only" ? "viewer" : "default";
}

function isAllowedSession(token: string, user: AuthUser | null, authMode: AuthMode) {
  if (authMode !== "intranet-only") return true;
  const authSource =
    user?.authSource ?? decodeAuthSourceFromToken(token) ?? undefined;
  return authSource === "intranet";
}

export function AuthProvider({
  children,
  authMode = "default",
}: AuthProviderProps) {
  const storageScope = storageScopeForMode(authMode);
  const intranetOnly = authMode === "intranet-only";

  const [token, setToken] = useState<string | null>(
    () => loadAuthToken(storageScope) || null,
  );
  const [user, setUser] = useState<AuthUser | null>(() => loadAuthUser(storageScope));
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const handleExpired = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener("policy-creator-auth-expired", handleExpired);
    return () => window.removeEventListener("policy-creator-auth-expired", handleExpired);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const loginError = readLoginErrorFromUrl();
      if (loginError) {
        toast.error(loginError);
      }

      const redirectSession = consumeAuthRedirect();
      if (redirectSession) {
        if (
          intranetOnly &&
          !isAllowedSession(redirectSession.token, null, authMode)
        ) {
          if (!cancelled) {
            clearAuthSession(storageScope);
            setToken(null);
            setUser(null);
            setIsBootstrapping(false);
            toast.error("Policy Viewer requires Intranet login");
          }
          return;
        }

        const redirectUser: AuthUser = {
          ...redirectSession.user,
          authSource:
            decodeAuthSourceFromToken(redirectSession.token) ??
            (intranetOnly ? "intranet" : "microsoft"),
        };
        storeAuthSession(redirectSession.token, redirectUser, storageScope);
        if (!cancelled) {
          setToken(redirectSession.token);
          setUser(redirectUser);
          setIsBootstrapping(false);
          toast.success(`Welcome, ${redirectUser.name || redirectUser.email}`);
        }
        return;
      }

      const intranetLink = consumeIntranetLinkFromQuery();
      if (intranetLink) {
        try {
          const session = await exchangeIntranetLink(intranetLink);
          if (cancelled) return;
          const sessionUser: AuthUser = {
            ...session.user,
            authSource: "intranet",
          };
          storeAuthSession(session.token, sessionUser, storageScope);
          setToken(session.token);
          setUser(sessionUser);
          setIsBootstrapping(false);
          toast.success(`Welcome, ${sessionUser.name || sessionUser.email}`);
          return;
        } catch {
          if (!cancelled) {
            toast.error("Invalid or expired Intranet link");
            if (intranetOnly) {
              setIsBootstrapping(false);
              return;
            }
          }
        }
      }

      const sharedToken = consumeTokenFromQuery();
      if (sharedToken) {
        try {
          const session = await exchangeSsoToken(sharedToken);
          if (cancelled) return;
          const sessionUser: AuthUser = {
            ...session.user,
            authSource: "intranet",
          };
          storeAuthSession(session.token, sessionUser, storageScope);
          setToken(session.token);
          setUser(sessionUser);
          setIsBootstrapping(false);
          toast.success(`Welcome, ${sessionUser.name || sessionUser.email}`);
          return;
        } catch {
          if (!cancelled) {
            toast.error("Could not sign in with the Intranet session");
          }
        }
      }

      const storedToken = loadAuthToken(storageScope);
      if (storedToken) {
        const storedUser = loadAuthUser(storageScope);
        if (!isAllowedSession(storedToken, storedUser, authMode)) {
          clearAuthSession(storageScope);
          if (!cancelled) {
            setToken(null);
            setUser(null);
            setIsBootstrapping(false);
          }
          return;
        }

        try {
          const profile = await fetchAuthProfile(storedToken, storageScope);
          if (cancelled) return;
          const profileUser: AuthUser = {
            ...profile.user,
            authSource:
              profile.user.authSource ??
              storedUser?.authSource ??
              decodeAuthSourceFromToken(storedToken),
          };
          if (!isAllowedSession(storedToken, profileUser, authMode)) {
            clearAuthSession(storageScope);
            setToken(null);
            setUser(null);
            setIsBootstrapping(false);
            return;
          }
          setToken(storedToken);
          setUser(profileUser);
          storeAuthSession(storedToken, profileUser, storageScope);
        } catch {
          if (cancelled) return;
          clearAuthSession(storageScope);
          setToken(null);
          setUser(null);
        } finally {
          if (!cancelled) setIsBootstrapping(false);
        }
        return;
      }

      if (!intranetOnly && shouldTrySilentSso()) {
        markSilentSsoAttempted();
        setIsLoggingIn(true);
        startMicrosoftLogin({ silent: true });
        return;
      }

      if (!cancelled) setIsBootstrapping(false);
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [authMode, intranetOnly, storageScope]);

  const loginWithMicrosoft = useCallback(() => {
    if (intranetOnly) {
      toast.error("Policy Viewer is available through Intranet login only");
      return;
    }
    setIsLoggingIn(true);
    startMicrosoftLogin({ silent: false });
  }, [intranetOnly]);

  const logout = useCallback(() => {
    clearAuthSession(storageScope);
    setToken(null);
    setUser(null);
  }, [storageScope]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: !!token && !!user,
      isBootstrapping,
      isLoggingIn,
      loginWithMicrosoft,
      logout,
    }),
    [user, token, isBootstrapping, isLoggingIn, loginWithMicrosoft, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
