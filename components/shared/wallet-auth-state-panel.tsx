"use client";

import { type ReactNode } from "react";

import { type WalletSessionState } from "@/hooks/use-wallet-session";
import { ActionPanel } from "@/components/shared/action-panel";
import { Btn } from "@/components/shared/btn";
import { EmptyState } from "@/components/shared/empty-state";
import { Notice } from "@/components/shared/notice";

type WalletAuthMessages = {
  connectTitle: string;
  connectDescription: string;
  switchTitle: string;
  switchDescription: string;
  checkingTitle: string;
  checkingDescription: string;
  signInTitle: string;
  signInDescription: string;
};

type WalletAuthSessionProps = Pick<
  WalletSessionState,
  | "isConnected"
  | "isCorrectChain"
  | "siweStatus"
  | "isSigningIn"
  | "signInError"
  | "connect"
  | "switchToCorrectChain"
  | "signIn"
>;

type WalletAuthStatePanelProps = {
  icon: ReactNode;
  messages: WalletAuthMessages;
  session: WalletAuthSessionProps;
};

type BasePanelProps = {
  action?: ReactNode;
  description: string;
  error?: string | null;
  icon: ReactNode;
  title: string;
};

function BaseAuthStatePanel({
  action,
  description,
  error,
  icon,
  title,
}: BasePanelProps) {
  return (
    <ActionPanel style={authPanelStyle}>
      <EmptyState
        action={action}
        description={description}
        icon={icon}
        title={title}
      />
      {error && (
        <Notice
          message={error}
          tone="danger"
        />
      )}
    </ActionPanel>
  );
}

export function WalletAuthStatePanel({
  icon,
  messages,
  session,
}: WalletAuthStatePanelProps) {
  if (!session.isConnected) {
    return (
      <BaseAuthStatePanel
        action={
          <Btn onClick={() => session.connect()} size="md">
            Connect wallet
          </Btn>
        }
        description={messages.connectDescription}
        icon={icon}
        title={messages.connectTitle}
      />
    );
  }

  if (!session.isCorrectChain) {
    return (
      <BaseAuthStatePanel
        action={
          <Btn onClick={() => session.switchToCorrectChain()} size="md">
            Switch to Base
          </Btn>
        }
        description={messages.switchDescription}
        icon={icon}
        title={messages.switchTitle}
      />
    );
  }

  if (session.siweStatus === "loading") {
    return (
      <BaseAuthStatePanel
        description={messages.checkingDescription}
        icon={icon}
        title={messages.checkingTitle}
      />
    );
  }

  return (
    <BaseAuthStatePanel
      action={
        <Btn
          loading={session.isSigningIn}
          onClick={() => session.signIn()}
          size="md"
        >
          Sign in with Ethereum
        </Btn>
      }
      description={messages.signInDescription}
      error={session.signInError}
      icon={icon}
      title={messages.signInTitle}
    />
  );
}

const authPanelStyle = {
  overflow: "hidden",
  padding: "0 16px 16px",
} as const;
