import { NextResponse } from "next/server";
import { AUTH_NONCE_TTL_MS, generateAuthNonce, normalizeWalletAddress } from "@/lib/auth/siwe";
import { createNonce } from "@/server/repositories/nonces";

export const runtime = "nodejs";

function badRequest(message: string) {
  return NextResponse.json({ error: message, ok: false }, { status: 400 });
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const walletValue =
    payload && typeof payload === "object" && "wallet" in payload ? payload.wallet : null;

  if (typeof walletValue !== "string" || walletValue.trim().length === 0) {
    return badRequest("Wallet is required.");
  }

  try {
    const wallet = normalizeWalletAddress(walletValue);
    const nonce = generateAuthNonce();
    const nonceRecord = await createNonce(wallet, nonce, new Date(Date.now() + AUTH_NONCE_TTL_MS));

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
    return badRequest(message);
  }
}
