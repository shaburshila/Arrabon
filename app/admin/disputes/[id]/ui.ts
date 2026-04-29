import type { DealRiskStatus } from "@/lib/db/types";

export function getAdminResolveAvailability(
  riskStatus: DealRiskStatus,
  acknowledgedReviewRisk: boolean,
): {
  blocked: boolean;
  disabled: boolean;
  disabledReason: string | null;
  requiresAcknowledge: boolean;
} {
  if (riskStatus === "Blocked") {
    return {
      blocked: true,
      disabled: true,
      disabledReason: "Funds are in legal hold.",
      requiresAcknowledge: false,
    };
  }

  if (riskStatus === "Review" && !acknowledgedReviewRisk) {
    return {
      blocked: false,
      disabled: true,
      disabledReason: "Acknowledge the review risk before resolving this dispute.",
      requiresAcknowledge: true,
    };
  }

  return {
    blocked: false,
    disabled: false,
    disabledReason: null,
    requiresAcknowledge: riskStatus === "Review",
  };
}
