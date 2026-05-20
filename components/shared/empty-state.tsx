import type { ReactNode } from "react";

export function EmptyState({
  action,
  description,
  icon,
  title,
}: {
  action?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <div style={emptyStateStyle}>
      {icon && <div style={iconContainerStyle}>{icon}</div>}
      <p style={titleStyle}>{title}</p>
      {description && <p style={descriptionStyle}>{description}</p>}
      {action && <div style={actionStyle}>{action}</div>}
    </div>
  );
}

const emptyStateStyle = {
  alignItems: "center",
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
  padding: "64px 32px",
  textAlign: "center" as const,
};

const iconContainerStyle = {
  alignItems: "center",
  background: "var(--surface-2)",
  border: "1px solid var(--border-soft)",
  borderRadius: 999,
  color: "var(--muted)",
  display: "inline-grid",
  height: 64,
  marginBottom: 4,
  placeItems: "center",
  width: 64,
} as const;

const titleStyle = {
  color: "var(--ink)",
  fontFamily: "var(--font-serif)",
  fontSize: 24,
  fontWeight: 500,
  letterSpacing: "-0.005em",
  margin: 0,
} as const;

const descriptionStyle = {
  color: "var(--muted)",
  fontSize: 14,
  lineHeight: 1.5,
  margin: 0,
  maxWidth: "40ch",
} as const;

const actionStyle = {
  marginTop: 4,
} as const;
