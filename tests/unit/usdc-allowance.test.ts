import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

function makeEntry(id: string, exports: unknown) {
  return {
    id,
    filename: id,
    loaded: true,
    exports,
    paths: [],
    parent: null,
    children: [],
  } as any;
}

const wagmiCorePath = require.resolve("@wagmi/core");
const baseConfigPath = path.resolve(__dirname, "../../lib/base/config.ts");

interface WagmiCoreMocks {
  allowanceReads: bigint[];
  readContractCalls: number;
  receiptCalls: unknown[];
  reset: () => void;
  waitForTransactionReceipt: (...args: unknown[]) => Promise<void>;
  writeContract: (...args: unknown[]) => Promise<`0x${string}`>;
}

const mocks: WagmiCoreMocks = {
  allowanceReads: [],
  readContractCalls: 0,
  receiptCalls: [],
  reset() {
    this.allowanceReads = [];
    this.readContractCalls = 0;
    this.receiptCalls = [];
    this.waitForTransactionReceipt = async () => undefined;
    this.writeContract = async () => `0x${"a".repeat(64)}`;
  },
  waitForTransactionReceipt: async () => undefined,
  writeContract: async () => `0x${"a".repeat(64)}`,
};

mocks.reset();

(require.cache as Record<string, unknown>)[wagmiCorePath] = makeEntry(wagmiCorePath, {
  readContract: async () => {
    mocks.readContractCalls += 1;
    return mocks.allowanceReads.shift() ?? BigInt(0);
  },
  waitForTransactionReceipt: async (...args: unknown[]) => {
    mocks.receiptCalls.push(args);
    return mocks.waitForTransactionReceipt(...args);
  },
  writeContract: (...args: unknown[]) => mocks.writeContract(...args),
});

(require.cache as Record<string, unknown>)[baseConfigPath] = makeEntry(baseConfigPath, {
  baseRuntimeConfig: {
    usdcAddress: "0x00000000000000000000000000000000000000C2",
  },
});

const {
  ensureUsdcAllowance,
} = require("../../lib/contract/usdc") as typeof import("../../lib/contract/usdc");

const owner = "0x00000000000000000000000000000000000000A1";
const spender = "0x00000000000000000000000000000000000000B2";
const config = {} as import("wagmi").Config;

beforeEach(() => {
  mocks.reset();
});

describe("ensureUsdcAllowance", () => {
  test("does not send approve when current allowance is already sufficient", async () => {
    mocks.allowanceReads = [BigInt(100)];

    await ensureUsdcAllowance(config, owner, spender, BigInt(50));

    assert.equal(mocks.readContractCalls, 1);
    assert.deepEqual(mocks.receiptCalls, []);
  });

  test("waits for approve receipt and re-reads allowance until it updates", async () => {
    let onApproveStartCalls = 0;
    let onApprovePendingHash: unknown = null;

    mocks.allowanceReads = [BigInt(0), BigInt(0), BigInt(100)];

    const promise = ensureUsdcAllowance(config, owner, spender, BigInt(50), {
      delay: async () => undefined,
      onApprovePending: (hash) => {
        onApprovePendingHash = hash;
      },
      onApproveStart: () => {
        onApproveStartCalls += 1;
      },
    });
    await promise;

    assert.equal(onApproveStartCalls, 1);
    assert.equal(onApprovePendingHash, `0x${"a".repeat(64)}`);
    assert.equal(mocks.readContractCalls, 3);
    assert.equal(mocks.receiptCalls.length, 1);
  });

  test("throws a user-friendly error when allowance never propagates", async () => {
    mocks.allowanceReads = [
      BigInt(0),
      BigInt(0),
      BigInt(0),
      BigInt(0),
      BigInt(0),
      BigInt(0),
    ];

    await assert.rejects(
      () =>
        ensureUsdcAllowance(config, owner, spender, BigInt(50), {
          delay: async () => undefined,
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(
          error.message,
          "USDC approval is confirmed, but the allowance update is taking too long. Please retry.",
        );
        return true;
      },
    );

    assert.equal(mocks.readContractCalls, 6);
    assert.equal(mocks.receiptCalls.length, 1);
  });
});
