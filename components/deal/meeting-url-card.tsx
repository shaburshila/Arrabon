"use client";

// Meeting URL reveal card.
// Explicit rules:
// - Refunded → reveal unavailable (shown explicitly, not silently hidden)
// - Wallet/chain unavailable → prompt before participant checks
// - No SIWE session → prompt to sign in
// - Non-participant → unavailable
// - All other allowed states → reveal button

import { useState } from "react";

import type { DealStatus } from "@/lib/api/deals";
import { fetchMeetingUrl } from "@/lib/api/deals";
import { ApiError } from "@/lib/api/auth";
import type { WalletSessionState } from "@/hooks/use-wallet-session";
import { Btn } from "@/components/shared/btn";
import { CopyBtn } from "@/components/shared/copy-btn";

interface MeetingUrlCardProps {
  dealId: string;
  dealStatus: DealStatus;
  isParticipant: boolean;
  session: WalletSessionState;
}

type RevealState = "error" | "idle" | "loading" | "revealed";

export function MeetingUrlCard({
  dealId,
  dealStatus,
  isParticipant,
  session,
}: MeetingUrlCardProps) {
  const [revealState, setRevealState] = useState<RevealState>("idle");
  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { isConnected, isCorrectChain, siweStatus, signIn, isSigningIn, signInError } = session;

  // Refunded: explicitly unavailable per architecture rule
  if (dealStatus === "Refunded") {
    return (
      <div style={cardStyle}>
        <p style={labelStyle}>Meeting link</p>
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
          Meeting link is unavailable — this deal was refunded.
        </div>
      </div>
    );
  }

  // Not connected
  if (!isConnected) {
    return (
      <div style={cardStyle}>
        <p style={labelStyle}>Meeting link</p>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 12px" }}>
          Connect your wallet to reveal the meeting link.
        </p>
      </div>
    );
  }

  // Wrong chain
  if (!isCorrectChain) {
    return (
      <div style={cardStyle}>
        <p style={labelStyle}>Meeting link</p>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 12px" }}>
          Switch to the correct network to reveal the meeting link.
        </p>
      </div>
    );
  }

  // Non-participant: unavailable
  if (!isParticipant) {
    return (
      <div style={cardStyle}>
        <p style={labelStyle}>Meeting link</p>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
          Only the buyer and seller can access the meeting link.
        </p>
      </div>
    );
  }

  // No SIWE session
  if (siweStatus !== "authenticated") {
    return (
      <div style={cardStyle}>
        <p style={labelStyle}>Meeting link</p>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 12px" }}>
          Sign in to reveal the meeting link.
        </p>
        <Btn
          fullWidth
          loading={isSigningIn}
          onClick={signIn}
          variant="secondary"
        >
          Sign in with Ethereum
        </Btn>
        {signInError && (
          <div
            style={{
              background: "var(--danger-muted)",
              border: "1px solid var(--danger)",
              borderRadius: "var(--radius-sm)",
              color: "var(--danger)",
              fontSize: 13,
              marginTop: 10,
              padding: "10px 14px",
            }}
          >
            {signInError}
          </div>
        )}
      </div>
    );
  }

  const handleReveal = async () => {
    setRevealState("loading");
    setError(null);
    try {
      const url = await fetchMeetingUrl(dealId);
      setMeetingUrl(url);
      setRevealState("revealed");
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to reveal meeting link.";
      setError(msg);
      setRevealState("error");
    }
  };

  return (
    <div style={cardStyle}>
      <p style={labelStyle}>Meeting link</p>

      {revealState === "idle" && (
        <Btn fullWidth onClick={handleReveal} variant="secondary">
          Reveal meeting link
        </Btn>
      )}

      {revealState === "loading" && (
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
          Loading…
        </p>
      )}

      {revealState === "revealed" && meetingUrl && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              background: "var(--success-muted)",
              border: "1px solid var(--success)",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "12px 14px",
            }}
          >
            <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
              Meeting link
            </p>
            <a
              href={meetingUrl}
              rel="noopener noreferrer"
              style={{
                color: "var(--accent)",
                fontSize: 14,
                fontWeight: 500,
                wordBreak: "break-all",
              }}
              target="_blank"
            >
              {meetingUrl}
            </a>
          </div>
          <CopyBtn text={meetingUrl} label="Copy link" />
        </div>
      )}

      {revealState === "error" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              background: "var(--danger-muted)",
              border: "1px solid var(--danger)",
              borderRadius: "var(--radius-sm)",
              color: "var(--danger)",
              fontSize: 13,
              padding: "10px 14px",
            }}
          >
            {error}
          </div>
          <Btn fullWidth onClick={handleReveal} variant="secondary">
            Try again
          </Btn>
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
