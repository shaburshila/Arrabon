import "server-only";

import { getAddress, type Address } from "viem";

import { baseRuntimeConfig } from "@/lib/base/config";

export class ComplianceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComplianceConfigError";
  }
}

export interface ComplianceConfig {
  chainalysisOracleAddress: Address;
  circuitBreakerFailureThreshold: number;
  circuitBreakerResetMs: number;
  circuitBreakerWindowMs: number;
  usdcAddress: Address;
}

let complianceConfig: ComplianceConfig | null = null;

function getRequiredEnv(name: "COMPLIANCE_CHAINALYSIS_ORACLE_ADDRESS"): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ComplianceConfigError(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readPositiveIntegerEnv(
  name:
    | "COMPLIANCE_CB_FAILURE_THRESHOLD"
    | "COMPLIANCE_CB_RESET_MS"
    | "COMPLIANCE_CB_WINDOW_MS",
): number {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ComplianceConfigError(`Missing required environment variable: ${name}`);
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ComplianceConfigError(`${name} must be a positive integer.`);
  }

  return parsed;
}

function readAddress(value: string, envName: string): Address {
  try {
    return getAddress(value);
  } catch {
    throw new ComplianceConfigError(`${envName} must be a valid EVM address.`);
  }
}

export function getComplianceConfig(): ComplianceConfig {
  if (complianceConfig) {
    return complianceConfig;
  }

  complianceConfig = {
    chainalysisOracleAddress: readAddress(
      getRequiredEnv("COMPLIANCE_CHAINALYSIS_ORACLE_ADDRESS"),
      "COMPLIANCE_CHAINALYSIS_ORACLE_ADDRESS",
    ),
    circuitBreakerFailureThreshold: readPositiveIntegerEnv("COMPLIANCE_CB_FAILURE_THRESHOLD"),
    circuitBreakerResetMs: readPositiveIntegerEnv("COMPLIANCE_CB_RESET_MS"),
    circuitBreakerWindowMs: readPositiveIntegerEnv("COMPLIANCE_CB_WINDOW_MS"),
    usdcAddress: readAddress(baseRuntimeConfig.usdcAddress, "NEXT_PUBLIC_USDC_ADDRESS"),
  };

  return complianceConfig;
}
