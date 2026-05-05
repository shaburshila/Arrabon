import Link from "next/link";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app/app-shell";

interface LegalPageLayoutProps {
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
  lastUpdated: string;
  title: string;
}

export function LegalPageLayout({
  backHref = "/",
  backLabel = "← Home",
  children,
  lastUpdated,
  title,
}: LegalPageLayoutProps) {
  return (
    <AppShell maxWidth={760}>
      <Link href={backHref} style={backLinkStyle}>
        {backLabel}
      </Link>

      <article style={articleStyle}>
        <header style={headerStyle}>
          <p style={eyebrowStyle}>Legal</p>
          <h1 style={titleStyle}>{title}</h1>
          <p style={updatedStyle}>Last updated: {lastUpdated}</p>
        </header>

        <div style={contentStyle}>{children}</div>
      </article>
    </AppShell>
  );
}

const backLinkStyle = {
  alignSelf: "flex-start",
  color: "var(--accent)",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
} as const;

const articleStyle = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 24,
  padding: 24,
};

const headerStyle = {
  borderBottom: "1px solid var(--border)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
  paddingBottom: 20,
};

const eyebrowStyle = {
  color: "var(--muted)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  margin: 0,
  textTransform: "uppercase" as const,
};

const titleStyle = {
  color: "var(--foreground)",
  fontSize: "clamp(30px, 5vw, 42px)",
  letterSpacing: "-0.03em",
  lineHeight: 1.05,
  margin: 0,
};

const updatedStyle = {
  color: "var(--muted)",
  fontSize: 14,
  lineHeight: 1.5,
  margin: 0,
};

const contentStyle = {
  color: "var(--foreground)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 20,
  lineHeight: 1.7,
};
