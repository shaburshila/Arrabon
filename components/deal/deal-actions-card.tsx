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
  session: WalletSessionState;
  complete: DealAction;
  release: DealAction;
  dispute: DealAction;
}

export function DealActionsCard({
  buyerDisputable,
  complete,
  dealStatus,
  dispute,
  isBuyer,
  isSeller,
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

  if (!showComplete && !showRelease && !showDispute) return null;

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
              description="Mark the consultation as completed. Only available after the scheduled slot + grace period."
              label="Mark completed"
              variant="primary"
            />
          )}

          {/* Buyer: release */}
          {showRelease && (
            <ActionGroup
              action={release}
              description="Release payment to the seller. Confirm the consultation went well."
              label="Release payment"
              variant="primary"
            />
          )}

          {/* Buyer: dispute */}
          {showDispute && (
            <ActionGroup
              action={dispute}
              description="Open a dispute if the consultation did not take place or there was an issue."
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

function ActionGroup({
  action,
  description,
  label,
  variant,
}: {
  action: DealAction;
  description: string;
  label: string;
  variant: "danger" | "primary";
}) {
  const { execute, reset, state } = action;
  const inFlight =
    state.step !== "idle" && state.step !== "failed" && state.step !== "succeeded";

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
          Done — waiting for on-chain confirmation to reflect.
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Btn
              disabled={inFlight}
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
