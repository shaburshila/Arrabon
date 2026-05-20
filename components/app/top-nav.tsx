"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/icons";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { WalletStatusPill } from "@/components/app/wallet-status-pill";

const navItems = [
  { href: "/create",   key: "create",   label: "Create" },
  { href: "/my-links", key: "my-links", label: "My links" },
  { href: "/my-deals", key: "my-deals", label: "My deals" },
] as const;

export function TopNav() {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const update = () =>
      setIsDark(document.documentElement.dataset.theme === "dark");
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  return (
    <header style={headerStyle}>
      <div style={headerInnerStyle}>
        {/* Brand */}
        <Link
          href="/"
          style={brandStyle}
          onClick={() => window.scrollTo({ behavior: "smooth", top: 0 })}
        >
          <span style={brandMarkStyle}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Arrabon"
              height={28}
              src={isDark ? "/alpha-lock-full-gold.svg" : "/alpha-lock-full-graphite.svg"}
              width={28}
            />
          </span>
          <span style={brandWordStyle}>Arrabon</span>
        </Link>

        {/* Desktop nav — hidden on mobile (BottomTabBar takes over) */}
        <nav aria-label="Primary navigation" style={navStyle}>
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              style={navItemStyle(
                pathname === item.href || pathname.startsWith(`${item.href}/`),
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Toolbar */}
        <div style={toolbarStyle}>
          <button
            aria-label="Notifications"
            className="iconbtn iconbtn--tooltip"
            data-tooltip="Soon"
            style={{ border: "1px solid var(--border)" }}
            type="button"
          >
            <Icon name="utility-bell" size={16} />
          </button>
          <ThemeToggle />
          <WalletStatusPill />
        </div>
      </div>
    </header>
  );
}

const headerStyle = {
  backdropFilter: "blur(24px) saturate(180%)",
  WebkitBackdropFilter: "blur(24px) saturate(180%)",
  background: "color-mix(in srgb, var(--bg) 94%, transparent)",
  borderBottom: "1px solid var(--border)",
  display: "flex",
  justifyContent: "center",
  left: 0,
  position: "fixed" as const,
  right: 0,
  top: 0,
  width: "100%",
  zIndex: 40,
} as const;

const headerInnerStyle = {
  alignItems: "center",
  display: "grid",
  gap: 32,
  gridTemplateColumns: "auto 1fr auto",
  maxWidth: 1280,
  padding: "14px 32px",
  width: "100%",
} as const;

const brandStyle = {
  alignItems: "center",
  color: "var(--ink)",
  display: "inline-flex",
  flexShrink: 0,
  gap: 10,
  textDecoration: "none",
} as const;

const brandMarkStyle = {
  alignItems: "center",
  display: "inline-grid",
  height: 28,
  placeItems: "center",
  width: 28,
} as const;

const brandWordStyle = {
  fontFamily: "var(--font-serif)",
  fontSize: 22,
  fontWeight: 500,
  letterSpacing: "0.005em",
  lineHeight: 1,
  color: "var(--ink)",
  whiteSpace: "nowrap" as const,
} as const;

const navStyle = {
  display: "flex",
  gap: 4,
  justifySelf: "center",
} as const;

function navItemStyle(active: boolean) {
  return {
    background: active ? "var(--surface-2)" : "transparent",
    border: 0,
    borderRadius: "var(--r-2)",
    color: active ? "var(--ink)" : "var(--muted)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: "0.01em",
    padding: "8px 16px",
    textDecoration: "none",
    transition: "color 0.15s, background 0.15s",
    whiteSpace: "nowrap" as const,
  };
}

const toolbarStyle = {
  alignItems: "center",
  display: "inline-flex",
  gap: 8,
  justifySelf: "end",
} as const;
