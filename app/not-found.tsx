import Link from "next/link";

export default function NotFound() {
  return (
    <main style={mainStyle}>
      <style>{hoverCss}</style>
      <div style={cardStyle}>
        <p style={codeStyle}>404</p>
        <h1 style={titleStyle}>Page not found</h1>
        <p style={descriptionStyle}>
          The link you followed doesn&apos;t exist or has been removed.
        </p>
        <Link className="not-found-btn" href="/" style={btnStyle}>
          Go home
        </Link>
      </div>
    </main>
  );
}

const hoverCss = `
  .not-found-btn:hover {
    background: var(--accent-hover) !important;
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

const codeStyle = {
  background: "linear-gradient(135deg, var(--accent) 0%, var(--success) 100%)",
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

const btnStyle = {
  alignItems: "center",
  background: "var(--accent)",
  borderRadius: "var(--radius)",
  color: "#fff",
  display: "inline-flex",
  fontSize: 15,
  fontWeight: 500,
  justifyContent: "center",
  minHeight: 48,
  padding: "0 28px",
  textDecoration: "none",
  transition: "background 0.15s, transform 0.15s",
} as const;
