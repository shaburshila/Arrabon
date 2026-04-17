import type { ReactNode } from "react";

export function FormField({
  children,
  error,
  helper,
  label,
}: {
  children: ReactNode;
  error?: string | null;
  helper?: ReactNode;
  label: string;
}) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      {children}
      {helper && !error && <span style={helperStyle}>{helper}</span>}
      {error && <span style={errorStyle}>{error}</span>}
    </label>
  );
}

const fieldStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
};

const labelStyle = {
  color: "var(--muted)",
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
};

const helperStyle = {
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.4,
};

const errorStyle = {
  color: "var(--danger)",
  fontSize: 12,
  lineHeight: 1.4,
};
