function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

function normalizeAuthDomain(value: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  try {
    return new URL(trimmedValue).host.toLowerCase();
  } catch {
    return trimmedValue.split("/")[0].toLowerCase();
  }
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
    return normalizeAuthDomain(authDomain);
  }

  return new URL(request.url).host.toLowerCase();
}
