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
        background: "var(--panel-muted)",
        borderRadius: "var(--radius)",
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
