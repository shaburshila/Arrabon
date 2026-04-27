import type { ComplianceReasonCode } from "@/lib/db/types";

export interface ComplianceDisplayInfo {
  isRetryable: boolean;
  message: string;
  title: string;
  verificationLabel: string | null;
  verificationUrl: string | null;
}

const CHAINALYSIS_SCREENING_URL = "https://www.chainalysis.com/sanctions/";
const LOCAL_DENYLIST_SUPPORT_URL = "mailto:support@baseconsult.link";
const USDC_BASESCAN_CONTRACT_URL = process.env.NEXT_PUBLIC_USDC_ADDRESS?.trim()
  ? `https://basescan.org/address/${process.env.NEXT_PUBLIC_USDC_ADDRESS.trim()}#readContract`
  : null;

export function getComplianceDisplay(
  reasonCode: ComplianceReasonCode | string | null,
): ComplianceDisplayInfo {
  switch (reasonCode) {
    case "OFAC_SANCTIONS":
      return {
        isRetryable: false,
        message:
          "This wallet was flagged during sanctions screening. Review the sanctions provider result before retrying.",
        title: "Sanctions screening blocked this action",
        verificationLabel: "Review Chainalysis screening",
        verificationUrl: CHAINALYSIS_SCREENING_URL,
      };
    case "USDC_BLACKLISTED":
      return {
        isRetryable: false,
        message:
          "This wallet appears on the USDC blacklist. Review the USDC contract on Basescan before retrying.",
        title: "USDC blacklist blocked this action",
        verificationLabel: "Review USDC contract on Basescan",
        verificationUrl: USDC_BASESCAN_CONTRACT_URL,
      };
    case "LOCAL_DENYLIST":
      return {
        isRetryable: false,
        message:
          "This wallet was blocked by the local compliance denylist. Contact support if you believe this is incorrect.",
        title: "Local compliance policy blocked this action",
        verificationLabel: "Contact support",
        verificationUrl: LOCAL_DENYLIST_SUPPORT_URL,
      };
    case "PROVIDER_UNAVAILABLE":
      return {
        isRetryable: true,
        message:
          "Compliance screening is temporarily unavailable. Please retry in a moment.",
        title: "Compliance screening is temporarily unavailable",
        verificationLabel: null,
        verificationUrl: null,
      };
    default:
      return {
        isRetryable: false,
        message:
          "This action was blocked by compliance screening. Review the wallet details and contact support if needed.",
        title: "Compliance screening blocked this action",
        verificationLabel: null,
        verificationUrl: null,
      };
  }
}
