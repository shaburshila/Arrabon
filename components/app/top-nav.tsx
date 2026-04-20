"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { WalletSessionState } from "@/hooks/use-wallet-session";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { WalletStatusPill } from "@/components/app/wallet-status-pill";

const navItems = [
  { href: "/create", key: "create", label: "Create" },
  { href: "/my-links", key: "my-links", label: "My links" },
  { href: "/my-deals", key: "my-deals", label: "My deals" },
] as const;

export function TopNav({ session }: { session: WalletSessionState }) {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 24);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isAtTop = !isScrolled;

  return (
    <header style={headerStyle(isAtTop)}>
      <div style={headerInnerStyle}>
        <Link href="/" style={brandStyle}>
          <span style={brandMarkStyle}>B</span>
          <span style={brandTextStyle}>Base Consult Link</span>
        </Link>
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
        </nav>
        <div style={rightSideStyle}>
          <ThemeToggle />
          <WalletStatusPill session={session} />
        </div>
      </div>
    </header>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function headerStyle(borderless: boolean) {
  return {
    backdropFilter: "blur(16px)",
    background: borderless
      ? "color-mix(in srgb, var(--background) 88%, transparent)"
      : "var(--background)",
    borderBottom: borderless ? "1px solid transparent" : "1px solid var(--border)",
    display: "flex",
    justifyContent: "center",
    left: 0,
    position: "fixed" as const,
    right: 0,
    top: 0,
    transition: "background 0.18s, border-color 0.18s",
    width: "100%",
    zIndex: 40,
  };
}

const headerInnerStyle = {
  alignItems: "center",
  display: "grid",
  gap: 16,
  gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
  height: 64,
  margin: "0 auto",
  maxWidth: 1280,
  minWidth: 0,
  padding: "0 16px",
  width: "100%",
};

const brandStyle = {
  alignItems: "center",
  color: "var(--foreground)",
  display: "inline-flex",
  flexShrink: 0,
  gap: 8,
  textDecoration: "none",
};

const brandMarkStyle = {
  alignItems: "center",
  background: "var(--accent)",
  borderRadius: 12,
  color: "#fff",
  display: "inline-flex",
  fontSize: 14,
  fontWeight: 800,
  height: 32,
  justifyContent: "center",
  width: 32,
} as const;

const brandTextStyle = {
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: "0",
  whiteSpace: "nowrap" as const,
};

const navStyle = {
  justifySelf: "center",
  background: "var(--panel-muted)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  display: "flex",
  flexShrink: 1,
  gap: 2,
  minWidth: 0,
  overflowX: "auto" as const,
  padding: 4,
};

const rightSideStyle = {
  alignItems: "center",
  display: "flex",
  flexShrink: 0,
  gap: 8,
  justifySelf: "end",
  minWidth: 0,
};

function navLinkStyle(active: boolean) {
  return {
    background: active ? "var(--panel)" : "transparent",
    border: "1px solid transparent",
    borderRadius: 12,
    boxShadow: active ? "0 1px 6px rgba(0, 0, 0, 0.08)" : "none",
    color: active ? "var(--foreground)" : "var(--muted)",
    fontSize: 14,
    fontWeight: 500,
    padding: "6px 14px",
    textDecoration: "none",
    whiteSpace: "nowrap" as const,
  };
}
