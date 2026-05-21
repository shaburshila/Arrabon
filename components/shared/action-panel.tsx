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
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--r-3)",
        boxShadow: "var(--shadow-2)",
        ...style,
      }}
    >
      {children}
    </Component>
  );
}
