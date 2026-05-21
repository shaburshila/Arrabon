import type { CSSProperties, ReactNode } from "react";

export function DetailRow({
  accent = false,
  bordered = true,
  label,
  mono = false,
  style,
  value,
}: {
  accent?: boolean;
  bordered?: boolean;
  label: string;
  mono?: boolean;
  style?: CSSProperties;
  value: ReactNode;
}) {
  return (
    <div
      style={{
        alignItems: "baseline",
        borderTop: bordered ? "1px solid var(--border-soft)" : "none",
        display: "grid",
        gap: 16,
        gridTemplateColumns: "minmax(0, 1fr) auto",
        padding: "14px 0",
        ...style,
      }}
    >
      <span style={labelStyle}>{label}</span>
      <span
        style={{
          ...valueStyle,
          color: accent ? "var(--gold-deep)" : "var(--ink)",
          ...(mono
            ? {
                fontFamily: "var(--font-mono)",
                fontSize: 12.5,
                letterSpacing: "-0.005em",
              }
            : {}),
        }}
      >
        {value}
      </span>
    </div>
  );
}

const labelStyle = {
  color: "var(--muted)",
  fontSize: 13,
  letterSpacing: "0.005em",
} as const;

const valueStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13.5,
  fontWeight: 500,
  justifyContent: "flex-end",
  letterSpacing: "-0.003em",
  minWidth: 0,
  textAlign: "right" as const,
  whiteSpace: "nowrap" as const,
} as const;
