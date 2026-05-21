"use client";

import type { DealReadModel } from "@/lib/api/deals";
import { truncateAddress } from "@/lib/ui/address";
import { formatDate } from "@/lib/ui/date";
import { formatUsdcPrice } from "@/lib/ui/format";
import { ActionPanel } from "@/components/shared/action-panel";
import { DetailRow } from "@/components/shared/detail-row";

interface Props {
  deal: DealReadModel;
  role: "buyer" | "seller" | "viewer";
}

export function DealDetailsCard({ deal, role }: Props) {
  return (
    <ActionPanel style={{ padding: 28 }}>
      <p className="section-label" style={{ marginBottom: 14 }}>Details</p>
      <DetailRow label="Amount" value={`${formatUsdcPrice(deal.price_usdc)} USDC`} accent />
      <DetailRow label="Deal ID" mono value={deal.id.slice(0, 8).toUpperCase()} />
      <DetailRow
        label="Seller"
        mono
        value={formatPartyAddress(deal.seller_address, role === "seller")}
      />
      <DetailRow
        label="Buyer"
        mono
        value={formatPartyAddress(deal.buyer_address, role === "buyer")}
      />
      <DetailRow
        label="Scheduled"
        value={formatDate(deal.scheduled_at, { fallback: "—", showTimeZoneName: true })}
      />
      {deal.duration_minutes && (
        <DetailRow label="Duration" value={`${deal.duration_minutes} min`} />
      )}
      {deal.release_deadline_at && (
        <DetailRow
          label={role === "seller" ? "Auto-release after" : "Release deadline"}
          value={formatDate(deal.release_deadline_at, { fallback: "—", showTimeZoneName: true })}
        />
      )}
      {deal.completed_at && (
        <DetailRow
          label="Completed"
          value={formatDate(deal.completed_at, { fallback: "—", showTimeZoneName: true })}
        />
      )}
      {deal.resolved_at && (
        <DetailRow
          label="Resolved"
          value={formatDate(deal.resolved_at, { fallback: "—", showTimeZoneName: true })}
        />
      )}
      {deal.tx_hash && (
        <DetailRow
          bordered={false}
          label="Funding tx"
          mono
          value={`${deal.tx_hash.slice(0, 10)}…${deal.tx_hash.slice(-6)}`}
        />
      )}
    </ActionPanel>
  );
}

function formatPartyAddress(address: string, isCurrentUser: boolean): string {
  return isCurrentUser ? `${truncateAddress(address)} (you)` : truncateAddress(address);
}

