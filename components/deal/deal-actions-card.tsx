"use client";

// Lifecycle action card for the deal page.
// Shows only actions available to the current role + deal state.
// All actions go through backend prepare → wallet tx.

import type { DealStatus } from "@/lib/api/deals";
import type { DealAction } from "@/hooks/use-deal-action";
import type { WalletSessionState } from "@/hooks/use-wallet-session";
import { Btn } from "@/components/shared/btn";
import { AsyncActionState } from "@/components/shared/async-action-state";

interface DealActionsCardProps {
  dealStatus: DealStatus;
  isSeller: boolean;
  isBuyer: boolean;
  markCompletedAfter: string;
  session: WalletSessionState;
  complete: DealAction;
  release: DealAction;
  dispute: DealAction;
  isAnyActionInFlight: boolean;
}

export function DealActionsCard({
  buyerDisputable,
  complete,
  dealStatus,
  dispute,
  isAnyActionInFlight,
  isBuyer,
  isSeller,
  markCompletedAfter,
  release,
  session,
}: DealActionsCardProps & { buyerDisputable: boolean }) {
  const { isConnected, isCorrectChain, siweStatus, signIn, isSigningIn, signInError } = session;

  const noActions =
    !isSeller && !isBuyer;

  if (noActions) return null;

  const needsAuth = !isConnected || !isCorrectChain || siweStatus !== "authenticated";

  // Determine what's visible to this user
  const showComplete = isSeller && dealStatus === "Funded";
  const showRelease = isBuyer && dealStatus === "ConfirmPending";
  const showDispute = isBuyer && buyerDisputable;
  const markCompletedAfterMs = new Date(markCompletedAfter).getTime();
  const completeDisabled =
    showComplete &&
    !Number.isNaN(markCompletedAfterMs) &&
    Date.now() < markCompletedAfterMs;

  if (!showComplete && !showRelease && !showDispute) {
    if (shouldShowParticipantStatusInfo(dealStatus, isSeller)) {
      return (
        <DealActionInfoCard
          message={getParticipantStatusMessage(dealStatus)}
        />
      );
    }

    return null;
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-card)",
        padding: 20,
      }}
    >
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
      {needsAuth && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            Sign in with your wallet to perform actions.
          </p>
          {isConnected && isCorrectChain && (
            <>
              <Btn
                fullWidth
                loading={isSigningIn}
                onClick={signIn}
                variant="secondary"
              >
                Sign in with Ethereum
              </Btn>
              {signInError && (
                <div style={errorStyle}>
                  {signInError}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Actions */}
      {!needsAuth && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Seller: complete */}
          {showComplete && (
            <ActionGroup
              action={complete}
              disabledByOtherAction={isAnyActionInFlight}
              description={getCompleteDescription(markCompletedAfter)}
              disabled={completeDisabled}
              disabledReason={`Available after ${formatLocalDateTime(markCompletedAfter)}.`}
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
              label="Release payment"
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
    </div>
  );
}

const errorStyle = {
  background: "var(--danger-muted)",
  border: "1px solid var(--danger)",
  borderRadius: "var(--radius-sm)",
  color: "var(--danger)",
  fontSize: 13,
  padding: "10px 14px",
} as const;

const labelStyle = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  margin: "0 0 16px",
  textTransform: "uppercase" as const,
};

function shouldShowParticipantStatusInfo(status: DealStatus, isSeller: boolean): boolean {
  return (
    status === "Disputed" ||
    status === "Released" ||
    status === "Refunded" ||
    (isSeller && status === "ConfirmPending")
  );
}

function getParticipantStatusMessage(status: DealStatus): string {
  switch (status) {
    case "Disputed":
      return "This deal is under admin review. An admin will resolve the dispute.";
    case "ConfirmPending":
      return "Waiting for the buyer to confirm payment release.";
    case "Released":
      return "Payment has been released to the seller.";
    case "Refunded":
      return "This deal was refunded to the buyer.";
    default:
      return "";
  }
}

function DealActionInfoCard({ message }: { message: string }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-card)",
        padding: 20,
      }}
    >
      <p style={labelStyle}>Actions</p>
      <div
        style={{
          background: "var(--muted-bg)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          color: "var(--muted)",
          fontSize: 14,
          padding: "12px 14px",
        }}
      >
        {message}
      </div>
    </div>
  );
}

function formatLocalDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

function getCompleteDescription(markCompletedAfter: string): string {
  const markCompletedAfterMs = new Date(markCompletedAfter).getTime();

  if (!Number.isNaN(markCompletedAfterMs) && Date.now() < markCompletedAfterMs) {
    return `Available after ${formatLocalDateTime(markCompletedAfter)} (after slot + grace period).`;
  }

  return "Mark the consultation as completed. Only available after the scheduled slot + grace period.";
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
    state.step !== "idle" &&
    state.step !== "failed" &&
    state.step !== "sync_failed" &&
    state.step !== "succeeded";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{description}</p>

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
      ) : (
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

      <AsyncActionState
        error={state.error}
        step={state.step}
        txHash={state.txHash}
      />
    </div>
  );
}
