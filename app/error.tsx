"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  function handleReset() {
    setReloading(true);
    setTimeout(reset, 400);
  }

  return (
    <main style={mainStyle}>
      <style>{hoverCss}</style>
      <div style={cardStyle}>
        <p style={iconStyle}>!</p>
        <h1 style={titleStyle}>Something went wrong</h1>
        <p style={descriptionStyle}>
          An unexpected error occurred. Please try again or return home.
        </p>
        <div style={actionsStyle}>
          <button
            className="error-primary-btn"
            disabled={reloading}
            onClick={handleReset}
            style={{
              ...primaryBtnStyle,
              ...(reloading ? { cursor: "not-allowed", opacity: 0.7 } : {}),
            }}
          >
            <span style={{ alignItems: "center", display: "inline-flex", gap: 8, justifyContent: "center" }}>
              {reloading ? <Spinner /> : null}
              {reloading ? "Reloading…" : "Try again"}
            </span>
          </button>
          <Link className="error-secondary-btn" href="/" style={secondaryBtnStyle}>
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}

const hoverCss = `
  .error-primary-btn:hover {
    background: var(--accent-hover) !important;
    transform: translateY(-1px);
  }
  .error-secondary-btn:hover {
    background: var(--muted-bg) !important;
    transform: translateY(-1px);
  }
`;

const mainStyle = {
  alignItems: "center",
  display: "flex",
  justifyContent: "center",
  minHeight: "100vh",
  padding: "24px 16px",
} as const;

const cardStyle = {
  alignItems: "center",
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-panel)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
  maxWidth: 420,
  padding: "56px 40px 48px",
  textAlign: "center" as const,
  width: "100%",
};

const iconStyle = {
  background: "linear-gradient(135deg, var(--danger) 0%, var(--warning) 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  fontSize: 72,
  fontWeight: 800,
  letterSpacing: "-0.04em",
  lineHeight: 1,
  margin: "0 0 16px",
} as const;

const titleStyle = {
  color: "var(--foreground)",
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: "-0.01em",
  margin: 0,
};

const descriptionStyle = {
  color: "var(--muted)",
  fontSize: 14,
  lineHeight: 1.6,
  margin: "4px 0 24px",
  maxWidth: 300,
};

const actionsStyle = {
  alignItems: "center",
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
  width: "100%",
};

const primaryBtnStyle = {
  alignItems: "center",
  background: "var(--accent)",
  border: "none",
  borderRadius: "var(--radius)",
  color: "#fff",
  cursor: "pointer",
  display: "inline-flex",
  fontFamily: "inherit",
  fontSize: 15,
  fontWeight: 500,
  justifyContent: "center",
  minHeight: 48,
  padding: "0 28px",
  transition: "background 0.15s, transform 0.15s",
  width: "100%",
} as const;

const secondaryBtnStyle = {
  alignItems: "center",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--muted)",
  display: "inline-flex",
  fontSize: 15,
  fontWeight: 500,
  justifyContent: "center",
  minHeight: 48,
  padding: "0 28px",
  textDecoration: "none",
  transition: "background 0.15s, transform 0.15s",
  width: "100%",
} as const;

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
        flexShrink: 0,
        height: 14,
        width: 14,
      }}
    />
  );
}
