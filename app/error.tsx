"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Icon } from "@/components/icons";
import { ArrabonSeal } from "@/components/shared/arrabon-seal";
import { Btn } from "@/components/shared/btn";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="not-found">
      <div className="not-found__inner">
        <ArrabonSeal size={80} tone="auto" />
        <p className="eyebrow">Error 500</p>
        <h1 className="h-display not-found__title">
          <span className="accent">Something</span>&nbsp;broke.
        </h1>
        <p className="lede not-found__sub">
          An unexpected error occurred. Please try again or return home.
        </p>
        <div style={actionsStyle}>
          <Btn onClick={reset} size="lg" variant="ghost">
            <Icon name="utility-arrow-left" size={14} />
            Try again
          </Btn>
          <Link href="/" style={{ textDecoration: "none" }}>
            <Btn size="lg" variant="primary">Home</Btn>
          </Link>
        </div>
      </div>
    </main>
  );
}

const actionsStyle = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap" as const,
  justifyContent: "center",
  marginTop: 8,
};
