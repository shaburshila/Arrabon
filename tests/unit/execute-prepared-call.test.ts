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
const viemActionsPath = require.resolve("viem/actions");
const root = path.resolve(__dirname, "../..");
const baseConfigPath = path.resolve(root, "lib/base/config.ts");

type CoreMocks = {
  connectorClientCalls: unknown[][];
  reset: () => void;
  waitForTransactionReceiptCalls: unknown[][];
};

type ViemActionMocks = {
  reset: () => void;
  sendTransactionCalls: unknown[][];
};

const coreMocks: CoreMocks = {
  connectorClientCalls: [],
  reset() {
    this.connectorClientCalls = [];
    this.waitForTransactionReceiptCalls = [];
  },
  waitForTransactionReceiptCalls: [],
};

const viemActionMocks: ViemActionMocks = {
  reset() {
    this.sendTransactionCalls = [];
  },
  sendTransactionCalls: [],
};

coreMocks.reset();
viemActionMocks.reset();

const connectorClient = {
  account: {
    address: "0x00000000000000000000000000000000000000aa",
    type: "json-rpc",
  },
  chain: undefined,
  uid: "connector-client",
};

(require.cache as Record<string, unknown>)[wagmiCorePath] = makeEntry(wagmiCorePath, {
  getConnectorClient: async (...args: unknown[]) => {
    coreMocks.connectorClientCalls.push(args);
    return connectorClient;
  },
  waitForTransactionReceipt: async (...args: unknown[]) => {
    coreMocks.waitForTransactionReceiptCalls.push(args);
    return { status: "success" };
  },
});

(require.cache as Record<string, unknown>)[viemActionsPath] = makeEntry(viemActionsPath, {
  sendTransaction: async (...args: unknown[]) => {
    viemActionMocks.sendTransactionCalls.push(args);
    return `0x${"a".repeat(64)}`;
  },
});

(require.cache as Record<string, unknown>)[baseConfigPath] = makeEntry(baseConfigPath, {
  baseRuntimeConfig: {
    builderCode: "",
  },
});

const {
  executeAdminCall,
  executeFundingCall,
  executeLifecycleCall,
} = require("../../lib/contract/execute-prepared-call") as typeof import("../../lib/contract/execute-prepared-call");

const config = {} as import("wagmi").Config;

beforeEach(() => {
  coreMocks.reset();
  viemActionMocks.reset();
});

describe("execute-prepared-call chain wiring", () => {
  test("funding call uses getConnectorClient with assertChainId false and passes full Base Sepolia chain", async () => {
    await executeFundingCall(config, {
      args: {
        buyer: "0x00000000000000000000000000000000000000AA",
        duration_minutes: "60",
        link_hash: `0x${"1".repeat(64)}`,
        price: "1000000",
        scheduled_at: "1735689600",
        seller: "0x00000000000000000000000000000000000000BB",
      },
      chain_id: 84532,
      contract_address: "0x00000000000000000000000000000000000000CC",
      function_name: "createAndFundDeal",
    });

    assert.deepEqual(coreMocks.connectorClientCalls, [
      [config, { assertChainId: false, chainId: 84532 }],
    ]);

    assert.equal(viemActionMocks.sendTransactionCalls.length, 1);
    const [clientArg, requestArg] = viemActionMocks.sendTransactionCalls[0] as [
      typeof connectorClient,
      { chain: { id: number; name: string }; data: `0x${string}`; to: string },
    ];

    assert.equal(clientArg, connectorClient);
    assert.equal(requestArg.chain.id, 84532);
    assert.equal(requestArg.chain.name, "Base Sepolia");
    assert.equal(requestArg.to, "0x00000000000000000000000000000000000000cc");
    assert.match(requestArg.data, /^0x[0-9a-f]+$/);
  });

  test("lifecycle and admin calls also use the same resolved chain path", async () => {
    await executeLifecycleCall(config, {
      args: { deal_id: "42" },
      chain_id: 84532,
      contract_address: "0x00000000000000000000000000000000000000CC",
      function_name: "confirmRelease",
    });

    await executeAdminCall(config, {
      args: { deal_id: "42" },
      chain_id: 84532,
      contract_address: "0x00000000000000000000000000000000000000CC",
      function_name: "adminResolveRefund",
    });

    assert.deepEqual(coreMocks.connectorClientCalls, [
      [config, { assertChainId: false, chainId: 84532 }],
      [config, { assertChainId: false, chainId: 84532 }],
    ]);

    assert.equal(viemActionMocks.sendTransactionCalls.length, 2);
    for (const [, requestArg] of viemActionMocks.sendTransactionCalls as Array<
      [typeof connectorClient, { chain: { id: number; name: string } }]
    >) {
      assert.equal(requestArg.chain.id, 84532);
      assert.equal(requestArg.chain.name, "Base Sepolia");
    }
  });
});
