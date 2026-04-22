"use client";

import Link from "next/link";
import { Btn } from "@/components/shared/btn";

export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main style={mainStyle}>
      <div style={contentStyle}>
        <div style={emptyStateStyle}>
          <p style={titleStyle}>Something went wrong</p>
          <p style={descriptionStyle}>
            An unexpected error occurred. Please try again or return home.
          </p>
          <div style={actionsStyle}>
            <Btn onClick={reset} variant="primary">
              Try again
            </Btn>
            <Link href="/" style={secondaryBtnStyle}>
              Go home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

const mainStyle = {
  alignItems: "center",
  display: "flex",
  justifyContent: "center",
  minHeight: "100vh",
  padding: "88px 16px 48px",
} as const;

const contentStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
  maxWidth: 640,
  width: "100%",
};

const emptyStateStyle = {
  alignItems: "center",
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "center",
  padding: "64px 24px",
  textAlign: "center" as const,
};

const titleStyle = {
  color: "var(--foreground)",
  fontSize: 16,
  fontWeight: 500,
  margin: 0,
};

const descriptionStyle = {
  color: "var(--muted)",
  fontSize: 14,
  lineHeight: 1.45,
  margin: "4px 0 0",
  maxWidth: 320,
};

const actionsStyle = {
  alignItems: "center",
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
  marginTop: 16,
};

const secondaryBtnStyle = {
  alignItems: "center",
  background: "var(--muted-bg)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--foreground)",
  display: "inline-flex",
  fontSize: 15,
  fontWeight: 500,
  justifyContent: "center",
  minHeight: 48,
  padding: "0 24px",
  textDecoration: "none",
} as const;
