"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useWalletSessionContext } from "@/contexts/wallet-session-context";
import type { WalletSessionState } from "@/hooks/use-wallet-session";
import { truncateAddress } from "@/lib/ui/address";

export function WalletStatusPill() {
  const session = useWalletSessionContext();
  const state = getWalletStatus(session);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleClick() {
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

    setIsOpen((value) => !value);
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

  return (
    <div ref={containerRef} style={containerStyle}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={handleClick}
        style={pillStyle(state.tone)}
        type="button"
      >
        {state.avatar ? (
          <WalletAvatar kind={state.avatar} tone={state.tone} />
        ) : state.dot ? (
          <span style={dotStyle(state.tone)} />
        ) : null}
        {state.label}
        {session.isConnected && session.isCorrectChain && (
          <span aria-hidden style={chevronStyle(isOpen)} />
        )}
      </button>

      {isOpen && session.isConnected && (
        <div role="menu" style={dropdownStyle}>
          <div style={dropdownHeaderStyle}>
            <span style={headerAvatarStyle(state.tone)}>
              <WalletAvatarIcon kind={session.session?.is_admin === true ? "admin" : "wallet"} />
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={dropdownLabelStyle}>
                {session.session?.is_admin === true ? "Admin wallet" : "Connected wallet"}
              </p>
              <p style={addressStyle}>
                {session.address ? truncateAddress(session.address) : "Unknown address"}
              </p>
            </div>
          </div>

          {session.address && (
            <button
              onClick={copyAddress}
              role="menuitem"
              style={dropdownButtonStyle()}
              type="button"
            >
              <MenuIcon kind={copied ? "check" : "copy"} tone="muted" />
              {copied ? "Copied" : "Copy address"}
            </button>
          )}

          {session.session?.is_admin === true && (
            <Link
              href="/admin/disputes"
              onClick={() => setIsOpen(false)}
              role="menuitem"
              style={{
                ...dropdownButtonStyle("warning"),
                color: "var(--warning)",
                textDecoration: "none",
              }}
            >
              <MenuIcon kind="shield" tone="warning" />
              Admin disputes
            </Link>
          )}

          <button
            onClick={() => {
              setIsOpen(false);
              void session.disconnect();
            }}
            role="menuitem"
            style={dropdownButtonStyle("danger")}
            type="button"
          >
            <MenuIcon kind="disconnect" tone="danger" />
            Disconnect wallet
          </button>
        </div>
      )}
    </div>
  );
}

function getWalletStatus(session: WalletSessionState) {
  if (!session.isConnected) {
    return { avatar: null, dot: false, label: "Connect", tone: "accent" as const };
  }

  if (!session.isCorrectChain) {
    return { avatar: null, dot: true, label: "Wrong network", tone: "danger" as const };
  }

  if (session.siweStatus !== "authenticated") {
    return {
      avatar: "wallet" as const,
      dot: true,
      label: session.address ? truncateAddress(session.address) : "Connected",
      tone: "muted" as const,
    };
  }

  if (session.session?.is_admin === true) {
    return { avatar: "admin" as const, dot: true, label: "Admin", tone: "accent" as const };
  }

  if (session.address) {
    return { avatar: "wallet" as const, dot: true, label: truncateAddress(session.address), tone: "success" as const };
  }

  return { avatar: "wallet" as const, dot: true, label: "Connected", tone: "success" as const };
}

function pillStyle(tone: "accent" | "danger" | "muted" | "success") {
  const colors = {
    accent: {
      background: "var(--accent)",
      color: "#161616",
    },
    danger: {
      background: "var(--danger-muted)",
      color: "var(--danger)",
    },
    muted: {
      background: "var(--muted-bg)",
      color: "var(--muted)",
    },
    success: {
      background: "var(--success-muted)",
      color: "var(--success)",
    },
  }[tone];

  return {
    ...colors,
    alignItems: "center",
    border: tone === "accent" ? "1px solid var(--accent)" : "1px solid var(--border)",
    borderRadius: 16,
    cursor: "pointer",
    display: "inline-flex",
    flexShrink: 0,
    fontSize: 14,
    fontWeight: 500,
    gap: 8,
    minHeight: 36,
    lineHeight: 1,
    padding: "0 10px",
    whiteSpace: "nowrap" as const,
  };
}

function WalletAvatar({
  kind,
  tone,
}: {
  kind: "admin" | "wallet";
  tone: "accent" | "danger" | "muted" | "success";
}) {
  return (
    <span style={avatarStyle(tone)}>
      <WalletAvatarIcon kind={kind} />
    </span>
  );
}

function WalletAvatarIcon({ kind }: { kind: "admin" | "wallet" }) {
  return (
    <svg
      aria-hidden
      fill="none"
      height="13"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="13"
    >
      {kind === "admin" ? (
        <path d="M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
      ) : (
        <>
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 17.5v-10Z" />
          <path d="M16 12h4v4h-4a2 2 0 0 1 0-4Z" />
          <path d="M16 14h.01" />
        </>
      )}
    </svg>
  );
}

function avatarStyle(tone: "accent" | "danger" | "muted" | "success") {
  const colors = {
    accent: {
      background: "linear-gradient(135deg, var(--accent), var(--warning))",
      color: "#161616",
    },
    danger: {
      background: "var(--danger-muted)",
      color: "var(--danger)",
    },
    muted: {
      background: "linear-gradient(135deg, var(--accent-muted), var(--success-muted))",
      color: "var(--foreground)",
    },
    success: {
      background: "linear-gradient(135deg, var(--accent), var(--success))",
      color: "#161616",
    },
  }[tone];

  return {
    ...colors,
    alignItems: "center",
    borderRadius: "50%",
    display: "inline-flex",
    flexShrink: 0,
    height: 20,
    justifyContent: "center",
    width: 20,
  };
}

function dotStyle(tone: "accent" | "danger" | "muted" | "success") {
  const colors = {
    accent: "#161616",
    danger: "var(--danger)",
    muted: "var(--muted)",
    success: "var(--success)",
  };

  return {
    background: colors[tone],
    borderRadius: "50%",
    display: "inline-block",
    height: 7,
    width: 7,
  };
}

function chevronStyle(open: boolean) {
  return {
    borderBottom: "1.5px solid currentColor",
    borderRight: "1.5px solid currentColor",
    display: "inline-block",
    height: 6,
    marginLeft: 2,
    opacity: 0.7,
    transform: open ? "rotate(225deg) translate(-1px, -1px)" : "rotate(45deg) translate(-1px, -1px)",
    transition: "transform 0.15s ease",
    width: 6,
  };
}

const containerStyle = {
  position: "relative" as const,
};

const dropdownStyle = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 18,
  boxShadow: "0 18px 48px rgba(0, 0, 0, 0.18)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 4,
  minWidth: 260,
  padding: 6,
  position: "absolute" as const,
  right: 0,
  top: "calc(100% + 8px)",
  zIndex: 60,
};

const dropdownHeaderStyle = {
  alignItems: "center",
  borderBottom: "1px solid var(--border)",
  display: "flex",
  gap: 10,
  marginBottom: 4,
  padding: "10px 10px 12px",
};

function headerAvatarStyle(tone: "accent" | "danger" | "muted" | "success") {
  return {
    ...avatarStyle(tone),
    height: 32,
    width: 32,
  };
}

const dropdownLabelStyle = {
  color: "var(--muted)",
  fontSize: 12,
  margin: "0 0 4px",
};

const addressStyle = {
  color: "var(--foreground)",
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 14,
  fontWeight: 500,
  margin: 0,
  overflowWrap: "anywhere" as const,
};

function dropdownButtonStyle(tone: "accent" | "danger" | "muted" | "warning" = "muted") {
  const backgrounds = {
    accent: "var(--accent-muted)",
    danger: "var(--danger-muted)",
    muted: "transparent",
    warning: "var(--warning-muted)",
  };

  return {
    alignItems: "center",
    background: backgrounds[tone],
    border: "none",
    borderRadius: 12,
    color: tone === "danger" ? "var(--danger)" : "var(--foreground)",
    cursor: "pointer",
    display: "flex",
    fontSize: 14,
    fontWeight: 500,
    gap: 8,
    minHeight: 38,
    padding: "0 10px",
    textAlign: "left" as const,
    width: "100%",
  };
}

function MenuIcon({
  kind,
  tone,
}: {
  kind: "check" | "copy" | "disconnect" | "shield";
  tone: "accent" | "danger" | "muted" | "warning";
}) {
  return (
    <span style={menuIconStyle(tone)}>
      <svg
        aria-hidden
        fill="none"
        height="14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
        width="14"
      >
        {kind === "copy" && (
          <>
            <rect height="12" rx="2" width="12" x="8" y="8" />
            <path d="M4 14V6a2 2 0 0 1 2-2h8" />
          </>
        )}
        {kind === "check" && <path d="M5 12.5 9.5 17 19 7" />}
        {kind === "shield" && (
          <path d="M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
        )}
        {kind === "disconnect" && (
          <>
            <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
            <path d="M15 8 19 12 15 16" />
            <path d="M19 12H9" />
          </>
        )}
      </svg>
    </span>
  );
}

function menuIconStyle(tone: "accent" | "danger" | "muted" | "warning") {
  const colors = {
    accent: {
      background: "var(--accent-muted)",
      color: "var(--accent)",
    },
    danger: {
      background: "var(--danger-muted)",
      color: "var(--danger)",
    },
    muted: {
      background: "var(--muted-bg)",
      color: "var(--muted)",
    },
    warning: {
      background: "var(--warning-muted)",
      color: "var(--warning)",
    },
  }[tone];

  return {
    ...colors,
    alignItems: "center",
    borderRadius: 8,
    display: "inline-flex",
    flexShrink: 0,
    fontSize: 9,
    fontWeight: 800,
    height: 22,
    justifyContent: "center",
    width: 22,
  };
}
