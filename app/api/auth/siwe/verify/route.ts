import { NextResponse } from "next/server";
import { resolveAllowedAuthDomains } from "@/lib/auth/config";
import { setSessionCookie } from "@/lib/auth/cookies";
import { createAuthSession } from "@/lib/auth/session";
import {
  AUTH_VERIFY_RATE_LIMIT_MAX_REQUESTS,
  AUTH_VERIFY_RATE_LIMIT_WINDOW_MS,
  parseSiweMessage,
  verifySiweMessage,
} from "@/lib/auth/siwe";
import {
  countRecentSecurityRequestAttempts,
  createSecurityRequestAttempt,
  deleteExpiredSecurityRequestAttempts,
} from "@/server/repositories/security-request-attempts";
import { consumeValidNonce } from "@/server/repositories/nonces";
import { getOrCreateUser } from "@/server/repositories/users";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message, ok: false }, { status });
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const messageValue =
    payload && typeof payload === "object" && "message" in payload ? payload.message : null;
  const signatureValue =
    payload && typeof payload === "object" && "signature" in payload ? payload.signature : null;

  if (typeof messageValue !== "string" || messageValue.trim().length === 0) {
    return jsonError("Message is required.", 400);
  }

  if (typeof signatureValue !== "string" || signatureValue.trim().length === 0) {
    return jsonError("Signature is required.", 400);
  }

  try {
    const parsedMessage = parseSiweMessage(messageValue);
    const now = new Date();
    const windowStart = new Date(now.getTime() - AUTH_VERIFY_RATE_LIMIT_WINDOW_MS);

    await deleteExpiredSecurityRequestAttempts("siwe_verify", windowStart);

    const recentVerifyCount = await countRecentSecurityRequestAttempts({
      scope: "siwe_verify",
      walletAddress: parsedMessage.address,
      since: windowStart,
    });

    if (recentVerifyCount >= AUTH_VERIFY_RATE_LIMIT_MAX_REQUESTS) {
      return jsonError("Too many verification attempts. Please try again later.", 429);
    }

    await createSecurityRequestAttempt({
      scope: "siwe_verify",
      walletAddress: parsedMessage.address,
    });

    const verifiedMessage = await verifySiweMessage({
      expectedDomains: resolveAllowedAuthDomains(request),
      message: messageValue,
      signature: signatureValue,
    });
    const usedNonce = await consumeValidNonce(
      verifiedMessage.address,
      verifiedMessage.nonce,
      new Date(),
    );

    if (!usedNonce) {
      return jsonError("Nonce is invalid or expired.", 401);
    }

    await getOrCreateUser(verifiedMessage.address);

    const { expiresAt, session, token } = await createAuthSession(verifiedMessage.address);
    const response = NextResponse.json({
      expires_at: expiresAt.toISOString(),
      is_admin: session.is_admin,
      ok: true,
      wallet_address: verifiedMessage.address,
    });

    setSessionCookie(response, token, expiresAt);

    return response;
  } catch (error) {
    console.error("[siwe/verify]", error);
    return jsonError("Authentication failed.", 401);
  }
}
