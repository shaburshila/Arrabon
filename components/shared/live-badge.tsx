"use client";

export function LiveBadge() {
  return (
    <span style={badgeStyle} title="This page updates automatically">
      <span style={dotStyle} />
      Live
    </span>
  );
}

const badgeStyle = {
  alignItems: "center",
  color: "var(--muted)",
  display: "inline-flex",
  fontSize: 12,
  fontWeight: 600,
  gap: 6,
} as const;

const dotStyle = {
  background: "var(--success)",
  borderRadius: "50%",
  boxShadow: "0 0 0 3px var(--success-muted)",
  display: "inline-block",
  height: 8,
  width: 8,
} as const;
