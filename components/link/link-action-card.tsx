"use client";

// Primary CTA card for the link page.
// Renders the right action based on wallet/session/role/link state.
// Delegates to funding hook — does not contain funding logic itself.

import type { WalletSessionState } from "@/hooks/use-wallet-session";
import type { FundingFlow } from "@/hooks/use-funding-flow";
import type { PublicLink } from "@/lib/api/links";
import { Btn } from "@/components/shared/btn";

interface LinkActionCardProps {
  link: PublicLink;
  role: "seller" | "viewer";
  session: WalletSessionState;
  funding: FundingFlow;
}

export function LinkActionCard({ funding, link, role, session }: LinkActionCardProps) {
  const { address, isConnected, isCorrectChain, siweStatus, connect, signIn, signInError } = session;
  const { execute, reset, state: fundingState } = funding;

  const isFunding =
    fundingState.step !== "idle" &&
    fundingState.step !== "failed" &&
    fundingState.step !== "indexing_failed" &&
    fundingState.step !== "succeeded";

  // Seller sees their own link — no fund CTA
  if (role === "seller") {
    return (
      <div style={cardStyle}>
        <p style={labelStyle}>Your link</p>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
          This is your consultation link. Share it with your client.
        </p>
      </div>
    );
  }

  // Link is not open — no fund CTA
  if (link.status !== "Open") {
    return null;
  }

  return (
    <div style={cardStyle}>
      <p style={labelStyle}>Book consultation</p>

      {/* Step 1: Connect wallet */}
      {!isConnected && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={hintStyle}>Connect your wallet to book this slot.</p>
          <Btn fullWidth onClick={() => connect()}>
            Connect Wallet
          </Btn>
        </div>
      )}

      {/* Step 2: Wrong chain */}
      {isConnected && !isCorrectChain && (
        <div
          style={{
            background: "var(--warning-muted)",
            border: "1px solid var(--warning)",
            borderRadius: "var(--radius-sm)",
            color: "var(--warning)",
            fontSize: 13,
            padding: "10px 14px",
          }}
        >
          Switch to the correct network to continue.
        </div>
      )}

      {/* Step 3: Sign in */}
      {isConnected && isCorrectChain && siweStatus === "unauthenticated" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={hintStyle}>Sign in to confirm your wallet before paying.</p>
          <Btn
            fullWidth
            loading={session.isSigningIn}
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
        </div>
      )}

      {siweStatus === "loading" && (
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
          Checking session…
        </p>
      )}

      {/* Step 4: Fund */}
      {isConnected && isCorrectChain && siweStatus === "authenticated" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <PricePreview priceUsdc={link.price_usdc} />

          {fundingState.step === "failed" && (
            <Btn fullWidth onClick={reset} variant="secondary">
              Try again
            </Btn>
          )}

          {(fundingState.step === "idle" || fundingState.step === "failed") && (
            <Btn
              disabled={isFunding}
              fullWidth
              loading={false}
              onClick={execute}
            >
              Fund Consultation · ${link.price_usdc} USDC
            </Btn>
          )}

          {isFunding && (
            <p style={{ color: "var(--muted)", fontSize: 13, margin: 0, textAlign: "center" }}>
              Transaction in progress — do not close this page.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PricePreview({ priceUsdc }: { priceUsdc: string }) {
  return (
    <div
      style={{
        alignItems: "center",
        background: "var(--accent-muted)",
        borderRadius: "var(--radius-sm)",
        display: "flex",
        gap: 8,
        justifyContent: "space-between",
        marginBottom: 4,
        padding: "10px 14px",
      }}
    >
      <span style={{ color: "var(--muted)", fontSize: 13 }}>You pay</span>
      <span style={{ color: "var(--accent)", fontSize: 18, fontWeight: 700 }}>
        ${priceUsdc} USDC
      </span>
    </div>
  );
}

const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-card)",
  padding: 20,
} as const;

const labelStyle = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  margin: "0 0 12px",
  textTransform: "uppercase" as const,
};

const hintStyle = {
  color: "var(--muted)",
  fontSize: 14,
  margin: 0,
} as const;

const errorStyle = {
  background: "var(--danger-muted)",
  border: "1px solid var(--danger)",
  borderRadius: "var(--radius-sm)",
  color: "var(--danger)",
  fontSize: 13,
  padding: "10px 14px",
} as const;
