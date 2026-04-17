import type { CSSProperties } from "react";

type StatusPillTone = "accent" | "danger" | "muted" | "success" | "warning";
type StatusPillSize = "md" | "sm";

const toneStyles: Record<StatusPillTone, { background: string; color: string }> = {
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
  success: {
    background: "var(--success-muted)",
    color: "var(--success)",
  },
  warning: {
    background: "var(--warning-muted)",
    color: "var(--warning)",
  },
};

export function StatusPill({
  bg,
  color,
  label,
  size = "sm",
  style,
  tone = "muted",
}: {
  bg?: string;
  color?: string;
  label: string;
  size?: StatusPillSize;
  style?: CSSProperties;
  tone?: StatusPillTone;
}) {
  const colors = toneStyles[tone];
  const sizeStyle = size === "md" ? mdStyle : smStyle;

  return (
    <span
      style={{
        alignItems: "center",
        background: bg ?? colors.background,
        border: "1px solid transparent",
        borderRadius: 999,
        color: color ?? colors.color,
        display: "inline-flex",
        fontWeight: 500,
        lineHeight: 1,
        whiteSpace: "nowrap",
        ...sizeStyle,
        ...style,
      }}
    >
      {label}
    </span>
  );
}

const smStyle = {
  fontSize: 12,
  padding: "2px 8px",
} as const;

const mdStyle = {
  fontSize: 14,
  padding: "4px 12px",
} as const;
