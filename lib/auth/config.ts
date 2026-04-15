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

function parseAllowedAuthDomains(): string[] {
  const values = [
    process.env.AUTH_DOMAIN,
    ...(process.env.AUTH_ALLOWED_DOMAINS ?? "").split(","),
  ];

  return Array.from(
    new Set(
      values
        .map((value) => normalizeAuthDomain(value ?? ""))
        .filter(Boolean),
    ),
  );
}

export function resolveAllowedAuthDomains(request: Request): string[] {
  ensureAuthEnvironment();

  const requestHost = new URL(request.url).host.toLowerCase();
  const allowedDomains = parseAllowedAuthDomains();

  if (!isProductionRuntime()) {
    return Array.from(new Set([...allowedDomains, requestHost]));
  }

  if (allowedDomains.length > 0) {
    return allowedDomains;
  }

  return [requestHost];
}
