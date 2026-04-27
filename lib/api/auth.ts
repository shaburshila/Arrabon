// Typed API wrappers for auth endpoints.
// All functions throw ApiError on non-2xx responses.

export class ApiError extends Error {
  code: string | null;
  status: number;
  body: unknown;
  reason_code: string | null;

  constructor(status: number, body: unknown) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed with status ${status}`;
    super(message);
    this.name = "ApiError";
    this.code =
      body && typeof body === "object" && "code" in body && typeof (body as { code?: unknown }).code === "string"
        ? (body as { code: string }).code
        : null;
    this.status = status;
    this.body = body;
    this.reason_code =
      body &&
      typeof body === "object" &&
      "reason_code" in body &&
      typeof (body as { reason_code?: unknown }).reason_code === "string"
        ? (body as { reason_code: string }).reason_code
        : null;
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export interface NonceResult {
  nonce: string;
  issued_at: string;
}

export interface SiweSession {
  ok: boolean;
  wallet_address: string;
  is_admin: boolean;
  expires_at: string;
}

// POST /api/auth/siwe/nonce — wallet required in body
export async function fetchNonce(wallet: string): Promise<NonceResult> {
  const res = await fetch("/api/auth/siwe/nonce", {
    body: JSON.stringify({ wallet }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  return parseResponse<NonceResult>(res);
}

// POST /api/auth/siwe/verify — sets HttpOnly session cookie
export async function verifySiwe(
  message: string,
  signature: string,
): Promise<SiweSession> {
  const res = await fetch("/api/auth/siwe/verify", {
    body: JSON.stringify({ message, signature }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  return parseResponse<SiweSession>(res);
}

// POST /api/auth/logout — clears session cookie
export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

// GET /api/private/ping — check if session cookie is valid
// Returns null if not authenticated (401)
export async function pingSession(): Promise<SiweSession | null> {
  const res = await fetch("/api/private/ping");
  if (res.status === 401) return null;
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) return null;
  return body as SiweSession;
}
