"use client";

import { useState } from "react";

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

  return (
    <AppShell maxWidth={1100}>
      <div className="create-split">
        <div>
          <CreateLinkForm
            session={session}
            onValuesChange={(values) =>
              setPreview({
                description: values.description,
                duration_minutes: values.duration_minutes,
                expires_date: values.expires_date,
                expires_time: values.expires_time,
                price_usdc: values.price_usdc,
                scheduled_date: values.scheduled_date,
                scheduled_time: values.scheduled_time,
                seller_address: session.address ?? "",
                title: values.title,
              })
            }
          />
        </div>
        <aside className="create-split__preview">
          <LinkPreviewCard values={preview} />
        </aside>
      </div>
    </AppShell>
  );
}
