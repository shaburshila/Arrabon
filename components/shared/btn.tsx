"use client";

import type { CSSProperties, ReactNode } from "react";

type BtnVariant = "danger" | "ghost" | "primary" | "secondary";
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
  border: "none",
  borderRadius: "var(--radius)",
  display: "inline-flex",
  fontWeight: 500,
  gap: 8,
  justifyContent: "center",
  minHeight: 48, // touch target ≥ 44px per product spec
  outline: "none",
  transition: "opacity 0.15s, background 0.15s",
  userSelect: "none",
};

const sizeStyles: Record<BtnSize, CSSProperties> = {
  lg: {
    fontSize: 15,
    minHeight: 48,
    padding: "0 24px",
  },
  md: {
    fontSize: 14,
    minHeight: 42,
    padding: "0 20px",
  },
  sm: {
    fontSize: 14,
    minHeight: 36,
    padding: "0 16px",
  },
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
