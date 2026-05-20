"use client";

import { getAdminResolveAvailability } from "@/app/admin/disputes/ui";
import type { AdminDealReview, AdminResolution } from "@/lib/api/admin-deals";
import { Btn } from "@/components/shared/btn";
import { Notice } from "@/components/shared/notice";

export interface AdminDisputeResolveControlsProps {
  acknowledgedReviewRisk: boolean;
  confirmForDeal: { dealId: string; resolution: AdminResolution } | null;
  deal: AdminDealReview;
  isResolving: boolean;
  onAcknowledgeReviewRiskChange: (checked: boolean) => void;
  onConfirmingChange: (
    next: { dealId: string; resolution: AdminResolution } | null,
  ) => void;
  onResolve: (deal: AdminDealReview, resolution: AdminResolution) => void;
}

function actionLabel(resolution: AdminResolution) {
  return resolution === "release" ? "Release to seller" : "Refund to buyer";
}

export function AdminDisputeResolveControls({
  acknowledgedReviewRisk,
  confirmForDeal,
  deal,
  isResolving,
  onAcknowledgeReviewRiskChange,
  onConfirmingChange,
  onResolve,
}: AdminDisputeResolveControlsProps) {
  const resolveAvailability = getAdminResolveAvailability(
    deal.risk_status,
    acknowledgedReviewRisk,
  );
  const actionDisabled = isResolving || resolveAvailability.disabled;

  return (
    <>
      {deal.risk_status === "Blocked" && (
        <Notice
          message="Funds in legal hold. Do not resolve this dispute until cleared by counsel. Both release and refund may constitute an OFAC violation."
          title="Legal hold"
          tone="danger"
        />
      )}

      {deal.risk_status === "Review" && (
        <Notice
          message="This deal is flagged for review. Acknowledge the risk before resolving the dispute."
          title="Manual review required"
          tone="warning"
        />
      )}

      {deal.risk_status === "Review" && (
        <label style={acknowledgeLabelStyle}>
          <input
            checked={acknowledgedReviewRisk}
            onChange={(event) => onAcknowledgeReviewRiskChange(event.target.checked)}
            type="checkbox"
          />
          <span>I understand the compliance review risk and want to continue.</span>
        </label>
      )}

      {confirmForDeal ? (
        <div style={confirmStyle}>
          <p style={confirmTextStyle}>
            {confirmForDeal.resolution === "release"
              ? `Release ${deal.price_usdc} USDC to seller?`
              : `Refund ${deal.price_usdc} USDC to buyer?`}
          </p>
          <div style={actionsStyle}>
            <Btn
              disabled={actionDisabled}
              disabledReason={resolveAvailability.disabledReason ?? undefined}
              onClick={() => onResolve(deal, confirmForDeal.resolution)}
              variant={confirmForDeal.resolution === "release" ? "primary" : "danger"}
            >
              {actionLabel(confirmForDeal.resolution)}
            </Btn>
            <Btn
              disabled={isResolving}
              onClick={() => onConfirmingChange(null)}
              variant="ghost"
            >
              Cancel
            </Btn>
          </div>
        </div>
      ) : (
        <div style={actionsStyle}>
          <Btn
            disabled={actionDisabled}
            disabledReason={resolveAvailability.disabledReason ?? undefined}
            onClick={() => onConfirmingChange({ dealId: deal.id, resolution: "release" })}
            variant="primary"
          >
            Release to seller
          </Btn>
          <Btn
            disabled={actionDisabled}
            disabledReason={resolveAvailability.disabledReason ?? undefined}
            onClick={() => onConfirmingChange({ dealId: deal.id, resolution: "refund" })}
            variant="danger"
          >
            Refund to buyer
          </Btn>
        </div>
      )}
    </>
  );
}

const actionsStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
};

const confirmStyle = {
  background: "var(--panel-muted)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
  padding: 12,
};

const confirmTextStyle = {
  color: "var(--foreground)",
  fontSize: 14,
  margin: 0,
};

const acknowledgeLabelStyle = {
  alignItems: "center",
  color: "var(--muted)",
  display: "inline-flex",
  fontSize: 13,
  gap: 8,
} as const;
