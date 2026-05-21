"use client";

// Primary CTA card for the link page.
// Renders the right action based on wallet/session/role/link state.
// Delegates to funding hook — does not contain funding logic itself.

import { useState } from "react";
import Link from "next/link";

import type { WalletSessionState } from "@/hooks/use-wallet-session";
import type { FundingFlow } from "@/hooks/use-funding-flow";
import type { PublicLink } from "@/lib/api/links";
import {
  calculateFee,
  calculateTotalWithFee,
  formatUsdcAmount,
  parseUsdcAmount,
} from "@/lib/fees/calculate-fee";
import { ActionPanel } from "@/components/shared/action-panel";
import { Btn } from "@/components/shared/btn";
import { ComplianceBlockedNotice } from "@/components/shared/compliance-blocked-notice";
import { Notice } from "@/components/shared/notice";
import { FundingProgress } from "@/components/link/funding-progress";
import { SiweSignModal } from "@/components/shared/siwe-sign-modal";

interface LinkActionCardProps {
  dealIdPollingTimedOut: boolean;
  link: PublicLink;
  onRetryPolling: () => void;
  role: "seller" | "viewer";
  session: WalletSessionState;
  funding: FundingFlow;
}

export function LinkActionCard({
  dealIdPollingTimedOut,
  funding,
  link,
  onRetryPolling,
  role,
  session,
}: LinkActionCardProps) {
  const {
    isConnected,
    isCorrectChain,
    siweStatus,
    connect,
    signIn,
    signInError,
    switchToCorrectChain,
  } = session;
  const { execute, reset, state: fundingState } = funding;

  const [showSiwe, setShowSiwe] = useState(false);

  async function handleSignInClick() {
    setShowSiwe(true);
  }

  async function handleSiweApprove() {
    setShowSiwe(false);
    try {
      await signIn();
    } catch {
      // signInError state will be set by the hook
    }
  }
  const priceAmount = parseUsdcAmount(link.price_usdc);
  const totalAmount = calculateTotalWithFee(priceAmount);

  const isFunding =
    fundingState.step !== "idle" &&
    fundingState.step !== "compliance_blocked" &&
    fundingState.step !== "failed" &&
    fundingState.step !== "indexing_failed" &&
    fundingState.step !== "succeeded";

  if (role === "seller") {
    return (
      <ActionPanel style={{ padding: 20 }}>
        <p className="section-label">Your link</p>
        <p style={hintStyle}>
          This is your consultation link. Share it with your client.
        </p>
        <Link href="/my-links" style={myLinksLinkStyle}>
          View in My Links →
        </Link>
      </ActionPanel>
    );
  }

  if (link.status !== "Open") {
    return null;
  }

  return (
    <ActionPanel style={{ padding: 20 }}>
      <p className="section-label">Fund this deal</p>

      {!isConnected && (
        <div style={stackStyle}>
          <p style={hintStyle}>Connect your wallet to book this slot.</p>
          <Btn fullWidth onClick={() => connect()}>
            Connect Wallet
          </Btn>
        </div>
      )}

      {isConnected && !isCorrectChain && (
        <div style={stackStyle}>
          <Notice
            message="Switch to the correct network to continue."
            tone="warning"
          />
          <Btn fullWidth onClick={switchToCorrectChain} variant="secondary">
            Switch to Base
          </Btn>
        </div>
      )}

      {isConnected && isCorrectChain && siweStatus === "unauthenticated" && (
        <div style={stackStyle}>
          <p style={hintStyle}>Sign in to confirm your wallet before paying.</p>
          <Btn fullWidth onClick={handleSignInClick} variant="secondary" loading={session.isSigningIn}>
            Sign in with Ethereum
          </Btn>
          {signInError && (
            <Notice message={signInError} tone="danger" />
          )}
        </div>
      )}

      {siweStatus === "loading" && (
        <p style={hintStyle}>Checking session...</p>
      )}

      {isConnected && isCorrectChain && siweStatus === "authenticated" && (
        <div style={stackStyle}>
          <PaymentSummary priceUsdc={link.price_usdc} />

          {fundingState.step === "idle" && (
            <>
              <Btn
                disabled={isFunding}
                fullWidth
                loading={false}
                onClick={execute}
              >
                Pay into escrow · ${formatUsdcAmount(totalAmount)}
              </Btn>
              <p style={signHelperStyle}>
                You&apos;ll be asked to sign a SIWE message and approve USDC before funding.
              </p>
            </>
          )}

          {fundingState.step === "compliance_blocked" && (
            <ComplianceBlockedNotice
              reasonCode={fundingState.complianceReasonCode}
              walletAddress={fundingState.complianceWallet}
            />
          )}

          {fundingState.step !== "idle" && fundingState.step !== "compliance_blocked" && (
            <FundingProgress
              embedded
              error={fundingState.error}
              footer={
                <div style={progressFooterStyle}>
                  {fundingState.step === "failed" && (
                    <Btn fullWidth onClick={reset} variant="secondary">
                      Try again
                    </Btn>
                  )}

                  {(dealIdPollingTimedOut || fundingState.step === "indexing_failed") && (
                    <>
                      <Notice
                        message={
                          fundingState.step === "indexing_failed"
                            ? "Your payment is confirmed on-chain. Do not retry the payment — check the status below."
                            : "Deal creation is taking longer than expected. Retry polling or refresh this page."
                        }
                        tone={fundingState.step === "indexing_failed" ? "info" : "danger"}
                      />
                      <Btn fullWidth onClick={onRetryPolling} variant="secondary">
                        Retry check
                      </Btn>
                    </>
                  )}
                </div>
              }
              step={fundingState.step}
              txHash={fundingState.txHash}
            />
          )}
        </div>
      )}
      <SiweSignModal
        open={showSiwe}
        onApprove={handleSiweApprove}
        onReject={() => setShowSiwe(false)}
      />
    </ActionPanel>
  );
}

function PaymentSummary({ priceUsdc }: { priceUsdc: string }) {
  const priceAmount = parseUsdcAmount(priceUsdc);
  const feeAmount = calculateFee(priceAmount);
  const totalAmount = calculateTotalWithFee(priceAmount);

  return (
    <div style={paymentSummaryStyle}>
      <div style={feeRowStyle}>
        <span style={feeRowLabelStyle}>Consultation fee</span>
        <span style={feeRowValueStyle}>
          {formatUsdcAmount(priceAmount)}
          <span style={feeRowTokenStyle}>USDC</span>
        </span>
      </div>
      <div style={feeRowStyle}>
        <span style={feeRowLabelStyle}>Platform fee (3%)</span>
        <span style={feeRowValueStyle}>
          {formatUsdcAmount(feeAmount)}
          <span style={feeRowTokenStyle}>USDC</span>
        </span>
      </div>
      <hr style={ruleStyle} />
      <div style={totalRowStyle}>
        <span style={totalLabelStyle}>You pay</span>
        <span style={{ whiteSpace: "nowrap" }}>
          <span style={totalAmountStyle}>{formatUsdcAmount(totalAmount)}</span>
          <span style={totalTokenStyle}>USDC</span>
        </span>
      </div>
      <p style={feeNoteStyle}>Non-refundable escrow service fee</p>
    </div>
  );
}

const feeRowStyle = { alignItems: "center", display: "flex", justifyContent: "space-between" };
const feeRowLabelStyle = { color: "var(--muted)", fontSize: 13, lineHeight: 1.5 };
const feeRowValueStyle = { color: "var(--ink)", fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "-0.01em", whiteSpace: "nowrap" as const };
const feeRowTokenStyle = { color: "var(--muted)", fontSize: 11, marginLeft: 6 };
const ruleStyle = { background: "var(--rule)", border: 0, height: 1, margin: 0 };
const totalRowStyle = { alignItems: "baseline", display: "flex", justifyContent: "space-between", marginTop: 4 };
const totalLabelStyle = { color: "var(--ink)", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" as const };
const totalAmountStyle = { color: "var(--ink)", fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 500, letterSpacing: "-0.01em" };
const totalTokenStyle = { color: "var(--muted)", fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", marginLeft: 6 };

const stackStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
};

const hintStyle = {
  color: "var(--muted)",
  fontSize: 14,
  lineHeight: 1.45,
  margin: 0,
};

const paymentSummaryStyle = {
  background: "var(--surface-2)",
  borderRadius: "var(--r-3)",
  padding: "4px 14px 12px",
};

const feeNoteStyle = {
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.45,
  margin: "10px 0 0",
};

const myLinksLinkStyle = {
  color: "var(--gold-deep)",
  display: "inline-block",
  fontSize: 13,
  fontWeight: 700,
  marginTop: 12,
  textDecoration: "none",
};

const signHelperStyle = {
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.5,
  margin: "12px 0 0",
  textAlign: "center" as const,
};

const progressFooterStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
  marginTop: 12,
};
