"use client";

import type { CSSProperties, ReactNode } from "react";

type BtnVariant = "danger" | "ghost" | "ink" | "primary" | "quiet" | "secondary";
type BtnSize = "lg" | "md" | "sm";

interface BtnProps {
  children: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  fullWidth?: boolean;
  loading?: boolean;
  onClick?: () => void;
  size?: BtnSize;
  type?: "button" | "reset" | "submit";
  variant?: BtnVariant;
}

const baseStyle: CSSProperties = {
  alignItems: "center",
  border: "1px solid transparent",
  borderRadius: "var(--r-3)",
  display: "inline-flex",
  fontFamily: "inherit",
  fontWeight: 500,
  gap: 8,
  justifyContent: "center",
  letterSpacing: "0.005em",
  outline: "none",
  transition: "background 0.15s, border-color 0.15s, color 0.15s, transform 0.05s",
  userSelect: "none",
  whiteSpace: "nowrap",
};

const sizeStyles: Record<BtnSize, CSSProperties> = {
  lg: { fontSize: 15, minHeight: 48, padding: "0 24px" },
  md: { fontSize: 14, minHeight: 42, padding: "0 20px" },
  sm: { fontSize: 13, minHeight: 36, padding: "0 14px" },
};

const variantStyles: Record<BtnVariant, CSSProperties> = {
  primary: {
    background: "var(--gold)",
    borderColor: "var(--gold)",
    color: "var(--gold-on)",
  },
  danger: {
    background: "transparent",
    borderColor: "var(--border)",
    color: "var(--red)",
  },
  ghost: {
    background: "transparent",
    borderColor: "var(--border)",
    color: "var(--ink)",
  },
  ink: {
    background: "var(--ink)",
    borderColor: "var(--ink)",
    color: "var(--bg)",
  },
  quiet: {
    background: "transparent",
    borderColor: "transparent",
    color: "var(--muted)",
    padding: "0 6px",
  },
  secondary: {
    background: "var(--surface-2)",
    borderColor: "var(--border)",
    color: "var(--ink)",
  },
};

export function Btn({
  children,
  disabled,
  disabledReason,
  fullWidth = false,
  loading = false,
  onClick,
  size = "lg",
  type = "button",
  variant = "primary",
}: BtnProps) {
  const isDisabled = disabled || loading;
  const needsWrapper = fullWidth || Boolean(isDisabled && disabledReason);

  const button = (
    <button
      disabled={isDisabled}
      onClick={onClick}
      style={{
        ...baseStyle,
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...(fullWidth ? { width: "100%" } : {}),
        ...(isDisabled ? { cursor: "not-allowed", opacity: 0.5 } : {}),
      }}
      type={type}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );

  if (!needsWrapper) {
    return button;
  }

  return (
    <div style={fullWidth ? { width: "100%" } : {}}>
      {button}
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
    />
  );
}
