"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { BottomTabBar } from "@/components/app/bottom-tab-bar";
import { TopNav } from "@/components/app/top-nav";

export function AppShell({
  children,
  flushBottom = false,
  maxWidth = 640,
}: {
  children: React.ReactNode;
  flushBottom?: boolean;
  maxWidth?: number;
}) {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <TopNav />
      <main style={{ ...mainStyle, paddingBottom: flushBottom ? 0 : 64 }}>
        <div style={{ ...contentStyle, maxWidth }}>
          {children}
        </div>
      </main>
      <BottomTabBar />
    </>
  );
}

const mainStyle = {
  display: "flex",
  justifyContent: "center",
  minHeight: "100vh",
  padding: "32px 32px 64px",
} as const;

const contentStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 24,
  width: "100%",
};
