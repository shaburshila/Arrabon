import { NextResponse } from "next/server";
import { AuthGuardError, requireSession } from "@/lib/auth/guards";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireSession();

    return NextResponse.json({
      expires_at: session.expires_at,
      is_admin: session.is_admin,
      ok: true,
      wallet_address: session.wallet_address,
    });
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return NextResponse.json({ error: error.message, ok: false }, { status: error.status });
    }

    return NextResponse.json({ error: "Failed to validate session.", ok: false }, { status: 500 });
  }
}
