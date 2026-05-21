import type { CSSProperties, ReactNode } from "react";

export function ActionPanel({
  as = "div",
  children,
  style,
}: {
  as?: "div" | "section";
  children: ReactNode;
  style?: CSSProperties;
}) {
  const Component = as;

  return (
    <Component
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-5)",
        boxShadow: "var(--shadow-panel)",
        ...style,
      }}
    >
      {children}
    </Component>
  );
}
