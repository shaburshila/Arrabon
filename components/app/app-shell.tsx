"use client";

import { useWalletSession } from "@/hooks/use-wallet-session";
import { TopNav } from "@/components/app/top-nav";

export function AppShell({
  children,
  maxWidth = 640,
}: {
  children: React.ReactNode;
  maxWidth?: number;
}) {
  const session = useWalletSession();

  return (
    <>
      <TopNav session={session} />
      <main style={mainStyle}>
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
