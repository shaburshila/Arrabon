"use client";

import { createContext, useContext } from "react";

import {
  useWalletSession,
  type WalletSessionState,
} from "@/hooks/use-wallet-session";

const WalletSessionContext = createContext<WalletSessionState | null>(null);

export function WalletSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = useWalletSession();

  return (
    <WalletSessionContext.Provider value={session}>
      {children}
    </WalletSessionContext.Provider>
  );
}

export function useWalletSessionContext(): WalletSessionState {
  const value = useContext(WalletSessionContext);

  if (!value) {
    throw new Error("useWalletSessionContext must be used within WalletSessionProvider.");
  }

  return value;
}
