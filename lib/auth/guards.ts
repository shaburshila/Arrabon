import { readSessionCookie } from "@/lib/auth/cookies";
import { getAuthSessionFromToken, type AuthSessionContext } from "@/lib/auth/session";
import { getByWallet } from "@/server/repositories/users";

export class AuthGuardError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthGuardError";
    this.status = status;
  }
}

export interface CurrentUserContext {
  avatar_url: string | null;
  expires_at: string;
  id: string;
  is_admin: boolean;
  username: string | null;
  wallet_address: string;
}

export async function getCurrentSession(): Promise<AuthSessionContext | null> {
  try {
    const sessionToken = await readSessionCookie();

    if (!sessionToken) {
      return null;
    }

    return await getAuthSessionFromToken(sessionToken);
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getCurrentSession();

  if (!session) {
    throw new AuthGuardError("Authentication required.", 401);
  }

  return session;
}

export async function getCurrentUser(): Promise<CurrentUserContext | null> {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const user = await getByWallet(session.wallet_address);

  if (!user) {
    return null;
  }

  return {
    avatar_url: user.avatar_url,
    expires_at: session.expires_at,
    id: user.id,
    is_admin: session.is_admin,
    username: user.username,
    wallet_address: user.wallet,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthGuardError("Authentication required.", 401);
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (!user.is_admin) {
    throw new AuthGuardError("Access denied.", 403);
  }

  return user;
}
