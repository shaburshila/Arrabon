import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/cookies";
import {
  getAuthSessionFromCurrentCookieStrict,
  revokeAuthSession,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  let session;

  try {
    session = await getAuthSessionFromCurrentCookieStrict();
  } catch (error) {
    console.error("Failed to load auth session during logout.", {
      error: error instanceof Error ? error.message : String(error),
      operation: "auth.logout.lookup",
    });

    return NextResponse.json(
      {
        code: "LOGOUT_LOOKUP_FAILED",
        error: "Failed to invalidate the current session.",
      },
      { status: 500 },
    );
  }

  if (session) {
    try {
      await revokeAuthSession(session.session_id);
    } catch (error) {
      console.error("Failed to revoke auth session during logout.", {
        error: error instanceof Error ? error.message : String(error),
        operation: "auth.logout.revoke",
        sessionId: session.session_id,
      });

      return NextResponse.json(
        {
          code: "LOGOUT_REVOKE_FAILED",
          error: "Failed to invalidate the current session.",
        },
        { status: 500 },
      );
    }
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
