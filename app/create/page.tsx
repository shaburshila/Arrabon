"use client";

import { AppShell } from "@/components/app/app-shell";
import { CreateLinkForm } from "@/components/link/create-link-form";
import { useWalletSessionContext } from "@/contexts/wallet-session-context";

export default function CreatePage() {
  const session = useWalletSessionContext();

  return (
    <AppShell maxWidth={520}>
      <CreateLinkForm session={session} />
    </AppShell>
  );
}
