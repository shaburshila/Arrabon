"use client";

import Link from "next/link";

import { Icon } from "@/components/icons";
import { ArrabonSeal } from "@/components/shared/arrabon-seal";
import { Btn } from "@/components/shared/btn";

interface Props {
  dealId: string;
  isSettled: boolean;
}

export function DealSealCard({ dealId, isSettled }: Props) {
  return (
    <div style={insetStyle}>
      <ArrabonSeal size={56} tone="auto" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="tiny">Secured by Arrabon</p>
        <p style={subStyle}>
          Onchain escrow · Base · Deal {dealId.slice(0, 8).toUpperCase()}
        </p>
      </div>
      {isSettled && (
        <Link href={`/deal/${dealId}/receipt`} style={{ textDecoration: "none", marginLeft: "auto" }}>
          <Btn size="sm" variant="ghost">
            View receipt
            <Icon name="utility-external-link" size={14} />
          </Btn>
        </Link>
      )}
    </div>
  );
}

const insetStyle = {
  alignItems: "center",
  background: "var(--surface-2)",
  border: "1px solid var(--border-soft)",
  borderRadius: "var(--r-3)",
  display: "flex",
  gap: 14,
  padding: 28,
} as const;

const subStyle = {
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.5,
  margin: "4px 0 0",
};
