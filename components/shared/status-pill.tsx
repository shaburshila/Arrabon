import type { CSSProperties } from "react";
import type { IconName } from "@/components/icons";
import { Icon } from "@/components/icons";

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
  icon,
  label,
  size = "sm",
  style,
  tone = "muted",
}: {
  bg?: string;
  color?: string;
  icon?: IconName;
  label: string;
  size?: StatusPillSize;
  style?: CSSProperties;
  tone?: StatusPillTone;
}) {
  const colors = toneStyles[tone];
  const sizeStyle = size === "md" ? mdStyle : smStyle;
  const iconSize = size === "md" ? 14 : 12;

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
        gap: icon ? 5 : 0,
        lineHeight: 1,
        whiteSpace: "nowrap",
        ...sizeStyle,
        ...style,
      }}
    >
      {icon && <Icon aria-hidden name={icon} size={iconSize} />}
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
