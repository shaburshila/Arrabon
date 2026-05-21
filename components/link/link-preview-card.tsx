"use client";

import { ArrabonSeal } from "@/components/shared/arrabon-seal";
import { DetailRow } from "@/components/shared/detail-row";

export interface LinkPreviewValues {
  title: string;
  description: string;
  price_usdc: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: string;
  expires_date: string;
  expires_time: string;
  seller_address: string;
}

interface Props {
  values: LinkPreviewValues;
}

export function LinkPreviewCard({ values }: Props) {
  const scheduled =
    values.scheduled_date && values.scheduled_time
      ? `${values.scheduled_date} · ${values.scheduled_time}`
      : "Not set";
  const expires =
    values.expires_date && values.expires_time
      ? `${values.expires_date} · ${values.expires_time}`
      : "Not set";

  return (
    <div style={stack}>
      <div style={cardStyle}>
        <p className="section-label" style={{ marginBottom: 18 }}>Preview</p>
        <div className="stack-12">
          <p className="eyebrow">Consultation</p>
          <h3 style={titleStyle}>{values.title || "Untitled consultation"}</h3>
          {values.description && (
            <p className="small" style={{ color: "var(--muted)" }}>{values.description}</p>
          )}
        </div>
        <div style={divider} />
        <DetailRow
          label="Price"
          value={
            values.price_usdc ? (
              <span>
                <span style={{ fontFamily: "var(--font-mono)" }}>{values.price_usdc}</span>
                <span style={{ color: "var(--muted)", marginLeft: 4 }}>USDC</span>
              </span>
            ) : (
              "—"
            )
          }
        />
        <DetailRow label="Scheduled" value={scheduled} />
        <DetailRow label="Duration" value={values.duration_minutes ? `${values.duration_minutes} minutes` : "—"} />
        <DetailRow label="Seller" mono value={values.seller_address ? truncate(values.seller_address) : "—"} />
        <DetailRow bordered={false} label="Expires" value={expires} />
      </div>

      <div style={insetStyle}>
        <ArrabonSeal size={56} tone="auto" />
        <div>
          <p className="tiny">Secured by Arrabon</p>
          <p className="small" style={{ color: "var(--muted)", marginTop: 4 }}>
            Onchain escrow · Trusted settlement
          </p>
        </div>
      </div>
    </div>
  );
}

function truncate(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

const stack = { display: "flex", flexDirection: "column" as const, gap: 20 };

const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border-soft)",
  borderRadius: "var(--r-3)",
  boxShadow: "var(--shadow-2)",
  display: "flex",
  flexDirection: "column" as const,
  padding: 28,
};

const titleStyle = {
  color: "var(--ink)",
  fontFamily: "var(--font-serif)",
  fontSize: 22,
  fontWeight: 500,
  letterSpacing: "-0.005em",
  lineHeight: 1.2,
  margin: 0,
  textWrap: "balance" as const,
} as const;

const divider = {
  background: "var(--rule)",
  border: 0,
  height: 1,
  margin: "20px 0",
};

const insetStyle = {
  alignItems: "center",
  background: "var(--surface-2)",
  border: "1px solid var(--border-soft)",
  borderRadius: "var(--r-3)",
  display: "flex",
  gap: 14,
  padding: 28,
};

