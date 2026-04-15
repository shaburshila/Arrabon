"use client";

import type { DealStatus } from "@/lib/api/deals";

interface DealGuidanceCardProps {
  dealStatus: DealStatus;
  isBuyer: boolean;
  isSeller: boolean;
  isViewer: boolean;
  priceUsdc?: string;
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

function formatTimeLeft(iso: string | null): string | null {
  if (!iso) {
    return null;
  }

  const deadline = new Date(iso);
  const msUntil = deadline.getTime() - Date.now();

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

function getGuidanceMessage({
  dealStatus,
  isBuyer,
  isSeller,
  isViewer,
  priceUsdc,
  releaseDeadlineAt,
  scheduledAt,
}: DealGuidanceCardProps): string {
  if (isViewer) {
    return "This page is for the buyer and seller of this deal.";
  }

  const scheduledTime = formatAbsoluteDate(scheduledAt);
  const amount = priceUsdc ? `$${priceUsdc} USDC` : null;

  switch (dealStatus) {
    case "Funded":
      if (isBuyer) {
        return `Your booking is confirmed. Reveal the meeting link below and join at the scheduled time (${scheduledTime}).`;
      }

      if (isSeller) {
        return `A consultation is booked for ${scheduledTime}. After the session and grace period, come back to mark it completed.`;
      }

      break;

    case "ConfirmPending": {
      if (isBuyer) {
        const deadline = formatTimeLeft(releaseDeadlineAt);
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
        return `Payment of ${amount} has been released to the seller wallet. This deal is complete.`;
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
  return (
    <div style={cardStyle}>
      <p style={labelStyle}>What happens next</p>
      <p style={messageStyle}>{getGuidanceMessage(props)}</p>
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
  margin: "0 0 10px",
  textTransform: "uppercase" as const,
};

const messageStyle = {
  color: "var(--foreground)",
  fontSize: 14,
  lineHeight: 1.55,
  margin: 0,
} as const;
