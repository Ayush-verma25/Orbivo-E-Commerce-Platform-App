import { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify, decodeJwt } from "jose";
import { findNeonUser } from "../services/neonUser.js";
import { prisma } from "../config/prisma.js";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "merchant" | "customer";
  store_id?: number | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

const NEON_AUTH_JWKS_URL = process.env.NEON_AUTH_JWKS_URL;
const NEON_AUTH_BASE_URL = process.env.NEON_AUTH_BASE_URL;
const NEON_AUTH_AUDIENCE = process.env.NEON_AUTH_AUDIENCE;

let neonJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
let neonIssuer = "";

try {
  if (NEON_AUTH_JWKS_URL) {
    neonJWKS = createRemoteJWKSet(new URL(NEON_AUTH_JWKS_URL));
  }
  if (NEON_AUTH_BASE_URL) {
    neonIssuer = new URL(NEON_AUTH_BASE_URL).origin;
  }
} catch (e) {
  console.warn("Neon Auth JWKS initialization warning:", e);
}

/**
 * Verifies an authentication token via Neon Auth JWKS, Neon session table lookup,
 * or decoded JWT payload, resolving the active user and associated store.
 *
 * @param token - JWT or session token string without the Bearer prefix.
 * @returns The resolved user with a store ID, or null when authentication fails.
 */
export const verifyAuthToken = async (
  token: string,
): Promise<AuthUser | null> => {
  if (!token || typeof token !== "string" || !token.trim()) return null;

  const cleanToken = token.trim();
  let userId: string | null = null;
  let payload: Record<string, any> | null = null;

  // 1. If it looks like a JWT (3 dot-separated parts) and JWKS is initialized, attempt JWKS verification
  if (cleanToken.split(".").length === 3 && neonJWKS) {
    try {
      const validIssuers = [
        neonIssuer,
        NEON_AUTH_BASE_URL,
        NEON_AUTH_BASE_URL ? NEON_AUTH_BASE_URL.replace(/\/+$/, "") : "",
      ].filter(Boolean) as string[];

      const verifyOptions: any = {};
      if (validIssuers.length > 0) {
        verifyOptions.issuer =
          validIssuers.length === 1 ? validIssuers[0] : validIssuers;
      }
      if (NEON_AUTH_AUDIENCE) {
        verifyOptions.audience = NEON_AUTH_AUDIENCE;
      }

      const result = await jwtVerify(cleanToken, neonJWKS, verifyOptions);
      if (result.payload?.sub) {
        userId = String(result.payload.sub);
        payload = result.payload;
      }
    } catch (jwtErr: any) {
      console.warn(
        "JWKS verification warning (falling back to session lookup):",
        jwtErr?.message || jwtErr,
      );
    }
  }

  // 2. Database session lookup fallback (handles Better Auth session tokens or when JWKS fails)
  if (!userId) {
    try {
      const sessionRows = await prisma.$queryRaw<Array<{ userId: string }>>`
        SELECT "userId"
        FROM neon_auth."session"
        WHERE token = ${cleanToken} AND "expiresAt" > NOW()
        LIMIT 1;
      `;
      if (sessionRows && sessionRows.length > 0 && sessionRows[0].userId) {
        userId = String(sessionRows[0].userId);
      }
    } catch (sessionErr: any) {
      console.warn(
        "Session table lookup fallback error:",
        sessionErr?.message || sessionErr,
      );
    }
  }

  // 3. Fallback: If it's a validly structured unexpired JWT, verify user exists in DB
  if (!userId && cleanToken.split(".").length === 3) {
    try {
      const decoded = decodeJwt(cleanToken);
      if (decoded?.sub && (!decoded.exp || decoded.exp * 1000 > Date.now())) {
        const dbUser = await findNeonUser({ id: String(decoded.sub) });
        if (dbUser) {
          userId = String(decoded.sub);
          payload = decoded;
        }
      }
    } catch {
      // Not a valid JWT structure
    }
  }

  if (!userId) {
    return null;
  }

  try {
    const u = await findNeonUser({ id: userId });

    const effectiveName =
      u?.name || String(payload?.name || u?.email?.split("@")[0] || "User");
    const effectiveEmail = u?.email || String(payload?.email || "");

    const store = await prisma.stores.findFirst({
      where: { merchant_id: userId },
    });

    let role: "admin" | "merchant" | "customer" = "customer";
    if (u?.role === "admin" || payload?.role === "admin") {
      role = "admin";
    } else if (store || u?.role === "merchant" || payload?.role === "merchant") {
      role = "merchant";
    }

    return {
      id: userId,
      name: effectiveName,
      email: effectiveEmail,
      role,
      store_id: role === "admin" ? null : store?.id || null,
    };
  } catch (error) {
    console.warn("User or store lookup failed:", error);
    return null;
  }
};

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ success: false, message: "Unauthorized: No token provided" });
    return;
  }

  const token = authHeader.split(" ")[1];
  const user = await verifyAuthToken(token);

  if (!user) {
    res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid or expired token",
    });
    return;
  }

  req.user = user;
  next();
};

/**
 * Attaches a verified user to req.user for a case-sensitive `Bearer ` header,
 * trimming surrounding token whitespace. Leaves req.user unchanged when the
 * header is absent or authentication fails, then calls next in either case.
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    const user = await verifyAuthToken(token);
    if (user) {
      req.user = user;
    }
  }
  next();
};

/**
 * Creates middleware that calls next when req.user has one of the allowed roles.
 * Otherwise sends a 403 JSON response with success: false and
 * "Forbidden: Access denied" without calling next. Does not authenticate tokens;
 * authentication middleware must populate req.user first.
 *
 * @param roles - Allowed roles; an empty array denies every request.
 */
export const requireRole = (
  roles: Array<"admin" | "merchant" | "customer">,
) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res
        .status(403)
        .json({ success: false, message: "Forbidden: Access denied" });
      return;
    }
    next();
  };
};
