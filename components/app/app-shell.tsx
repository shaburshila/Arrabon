"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { BottomTabBar } from "@/components/app/bottom-tab-bar";
import { TopNav } from "@/components/app/top-nav";

export function AppShell({
  children,
  flushBottom = false,
  flushTop = false,
  maxWidth = 640,
}: {
  children: React.ReactNode;
  flushBottom?: boolean;
  flushTop?: boolean;
  maxWidth?: number;
}) {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <TopNav />
      <main style={mainStyle}>
        <div
          style={{
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: 24,
            margin: "0 auto",
            maxWidth,
            padding: `${flushTop ? 0 : 56}px 32px ${flushBottom ? 0 : 96}px`,
            width: "100%",
          }}
        >
          {children}
        </div>
      </main>
      <BottomTabBar />
    </>
  );
}

const mainStyle = {
  minHeight: "100vh",
} as const;
