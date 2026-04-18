import { AppShell } from "@/components/app/app-shell";
import { CreateLinkForm } from "@/components/link/create-link-form";

export default function CreatePage() {
  return (
    <AppShell maxWidth={520}>
      <CreateLinkForm />
    </AppShell>
  );
}
