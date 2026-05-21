"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/icons";
import { ArrabonSeal } from "@/components/shared/arrabon-seal";
import { Btn } from "@/components/shared/btn";

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="not-found">
      <ArrabonSeal size={80} tone="auto" />
      <p className="eyebrow">Error 404</p>
      <h1 className="h-display not-found__title">
        <span className="accent">Page</span>&nbsp;not&nbsp;found.
      </h1>
      <p className="lede not-found__sub">
        The link you followed may be expired, cancelled, or never existed.
        Check the URL or return to safer ground.
      </p>
      <div style={actionsStyle}>
        <Btn onClick={() => router.back()} size="lg" variant="ghost">
          <Icon name="utility-arrow-left" size={14} />
          Back
        </Btn>
        <Link href="/" style={{ textDecoration: "none" }}>
          <Btn size="lg" variant="primary">Home</Btn>
        </Link>
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
