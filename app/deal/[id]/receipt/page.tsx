"use client";

// /deal/[id]/receipt — settlement receipt for a completed deal.
// Accessible to deal participants after release or refund.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { useWalletSessionContext } from "@/contexts/wallet-session-context";
import { fetchDeal, type DealReadModel } from "@/lib/api/deals";
import { formatDate } from "@/lib/ui/date";
import { formatUsdcPrice } from "@/lib/ui/format";
import { truncateAddress } from "@/lib/ui/address";
import { Icon } from "@/components/icons";
import { ArrabonSeal } from "@/components/shared/arrabon-seal";
import { AppShell } from "@/components/app/app-shell";
import { Btn } from "@/components/shared/btn";
import { DetailRow } from "@/components/shared/detail-row";
import { Notice } from "@/components/shared/notice";
import { StatusPill } from "@/components/shared/status-pill";

function getReceiptTitle(status: DealReadModel["status"]): string {
  if (status === "Released") return "Payment released";
  if (status === "Refunded") return "Funds refunded";
  return "Settlement receipt";
}

function getReceiptSub(deal: DealReadModel): string {
  if (deal.status === "Released") {
    return `${formatUsdcPrice(deal.price_usdc)} USDC was released to the seller after the consultation was completed.`;
  }
  if (deal.status === "Refunded") {
    return `${formatUsdcPrice(deal.price_usdc)} USDC was returned to the buyer after the dispute was resolved.`;
  }
  return `Settlement record for deal ${deal.id.slice(0, 8).toUpperCase()}.`;
}

function getSettledAt(deal: DealReadModel): string | null {
  return deal.resolved_at ?? deal.completed_at ?? null;
}

export default function ReceiptPage() {
  const params = useParams();
  const dealId = typeof params.id === "string" ? params.id : (params.id?.[0] ?? "");

  const session = useWalletSessionContext();
  const [deal, setDeal] = useState<DealReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    fetchDeal(dealId)
      .then(setDeal)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load receipt."))
      .finally(() => setLoading(false));
  }, [dealId]);

  const settledAt = deal ? getSettledAt(deal) : null;

  return (
    <AppShell maxWidth={760}>
      <div style={topRowStyle}>
        <Link href={`/deal/${dealId}`} className="btn btn--quiet btn--sm">
          <Icon name="utility-arrow-left" size={14} />
          Back to deal
        </Link>
        <Btn
          size="sm"
          variant="ghost"
          onClick={() => navigator.clipboard.writeText(deal?.id ?? "")}
        >
          <Icon name="utility-copy-address" size={14} />
          Copy ID
        </Btn>
      </div>

      {loading && (
        <p className="small" role="status" aria-live="polite" style={{ textAlign: "center" }}>Loading receipt…</p>
      )}

      {error && (
        <Notice message={error} title="Could not load receipt" tone="danger" />
      )}

      {!loading && !error && deal && (
        <>
          {deal.status !== "Released" && deal.status !== "Refunded" && (
            <Notice
              message="This deal hasn't settled yet. The receipt will be available once the deal is released or refunded."
              tone="warning"
            />
          )}

          <div className="receipt">
            <div className="receipt__seal">
              <ArrabonSeal size={96} tone="auto" />
            </div>

            <h1 className="receipt__title">{getReceiptTitle(deal.status)}</h1>
            <p className="receipt__sub">{getReceiptSub(deal)}</p>

            <div className="receipt__details">
              <DetailRow
                label="Deal ID"
                mono
                value={deal.id.slice(0, 8).toUpperCase()}
              />
              <DetailRow
                label="Amount"
                value={`${formatUsdcPrice(deal.price_usdc)} USDC`}
                accent
              />
              <DetailRow
                label="Status"
                value={
                  <StatusPill
                    label={deal.status === "Released" ? "Released" : "Refunded"}
                    tone={deal.status === "Released" ? "success" : "accent"}
                  />
                }
              />
              <DetailRow
                label="Seller"
                mono
                value={truncateAddress(deal.seller_address)}
              />
              <DetailRow
                label="Buyer"
                mono
                value={truncateAddress(deal.buyer_address)}
              />
              <DetailRow
                label="Scheduled"
                value={formatDate(deal.scheduled_at)}
              />
              {settledAt && (
                <DetailRow
                  label="Released"
                  value={formatDate(settledAt)}
                />
              )}
              {deal.tx_hash && (
                <DetailRow
                  bordered={false}
                  label="Settlement tx"
                  mono
                  value={
                    <a
                      href={`https://basescan.org/tx/${deal.tx_hash}`}
                      rel="noreferrer"
                      style={txLinkStyle}
                      target="_blank"
                    >
                      {deal.tx_hash.slice(0, 10)}…
                    </a>
                  }
                />
              )}
            </div>

            <div className="receipt__foot">
              <ArrabonSeal size={36} tone="gold-line" />
              <div className="receipt__foot-text">
                <strong>Secured by Arrabon</strong>
                Onchain escrow on Base · Trusted settlement
              </div>
            </div>
          </div>

          <p className="small" style={contractNoteStyle}>
            Powered by smart contract{" "}
            <a
              href="https://basescan.org/address/0x2EB0e35AbF9035f7A3B1807B857dc33518D1C5aD"
              rel="noreferrer"
              style={txLinkStyle}
              target="_blank"
            >
              0x2EB0…1C5aD
            </a>{" "}
            on Base.
          </p>

          <div style={actionsStyle}>
            <Link href={`/deal/${dealId}`} style={{ textDecoration: "none" }}>
              <Btn size="md" variant="ghost">View deal</Btn>
            </Link>
            <Btn
              size="md"
              variant="ghost"
              onClick={() => window.print()}
            >
              Print receipt
            </Btn>
          </div>
        </>
      )}
    </AppShell>
  );
}

const txLinkStyle = {
  color: "var(--gold-deep)",
  textDecoration: "none",
} as const;

const contractNoteStyle = {
  marginTop: 4,
  textAlign: "center" as const,
} as const;

const topRowStyle = {
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
} as const;

const actionsStyle = {
  display: "flex",
  gap: 10,
  justifyContent: "center",
} as const;
