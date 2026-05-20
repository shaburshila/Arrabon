import type { CSSProperties, ReactNode } from "react";

import type { IconName } from "@/components/icons";
import { Icon } from "@/components/icons";

type NoticeTone = "danger" | "gold" | "info" | "muted" | "success" | "warning";

const toneStyles: Record<NoticeTone, { background: string; border: string; color: string }> = {
  danger:  { background: "var(--red-bg)",   border: "color-mix(in srgb, var(--red) 22%, transparent)",   color: "var(--red)" },
  gold:    { background: "var(--gold-soft)", border: "color-mix(in srgb, var(--gold) 26%, transparent)", color: "var(--gold-deep)" },
  info:    { background: "var(--blue-bg)",  border: "color-mix(in srgb, var(--blue) 22%, transparent)",  color: "var(--blue)" },
  muted:   { background: "var(--surface-2)", border: "var(--border)",                                    color: "var(--muted)" },
  success: { background: "var(--green-bg)", border: "color-mix(in srgb, var(--green) 22%, transparent)", color: "var(--green)" },
  warning: { background: "var(--amber-bg)", border: "color-mix(in srgb, var(--amber) 22%, transparent)", color: "var(--amber)" },
};

export function Notice({
  icon,
  message,
  style,
  title,
  tone = "info",
}: {
  icon?: IconName;
  message: ReactNode;
  style?: CSSProperties;
  title?: string;
  tone?: NoticeTone;
}) {
  const colors = toneStyles[tone];

  return (
    <div
      style={{
        background: colors.background,
        border: `1px solid ${colors.border}`,
        borderRadius: "var(--r-2)",
        color: colors.color,
        padding: 14,
        ...style,
      }}
    >
      <div style={{ display: "flex", gap: 12 }}>
        {icon && <span style={iconWrapStyle}><Icon name={icon} size={16} /></span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          {title && <p style={titleStyle}>{title}</p>}
          <div style={messageStyle}>{message}</div>
        </div>
      </div>
    </div>
  );
}

const iconWrapStyle = {
  flex: "0 0 18px",
  marginTop: 1,
  color: "inherit",
} as const;

const titleStyle = {
  fontSize: 13,
  fontWeight: 600,
  margin: "0 0 4px",
} as const;

const messageStyle = {
  fontSize: 13.5,
  lineHeight: 1.5,
  color: "var(--ink-soft)",
} as const;
