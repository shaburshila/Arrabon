"use client";

// Displays step-by-step funding progress during the funding flow.

import type { FundingStep } from "@/hooks/use-funding-flow";
import type { Hex } from "viem";
import Link from "next/link";

import { ActionPanel } from "@/components/shared/action-panel";
import { Notice } from "@/components/shared/notice";
import { ProgressSteps, type ProgressStepItem } from "@/components/shared/progress-steps";

interface FundingProgressProps {
  step: FundingStep;
  txHash: Hex | null;
  error: string | null;
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
  "indexing",
  "indexing_failed",
  "succeeded",
];

const activeStepLabels: Partial<Record<FundingStep, string>> = {
  approve_pending: "Approve transaction confirming...",
  approve_signature: "Approve USDC in your wallet...",
  fund_pending: "Payment transaction confirming...",
  fund_signature: "Confirm payment in your wallet...",
  indexing: "Waiting for the deal to appear...",
  preparing: "Checking payment state...",
};

export function FundingProgress({ error, step, txHash }: FundingProgressProps) {
  if (!activeSteps.includes(step) && step !== "failed") return null;

  if (step === "failed") {
    return (
      <ActionPanel style={{ padding: 20 }}>
        <p style={sectionLabelStyle}>Payment progress</p>
        <Notice
          message={error ?? "Payment failed. Please try again."}
          title="Payment failed"
          tone="danger"
        />
      </ActionPanel>
    );
  }

  return (
    <ActionPanel style={{ padding: 20 }}>
      <p style={sectionLabelStyle}>Payment progress</p>

      <ProgressSteps steps={getProgressSteps(step)} />

      {activeStepLabels[step] && (
        <p style={activeHelperStyle}>{activeStepLabels[step]}</p>
      )}

      {["fund_pending", "indexing", "indexing_failed", "succeeded"].includes(step) && (
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
          <code style={{ fontFamily: "monospace" }}>
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
    </ActionPanel>
  );
}

function getProgressSteps(step: FundingStep): ProgressStepItem[] {
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
    case "indexing":
    case "indexing_failed":
      return "confirming";
    case "succeeded":
      return "funded";
    default:
      return "review";
  }
}

const sectionLabelStyle = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  margin: "0 0 16px",
  textTransform: "uppercase" as const,
};

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
  color: "var(--accent)",
  fontWeight: 700,
};

const txStyle = {
  color: "var(--foreground)",
  fontSize: 12,
  margin: "8px 0 0",
  wordBreak: "break-all" as const,
};
