import type { CSSProperties, ReactNode } from "react";

export function InnerSection({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--surface-2)",
        borderRadius: "var(--r-4)",
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
