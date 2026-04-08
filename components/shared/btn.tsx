"use client";

import type { CSSProperties, ReactNode } from "react";

type BtnVariant = "danger" | "ghost" | "primary" | "secondary";

interface BtnProps {
  children: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  fullWidth?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: "button" | "reset" | "submit";
  variant?: BtnVariant;
}

const baseStyle: CSSProperties = {
  alignItems: "center",
  border: "none",
  borderRadius: 12,
  display: "inline-flex",
  fontSize: 15,
  fontWeight: 600,
  gap: 8,
  justifyContent: "center",
  letterSpacing: "-0.01em",
  minHeight: 48, // touch target ≥ 44px per product spec
  outline: "none",
  padding: "0 20px",
  transition: "opacity 0.15s, background 0.15s",
  userSelect: "none",
};

const variantStyles: Record<BtnVariant, CSSProperties> = {
  danger: {
    background: "var(--danger)",
    color: "#fff",
  },
  ghost: {
    background: "transparent",
    border: "1px solid var(--border)",
    color: "var(--muted)",
  },
  primary: {
    background: "var(--accent)",
    color: "#fff",
  },
  secondary: {
    background: "var(--muted-bg)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
  },
};

export function Btn({
  children,
  disabled,
  disabledReason,
  fullWidth = false,
  loading = false,
  onClick,
  type = "button",
  variant = "primary",
}: BtnProps) {
  const isDisabled = disabled || loading;

  return (
    <div style={fullWidth ? { width: "100%" } : {}}>
      <button
        disabled={isDisabled}
        onClick={onClick}
        style={{
          ...baseStyle,
          ...variantStyles[variant],
          ...(fullWidth ? { width: "100%" } : {}),
          ...(isDisabled ? { cursor: "not-allowed", opacity: 0.5 } : {}),
        }}
        type={type}
      >
        {loading && <Spinner />}
        {children}
      </button>
      {isDisabled && disabledReason && (
        <p
          style={{
            color: "var(--muted)",
            fontSize: 12,
            margin: "6px 0 0",
            textAlign: "center",
          }}
        >
          {disabledReason}
        </p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      style={{
        animation: "spin 0.8s linear infinite",
        border: "2px solid currentColor",
        borderRadius: "50%",
        borderTopColor: "transparent",
        display: "inline-block",
        height: 14,
        width: 14,
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}
