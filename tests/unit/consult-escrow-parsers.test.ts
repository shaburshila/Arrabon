/**
 * Unit tests for consult-escrow event log parsers.
 *
 * Focus: verify that after the alignment pass, parseCompletedEventLog and
 * parseReleasedEventLog decode timestamps from the event payload, not from
 * block data.  Block data is deliberately absent from every synthetic log to
 * make the dependency explicit.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  encodeAbiParameters,
  keccak256,
  toHex,
  encodePacked,
  toBytes,
  type Log,
} from "viem";

import {
  parseCompletedEventLog,
  parseReleasedEventLog,
  parseFundedEventLog,
  parseDisputedEventLog,
  parseRefundedEventLog,
} from "../../lib/base/consult-escrow";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function eventSignatureTopic(sig: string): `0x${string}` {
  return keccak256(toHex(toBytes(sig)));
}

function uint256Topic(value: bigint): `0x${string}` {
  return `0x${value.toString(16).padStart(64, "0")}`;
}

function bytes32Topic(hex: string): `0x${string}` {
  return `0x${hex.replace(/^0x/, "").padEnd(64, "0")}` as `0x${string}`;
}

const CONTRACT_ADDR = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF" as `0x${string}`;
const SELLER_ADDR   = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`;
const BUYER_ADDR    = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as `0x${string}`;
const TX_HASH       = ("0x" + "ab".repeat(32)) as `0x${string}`;
const BLOCK_NUMBER  = BigInt(5_000_000);

/**
 * Build a synthetic viem Log for a single-non-indexed-uint256 event
 * (Completed, Released, Disputed, Refunded).
 */
function buildSingleTopicLog(params: {
  eventSig: string;
  dealId: bigint;
  nonIndexedData?: `0x${string}`;
  logIndex?: number;
}): Log {
  return {
    address: CONTRACT_ADDR,
    blockHash: ("0x" + "cc".repeat(32)) as `0x${string}`,
    blockNumber: BLOCK_NUMBER,
    data: params.nonIndexedData ?? "0x",
    logIndex: params.logIndex ?? 0,
    removed: false,
    topics: [
      eventSignatureTopic(params.eventSig),
      uint256Topic(params.dealId),
    ],
    transactionHash: TX_HASH,
    transactionIndex: 0,
  } as unknown as Log;
}

/**
 * Build a synthetic viem Log for DealFunded (two indexed params + address
 * pair in data).
 */
function buildFundedLog(params: {
  dealId: bigint;
  linkHash: `0x${string}`;
  seller: `0x${string}`;
  buyer: `0x${string}`;
  logIndex?: number;
}): Log {
  const data = encodeAbiParameters(
    [{ name: "seller", type: "address" }, { name: "buyer", type: "address" }],
    [params.seller, params.buyer],
  );

  return {
    address: CONTRACT_ADDR,
    blockHash: ("0x" + "cc".repeat(32)) as `0x${string}`,
    blockNumber: BLOCK_NUMBER,
    data,
    logIndex: params.logIndex ?? 0,
    removed: false,
    topics: [
      eventSignatureTopic("DealFunded(uint256,bytes32,address,address)"),
      uint256Topic(params.dealId),
      bytes32Topic(params.linkHash),
    ],
    transactionHash: TX_HASH,
    transactionIndex: 0,
  } as unknown as Log;
}

// ---------------------------------------------------------------------------
// parseCompletedEventLog
// ---------------------------------------------------------------------------

describe("parseCompletedEventLog", () => {

  test("decodes completedAt from event payload — basic case", () => {
    const dealId = BigInt(42);
    const completedAtUnix = BigInt(1_750_000_000); // arbitrary unix timestamp

    const data = encodeAbiParameters(
      [{ name: "completedAt", type: "uint256" }],
      [completedAtUnix],
    );

    const log = buildSingleTopicLog({
      eventSig: "Completed(uint256,uint256)",
      dealId,
      nonIndexedData: data,
    });

    const result = parseCompletedEventLog(log);

    assert.equal(result.eventType, "Completed");
    assert.equal(result.onchainDealId, "42");
    assert.equal(result.completedAt.getTime(), Number(completedAtUnix) * 1000,
      "completedAt must match the event payload value, not block timestamp");
    assert.equal(result.txHash, TX_HASH);
    assert.equal(result.blockNumber, BLOCK_NUMBER);
    assert.equal(result.logIndex, 0);
  });

  test("completedAt differs from block timestamp — payload wins", () => {
    // This test explicitly proves the value comes from the event, not the block.
    // Block number 5_000_000 would have a different timestamp than what we encode.
    const dealId = BigInt(7);
    // Use a timestamp that is clearly not a plausible block timestamp for block 5_000_000
    const eventCompletedAt = BigInt(1_800_000_000);

    const data = encodeAbiParameters(
      [{ name: "completedAt", type: "uint256" }],
      [eventCompletedAt],
    );

    const log = buildSingleTopicLog({
      eventSig: "Completed(uint256,uint256)",
      dealId,
      nonIndexedData: data,
    });

    const result = parseCompletedEventLog(log);

    assert.equal(
      result.completedAt.getTime(),
      Number(eventCompletedAt) * 1000,
      "Parser must read completedAt from decoded event args, not infer from block",
    );
  });

  test("completedAt = 0 is decoded correctly", () => {
    const data = encodeAbiParameters(
      [{ name: "completedAt", type: "uint256" }],
      [BigInt(0)],
    );
    const log = buildSingleTopicLog({
      eventSig: "Completed(uint256,uint256)",
      dealId: BigInt(1),
      nonIndexedData: data,
    });

    const result = parseCompletedEventLog(log);
    assert.equal(result.completedAt.getTime(), 0);
  });

  test("large dealId is serialized as decimal string", () => {
    const largeDealId = BigInt("999999999999999999");
    const data = encodeAbiParameters(
      [{ name: "completedAt", type: "uint256" }],
      [BigInt(1_750_000_000)],
    );
    const log = buildSingleTopicLog({
      eventSig: "Completed(uint256,uint256)",
      dealId: largeDealId,
      nonIndexedData: data,
    });

    const result = parseCompletedEventLog(log);
    assert.equal(result.onchainDealId, "999999999999999999");
  });

  test("contractAddress is normalized from log.address", () => {
    const data = encodeAbiParameters(
      [{ name: "completedAt", type: "uint256" }],
      [BigInt(1_750_000_000)],
    );
    const log = buildSingleTopicLog({
      eventSig: "Completed(uint256,uint256)",
      dealId: BigInt(1),
      nonIndexedData: data,
    });

    const result = parseCompletedEventLog(log);
    // viem getAddress checksums the address
    assert.equal(result.contractAddress.toLowerCase(), CONTRACT_ADDR.toLowerCase());
  });

  test("throws when transactionHash is missing", () => {
    const data = encodeAbiParameters(
      [{ name: "completedAt", type: "uint256" }],
      [BigInt(1_750_000_000)],
    );
    const log = buildSingleTopicLog({
      eventSig: "Completed(uint256,uint256)",
      dealId: BigInt(1),
      nonIndexedData: data,
    });

    // Remove transactionHash to simulate a pending/unconfirmed log
    (log as any).transactionHash = null;

    assert.throws(() => parseCompletedEventLog(log), {
      message: /transactionHash/,
    });
  });
});

// ---------------------------------------------------------------------------
// parseReleasedEventLog
// ---------------------------------------------------------------------------

describe("parseReleasedEventLog", () => {

  test("decodes releasedAt from event payload — basic case", () => {
    const dealId = BigInt(99);
    const releasedAtUnix = BigInt(1_760_000_000);

    const data = encodeAbiParameters(
      [{ name: "releasedAt", type: "uint256" }],
      [releasedAtUnix],
    );

    const log = buildSingleTopicLog({
      eventSig: "Released(uint256,uint256)",
      dealId,
      nonIndexedData: data,
    });

    const result = parseReleasedEventLog(log);

    assert.equal(result.eventType, "Released");
    assert.equal(result.onchainDealId, "99");
    assert.equal(result.releasedAt.getTime(), Number(releasedAtUnix) * 1000,
      "releasedAt must match the event payload value, not block timestamp");
    assert.equal(result.txHash, TX_HASH);
    assert.equal(result.blockNumber, BLOCK_NUMBER);
  });

  test("releasedAt differs from block timestamp — payload wins", () => {
    const dealId = BigInt(3);
    const eventReleasedAt = BigInt(1_900_000_000);

    const data = encodeAbiParameters(
      [{ name: "releasedAt", type: "uint256" }],
      [eventReleasedAt],
    );

    const log = buildSingleTopicLog({
      eventSig: "Released(uint256,uint256)",
      dealId,
      nonIndexedData: data,
    });

    const result = parseReleasedEventLog(log);

    assert.equal(
      result.releasedAt.getTime(),
      Number(eventReleasedAt) * 1000,
      "Parser must read releasedAt from decoded event args, not infer from block",
    );
  });

  test("throws when blockNumber is missing", () => {
    const data = encodeAbiParameters(
      [{ name: "releasedAt", type: "uint256" }],
      [BigInt(1_760_000_000)],
    );
    const log = buildSingleTopicLog({
      eventSig: "Released(uint256,uint256)",
      dealId: BigInt(1),
      nonIndexedData: data,
    });

    (log as any).blockNumber = null;

    assert.throws(() => parseReleasedEventLog(log), {
      message: /blockNumber/,
    });
  });
});

// ---------------------------------------------------------------------------
// parseFundedEventLog
// ---------------------------------------------------------------------------

describe("parseFundedEventLog", () => {

  test("decodes DealFunded fields correctly", () => {
    const dealId = BigInt(17);
    const linkHash = ("0x" + "ff".repeat(32)) as `0x${string}`;

    const log = buildFundedLog({
      dealId,
      linkHash,
      seller: SELLER_ADDR,
      buyer: BUYER_ADDR,
    });

    const result = parseFundedEventLog(log);

    assert.equal(result.eventType, "Funded");
    assert.equal(result.onchainDealId, "17");
    assert.equal(result.sellerAddress.toLowerCase(), SELLER_ADDR.toLowerCase());
    assert.equal(result.buyerAddress.toLowerCase(), BUYER_ADDR.toLowerCase());
    assert.equal(result.fundedAt, null, "fundedAt must remain null (Phase 4 intentional)");
    assert.equal(result.txHash, TX_HASH);
  });
});

// ---------------------------------------------------------------------------
// parseDisputedEventLog
// ---------------------------------------------------------------------------

describe("parseDisputedEventLog", () => {

  test("decodes Disputed with no data field", () => {
    const dealId = BigInt(55);

    const log = buildSingleTopicLog({
      eventSig: "Disputed(uint256)",
      dealId,
      nonIndexedData: "0x",
    });

    const result = parseDisputedEventLog(log);

    assert.equal(result.eventType, "Disputed");
    assert.equal(result.onchainDealId, "55");
    assert.equal(result.txHash, TX_HASH);
  });
});

// ---------------------------------------------------------------------------
// parseRefundedEventLog
// ---------------------------------------------------------------------------

describe("parseRefundedEventLog", () => {

  test("decodes Refunded with no data field", () => {
    const dealId = BigInt(88);

    const log = buildSingleTopicLog({
      eventSig: "Refunded(uint256)",
      dealId,
      nonIndexedData: "0x",
    });

    const result = parseRefundedEventLog(log);

    assert.equal(result.eventType, "Refunded");
    assert.equal(result.onchainDealId, "88");
    assert.equal(result.txHash, TX_HASH);
  });
});
