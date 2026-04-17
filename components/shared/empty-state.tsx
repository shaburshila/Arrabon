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
      {icon && <div style={iconStyle}>{icon}</div>}
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
  justifyContent: "center",
  padding: "64px 24px",
  textAlign: "center" as const,
};

const iconStyle = {
  color: "var(--muted)",
  marginBottom: 16,
};

const titleStyle = {
  color: "var(--foreground)",
  fontSize: 16,
  fontWeight: 500,
  margin: 0,
};

const descriptionStyle = {
  color: "var(--muted)",
  fontSize: 14,
  lineHeight: 1.45,
  margin: "4px 0 0",
  maxWidth: 320,
};

const actionStyle = {
  marginTop: 16,
};
