import type { CSSProperties, ReactNode } from "react";

type NoticeTone = "danger" | "info" | "muted" | "success" | "warning";

const toneStyles: Record<NoticeTone, { background: string; border: string; color: string }> = {
  danger: {
    background: "var(--danger-muted)",
    border: "var(--danger)",
    color: "var(--danger)",
  },
  info: {
    background: "var(--accent-muted)",
    border: "var(--accent)",
    color: "var(--accent)",
  },
  muted: {
    background: "var(--muted-bg)",
    border: "var(--subtle-border)",
    color: "var(--muted)",
  },
  success: {
    background: "var(--success-muted)",
    border: "var(--success)",
    color: "var(--success)",
  },
  warning: {
    background: "var(--warning-muted)",
    border: "var(--warning)",
    color: "var(--warning)",
  },
};

export function Notice({
  message,
  style,
  title,
  tone = "info",
}: {
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
        borderRadius: "var(--radius)",
        color: colors.color,
        padding: 14,
        ...style,
      }}
    >
      {title && <p style={titleStyle}>{title}</p>}
      <div style={messageStyle}>{message}</div>
    </div>
  );
}

const titleStyle = {
  fontSize: 14,
  fontWeight: 500,
  margin: "0 0 4px",
} as const;

const messageStyle = {
  fontSize: 14,
  lineHeight: 1.45,
} as const;
