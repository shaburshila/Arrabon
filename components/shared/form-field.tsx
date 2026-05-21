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
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {helper && !error && <span className="field__help">{helper}</span>}
      {error && <span style={errorStyle}>{error}</span>}
    </label>
  );
}

const errorStyle = {
  color: "var(--red)",
  fontSize: 12,
  lineHeight: 1.4,
};
