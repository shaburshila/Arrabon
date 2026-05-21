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
          <p className="eyebrow">Legal</p>
          <h1 className="h1">{title}</h1>
          <p className="small">Last updated: {lastUpdated}</p>
        </header>

        <div style={contentStyle}>{children}</div>
      </article>
    </AppShell>
  );
}

const backLinkStyle = {
  alignSelf: "flex-start",
  color: "var(--gold-deep)",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
} as const;

const articleStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-5)",
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

const contentStyle = {
  color: "var(--ink)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 20,
  lineHeight: 1.7,
};
