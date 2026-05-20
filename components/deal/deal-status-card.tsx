"use client";

import type { DealReadModel } from "@/lib/api/deals";
import { getDealDisplayConfig, toneFromStatus } from "@/lib/ui/deal-status";
import { formatUsdcPrice } from "@/lib/ui/format";
import { Icon } from "@/components/icons";
import { getGuidanceMessageAt } from "@/components/deal/deal-guidance-card";

const STATUS_TITLES: Record<string, string> = {
  ConfirmPending: "Confirm payment release",
  Disputed: "Under dispute review",
  Funded: "Escrow funded",
  Refunded: "Funds refunded",
  Released: "Payment released",
};

interface DealStatusCardProps {
  deal: DealReadModel;
  isAdmin?: boolean;
  isBuyer: boolean;
  isSeller: boolean;
  isParticipant: boolean;
}

export function DealStatusCard({ deal, isAdmin = false, isBuyer, isSeller, isParticipant }: DealStatusCardProps) {
  const sc = getDealDisplayConfig({ resolution_type: deal.resolution_type, status: deal.status });
  const title = STATUS_TITLES[deal.status] ?? "Consultation escrow";
  const tone = toneFromStatus(deal.status);

  const guidanceSubtitle = getGuidanceMessageAt(
    {
      dealStatus: deal.status,
      isBuyer,
      isSeller,
      isViewer: !isParticipant,
      priceUsdc: deal.price_usdc,
      riskStatus: deal.risk_status,
      releaseDeadlineAt: deal.release_deadline_at,
      scheduledAt: deal.scheduled_at,
    },
    Date.now(),
  );

  return (
    <div className="deal-hero">
      <span className={`status-icon status-icon--lg status-icon--${tone}`}>
        <Icon name={sc.icon} size={20} />
      </span>
      <div style={heroBodyStyle}>
        <p style={eyebrowStyle}>Deal · {deal.id.slice(0, 8).toUpperCase()}</p>
        <h1 style={heroTitleStyle}>{title}</h1>
        <p style={heroSubtitleStyle}>{guidanceSubtitle}</p>
      </div>
      <div className="deal-hero__amount">
        <div className="deal-hero__amount-num">{formatUsdcPrice(deal.price_usdc)}</div>
        <div className="deal-hero__amount-token">USDC · {sc.label}</div>
      </div>
    </div>
  );
}

const heroBodyStyle = { display: "flex", flexDirection: "column" as const, gap: 8, minWidth: 0 };

const eyebrowStyle = {
  color: "var(--muted)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
  margin: 0, textTransform: "uppercase" as const,
};

const heroTitleStyle = {
  color: "var(--ink)", fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 500,
  letterSpacing: "-0.01em", lineHeight: 1.1, margin: 0,
};

const heroSubtitleStyle = {
  color: "var(--muted)", fontSize: 14, lineHeight: 1.5, margin: 0, maxWidth: "52ch",
};
