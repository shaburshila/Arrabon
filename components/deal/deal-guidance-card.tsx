"use client";

import { useEffect, useState } from "react";

import type { DealRiskStatus, DealStatus } from "@/lib/api/deals";
import { ActionPanel } from "@/components/shared/action-panel";

interface DealGuidanceCardProps {
  dealStatus: DealStatus;
  isBuyer: boolean;
  isSeller: boolean;
  isViewer: boolean;
  priceUsdc?: string;
  riskStatus?: DealRiskStatus;
  releaseDeadlineAt: string | null;
  scheduledAt: string;
}

function formatAbsoluteDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

function hasScheduledTimeStartedAt(iso: string, nowMs: number): boolean {
  const scheduledAtMs = new Date(iso).getTime();

  return !Number.isNaN(scheduledAtMs) && nowMs >= scheduledAtMs;
}

function formatTimeLeftAt(iso: string | null, nowMs: number): string | null {
  if (!iso) {
    return null;
  }

  const deadline = new Date(iso);
  const msUntil = deadline.getTime() - nowMs;

  if (Number.isNaN(deadline.getTime()) || msUntil <= 0) {
    return null;
  }

  const minutes = Math.max(1, Math.round(msUntil / 60_000));
  const absolute = formatAbsoluteDate(iso);

  if (minutes > 48 * 60) {
    return `${Math.round(minutes / (24 * 60))} days left, ${absolute}`;
  }

  if (minutes > 2 * 60) {
    return `${Math.round(minutes / 60)} hours left, ${absolute}`;
  }

  return `${minutes} minutes left, ${absolute}`;
}

export function getGuidanceMessageAt(
  {
  dealStatus,
  isBuyer,
  isSeller,
  isViewer,
  priceUsdc,
  riskStatus = "Clear",
  releaseDeadlineAt,
  scheduledAt,
}: DealGuidanceCardProps,
  nowMs: number,
): string {
  if (isViewer) {
    return "This page is for the buyer and seller of this deal.";
  }

  const scheduledTime = formatAbsoluteDate(scheduledAt);
  const amount = priceUsdc ? `$${priceUsdc} USDC` : null;
  const shouldOverrideForCompliance =
    (dealStatus === "Funded" ||
      dealStatus === "ConfirmPending" ||
      dealStatus === "Disputed") &&
    (riskStatus === "Blocked" || riskStatus === "Review");

  if (shouldOverrideForCompliance) {
    if (riskStatus === "Blocked") {
      return "This deal is under compliance review. Payouts are temporarily paused while the hold is reviewed.";
    }

    return "This deal is under compliance review. Payout actions may be delayed while checks are completed.";
  }

  switch (dealStatus) {
    case "Funded":
      if (isBuyer) {
        if (!hasScheduledTimeStartedAt(scheduledAt, nowMs)) {
          return `Your booking is confirmed. Reveal the meeting link below and join at the scheduled time (${scheduledTime}). If the seller does not show up, you can open a dispute after that time.`;
        }

        return `Your booking is confirmed. Reveal the meeting link below and join at the scheduled time (${scheduledTime}). If the consultation did not happen, you can now open a dispute.`;
      }

      if (isSeller) {
        return `A consultation is booked for ${scheduledTime}. When you believe the session is complete, mark it completed so the buyer can confirm payment or open a dispute.`;
      }

      break;

    case "ConfirmPending": {
      if (isBuyer) {
        const deadline = formatTimeLeftAt(releaseDeadlineAt, nowMs);
        return deadline
          ? `The seller has marked the consultation as completed. Confirm payment release or open a dispute before the deadline (${deadline}).`
          : "The seller has marked the consultation as completed. Confirm payment release or open a dispute before the deadline.";
      }

      if (isSeller) {
        return "Waiting for the buyer to confirm payment release.";
      }

      break;
    }

    case "Disputed":
      if (isBuyer) {
        return "Your dispute has been submitted. An admin will review and resolve it.";
      }

      if (isSeller) {
        return "The buyer opened a dispute. An admin will review and resolve it.";
      }

      break;

    case "Released":
      if (isSeller && amount) {
        return `Payment of ${amount} has been released to your wallet. This deal is complete.`;
      }

      return "Payment has been released to the seller. This deal is complete.";

    case "Refunded":
      if (isBuyer && amount) {
        return `A refund of ${amount} has been indexed for this deal.`;
      }

      if (isBuyer) {
        return "Your refund has been indexed for this deal.";
      }

      if (isSeller) {
        return "This deal was refunded to the buyer.";
      }

      return "This deal was refunded to the buyer.";
  }

  return "This page shows the current status of this consultation escrow.";
}

export function DealGuidanceCard(props: DealGuidanceCardProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const needsLiveCountdown =
      !props.isViewer &&
      (props.dealStatus === "Funded" || props.dealStatus === "ConfirmPending");

    if (!needsLiveCountdown) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [props.dealStatus, props.isViewer]);

  return (
    <ActionPanel style={cardStyle}>
      <p style={labelStyle}>What happens next</p>
      <p style={messageStyle}>{getGuidanceMessageAt(props, nowMs)}</p>
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
  margin: "0 0 10px",
  textTransform: "uppercase" as const,
};

const messageStyle = {
  color: "var(--foreground)",
  fontSize: 14,
  lineHeight: 1.55,
  margin: 0,
} as const;
