import "server-only";

export type ChainalysisDevMockMode = "blocked" | "clear" | "unavailable";
export type UsdcDevMockMode = "blocked" | "clear" | "unavailable";

const ENABLED_VALUE = "true";

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function isChainalysisDevMockEnabled(): boolean {
  return readEnv("COMPLIANCE_CHAINALYSIS_DEV_MOCK").toLowerCase() === ENABLED_VALUE;
}

export function getChainalysisDevMockMode(): ChainalysisDevMockMode {
  const rawValue = readEnv("COMPLIANCE_CHAINALYSIS_DEV_MOCK_MODE").toLowerCase();

  if (!rawValue) {
    return "clear";
  }

  if (rawValue === "blocked" || rawValue === "clear" || rawValue === "unavailable") {
    return rawValue;
  }

  throw new Error(
    "COMPLIANCE_CHAINALYSIS_DEV_MOCK_MODE must be one of: clear, blocked, unavailable.",
  );
}

export function isUsdcDevMockEnabled(): boolean {
  return readEnv("COMPLIANCE_USDC_DEV_MOCK").toLowerCase() === ENABLED_VALUE;
}

export function getUsdcDevMockMode(): UsdcDevMockMode {
  const rawValue = readEnv("COMPLIANCE_USDC_DEV_MOCK_MODE").toLowerCase();

  if (!rawValue) {
    return "clear";
  }

  if (rawValue === "blocked" || rawValue === "clear" || rawValue === "unavailable") {
    return rawValue;
  }

  throw new Error(
    "COMPLIANCE_USDC_DEV_MOCK_MODE must be one of: clear, blocked, unavailable.",
  );
}
