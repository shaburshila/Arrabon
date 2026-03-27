import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/cookies";
import { getCurrentSession } from "@/lib/auth/guards";
import { revokeAuthSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await getCurrentSession();

    if (session) {
      await revokeAuthSession(session.session_id);
    }
  } catch {
    // Logout is intentionally idempotent: auth lookup/revoke failures
    // must not prevent cookie cleanup or a 200 response.
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
