import "server-only";

import { ConsultEscrowConfigError } from "@/lib/base/consult-escrow";
import { DealEventSyncServiceError } from "@/server/services/deal-events";

export type DealEventsWorkerFailureType = "fatal" | "retryable";

export interface ClassifiedDealEventsWorkerError {
  code: string;
  message: string;
  type: DealEventsWorkerFailureType;
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown deal events worker failure.";
}

function readErrorName(error: unknown): string | null {
  return error instanceof Error ? error.name : null;
}

function readErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  const code = (error as { code?: unknown }).code;

  return typeof code === "string" ? code : null;
}

function isChainSyncConfigError(message: string): boolean {
  return (
    message.startsWith("CHAIN_SYNC_") &&
    (
      message.includes("must be a valid integer") ||
      message.includes("must be a non-negative integer") ||
      message.includes("must be greater than or equal to 1")
    )
  );
}

function isEscrowConfigError(error: unknown, message: string): boolean {
  return (
    error instanceof ConsultEscrowConfigError ||
    message.includes("NEXT_PUBLIC_CONSULT_ESCROW_ADDRESS") ||
    message.includes("NEXT_PUBLIC_BASE_CHAIN_ID") ||
    message.startsWith("Missing required environment variable:")
  );
}

function isNetworkLikeError(error: unknown, message: string): boolean {
  const code = readErrorCode(error);
  const name = readErrorName(error);
  const lowerMessage = message.toLowerCase();

  return (
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    code?.startsWith("UND_ERR_") === true ||
    name === "HttpRequestError" ||
    name === "TimeoutError" ||
    name === "RpcRequestError" ||
    lowerMessage.includes("fetch failed") ||
    lowerMessage.includes("network") ||
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("rpc")
  );
}

export function classifyDealEventsWorkerError(
  error: unknown,
): ClassifiedDealEventsWorkerError {
  const message = readErrorMessage(error);

  if (isChainSyncConfigError(message) || isEscrowConfigError(error, message)) {
    return {
      code: "WORKER_CONFIG_INVALID",
      message,
      type: "fatal",
    };
  }

  if (isNetworkLikeError(error, message)) {
    return {
      code: "WORKER_TRANSPORT_UNAVAILABLE",
      message,
      type: "retryable",
    };
  }

  if (error instanceof DealEventSyncServiceError) {
    return {
      code: error.code,
      message,
      type: "retryable",
    };
  }

  return {
    code: "WORKER_UNCLASSIFIED_FAILURE",
    message,
    type: "retryable",
  };
}
