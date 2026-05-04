"use client";

import { useEffect, useState } from "react";

const themeVarsCss = `
:root {
  --g-bg: #ffffff; --g-fg: #1a1b1f; --g-muted: #6c7080;
  --g-surface: #f0f0f5; --g-accent: #0052ff;
}
[data-theme="dark"] {
  --g-bg: #16161e; --g-fg: #f0f0f5; --g-muted: #8585a0;
  --g-surface: #1e1e27; --g-accent: #4d7cff;
}
@keyframes g-spin { to { transform: rotate(360deg); } }
`;

export default function GlobalError({
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

  useEffect(() => {
    try {
      const t = localStorage.getItem("theme");
      if (t === "dark" || t === "light") {
        document.documentElement.setAttribute("data-theme", t);
      }
    } catch {}
  }, []);

  function handleReset() {
    setReloading(true);
    setTimeout(reset, 400);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeVarsCss }} />
      </head>
      <body style={bodyStyle}>
        <main style={mainStyle}>
          <p style={titleStyle}>Something went wrong</p>
          <p style={descriptionStyle}>
            An unexpected error occurred. Please try again or return home.
          </p>
          <div style={actionsStyle}>
            <button
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
            <a href="/" style={secondaryBtnStyle}>
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}

const bodyStyle = {
  backgroundColor: "var(--g-bg)",
  color: "var(--g-fg)",
  fontFamily: "system-ui, -apple-system, sans-serif",
  margin: 0,
  padding: 0,
} as const;

const mainStyle = {
  alignItems: "center",
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "center",
  minHeight: "100vh",
  padding: "24px",
  textAlign: "center" as const,
};

const titleStyle = {
  color: "var(--g-fg)",
  fontSize: 16,
  fontWeight: 500,
  margin: 0,
};

const descriptionStyle = {
  color: "var(--g-muted)",
  fontSize: 14,
  lineHeight: 1.45,
  margin: "8px 0 0",
  maxWidth: 320,
};

const actionsStyle = {
  alignItems: "center",
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
  marginTop: 20,
};

const primaryBtnStyle = {
  alignItems: "center",
  background: "var(--g-accent)",
  border: "none",
  borderRadius: 16,
  color: "#ffffff",
  cursor: "pointer",
  display: "inline-flex",
  fontSize: 15,
  fontFamily: "inherit",
  fontWeight: 500,
  justifyContent: "center",
  minHeight: 48,
  padding: "0 24px",
} as const;

function Spinner() {
  return (
    <span
      aria-hidden
      style={{
        animation: "g-spin 0.8s linear infinite",
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

const secondaryBtnStyle = {
  alignItems: "center",
  background: "var(--g-surface)",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 16,
  color: "var(--g-fg)",
  display: "inline-flex",
  fontSize: 15,
  fontWeight: 500,
  justifyContent: "center",
  minHeight: 48,
  padding: "0 24px",
  textDecoration: "none",
} as const;
