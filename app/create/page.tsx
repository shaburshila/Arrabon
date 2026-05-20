"use client";

import { useCallback, useState } from "react";

import { useWalletSessionContext } from "@/contexts/wallet-session-context";
import { AppShell } from "@/components/app/app-shell";
import { CreateLinkForm } from "@/components/link/create-link-form";
import { LinkPreviewCard, type LinkPreviewValues } from "@/components/link/link-preview-card";

const emptyPreview: LinkPreviewValues = {
  description: "",
  duration_minutes: "",
  expires_date: "",
  expires_time: "",
  price_usdc: "",
  scheduled_date: "",
  scheduled_time: "",
  seller_address: "",
  title: "",
};

export default function CreatePage() {
  const session = useWalletSessionContext();
  const [preview, setPreview] = useState<LinkPreviewValues>(emptyPreview);
  const sellerAddress = session.address ?? "";

  const handleValuesChange = useCallback(
    (values: {
      description: string;
      duration_minutes: string;
      expires_date: string;
      expires_time: string;
      price_usdc: string;
      scheduled_date: string;
      scheduled_time: string;
      title: string;
    }) => {
      setPreview({
        description: values.description,
        duration_minutes: values.duration_minutes,
        expires_date: values.expires_date,
        expires_time: values.expires_time,
        price_usdc: values.price_usdc,
        scheduled_date: values.scheduled_date,
        scheduled_time: values.scheduled_time,
        seller_address: sellerAddress,
        title: values.title,
      });
    },
    [sellerAddress],
  );

  return (
    <AppShell maxWidth={1100}>
      <header style={pageHeaderStyle}>
        <h1 style={pageTitleStyle}>Create consultation link</h1>
        <p style={pageSubStyle}>
          Define the consultation, set the price, and share a single link.
          Funds settle in USDC on Base.
        </p>
      </header>

      <div className="create-split">
        <div>
          <CreateLinkForm session={session} onValuesChange={handleValuesChange} />
        </div>
        <aside className="create-split__preview">
          <LinkPreviewCard values={preview} />
        </aside>
      </div>
    </AppShell>
  );
}

const pageHeaderStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
  marginBottom: 48,
  maxWidth: 720,
};

const pageTitleStyle = {
  color: "var(--ink)",
  fontFamily: "var(--font-serif)",
  fontSize: 40,
  fontWeight: 500,
  letterSpacing: "-0.008em",
  lineHeight: 1.08,
  margin: 0,
  textWrap: "balance" as const,
};

const pageSubStyle = {
  color: "var(--muted)",
  fontSize: 16,
  lineHeight: 1.55,
  margin: 0,
};
