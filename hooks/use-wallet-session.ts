"use client";

// Orchestrates wallet connection + SIWE session flow.
// SIWE session is an HttpOnly cookie managed by the backend.
// On mount: if wallet is connected, pings backend to restore session state.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
} from "wagmi";

import { getAddress } from "viem";

import { fetchNonce, logout, pingSession, verifySiwe, type SiweSession } from "@/lib/api/auth";
import { baseRuntimeConfig } from "@/lib/base/config";
import { buildSiweMessage } from "@/lib/wallet/siwe";

export type SiweStatus = "authenticated" | "loading" | "unauthenticated";

export interface WalletSessionState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isCorrectChain: boolean;
  isSigningIn: boolean;
  signInError: string | null;
  session: SiweSession | null;
  siweStatus: SiweStatus;
  // actions
  connect: (connectorId?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  switchToCorrectChain: () => Promise<void>;
}

export function useWalletSession(): WalletSessionState {
  const { address, isConnected, chainId: accountChainId } = useAccount();
  const wagmiChainId = useChainId();
  const chainId = accountChainId ?? wagmiChainId;
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();

  const [siweStatus, setSiweStatus] = useState<SiweStatus>("loading");
  const [session, setSession] = useState<SiweSession | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const pingDone = useRef(false);

  const isCorrectChain = chainId === baseRuntimeConfig.chainId;

  // Restore session state on mount / when wallet connects
  useEffect(() => {
    if (!isConnected) {
      setSiweStatus("unauthenticated");
      setSession(null);
      setSignInError(null);
      pingDone.current = false;
      return;
    }

    if (pingDone.current) {
      // Wallet address changed after sign-in — invalidate session
      if (session && address && getAddress(session.wallet_address) !== getAddress(address)) {
        logout().catch(() => {});
        setSession(null);
        setSiweStatus("unauthenticated");
        setSignInError(null);
        pingDone.current = false;
      }
      return;
    }

    pingDone.current = true;

    pingSession().then((s) => {
      if (s) {
        setSession(s);
        setSiweStatus("authenticated");
      } else {
        setSiweStatus("unauthenticated");
      }
    });
  }, [isConnected, address, session]);

  const connect = useCallback(
    async (connectorId?: string) => {
      const target = connectorId
        ? connectors.find((c) => c.id === connectorId)
        : // Prefer injected (Base App), fall back to coinbaseWallet
          connectors.find((c) => c.id === "injected") ?? connectors[0];
      if (!target) return;
      await connectAsync({ connector: target });
    },
    [connectAsync, connectors],
  );

  const disconnect = useCallback(async () => {
    await logout().catch(() => {});
    setSession(null);
    setSiweStatus("unauthenticated");
    setSignInError(null);
    pingDone.current = false;
    await disconnectAsync();
  }, [disconnectAsync]);

  const signIn = useCallback(async () => {
    if (!address) throw new Error("Wallet not connected");
    setIsSigningIn(true);
    setSignInError(null);

    try {
      const { issued_at, nonce } = await fetchNonce(address);
      const domain =
        typeof window !== "undefined" ? window.location.host : "localhost";
      const uri =
        typeof window !== "undefined" ? window.location.origin : "http://localhost";

      const message = buildSiweMessage({
        address,
        chainId: baseRuntimeConfig.chainId,
        domain,
        issuedAt: issued_at,
        nonce,
        uri,
      });

      const signature = await signMessageAsync({ message });
      const s = await verifySiwe(message, signature);
      setSession(s);
      setSiweStatus("authenticated");
      setSignInError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to sign in with Ethereum.";
      setSession(null);
      setSiweStatus("unauthenticated");
      setSignInError(message);
    } finally {
      setIsSigningIn(false);
    }
  }, [address, signMessageAsync]);

  const signOut = useCallback(async () => {
    await logout().catch(() => {});
    setSession(null);
    setSiweStatus("unauthenticated");
    setSignInError(null);
    pingDone.current = false;
  }, []);

  const switchToCorrectChain = useCallback(async () => {
    await switchChainAsync({ chainId: baseRuntimeConfig.chainId });
  }, [switchChainAsync]);

  return {
    address: address ?? null,
    chainId: chainId ?? null,
    isConnected,
    isCorrectChain,
    isSigningIn,
    signInError,
    session,
    siweStatus,
    connect,
    disconnect,
    signIn,
    signOut,
    switchToCorrectChain,
  };
}
