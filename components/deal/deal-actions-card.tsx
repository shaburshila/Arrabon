"use client";

// Lifecycle action card for the deal page.
// Shows only actions available to the current role + deal state.
// All actions go through backend prepare → wallet tx.

import type { DealStatus } from "@/lib/api/deals";
import type { DealAction } from "@/hooks/use-deal-action";
import type { WalletSessionState } from "@/hooks/use-wallet-session";
import { Btn } from "@/components/shared/btn";
import { AsyncActionState } from "@/components/shared/async-action-state";
import { ActionPanel } from "@/components/shared/action-panel";
import { ComplianceBlockedNotice } from "@/components/shared/compliance-blocked-notice";
import { Notice } from "@/components/shared/notice";

interface DealActionsCardProps {
  autoRelease: DealAction;
  autoReleaseAvailable: boolean;
  buyerDisputable: boolean;
  buyerReleasable: boolean;
  dealStatus: DealStatus;
  isSeller: boolean;
  isBuyer: boolean;
  session: WalletSessionState;
  complete: DealAction;
  release: DealAction;
  dispute: DealAction;
  isAnyActionInFlight: boolean;
}

export function DealActionsCard({
  autoRelease,
  autoReleaseAvailable,
  buyerDisputable,
  buyerReleasable,
  complete,
  dealStatus,
  dispute,
  isAnyActionInFlight,
  isBuyer,
  isSeller,
  release,
  session,
}: DealActionsCardProps) {
  const { isConnected, isCorrectChain, siweStatus } = session;

  // Determine what's visible to this user
  const showComplete = isSeller && dealStatus === "Funded";
  const showRelease = isBuyer && buyerReleasable;
  const showDispute = isBuyer && buyerDisputable;
  const showAutoRelease = autoReleaseAvailable;
  const needsWallet = !isConnected || !isCorrectChain;
  const needsParticipantAuth =
    (showComplete || showRelease || showDispute) && siweStatus !== "authenticated";
  const actionsBlocked = needsWallet || needsParticipantAuth;

  if (!showComplete && !showRelease && !showDispute && !showAutoRelease) return null;

  return (
    <ActionPanel style={{ padding: 20 }}>
      <p
        style={{
          color: "var(--muted)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          margin: "0 0 16px",
          textTransform: "uppercase",
        }}
      >
        Actions
      </p>

      {/* Auth gate */}
      {actionsBlocked && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Notice
            message="Use the wallet panel above to connect, switch network, or sign in before performing actions."
            tone="muted"
          />
        </div>
      )}

      {/* Participant actions */}
      {!actionsBlocked && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Seller: complete */}
          {showComplete && (
            <ActionGroup
              action={complete}
              disabledByOtherAction={isAnyActionInFlight}
              description="Mark the consultation as completed so the buyer can confirm payment release or open a dispute."
              label="Mark completed"
              variant="primary"
            />
          )}

          {/* Buyer: release */}
          {showRelease && (
            <ActionGroup
              action={release}
              disabledByOtherAction={isAnyActionInFlight}
              description="Release payment to the seller. Confirm the consultation went well."
              label="Release to seller"
              variant="primary"
            />
          )}

          {/* Buyer: dispute */}
          {showDispute && (
            <ActionGroup
              action={dispute}
              disabledByOtherAction={isAnyActionInFlight}
              description={getDisputeDescription(dealStatus)}
              label="Open dispute"
              variant="danger"
            />
          )}
        </div>
      )}

      {/* Anyone: auto-release after buyer window closes */}
      {showAutoRelease && (
        <ActionGroup
          action={autoRelease}
          description="The buyer dispute window has closed. Anyone can finalize the escrow release to the seller."
          disabled={needsWallet}
          disabledByOtherAction={isAnyActionInFlight}
          disabledReason="Connect your wallet on the correct network to finalize auto-release."
          label="Auto-release to seller"
          variant="primary"
        />
      )}
    </ActionPanel>
  );
}

function getDisputeDescription(dealStatus: DealStatus): string {
  if (dealStatus === "Funded") {
    return "Open a dispute if the consultation cannot proceed or the seller did not show up. This sends the deal to admin review.";
  }

  return "Open a dispute if the consultation did not take place or there was an issue.";
}

function ActionGroup({
  action,
  disabledByOtherAction,
  description,
  disabled,
  disabledReason,
  label,
  variant,
}: {
  action: DealAction;
  disabledByOtherAction: boolean;
  description: string;
  disabled?: boolean;
  disabledReason?: string;
  label: string;
  variant: "danger" | "primary";
}) {
  const { execute, reset, state } = action;
  const backendSyncFailed = state.step === "sync_failed";
  const inFlight =
    state.step !== "compliance_blocked" &&
    state.step !== "idle" &&
    state.step !== "failed" &&
    state.step !== "sync_failed" &&
    state.step !== "succeeded";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{description}</p>

      {state.step === "compliance_blocked" && (
        <ComplianceBlockedNotice
          reasonCode={state.complianceReasonCode}
          walletAddress={state.complianceWallet}
        />
      )}

      {state.step === "succeeded" ? (
        <div
          style={{
            background: "var(--success-muted)",
            border: "1px solid var(--success)",
            borderRadius: "var(--radius-sm)",
            color: "var(--success)",
            fontSize: 13,
            padding: "10px 14px",
          }}
        >
          Done — backend state is up to date.
        </div>
      ) : state.step === "compliance_blocked" ? null : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Btn
              disabled={disabled || disabledByOtherAction || inFlight || backendSyncFailed}
              disabledReason={
                backendSyncFailed
                  ? "Transaction confirmed. Please refresh later instead of retrying the transaction."
                  : disabledByOtherAction && !inFlight
                    ? "Another action is in progress."
                    : disabled
                    ? disabledReason
                    : undefined
              }
              fullWidth
              loading={inFlight}
              onClick={execute}
              variant={variant}
            >
              {label}
            </Btn>
          </div>
          {state.step === "failed" && (
            <Btn onClick={reset} variant="ghost">
              Reset
            </Btn>
          )}
        </div>
      )}

      {state.step !== "compliance_blocked" && (
        <AsyncActionState
          error={state.error}
          step={state.step}
          txHash={state.txHash}
        />
      )}
    </div>
  );
}
