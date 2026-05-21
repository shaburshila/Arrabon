import type { CSSProperties } from "react";

import { Icon } from "@/components/icons";
import type { IconName } from "@/components/icons";

export type StatusPillTone =
  | "accent"
  | "amber"
  | "blue"
  | "danger"
  | "gold"
  | "gray"
  | "green"
  | "muted"
  | "purple"
  | "red"
  | "success"
  | "warning";

type StatusPillSize = "md" | "sm";

const toneStyles: Record<StatusPillTone, { background: string; color: string }> = {
  accent:  { background: "var(--gold-soft)",   color: "var(--gold-deep)" },
  amber:   { background: "var(--amber-bg)",    color: "var(--amber)" },
  blue:    { background: "var(--blue-bg)",     color: "var(--blue)" },
  danger:  { background: "var(--red-bg)",      color: "var(--red)" },
  gold:    { background: "var(--gold-soft)",   color: "var(--gold-deep)" },
  gray:    { background: "var(--gray-bg)",     color: "var(--muted)" },
  green:   { background: "var(--green-bg)",    color: "var(--green)" },
  muted:   { background: "var(--muted-bg)",    color: "var(--muted)" },
  purple:  { background: "var(--purple-bg)",   color: "var(--purple)" },
  red:     { background: "var(--red-bg)",      color: "var(--red)" },
  success: { background: "var(--green-bg)",    color: "var(--green)" },
  warning: { background: "var(--amber-bg)",    color: "var(--amber)" },
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
  const iconSize = size === "md" ? 13 : 12;

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
        maxWidth: "100%",
        whiteSpace: "nowrap",
        width: "max-content",
        ...sizeStyle,
        ...style,
      }}
    >
      {icon && <Icon aria-hidden name={icon} size={iconSize} stroke={2.2} />}
      {label}
    </span>
  );
}

const smStyle = {
  fontSize: 12,
  height: 24,
  padding: "0 10px",
} as const;

const mdStyle = {
  fontSize: 13,
  height: 28,
  padding: "0 12px",
} as const;
