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
import { ActionPanel } from "@/components/shared/action-panel";
import { Btn } from "@/components/shared/btn";
import { CopyBtn } from "@/components/shared/copy-btn";
import { Notice } from "@/components/shared/notice";

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
      <ActionPanel style={cardStyle}>
        <p style={labelStyle}>Meeting link</p>
        <Notice message="Meeting link is unavailable — this deal was refunded." tone="muted" />
      </ActionPanel>
    );
  }

  // Not connected
  if (!isConnected) {
    return (
      <ActionPanel style={cardStyle}>
        <p style={labelStyle}>Meeting link</p>
        <Notice message="Connect your wallet to reveal the meeting link." tone="muted" />
      </ActionPanel>
    );
  }

  // Wrong chain
  if (!isCorrectChain) {
    return (
      <ActionPanel style={cardStyle}>
        <p style={labelStyle}>Meeting link</p>
        <Notice message="Switch to the correct network to reveal the meeting link." tone="warning" />
      </ActionPanel>
    );
  }

  // Non-participant: unavailable
  if (!isParticipant) {
    return (
      <ActionPanel style={cardStyle}>
        <p style={labelStyle}>Meeting link</p>
        <Notice message="Only the buyer and seller can access the meeting link." tone="muted" />
      </ActionPanel>
    );
  }

  // No SIWE session
  if (siweStatus !== "authenticated") {
    return (
      <ActionPanel style={cardStyle}>
        <p style={labelStyle}>Meeting link</p>
        <Notice message="Sign in to reveal the meeting link." style={{ marginBottom: 12 }} tone="muted" />
        <Btn
          fullWidth
          loading={isSigningIn}
          onClick={signIn}
          variant="secondary"
        >
          Sign in with Ethereum
        </Btn>
        {signInError && (
          <Notice message={signInError} style={{ marginTop: 10 }} tone="danger" />
        )}
      </ActionPanel>
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
    <ActionPanel style={cardStyle}>
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
          <Notice message={error} tone="danger" />
          <Btn fullWidth onClick={handleReveal} variant="secondary">
            Try again
          </Btn>
        </div>
      )}
    </ActionPanel>
  );
}

const cardStyle = {
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
