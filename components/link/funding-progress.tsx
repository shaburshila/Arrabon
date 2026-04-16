"use client";

// Displays step-by-step funding progress during the funding flow.

import type { FundingStep } from "@/hooks/use-funding-flow";
import type { Hex } from "viem";

interface FundingProgressProps {
  step: FundingStep;
  txHash: Hex | null;
  error: string | null;
}

const steps: { key: FundingStep | FundingStep[]; label: string }[] = [
  { key: "preparing", label: "Preparing transaction" },
  { key: ["approve_signature", "approve_pending"], label: "Approve USDC" },
  { key: ["fund_signature", "fund_pending"], label: "Fund consultation" },
  { key: ["indexing", "indexing_failed"], label: "Confirming deal" },
  { key: "succeeded", label: "Funded!" },
];

function isActive(step: FundingStep, key: FundingStep | FundingStep[]): boolean {
  return Array.isArray(key) ? key.includes(step) : key === step;
}

function getStepIndex(step: FundingStep): number {
  return steps.findIndex((s) => isActive(step, s.key));
}

const activeSteps: FundingStep[] = [
  "preparing",
  "approve_signature",
  "approve_pending",
  "fund_signature",
  "fund_pending",
  "indexing",
  "indexing_failed",
  "succeeded",
];

const stepLabels: Partial<Record<FundingStep, string>> = {
  approve_pending: "Approve tx confirming…",
  approve_signature: "Approve USDC in wallet…",
  fund_pending: "Funding tx confirming…",
  fund_signature: "Confirm funding in wallet…",
  indexing: "Waiting for deal to appear…",
  indexing_failed: "Deal indexing needs attention.",
  preparing: "Checking state…",
  succeeded: "Deal funded!",
};

export function FundingProgress({ error, step, txHash }: FundingProgressProps) {
  if (!activeSteps.includes(step) && step !== "failed") return null;

  const currentIndex = getStepIndex(step);

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
        Funding progress
      </p>

      {/* Step list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map((s, i) => {
          const done = currentIndex > i;
          const active = isActive(step, s.key);
          const showSpinner = active && step !== "succeeded" && step !== "indexing_failed";
          return (
            <div key={i} style={{ alignItems: "center", display: "flex", gap: 10 }}>
              <span
                style={{
                  alignItems: "center",
                  background: done
                    ? "var(--success)"
                    : active
                      ? "var(--accent)"
                      : "var(--border)",
                  borderRadius: "50%",
                  color: done || active ? "#fff" : "var(--muted)",
                  display: "inline-flex",
                  flexShrink: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  height: 22,
                  justifyContent: "center",
                  width: 22,
                }}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                style={{
                  alignItems: "center",
                  color: active
                    ? "var(--foreground)"
                    : done
                      ? "var(--muted)"
                      : "var(--border)",
                  display: "inline-flex",
                  fontSize: 14,
                  gap: 8,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {s.label}
                {showSpinner && <Spinner />}
              </span>
            </div>
          );
        })}
      </div>

      {/* Active step label */}
      {step !== "succeeded" &&
        step !== "failed" &&
        step !== "indexing_failed" &&
        stepLabels[step] && (
        <p
          style={{
            color: "var(--muted)",
            fontSize: 13,
            margin: "16px 0 0",
          }}
        >
          {stepLabels[step]}
        </p>
      )}

      {/* Tx hash */}
      {txHash && (
        <p style={{ fontSize: 12, margin: "8px 0 0", wordBreak: "break-all" }}>
          <span style={{ color: "var(--muted)" }}>Tx: </span>
          <code style={{ fontFamily: "monospace" }}>
            {txHash.slice(0, 10)}…{txHash.slice(-6)}
          </code>
        </p>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            background: "var(--danger-muted)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--radius-sm)",
            color: "var(--danger)",
            fontSize: 13,
            marginTop: 12,
            padding: "10px 14px",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      style={{
        animation: "funding-progress-spin 0.8s linear infinite",
        border: "2px solid var(--accent)",
        borderRadius: "50%",
        borderTopColor: "transparent",
        display: "inline-block",
        height: 14,
        width: 14,
      }}
    >
      <style>{`@keyframes funding-progress-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}
