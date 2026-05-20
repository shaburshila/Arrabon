"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { useWalletSessionContext } from "@/contexts/wallet-session-context";
import { truncateAddress } from "@/lib/ui/address";

export function WalletStatusPill() {
  const session = useWalletSessionContext();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handlePillClick() {
    try {
      if (!session.isConnected) {
        await session.connect();
        return;
      }
      if (!session.isCorrectChain) {
        await session.switchToCorrectChain();
        return;
      }
    } catch {
      return;
    }
    setIsOpen((v) => !v);
  }

  async function copyAddress() {
    if (!session.address) return;
    try {
      await navigator.clipboard.writeText(session.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  // ─── Not connected ────────────────────────────────────────────────
  if (!session.isConnected) {
    return (
      <button onClick={handlePillClick} style={connectPillStyle} type="button">
        Connect
      </button>
    );
  }

  // ─── Wrong network ────────────────────────────────────────────────
  if (!session.isCorrectChain) {
    return (
      <button onClick={handlePillClick} style={wrongNetPillStyle} type="button">
        <span style={wrongNetDotStyle} />
        Switch to Base
      </button>
    );
  }

  // ─── Connected (dropdown-enabled) ────────────────────────────────
  const isAdmin = session.session?.is_admin === true;
  const isSigned = session.siweStatus === "authenticated";
  const address = session.address ? truncateAddress(session.address) : "…";

  return (
    <div ref={containerRef} style={wrapperStyle}>
      {/* Pill trigger */}
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={handlePillClick}
        style={connectedPillStyle}
        type="button"
      >
        {isSigned && (
          <>
            <span style={networkDotStyle} />
            <span style={networkLabelStyle}>Base</span>
          </>
        )}
        <span style={pillAddressStyle}>{address}</span>
        <span style={pillAvatarStyle} />
        <ChevronIcon open={isOpen} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div role="menu" style={dropdownStyle}>
          {/* Header */}
          <div style={dropdownHeaderStyle}>
            <span style={dropdownAvatarStyle}>
              {isAdmin ? <AdminSvg size={16} /> : <WalletSvg size={16} />}
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={connectedLabelStyle}>
                {isAdmin ? "Admin wallet" : "Connected wallet"}
              </p>
              <p style={dropdownAddressStyle}>
                {session.address ? truncateAddress(session.address) : ""}
              </p>
            </div>
          </div>

          <div style={dividerStyle} />

          {/* Copy address */}
          {session.address && (
            <button
              onClick={copyAddress}
              role="menuitem"
              style={menuItemStyle("muted")}
              type="button"
            >
              <span style={menuIconWrap("muted")}>
                {copied ? <CheckSvg /> : <CopySvg />}
              </span>
              {copied ? "Copied!" : "Copy address"}
            </button>
          )}

          {/* Admin disputes */}
          {isAdmin && (
            <Link
              href="/admin/disputes"
              onClick={() => setIsOpen(false)}
              role="menuitem"
              style={{ ...menuItemStyle("warning"), textDecoration: "none" }}
            >
              <span style={menuIconWrap("warning")}>
                <ShieldSvg />
              </span>
              Admin disputes
            </Link>
          )}

          {/* Disconnect */}
          <button
            onClick={() => {
              setIsOpen(false);
              void session.disconnect();
            }}
            role="menuitem"
            style={menuItemStyle("danger")}
            type="button"
          >
            <span style={menuIconWrap("danger")}>
              <CloseSvg />
            </span>
            Disconnect wallet
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

function WalletSvg({ size = 13 }: { size?: number }) {
  return (
    <svg aria-hidden fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size}>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 17.5v-10Z" />
      <path d="M16 12h4v4h-4a2 2 0 0 1 0-4Z" />
      <path d="M16 14h.01" />
    </svg>
  );
}

function AdminSvg({ size = 13 }: { size?: number }) {
  return (
    <svg aria-hidden fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size}>
      <path d="M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
    </svg>
  );
}

function CopySvg() {
  return (
    <svg aria-hidden fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="13">
      <rect height="12" rx="2" width="12" x="8" y="8" />
      <path d="M4 14V6a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

function CheckSvg() {
  return (
    <svg aria-hidden fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
      <path d="M5 12.5 9.5 17 19 7" />
    </svg>
  );
}

function ShieldSvg() {
  return (
    <svg aria-hidden fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="13">
      <path d="M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
    </svg>
  );
}

function CloseSvg() {
  return (
    <svg aria-hidden fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="13">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        color: "var(--muted)",
        display: "inline-flex",
        marginRight: 4,
        transition: "transform 0.15s ease",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
      }}
    >
      <Icon name="utility-chevron-down" size={12} />
    </span>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const wrapperStyle = {
  position: "relative" as const,
};

const connectPillStyle = {
  alignItems: "center",
  background: "var(--gold)",
  border: "1px solid var(--gold)",
  borderRadius: 999,
  color: "var(--gold-on)",
  cursor: "pointer",
  display: "inline-flex",
  fontSize: 13,
  fontWeight: 600,
  height: 34,
  padding: "0 18px",
  whiteSpace: "nowrap" as const,
} as const;

const wrongNetPillStyle = {
  alignItems: "center",
  background: "color-mix(in srgb, var(--danger) 10%, var(--surface))",
  border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
  borderRadius: 999,
  color: "var(--danger)",
  cursor: "pointer",
  display: "inline-flex",
  fontSize: 13,
  fontWeight: 500,
  gap: 8,
  height: 34,
  padding: "0 14px",
  whiteSpace: "nowrap" as const,
} as const;

const wrongNetDotStyle = {
  background: "var(--danger)",
  borderRadius: "50%",
  display: "inline-block",
  flexShrink: 0,
  height: 7,
  width: 7,
} as const;

const connectedPillStyle = {
  alignItems: "center",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 999,
  color: "var(--ink)",
  cursor: "pointer",
  display: "inline-flex",
  flexShrink: 0,
  gap: 7,
  height: 34,
  padding: "0 6px 0 10px",
  whiteSpace: "nowrap" as const,
} as const;

const networkDotStyle = {
  background: "var(--success)",
  borderRadius: "50%",
  display: "inline-block",
  flexShrink: 0,
  height: 7,
  width: 7,
} as const;

const networkLabelStyle = {
  color: "var(--muted)",
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.01em",
} as const;

const pillAddressStyle = {
  color: "var(--ink)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "-0.01em",
} as const;

const pillAvatarStyle = {
  alignItems: "center",
  background: "linear-gradient(135deg, var(--gold), var(--gold-deep))",
  borderRadius: "50%",
  color: "var(--gold-on)",
  display: "inline-flex",
  flexShrink: 0,
  height: 22,
  justifyContent: "center",
  marginLeft: 1,
  width: 22,
} as const;

// Dropdown

const dropdownStyle = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  boxShadow: "0 20px 60px rgba(0,0,0,0.24), 0 4px 16px rgba(0,0,0,0.10)",
  display: "flex",
  flexDirection: "column" as const,
  minWidth: 256,
  padding: 6,
  position: "absolute" as const,
  right: 0,
  top: "calc(100% + 8px)",
  zIndex: 60,
};

const dropdownHeaderStyle = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  padding: "12px 14px 14px",
};

const dropdownAvatarStyle = {
  alignItems: "center",
  background: "linear-gradient(135deg, var(--gold), var(--gold-deep))",
  borderRadius: "50%",
  color: "var(--gold-on)",
  display: "inline-flex",
  flexShrink: 0,
  height: 36,
  justifyContent: "center",
  width: 36,
} as const;

const connectedLabelStyle = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.04em",
  margin: "0 0 3px",
  textTransform: "uppercase" as const,
} as const;

const dropdownAddressStyle = {
  color: "var(--ink)",
  fontFamily: "var(--font-mono)",
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: "-0.01em",
  margin: 0,
  overflowWrap: "anywhere" as const,
} as const;

const dividerStyle = {
  borderTop: "1px solid var(--border-soft)",
  margin: "0 2px 4px",
} as const;

function menuItemStyle(tone: "danger" | "muted" | "warning") {
  const color = {
    danger: "var(--danger)",
    muted: "var(--ink)",
    warning: "var(--warning)",
  }[tone];

  return {
    alignItems: "center",
    background: "transparent",
    border: "none",
    borderRadius: 10,
    color,
    cursor: "pointer",
    display: "flex",
    fontSize: 14,
    fontWeight: 500,
    gap: 10,
    minHeight: 40,
    padding: "0 10px",
    textAlign: "left" as const,
    width: "100%",
  };
}

function menuIconWrap(tone: "danger" | "muted" | "warning") {
  const colors = {
    danger: { background: "var(--danger-muted)", color: "var(--danger)" },
    muted: { background: "var(--muted-bg)", color: "var(--muted)" },
    warning: { background: "var(--warning-muted)", color: "var(--warning)" },
  }[tone];

  return {
    ...colors,
    alignItems: "center",
    borderRadius: 8,
    display: "inline-flex",
    flexShrink: 0,
    height: 24,
    justifyContent: "center",
    width: 24,
  };
}
