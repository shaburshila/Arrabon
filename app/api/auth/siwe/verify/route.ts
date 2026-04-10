import { NextResponse } from "next/server";
import { resolveExpectedAuthDomain } from "@/lib/auth/config";
import { setSessionCookie } from "@/lib/auth/cookies";
import { createAuthSession, isAdminWallet } from "@/lib/auth/session";
import { verifySiweMessage } from "@/lib/auth/siwe";
import { getValidNonce, markUsed } from "@/server/repositories/nonces";
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
    const verifiedMessage = await verifySiweMessage({
      expectedDomain: resolveExpectedAuthDomain(request),
      message: messageValue,
      signature: signatureValue,
    });
    const nonceRecord = await getValidNonce(verifiedMessage.address, verifiedMessage.nonce);

    if (!nonceRecord) {
      return jsonError("Nonce is invalid or expired.", 401);
    }

    const usedNonce = await markUsed(nonceRecord.id);

    if (!usedNonce) {
      return jsonError("Nonce has already been used.", 409);
    }

    await getOrCreateUser(verifiedMessage.address);

    const { expiresAt, token } = await createAuthSession(verifiedMessage.address);
    const response = NextResponse.json({
      expires_at: expiresAt.toISOString(),
      is_admin: isAdminWallet(verifiedMessage.address),
      ok: true,
      wallet_address: verifiedMessage.address,
    });

    setSessionCookie(response, token, expiresAt);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify SIWE message.";
    return jsonError(message, 401);
  }
}
