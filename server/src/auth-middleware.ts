import type { NextFunction, Request, Response } from "express";
import { verifyAppToken, type AuthUser } from "./auth.js";
import {
  hasPolicyCreatorMenuAccess,
  hasPolicyViewerPortalAccess,
} from "./policy-creator-access.js";
import { normalizeEmail } from "./bi-users.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing token" });
    return;
  }

  const token = authHeader.slice("Bearer ".length);
  try {
    req.user = verifyAppToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireIntranetAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  requireAuth(req, res, () => {
    if (req.user?.authSource !== "intranet") {
      res.status(403).json({
        error: "Policy Viewer is available through Intranet login only",
        code: "intranet_only",
      });
      return;
    }
    next();
  });
}

export function requirePolicyViewerPortal(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  requireIntranetAuth(req, res, () => {
    void (async () => {
      try {
        const email = normalizeEmail(req.user?.email ?? "");
        if (!(await hasPolicyViewerPortalAccess(email))) {
          res.status(403).json({
            error: "No BI company access found for Policy Viewer",
            code: "viewer_access_denied",
          });
          return;
        }
        next();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    })();
  });
}

export function requirePolicyCreatorApp(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.path.startsWith("/viewers") || req.path === "/access") {
    next();
    return;
  }

  void (async () => {
    try {
      const email = normalizeEmail(req.user?.email ?? "");
      if (!(await hasPolicyCreatorMenuAccess(email))) {
        res.status(403).json({
          error: "Policy Creator access is not assigned in BI",
          code: "policy_creator_access_denied",
        });
        return;
      }
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  })();
}
