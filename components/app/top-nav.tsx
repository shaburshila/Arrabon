"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { WalletSessionState } from "@/hooks/use-wallet-session";
import { WalletStatusPill } from "@/components/app/wallet-status-pill";

const navItems = [
  { href: "/create", key: "create", label: "Create" },
  { href: "/my-links", key: "my-links", label: "My links" },
  { href: "/my-deals", key: "my-deals", label: "My deals" },
] as const;

export function TopNav({ session }: { session: WalletSessionState }) {
  const pathname = usePathname();
  const showAdmin = session.session?.is_admin === true;

  return (
    <header style={headerStyle}>
      <div style={topRowStyle}>
        <Link href="/" style={brandStyle}>
          Base Consult Link
        </Link>
        <WalletStatusPill session={session} />
      </div>
      <nav aria-label="Primary navigation" style={navStyle}>
        {navItems.map((item) => (
          <Link
            href={item.href}
            key={item.key}
            style={navLinkStyle(isActive(pathname, item.href))}
          >
            {item.label}
          </Link>
        ))}
        {showAdmin && (
          <Link
            href="/admin/disputes"
            style={navLinkStyle(pathname.startsWith("/admin"))}
          >
            Admin
          </Link>
        )}
      </nav>
    </header>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const headerStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
  width: "100%",
};

const topRowStyle = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const brandStyle = {
  color: "var(--accent)",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textDecoration: "none",
  textTransform: "uppercase" as const,
};

const navStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
};

function navLinkStyle(active: boolean) {
  return {
    background: active ? "var(--accent-muted)" : "var(--surface)",
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    borderRadius: 8,
    color: active ? "var(--accent)" : "var(--foreground)",
    fontSize: 13,
    fontWeight: 700,
    padding: "8px 10px",
    textDecoration: "none",
    whiteSpace: "nowrap" as const,
  };
}
