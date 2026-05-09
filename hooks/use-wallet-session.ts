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

export function shouldAutoSignIn(params: {
  isConnected: boolean;
  isCorrectChain: boolean;
  isSigningIn: boolean;
  manualSignOut: boolean;
  pingDone: boolean;
  siweStatus: SiweStatus;
  autoSignAttempted: boolean;
}): boolean {
  return (
    params.isConnected &&
    params.isCorrectChain &&
    params.siweStatus === "unauthenticated" &&
    !params.isSigningIn &&
    params.pingDone &&
    !params.autoSignAttempted &&
    !params.manualSignOut
  );
}

function normalizeAuthDomain(value: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  try {
    return new URL(trimmedValue).host.toLowerCase();
  } catch {
    return trimmedValue.split("/")[0].toLowerCase();
  }
}

function resolveSiweClientDomain(): string {
  const configuredDomain = normalizeAuthDomain(
    process.env.NEXT_PUBLIC_AUTH_DOMAIN ?? "",
  );

  if (configuredDomain) {
    return configuredDomain;
  }

  return typeof window !== "undefined"
    ? window.location.host.toLowerCase()
    : "localhost";
}

export function useWalletSession(): WalletSessionState {
  const { address, isConnected, chainId: accountChainId } = useAccount();
  const wagmiChainId = useChainId();
  const chainId = accountChainId ?? wagmiChainId;
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();

  const [siweStatus, setSiweStatus] = useState<SiweStatus>("unauthenticated");
  const [session, setSession] = useState<SiweSession | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [visibilityVersion, setVisibilityVersion] = useState(0);
  const pingDone = useRef(false);
  const autoSignAttempted = useRef(false);
  const manualSignOutRef = useRef(false);

  const isCorrectChain = chainId === baseRuntimeConfig.chainId;

  const refreshSessionFromPing = useCallback(async (): Promise<boolean> => {
    setSiweStatus("loading");
    setSignInError(null);

    try {
      const s = await pingSession();

      if (s) {
        setSession(s);
        setSiweStatus("authenticated");
        pingDone.current = true;
        autoSignAttempted.current = true;
        return true;
      } else {
        setSession(null);
        setSiweStatus("unauthenticated");
        pingDone.current = true;
        return false;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to restore wallet session.";
      setSession(null);
      setSiweStatus("unauthenticated");
      setSignInError(message);
      pingDone.current = true;
      return false;
    }
  }, []);

  // Restore session state on mount / when wallet connects
  useEffect(() => {
    if (!isConnected) {
      setSiweStatus("unauthenticated");
      setSession(null);
      setSignInError(null);
      pingDone.current = false;
      autoSignAttempted.current = false;
      manualSignOutRef.current = false;
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
        autoSignAttempted.current = false;
      }
      return;
    }

    void refreshSessionFromPing();
  }, [isConnected, address, session, refreshSessionFromPing]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const onVisibilityChange = () => {
      if (document.hidden || !isConnected || isSigningIn || siweStatus === "authenticated") {
        return;
      }

      void refreshSessionFromPing().then((authenticated) => {
        if (document.hidden || authenticated) {
          return;
        }

        autoSignAttempted.current = false;
        setVisibilityVersion((value) => value + 1);
      });
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isConnected, isSigningIn, refreshSessionFromPing, siweStatus]);

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
    autoSignAttempted.current = false;
    manualSignOutRef.current = false;
    await disconnectAsync();
  }, [disconnectAsync]);

  const signIn = useCallback(async () => {
    if (!address) {
      setSession(null);
      setSiweStatus("unauthenticated");
      setSignInError("Wallet not connected.");
      return;
    }

    manualSignOutRef.current = false;
    setIsSigningIn(true);
    setSignInError(null);

    try {
      const { issued_at, nonce } = await fetchNonce(address);
      const domain = resolveSiweClientDomain();
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
    manualSignOutRef.current = true;
    await logout().catch(() => {});
    setSession(null);
    setSiweStatus("unauthenticated");
    setSignInError(null);
    pingDone.current = false;
    autoSignAttempted.current = false;
  }, []);

  useEffect(() => {
    if (
      !shouldAutoSignIn({
        autoSignAttempted: autoSignAttempted.current,
        isConnected,
        isCorrectChain,
        isSigningIn,
        manualSignOut: manualSignOutRef.current,
        pingDone: pingDone.current,
        siweStatus,
      })
    ) {
      return;
    }

    if (typeof document !== "undefined" && document.hidden) {
      return;
    }

    autoSignAttempted.current = true;
    void signIn();
  }, [visibilityVersion, isConnected, isCorrectChain, siweStatus, isSigningIn, signIn]);

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
