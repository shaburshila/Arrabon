import { NextResponse } from "next/server";
import {
  AUTH_NONCE_RATE_LIMIT_MAX_REQUESTS,
  AUTH_NONCE_RATE_LIMIT_WINDOW_MS,
  AUTH_NONCE_TTL_MS,
  generateAuthNonce,
  normalizeWalletAddress,
} from "@/lib/auth/siwe";
import {
  countRecentNonces,
  createNonce,
  deleteExpiredNonces,
  invalidateActiveNonces,
} from "@/server/repositories/nonces";

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

  const walletValue =
    payload && typeof payload === "object" && "wallet" in payload ? payload.wallet : null;

  if (typeof walletValue !== "string" || walletValue.trim().length === 0) {
    return jsonError("Wallet is required.", 400);
  }

  let wallet: string;

  try {
    wallet = normalizeWalletAddress(walletValue);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid wallet address.";
    return jsonError(message, 400);
  }

  try {
    const now = new Date();
    await deleteExpiredNonces(now);

    const recentNonceCount = await countRecentNonces(
      wallet,
      new Date(now.getTime() - AUTH_NONCE_RATE_LIMIT_WINDOW_MS),
    );

    if (recentNonceCount >= AUTH_NONCE_RATE_LIMIT_MAX_REQUESTS) {
      return jsonError("Too many nonce requests. Please try again later.", 429);
    }

    await invalidateActiveNonces(wallet, now);

    const nonce = generateAuthNonce();
    const nonceRecord = await createNonce(
      wallet,
      nonce,
      new Date(now.getTime() + AUTH_NONCE_TTL_MS),
    );

    return NextResponse.json(
      {
        issued_at: nonceRecord.created_at,
        nonce: nonceRecord.nonce,
        ok: true,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create nonce.";
    return jsonError(message, 500);
  }
}
