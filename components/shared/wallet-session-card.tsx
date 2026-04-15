"use client";

// Displays wallet connection state, chain status, and SIWE session state.
// Exposes connect / sign-in / sign-out actions.

import type { WalletSessionState } from "@/hooks/use-wallet-session";
import { baseRuntimeConfig } from "@/lib/base/config";
import { Btn } from "@/components/shared/btn";

interface WalletSessionCardProps {
  session: WalletSessionState;
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletSessionCard({ session }: WalletSessionCardProps) {
  const {
    address,
    isConnected,
    isCorrectChain,
    isSigningIn,
    signInError,
    siweStatus,
    connect,
    disconnect,
    signIn,
    signOut,
    switchToCorrectChain,
  } = session;

  return (
    <div style={cardStyle}>
      <p style={labelStyle}>Wallet</p>

      {!isConnected ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            Connect your wallet to continue.
          </p>
          <Btn fullWidth onClick={() => connect()} variant="primary">
            Connect Wallet
          </Btn>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Address row */}
          <div style={rowStyle}>
            <span style={dotStyle("var(--success)")} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>
              {address ? truncateAddress(address) : "—"}
            </span>
            <button
              onClick={disconnect}
              style={textBtnStyle}
              type="button"
            >
              Disconnect
            </button>
          </div>

          {/* Chain check */}
          {!isCorrectChain && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={warningStyle}>
                Wrong network — switch to {baseRuntimeConfig.chain.name}.
              </div>
              <Btn fullWidth onClick={switchToCorrectChain} variant="primary">
                Switch to {baseRuntimeConfig.chain.name}
              </Btn>
            </div>
          )}

          {/* SIWE session */}
          {isCorrectChain && siweStatus === "unauthenticated" && (
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

          {siweStatus === "authenticated" && (
            <div style={rowStyle}>
              <span style={dotStyle("var(--accent)")} />
              <span style={{ color: "var(--muted)", fontSize: 13 }}>
                Signed in
              </span>
              <button
                onClick={signOut}
                style={textBtnStyle}
                type="button"
              >
                Sign out
              </button>
            </div>
          )}

          {siweStatus === "loading" && (
            <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
              Checking session…
            </p>
          )}
        </div>
      )}
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

const rowStyle = {
  alignItems: "center",
  display: "flex",
  gap: 8,
} as const;

const textBtnStyle = {
  background: "none",
  border: "none",
  color: "var(--muted)",
  cursor: "pointer",
  fontSize: 13,
  marginLeft: "auto",
  padding: 0,
  textDecoration: "underline",
} as const;

const warningStyle = {
  background: "var(--warning-muted)",
  border: "1px solid var(--warning)",
  borderRadius: "var(--radius-sm)",
  color: "var(--warning)",
  fontSize: 13,
  padding: "10px 14px",
} as const;

function dotStyle(color: string) {
  return {
    background: color,
    borderRadius: "50%",
    display: "inline-block",
    flexShrink: 0,
    height: 8,
    width: 8,
  } as const;
}

const errorStyle = {
  background: "var(--danger-muted)",
  border: "1px solid var(--danger)",
  borderRadius: "var(--radius-sm)",
  color: "var(--danger)",
  fontSize: 13,
  padding: "10px 14px",
} as const;
