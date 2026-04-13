import type { Metadata } from "next";

import { Providers } from "@/components/providers";
import { ThemeToggle } from "@/components/shared/theme-toggle";

import "./globals.css";

export const metadata: Metadata = {
  title: "Base Consult Link",
  description: "Single-use consultation escrow on Base.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ThemeToggle />
          {children}
        </Providers>
      </body>
    </html>
  );
}
