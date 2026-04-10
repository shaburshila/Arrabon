import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  processConfirmedCompletedEvent,
  processConfirmedDisputedEvent,
  processConfirmedFundedEvent,
  processConfirmedRefundedEvent,
  processConfirmedReleasedEvent,
} from "../../server/services/deal-events";
import type {
  NormalizedCompletedEvent,
  NormalizedDisputedEvent,
  NormalizedFundedEvent,
  NormalizedRefundedEvent,
  NormalizedReleasedEvent,
} from "../../lib/base/consult-escrow";

interface DealEventMocks {
  createAuditLogEntry: (...args: unknown[]) => Promise<void>;
  getByLinkHash: (...args: unknown[]) => Promise<{ id: string } | null>;
  getByTxHash: (...args: unknown[]) => Promise<unknown>;
  handleFundedEvent: (...args: unknown[]) => Promise<{ id: string }>;
  insertProcessedTransaction: (...args: unknown[]) => Promise<{ duplicate: boolean; row: unknown }>;
  setConfirmPendingByOnchainDealId: (...args: unknown[]) => Promise<{ id: string }>;
  setDisputedByOnchainDealId: (...args: unknown[]) => Promise<{ id: string }>;
  setRefundedByOnchainDealId: (...args: unknown[]) => Promise<{ id: string }>;
  setReleasedByOnchainDealId: (...args: unknown[]) => Promise<{ id: string }>;
}

const mocks = (global as typeof globalThis & { __dealEventMocks: DealEventMocks }).__dealEventMocks;

const SELLER_ADDRESS = "0x0000000000000000000000000000000000000001" as `0x${string}`;
const BUYER_ADDRESS = "0x0000000000000000000000000000000000000002" as `0x${string}`;
const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000003" as `0x${string}`;
const FUNDED_TX_HASH = ("0x" + "a".repeat(64)) as `0x${string}`;
const COMPLETED_TX_HASH = ("0x" + "b".repeat(64)) as `0x${string}`;
const RELEASED_TX_HASH = ("0x" + "c".repeat(64)) as `0x${string}`;
const DISPUTED_TX_HASH = ("0x" + "d".repeat(64)) as `0x${string}`;
const REFUNDED_TX_HASH = ("0x" + "e".repeat(64)) as `0x${string}`;
const LINK_HASH = ("0x" + "1".repeat(64)) as `0x${string}`;

const fundedEvent: NormalizedFundedEvent = {
  blockNumber: BigInt(1),
  buyerAddress: BUYER_ADDRESS,
  contractAddress: CONTRACT_ADDRESS,
  eventType: "Funded" as const,
  fundedAt: null,
  linkHash: LINK_HASH,
  logIndex: 0,
  onchainDealId: "11",
  sellerAddress: SELLER_ADDRESS,
  txHash: FUNDED_TX_HASH,
};

const completedEvent: NormalizedCompletedEvent = {
  blockNumber: BigInt(1),
  completedAt: new Date("2026-04-10T00:00:00.000Z"),
  contractAddress: CONTRACT_ADDRESS,
  eventType: "Completed" as const,
  logIndex: 0,
  onchainDealId: "12",
  txHash: COMPLETED_TX_HASH,
};

const releasedEvent: NormalizedReleasedEvent = {
  blockNumber: BigInt(1),
  contractAddress: CONTRACT_ADDRESS,
  eventType: "Released" as const,
  logIndex: 0,
  onchainDealId: "13",
  releasedAt: new Date("2026-04-10T00:00:00.000Z"),
  txHash: RELEASED_TX_HASH,
};

const disputedEvent: NormalizedDisputedEvent = {
  blockNumber: BigInt(1),
  contractAddress: CONTRACT_ADDRESS,
  eventType: "Disputed" as const,
  logIndex: 0,
  onchainDealId: "14",
  txHash: DISPUTED_TX_HASH,
};

const refundedEvent: NormalizedRefundedEvent = {
  blockNumber: BigInt(1),
  contractAddress: CONTRACT_ADDRESS,
  eventType: "Refunded" as const,
  logIndex: 0,
  onchainDealId: "15",
  txHash: REFUNDED_TX_HASH,
};

beforeEach(() => {
  mocks.createAuditLogEntry = async () => undefined;
  mocks.getByLinkHash = async () => ({ id: "link-id-1" });
  mocks.getByTxHash = async () => null;
  mocks.handleFundedEvent = async () => ({ id: "deal-id-funded" });
  mocks.insertProcessedTransaction = async () => ({ duplicate: false, row: { tx_hash: "0xtx" } });
  mocks.setConfirmPendingByOnchainDealId = async () => ({ id: "deal-id-completed" });
  mocks.setDisputedByOnchainDealId = async () => ({ id: "deal-id-disputed" });
  mocks.setRefundedByOnchainDealId = async () => ({ id: "deal-id-refunded" });
  mocks.setReleasedByOnchainDealId = async () => ({ id: "deal-id-released" });
});

describe("deal event idempotency", () => {
  test("funded duplicate marker returns already_processed and skips audit logging", async () => {
    let auditCalls = 0;
    mocks.insertProcessedTransaction = async () => ({ duplicate: true, row: null });
    mocks.createAuditLogEntry = async () => {
      auditCalls += 1;
    };

    const result = await processConfirmedFundedEvent(fundedEvent);

    assert.deepEqual(result, {
      result: "already_processed",
      txHash: fundedEvent.txHash,
    });
    assert.equal(auditCalls, 0);
  });

  test("completed duplicate marker returns already_processed and skips audit logging", async () => {
    let auditCalls = 0;
    mocks.insertProcessedTransaction = async () => ({ duplicate: true, row: null });
    mocks.createAuditLogEntry = async () => {
      auditCalls += 1;
    };

    const result = await processConfirmedCompletedEvent(completedEvent);

    assert.deepEqual(result, {
      result: "already_processed",
      txHash: completedEvent.txHash,
    });
    assert.equal(auditCalls, 0);
  });

  test("released duplicate marker returns already_processed and skips audit logging", async () => {
    let auditCalls = 0;
    mocks.insertProcessedTransaction = async () => ({ duplicate: true, row: null });
    mocks.createAuditLogEntry = async () => {
      auditCalls += 1;
    };

    const result = await processConfirmedReleasedEvent(releasedEvent);

    assert.deepEqual(result, {
      result: "already_processed",
      txHash: releasedEvent.txHash,
    });
    assert.equal(auditCalls, 0);
  });

  test("disputed duplicate marker returns already_processed and skips audit logging", async () => {
    let auditCalls = 0;
    mocks.insertProcessedTransaction = async () => ({ duplicate: true, row: null });
    mocks.createAuditLogEntry = async () => {
      auditCalls += 1;
    };

    const result = await processConfirmedDisputedEvent(disputedEvent);

    assert.deepEqual(result, {
      result: "already_processed",
      txHash: disputedEvent.txHash,
    });
    assert.equal(auditCalls, 0);
  });

  test("refunded duplicate marker returns already_processed and skips audit logging", async () => {
    let auditCalls = 0;
    mocks.insertProcessedTransaction = async () => ({ duplicate: true, row: null });
    mocks.createAuditLogEntry = async () => {
      auditCalls += 1;
    };

    const result = await processConfirmedRefundedEvent(refundedEvent);

    assert.deepEqual(result, {
      result: "already_processed",
      txHash: refundedEvent.txHash,
    });
    assert.equal(auditCalls, 0);
  });
});
