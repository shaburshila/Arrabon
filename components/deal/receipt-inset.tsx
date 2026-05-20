"use client";

import Link from "next/link";

import { ArrabonSeal } from "@/components/shared/arrabon-seal";
import { Btn } from "@/components/shared/btn";

interface Props {
  dealId: string;
  visible: boolean;
}

export function ReceiptInset({ dealId, visible }: Props) {
  if (!visible) return null;

  return (
    <div style={insetStyle}>
      <ArrabonSeal size={36} tone="gold-line" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={titleStyle}>Settlement confirmed</p>
        <p style={subStyle}>View full receipt and settlement details.</p>
      </div>
      <Link href={`/deal/${dealId}/receipt`} style={{ textDecoration: "none" }}>
        <Btn size="sm" variant="ghost">View receipt</Btn>
      </Link>
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
  padding: "16px 18px",
} as const;

const titleStyle = { color: "var(--ink)", fontSize: 13, fontWeight: 600, margin: 0 };
const subStyle = { color: "var(--muted)", fontSize: 12, lineHeight: 1.4, margin: "2px 0 0" };
