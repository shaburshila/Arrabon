"use client";

// Reusable tx feedback UI: shows step label, tx hash link, error message.

import type { Hex } from "viem";
import { Notice } from "@/components/shared/notice";

interface AsyncActionStateProps {
  error: string | null;
  step: string;
  stepLabel?: Record<string, string>;
  txHash: Hex | null;
}

const defaultLabels: Record<string, string> = {
  approve_pending: "Approve tx on chain…",
  approve_signature: "Approve USDC in wallet…",
  failed: "Action failed",
  fund_pending: "Funding tx on chain…",
  fund_signature: "Confirm in wallet…",
  idle: "",
  indexing: "Waiting for deal to appear…",
  pending_chain: "Tx on chain…",
  preparing: "Preparing…",
  signature: "Confirm in wallet…",
  sync_failed: "Backend sync delayed",
  syncing_backend: "Syncing backend state…",
  succeeded: "Done",
};

export function AsyncActionState({ error, step, stepLabel, txHash }: AsyncActionStateProps) {
  const labels = { ...defaultLabels, ...stepLabel };
  const label = labels[step] ?? step;

  if (step === "idle" || step === "succeeded") return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        marginTop: 12,
      }}
    >
      {label && step !== "failed" && (
        <p
          style={{
            color: "var(--muted)",
            fontSize: 13,
            margin: 0,
          }}
        >
          {label}
        </p>
      )}

      {txHash && (
        <p style={{ fontSize: 12, margin: 0, wordBreak: "break-all" }}>
          <span style={{ color: "var(--muted)" }}>Tx: </span>
          <code style={{ color: "var(--ink)", fontFamily: "var(--font-mono, monospace)" }}>
            {txHash.slice(0, 10)}…{txHash.slice(-6)}
          </code>
        </p>
      )}

      {error && (
        <Notice
          message={error}
          tone="danger"
        />
      )}
    </div>
  );
}
