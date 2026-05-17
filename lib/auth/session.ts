import { createHash, randomBytes } from "crypto";
import { readSessionCookie } from "@/lib/auth/cookies";
import { isContractAdmin } from "@/server/services/contract-admins";
import { createSession, getSession, revokeSession } from "@/server/repositories/sessions";

export const AUTH_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export interface AuthSessionContext {
  expires_at: string;
  is_admin: boolean;
  session_id: string;
  wallet_address: string;
}

export function generateSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAuthSession(wallet: string) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + AUTH_SESSION_TTL_MS);
  const isAdmin = await isContractAdmin(wallet);
  const session = await createSession(wallet, isAdmin, hashSessionToken(token), expiresAt);

  return {
    expiresAt,
    session,
    token,
  };
}

export async function getAuthSessionFromToken(token: string): Promise<AuthSessionContext | null> {
  const session = await getSession(hashSessionToken(token));

  if (!session) {
    return null;
  }

  return {
    expires_at: session.expires_at,
    is_admin: session.is_admin,
    session_id: session.id,
    wallet_address: session.wallet,
  };
}

export async function getAuthSessionFromCurrentCookieStrict(): Promise<AuthSessionContext | null> {
  const sessionToken = await readSessionCookie();

  if (!sessionToken) {
    return null;
  }

  return getAuthSessionFromToken(sessionToken);
}

export async function revokeAuthSession(sessionId: string) {
  return revokeSession(sessionId);
}
