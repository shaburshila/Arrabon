"use client";

import { AppShell } from "@/components/app/app-shell";
import { CreateLinkForm } from "@/components/link/create-link-form";
import { useWalletSession } from "@/hooks/use-wallet-session";

export default function CreatePage() {
  const session = useWalletSession();

  return (
    <AppShell maxWidth={520} session={session}>
      <CreateLinkForm session={session} />
    </AppShell>
  );
}
