"use client";

// Displays step-by-step funding progress during the funding flow.

import type { FundingStep } from "@/hooks/use-funding-flow";
import type { Hex } from "viem";
import type { ReactNode } from "react";
import Link from "next/link";

import { Icon } from "@/components/icons";
import { ActionPanel } from "@/components/shared/action-panel";
import { Notice } from "@/components/shared/notice";

interface FundingProgressProps {
  embedded?: boolean;
  step: FundingStep;
  txHash: Hex | null;
  error: string | null;
  footer?: ReactNode;
}

const progressOrder: Array<{
  key: "approve" | "confirming" | "fund" | "funded" | "review";
  label: string;
}> = [
  { key: "review", label: "Review" },
  { key: "approve", label: "Approve USDC" },
  { key: "fund", label: "Pay into escrow" },
  { key: "confirming", label: "Confirming deal" },
  { key: "funded", label: "Funded" },
];

const activeSteps: FundingStep[] = [
  "preparing",
  "approve_signature",
  "approve_pending",
  "fund_signature",
  "fund_pending",
  "tx_confirmed",
  "indexing",
  "indexing_failed",
  "succeeded",
];

const activeStepLabels: Partial<Record<FundingStep, string>> = {
  approve_pending: "Approve transaction confirming...",
  approve_signature: "Approve USDC in your wallet...",
  fund_pending: "Payment transaction confirming...",
  fund_signature: "Confirm payment in your wallet...",
  indexing: "Syncing deal status...",
  preparing: "Checking payment state...",
  tx_confirmed: "Payment confirmed on chain — syncing deal...",
};

export function FundingProgress({
  embedded = false,
  error,
  footer,
  step,
  txHash,
}: FundingProgressProps) {
  if (!activeSteps.includes(step) && step !== "failed") return null;

  if (step === "failed") {
    return renderProgressContent(
      embedded,
      <>
        <p className="section-label">Payment progress</p>
        <Notice
          message={error ?? "Payment failed. Please try again."}
          title="Payment failed"
          tone="danger"
        />
        {footer}
      </>,
    );
  }

  return renderProgressContent(
    embedded,
    <>
      <p className="section-label">Payment progress</p>

      <FundingStepList steps={getProgressSteps(step)} />

      {activeStepLabels[step] && (
        <p style={activeHelperStyle}>{activeStepLabels[step]}</p>
      )}

      {["fund_pending", "tx_confirmed", "indexing", "indexing_failed", "succeeded"].includes(step) && (
        <p style={recoveryHintStyle}>
          You can always find paid consultations in{" "}
          <Link href="/my-deals" style={recoveryLinkStyle}>
            My deals
          </Link>
          .
        </p>
      )}

      {txHash && (
        <p style={txStyle}>
          <span style={{ color: "var(--muted)" }}>Tx: </span>
          <code style={{ fontFamily: "var(--font-mono, monospace)" }}>
            {txHash.slice(0, 10)}...{txHash.slice(-6)}
          </code>
        </p>
      )}

      {error && (
        <Notice
          message={error}
          style={{ marginTop: 12 }}
          tone={step === "indexing_failed" ? "warning" : "danger"}
        />
      )}

      {footer}
    </>,
  );
}

function renderProgressContent(embedded: boolean, content: ReactNode) {
  if (embedded) {
    return <div style={embeddedProgressStyle}>{content}</div>;
  }

  return <ActionPanel style={{ padding: 20 }}>{content}</ActionPanel>;
}

type StepState = "active" | "done" | "error" | "pending";

interface FundStep {
  key: string;
  label: string;
  state: StepState;
}

function FundingStepList({ steps }: { steps: FundStep[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {steps.map((s) => (
        <div key={s.key} style={{ alignItems: "center", display: "flex", gap: 10 }}>
          <span style={stepMarkerStyle(s.state)}>
            {s.state === "done" ? (
              <Icon name="utility-check" size={11} stroke={3} />
            ) : s.state === "active" ? (
              <span className="spin" style={spinnerDotStyle} />
            ) : s.state === "error" ? (
              "×"
            ) : (
              <span style={pendingDotStyle} />
            )}
          </span>
          <span style={stepLabelStyle(s.state)}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function stepMarkerStyle(state: StepState) {
  const bg =
    state === "done" ? "var(--gold)" :
    state === "active" ? "transparent" :
    state === "error" ? "var(--red-bg)" :
    "var(--surface-2)";
  const border =
    state === "done" ? "1px solid var(--gold)" :
    state === "active" ? "1.5px solid var(--gold)" :
    state === "error" ? "1px solid var(--red)" :
    "1px solid var(--border)";
  const color =
    state === "done" ? "var(--gold-on)" :
    state === "error" ? "var(--red)" :
    "var(--muted)";
  return {
    alignItems: "center",
    background: bg,
    border,
    borderRadius: 999,
    color,
    display: "inline-grid",
    flexShrink: 0,
    fontSize: 11,
    fontWeight: 600,
    height: 18,
    placeItems: "center",
    width: 18,
  } as const;
}

function stepLabelStyle(state: StepState) {
  return {
    color: state === "pending" ? "var(--muted)" : "var(--ink)",
    fontSize: 13,
    fontWeight: state === "active" ? 600 : 400,
  };
}

const spinnerDotStyle = {
  border: "1.5px solid var(--gold)",
  borderRadius: 999,
  borderTopColor: "transparent",
  display: "inline-block",
  height: 9,
  width: 9,
} as const;

const pendingDotStyle = {
  background: "var(--muted)",
  borderRadius: 999,
  display: "inline-block",
  height: 4,
  width: 4,
} as const;

function getProgressSteps(step: FundingStep): FundStep[] {
  const activeKey = getActiveProgressKey(step);
  const activeIndex = progressOrder.findIndex((item) => item.key === activeKey);

  return progressOrder.map((item, index) => {
    if (step === "succeeded") {
      return { key: item.key, label: item.label, state: "done" };
    }

    if (step === "indexing_failed" && item.key === "confirming") {
      return { key: item.key, label: item.label, state: "error" };
    }

    if (activeIndex > index) {
      return { key: item.key, label: item.label, state: "done" };
    }

    if (activeIndex === index) {
      return { key: item.key, label: item.label, state: "active" };
    }

    return { key: item.key, label: item.label, state: "pending" };
  });
}

function getActiveProgressKey(step: FundingStep) {
  switch (step) {
    case "preparing":
      return "review";
    case "approve_pending":
    case "approve_signature":
      return "approve";
    case "fund_pending":
    case "fund_signature":
      return "fund";
    case "tx_confirmed":
    case "indexing":
    case "indexing_failed":
      return "confirming";
    case "succeeded":
      return "funded";
    default:
      return "review";
  }
}

const activeHelperStyle = {
  color: "var(--muted)",
  fontSize: 13,
  margin: "16px 0 0",
};

const recoveryHintStyle = {
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.5,
  margin: "12px 0 0",
};

const recoveryLinkStyle = {
  color: "var(--gold)",
  fontWeight: 600,
};

const txStyle = {
  color: "var(--ink)",
  fontSize: 12,
  margin: "8px 0 0",
  wordBreak: "break-all" as const,
};

const embeddedProgressStyle = {
  borderTop: "1px solid var(--border)",
  marginTop: 16,
  paddingTop: 16,
};
