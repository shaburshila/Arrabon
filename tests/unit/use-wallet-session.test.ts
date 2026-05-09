import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { shouldAutoSignIn } from "@/hooks/use-wallet-session";

describe("useWalletSession helpers", () => {
  test("allows auto sign-in only for connected, correct-chain, unauthenticated wallets without sticky manual logout", () => {
    assert.equal(
      shouldAutoSignIn({
        autoSignAttempted: false,
        isConnected: true,
        isCorrectChain: true,
        isSigningIn: false,
        manualSignOut: false,
        pingDone: true,
        siweStatus: "unauthenticated",
      }),
      true,
    );

    assert.equal(
      shouldAutoSignIn({
        autoSignAttempted: false,
        isConnected: true,
        isCorrectChain: true,
        isSigningIn: false,
        manualSignOut: true,
        pingDone: true,
        siweStatus: "unauthenticated",
      }),
      false,
    );
  });

  test("blocks auto sign-in when any normal gating condition fails", () => {
    assert.equal(
      shouldAutoSignIn({
        autoSignAttempted: true,
        isConnected: true,
        isCorrectChain: true,
        isSigningIn: false,
        manualSignOut: false,
        pingDone: true,
        siweStatus: "unauthenticated",
      }),
      false,
    );

    assert.equal(
      shouldAutoSignIn({
        autoSignAttempted: false,
        isConnected: false,
        isCorrectChain: true,
        isSigningIn: false,
        manualSignOut: false,
        pingDone: true,
        siweStatus: "unauthenticated",
      }),
      false,
    );

    assert.equal(
      shouldAutoSignIn({
        autoSignAttempted: false,
        isConnected: true,
        isCorrectChain: true,
        isSigningIn: false,
        manualSignOut: false,
        pingDone: false,
        siweStatus: "unauthenticated",
      }),
      false,
    );

    assert.equal(
      shouldAutoSignIn({
        autoSignAttempted: false,
        isConnected: true,
        isCorrectChain: true,
        isSigningIn: false,
        manualSignOut: false,
        pingDone: true,
        siweStatus: "authenticated",
      }),
      false,
    );
  });
});
