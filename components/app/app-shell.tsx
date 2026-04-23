"use client";

import type { WalletSessionState } from "@/hooks/use-wallet-session";
import { TopNav } from "@/components/app/top-nav";

export function AppShell({
  children,
  flushBottom = false,
  maxWidth = 640,
  session,
}: {
  children: React.ReactNode;
  flushBottom?: boolean;
  maxWidth?: number;
  session: WalletSessionState;
}) {
  return (
    <>
      <TopNav session={session} />
      <main style={{ ...mainStyle, paddingBottom: flushBottom ? 0 : 48 }}>
        <div style={{ ...contentStyle, maxWidth }}>
          {children}
        </div>
      </main>
    </>
  );
}

const mainStyle = {
  display: "flex",
  justifyContent: "center",
  minHeight: "100vh",
  padding: "88px 16px 48px",
} as const;

const contentStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
  width: "100%",
};
