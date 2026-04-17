"use client";

import Link from "next/link";

import { useWalletSession } from "@/hooks/use-wallet-session";
import { AppShell } from "@/components/app/app-shell";
import { WalletSessionCard } from "@/components/shared/wallet-session-card";

export default function HomePage() {
  const session = useWalletSession();
  const isAdmin = session.session?.is_admin === true;

  return (
    <AppShell maxWidth={640}>
      <section style={heroStyle}>
        <h1 style={h1Style}>Consultation escrow on Base</h1>
        <p style={subtitleStyle}>
          Create paid consultation links, fund them with USDC, and keep the outcome tied to escrow.
        </p>
      </section>

      <WalletSessionCard session={session} />

      <section style={actionsStyle} aria-label="Primary actions">
        <ActionCard
          href="/create"
          label="Create link"
          text="Set up a single-use consultation slot for a client."
        />
        <ActionCard
          href="/my-links"
          label="My links"
          text="Review the consultation links you have created."
        />
        <ActionCard
          href="/my-deals"
          label="My deals"
          text="Open consultations you have paid for."
        />
        {isAdmin && (
          <ActionCard
            href="/admin/disputes"
            label="Admin disputes"
            text="Review open disputes and prepare release or refund actions."
          />
        )}
      </section>
    </AppShell>
  );
}

function ActionCard({
  href,
  label,
  text,
}: {
  href: string;
  label: string;
  text: string;
}) {
  return (
    <Link href={href} style={actionCardStyle}>
      <span style={actionLabelStyle}>{label}</span>
      <span style={actionTextStyle}>{text}</span>
    </Link>
  );
}

const heroStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
  paddingBottom: 4,
};

const h1Style = {
  fontSize: 34,
  fontWeight: 850,
  letterSpacing: "-0.02em",
  lineHeight: 1.08,
  margin: 0,
} as const;

const subtitleStyle = {
  color: "var(--muted)",
  fontSize: 16,
  lineHeight: 1.55,
  margin: 0,
  maxWidth: 540,
} as const;

const actionsStyle = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
} as const;

const actionCardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  boxShadow: "var(--shadow-card)",
  color: "var(--foreground)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
  minHeight: 118,
  padding: 16,
  textDecoration: "none",
};

const actionLabelStyle = {
  color: "var(--accent)",
  fontSize: 15,
  fontWeight: 800,
};

const actionTextStyle = {
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.45,
};
