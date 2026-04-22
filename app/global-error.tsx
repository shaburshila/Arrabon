"use client";

const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`;

const themeVarsCss = `
:root {
  --g-bg: #ffffff; --g-fg: #1a1b1f; --g-muted: #6c7080;
  --g-surface: #f0f0f5; --g-accent: #0052ff;
}
[data-theme="dark"] {
  --g-bg: #16161e; --g-fg: #f0f0f5; --g-muted: #8585a0;
  --g-surface: #1e1e27; --g-accent: #4d7cff;
}
`;

export default function GlobalError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <style dangerouslySetInnerHTML={{ __html: themeVarsCss }} />
      </head>
      <body style={bodyStyle}>
        <main style={mainStyle}>
          <p style={titleStyle}>Something went wrong</p>
          <p style={descriptionStyle}>
            An unexpected error occurred. Please try again or return home.
          </p>
          <div style={actionsStyle}>
            <button onClick={reset} style={primaryBtnStyle}>
              Try again
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
