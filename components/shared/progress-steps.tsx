"use client";

import type { CSSProperties } from "react";

export type ProgressStepState = "active" | "done" | "error" | "pending";

export interface ProgressStepItem {
  key: string;
  label: string;
  state: ProgressStepState;
}

export function ProgressSteps({
  steps,
  style,
}: {
  steps: ProgressStepItem[];
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", ...style }}>
      {steps.map((step, index) => (
        <ProgressStep
          item={step}
          key={step.key}
          last={index === steps.length - 1}
        />
      ))}
    </div>
  );
}

function ProgressStep({
  item,
  last,
}: {
  item: ProgressStepItem;
  last: boolean;
}) {
  const colors = getStepColors(item.state);

  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={railStyle}>
        <div
          style={{
            ...markerStyle,
            background: colors.markerBg,
            color: colors.markerColor,
          }}
        >
          {item.state === "active" ? (
            <Spinner />
          ) : item.state === "done" ? (
            "✓"
          ) : item.state === "error" ? (
            "×"
          ) : (
            <span style={dotStyle} />
          )}
        </div>
        {!last && (
          <div
            style={{
              background: item.state === "done" ? "var(--success-muted)" : "var(--border)",
              flex: 1,
              marginTop: 4,
              width: 1,
            }}
          />
        )}
      </div>
      <div style={{ paddingBottom: last ? 0 : 22, paddingTop: 2 }}>
        <p style={{ ...labelStyle, color: colors.labelColor }}>{item.label}</p>
        {item.state === "active" && (
          <p style={processingStyle}>Processing...</p>
        )}
      </div>
    </div>
  );
}

function getStepColors(state: ProgressStepState) {
  switch (state) {
    case "active":
      return {
        labelColor: "var(--accent)",
        markerBg: "var(--accent)",
        markerColor: "#fff",
      };
    case "done":
      return {
        labelColor: "var(--success)",
        markerBg: "var(--success)",
        markerColor: "#fff",
      };
    case "error":
      return {
        labelColor: "var(--danger)",
        markerBg: "var(--danger)",
        markerColor: "#fff",
      };
    case "pending":
    default:
      return {
        labelColor: "var(--muted)",
        markerBg: "var(--muted-bg)",
        markerColor: "var(--muted)",
      };
  }
}

function Spinner() {
  return (
    <span
      aria-hidden
      style={{
        animation: "spin 0.8s linear infinite",
        border: "2px solid currentColor",
        borderRadius: "50%",
        borderTopColor: "transparent",
        display: "inline-block",
        height: 12,
        width: 12,
      }}
    />
  );
}

const railStyle = {
  alignItems: "center",
  display: "flex",
  flexDirection: "column" as const,
  flexShrink: 0,
};

const markerStyle = {
  alignItems: "center",
  borderRadius: "50%",
  display: "flex",
  fontSize: 13,
  fontWeight: 800,
  height: 24,
  justifyContent: "center",
  lineHeight: 1,
  width: 24,
};

const dotStyle = {
  background: "currentColor",
  borderRadius: "50%",
  display: "block",
  height: 6,
  opacity: 0.7,
  width: 6,
};

const labelStyle = {
  fontSize: 14,
  fontWeight: 500,
  lineHeight: 1.35,
  margin: 0,
};

const processingStyle = {
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.4,
  margin: "2px 0 0",
};
