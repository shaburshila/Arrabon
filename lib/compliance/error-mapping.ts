import type { Address } from "viem";

import type {
  ComplianceProviderId,
} from "@/lib/db/types";
import type {
  BlockingReasonCode,
  ComplianceScreeningContext,
  ScreeningResult,
} from "@/lib/compliance/types";

export class ComplianceBlockedError extends Error {
  dealId: string | null;
  provider: ComplianceProviderId | null;
  reasonCode: BlockingReasonCode;
  walletAddress: string;

  constructor(input: {
    dealId: string | null;
    provider: ComplianceProviderId | null;
    reasonCode: BlockingReasonCode;
    walletAddress: string;
  }) {
    super(resolveComplianceErrorMessage(input.reasonCode));
    this.name = "ComplianceBlockedError";
    this.dealId = input.dealId;
    this.provider = input.provider;
    this.reasonCode = input.reasonCode;
    this.walletAddress = input.walletAddress;
  }
}

function resolveComplianceErrorMessage(reasonCode: BlockingReasonCode): string {
  switch (reasonCode) {
    case "OFAC_SANCTIONS":
      return "Wallet flagged by sanctions screening.";
    case "USDC_BLACKLISTED":
      return "Wallet blocked by token blacklist screening.";
    case "LOCAL_DENYLIST":
      return "Wallet blocked by compliance screening.";
    case "PROVIDER_UNAVAILABLE":
      return "Compliance screening is temporarily unavailable.";
  }
}

export function assertCompliance(
  result: ScreeningResult,
  walletAddress: string,
  ctx: ComplianceScreeningContext,
): void {
  if (result.result !== "Blocked") {
    return;
  }

  throw new ComplianceBlockedError({
    dealId: ctx.dealId,
    provider: result.provider,
    reasonCode: result.reasonCode,
    walletAddress: walletAddress.toLowerCase(),
  });
}

export function complianceErrorToHttpResponse(error: ComplianceBlockedError): Response {
  return Response.json(
    {
      code: "COMPLIANCE_BLOCKED",
      error: resolveComplianceErrorMessage(error.reasonCode),
      reason_code: error.reasonCode,
      wallet_address: error.walletAddress.toLowerCase(),
    },
    { status: 403 },
  );
}

export function withComplianceErrorHandling<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Response | Promise<Response>,
): (...args: TArgs) => Promise<Response> {
  return async (...args: TArgs): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ComplianceBlockedError) {
        return complianceErrorToHttpResponse(error);
      }

      throw error;
    }
  };
}
