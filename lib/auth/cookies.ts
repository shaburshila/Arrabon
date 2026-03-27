import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const AUTH_SESSION_COOKIE_NAME = "bcl_session";

function isSecureCookie() {
  return process.env.NODE_ENV === "production";
}

export async function readSessionCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value ?? null;
}

export function setSessionCookie(
  response: NextResponse,
  sessionToken: string,
  expiresAt: Date,
) {
  response.cookies.set({
    expires: expiresAt,
    httpOnly: true,
    name: AUTH_SESSION_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: isSecureCookie(),
    value: sessionToken,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    expires: new Date(0),
    httpOnly: true,
    name: AUTH_SESSION_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: isSecureCookie(),
    value: "",
  });
}
