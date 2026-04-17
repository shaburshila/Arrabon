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
        background: "var(--muted-bg)",
        borderRadius: "var(--radius)",
        display: "flex",
        gap: 4,
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
              background: active ? "var(--panel)" : "transparent",
              border: "none",
              borderRadius: "var(--radius-sm)",
              boxShadow: active ? "0 1px 2px rgba(0, 0, 0, 0.05)" : "none",
              color: active ? "var(--foreground)" : "var(--muted)",
              flexShrink: 0,
              fontSize: 14,
              fontWeight: 500,
              padding: "7px 14px",
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
