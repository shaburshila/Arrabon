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
        <h1 className="h1">Create consultation link</h1>
        <p className="lede" style={{ marginTop: 8 }}>
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
  marginBottom: 40,
  maxWidth: 720,
};

