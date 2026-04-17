import type { ReactNode } from "react";

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p style={sectionLabelStyle}>{children}</p>;
}

const sectionLabelStyle = {
  color: "var(--muted)",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.08em",
  margin: 0,
  padding: "0 4px",
  textTransform: "uppercase" as const,
};
