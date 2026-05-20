import type { DealRiskStatus } from "@/lib/db/types";
import type { AdminDealReview } from "@/lib/api/admin-deals";

export function adminDealStatusLabel(status: AdminDealReview["status"]): string {
  return status === "ConfirmPending" ? "Awaiting confirmation" : "Disputed";
}

export function adminDealStatusTone(status: AdminDealReview["status"]): "danger" | "warning" {
  return status === "ConfirmPending" ? "warning" : "danger";
}

export function adminDealLinkLabel(status: AdminDealReview["status"]): string {
  return status === "ConfirmPending" ? "View blocked deal" : "View dispute";
}

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

export function shouldShowFlaggedDeal(
  riskStatus: "Blocked" | "Clear" | "Review",
  showOnlyFlagged: boolean,
): boolean {
  return !showOnlyFlagged || riskStatus !== "Clear";
}
