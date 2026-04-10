function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export function ensureAuthEnvironment() {
  if (isProductionRuntime() && !process.env.AUTH_DOMAIN?.trim()) {
    throw new Error("AUTH_DOMAIN is required in production");
  }
}

export function resolveExpectedAuthDomain(request: Request): string {
  ensureAuthEnvironment();

  const authDomain = process.env.AUTH_DOMAIN?.trim();

  if (authDomain) {
    return authDomain.toLowerCase();
  }

  return new URL(request.url).host.toLowerCase();
}
