"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrabonSeal } from "@/components/shared/arrabon-seal";
import { Btn } from "@/components/shared/btn";

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="not-found">
      <ArrabonSeal size={80} tone="auto" />
      <p style={eyebrowStyle}>Error 404</p>
      <h1 style={titleStyle}>
        <em style={accentStyle}>Page</em> not&nbsp;found.
      </h1>
      <p style={ledeStyle}>
        The link you followed may be expired, cancelled, or never existed.
        Check the URL or return to safer ground.
      </p>
      <div style={actionsStyle}>
        <Btn onClick={() => router.back()} size="md" variant="ghost">
          ← Back
        </Btn>
        <Link href="/" style={{ textDecoration: "none" }}>
          <Btn size="md" variant="primary">Home</Btn>
        </Link>
      </div>
    </main>
  );
}

const eyebrowStyle = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.1em",
  margin: 0,
  textTransform: "uppercase" as const,
};

const titleStyle = {
  color: "var(--ink)",
  fontFamily: "var(--font-serif)",
  fontSize: "clamp(28px, 5vw, 42px)",
  fontWeight: 500,
  letterSpacing: "-0.015em",
  lineHeight: 1.1,
  margin: 0,
  textWrap: "balance" as const,
};

const accentStyle = {
  color: "var(--gold-deep)",
  fontStyle: "italic",
};

const ledeStyle = {
  color: "var(--muted)",
  fontSize: 15,
  lineHeight: 1.65,
  margin: 0,
  maxWidth: "44ch",
};

const actionsStyle = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap" as const,
  justifyContent: "center",
  marginTop: 8,
};
