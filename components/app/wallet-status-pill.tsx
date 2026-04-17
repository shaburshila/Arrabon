"use client";

import type { WalletSessionState } from "@/hooks/use-wallet-session";

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function WalletStatusPill({ session }: { session: WalletSessionState }) {
  const state = getWalletStatus(session);

  return (
    <span style={pillStyle(state.tone)}>
      {state.label}
    </span>
  );
}

function getWalletStatus(session: WalletSessionState) {
  if (!session.isConnected) {
    return { label: "Not connected", tone: "muted" as const };
  }

  if (!session.isCorrectChain) {
    return { label: "Wrong network", tone: "danger" as const };
  }

  if (session.siweStatus !== "authenticated") {
    return { label: "Sign in", tone: "muted" as const };
  }

  if (session.session?.is_admin === true) {
    return { label: "Admin", tone: "accent" as const };
  }

  if (session.address) {
    return { label: shortAddress(session.address), tone: "success" as const };
  }

  return { label: "Connected", tone: "success" as const };
}

function pillStyle(tone: "accent" | "danger" | "muted" | "success") {
  const colors = {
    accent: {
      background: "var(--accent-muted)",
      color: "var(--accent)",
    },
    danger: {
      background: "var(--danger-muted)",
      color: "var(--danger)",
    },
    muted: {
      background: "var(--muted-bg)",
      color: "var(--muted)",
    },
    success: {
      background: "var(--success-muted)",
      color: "var(--success)",
    },
  }[tone];

  return {
    ...colors,
    border: "1px solid transparent",
    borderRadius: 8,
    flexShrink: 0,
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1,
    padding: "8px 10px",
    whiteSpace: "nowrap" as const,
  };
}
