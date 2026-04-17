import type { CSSProperties, ReactNode } from "react";

export function DetailRow({
  accent = false,
  bordered = true,
  label,
  style,
  value,
}: {
  accent?: boolean;
  bordered?: boolean;
  label: string;
  style?: CSSProperties;
  value: ReactNode;
}) {
  return (
    <div
      style={{
        alignItems: "center",
        borderBottom: bordered ? "1px solid var(--subtle-border)" : "none",
        display: "flex",
        gap: 12,
        justifyContent: "space-between",
        padding: "10px 0",
        ...style,
      }}
    >
      <span style={labelStyle}>{label}</span>
      <span
        style={{
          ...valueStyle,
          color: accent ? "var(--accent)" : "var(--foreground)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

const labelStyle = {
  color: "var(--muted)",
  fontSize: 14,
  lineHeight: 1.4,
} as const;

const valueStyle = {
  fontSize: 14,
  fontWeight: 500,
  lineHeight: 1.4,
  textAlign: "right" as const,
} as const;
