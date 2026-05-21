import type { CSSProperties } from "react";

export interface SegmentedTabOption {
  label: string;
  value: string;
}

export function SegmentedTabs({
  onChange,
  options,
  style,
  value,
}: {
  onChange: (value: string) => void;
  options: SegmentedTabOption[];
  style?: CSSProperties;
  value: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-3)",
        display: "flex",
        gap: 2,
        overflowX: "auto",
        padding: 4,
        ...style,
      }}
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            style={{
              background: active ? "var(--surface)" : "transparent",
              border: "none",
              borderRadius: "var(--r-2)",
              boxShadow: active ? "var(--shadow-1)" : "none",
              color: active ? "var(--ink)" : "var(--muted)",
              flexShrink: 0,
              fontSize: 13,
              fontWeight: 500,
              padding: "8px 16px",
              whiteSpace: "nowrap",
            }}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
