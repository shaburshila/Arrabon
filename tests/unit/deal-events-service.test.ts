import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  processConfirmedCompletedEvent,
  processConfirmedDisputedEvent,
  processConfirmedFundedEvent,
  processPendingDenylistHoldSweeps,
  processPendingFundingHoldForProcessedTransaction,
  processPendingFundingHoldSweeps,
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
import type { ConsultationLinkRow } from "../../lib/db/types";

interface DealEventMocks {
  applyDealPayoutBlock: (...args: unknown[]) => Promise<unknown>;
  createAuditLogEntry: (...args: unknown[]) => Promise<void>;
  getDealActionContextById: (...args: unknown[]) => Promise<unknown>;
  getByLinkHash: (...args: unknown[]) => Promise<ConsultationLinkRow | null>;
  getByTxHash: (...args: unknown[]) => Promise<unknown>;
  isInvalidStateTransitionHoldError: (...args: unknown[]) => boolean;
  listPendingDenylistDealPayoutBlockRequests: (...args: unknown[]) => Promise<unknown[]>;
  listPendingFundingHoldProcessedTransactions: (...args: unknown[]) => Promise<unknown[]>;
  markDealPayoutBlockRequestApplied: (...args: unknown[]) => Promise<void>;
  markDealPayoutBlockRequestFailure: (...args: unknown[]) => Promise<void>;
  markDealPayoutBlockRequestNonActionable: (...args: unknown[]) => Promise<void>;
  processConfirmedCompletedEventOnce: (...args: unknown[]) => Promise<{ alreadyProcessed: boolean; dealId: string | null }>;
  processConfirmedDisputedEventOnce: (...args: unknown[]) => Promise<{ alreadyProcessed: boolean; dealId: string | null }>;
  processConfirmedFundedEventOnce: (...args: unknown[]) => Promise<{ alreadyProcessed: boolean; dealId: string | null; holdApplied: boolean | null }>;
  processConfirmedRefundedEventOnce: (...args: unknown[]) => Promise<{ alreadyProcessed: boolean; dealId: string | null }>;
  processConfirmedReleasedEventOnce: (...args: unknown[]) => Promise<{ alreadyProcessed: boolean; dealId: string | null }>;
  screenWalletsBatch: (...args: unknown[]) => Promise<unknown[]>;
  updateProcessedTransactionHoldApplied: (...args: unknown[]) => Promise<void>;
}

const mocks = (global as typeof globalThis & { __dealEventMocks: DealEventMocks }).__dealEventMocks;

const SELLER_ADDRESS = "0x0000000000000000000000000000000000000001" as `0x${string}`;
const BUYER_ADDRESS = "0x0000000000000000000000000000000000000002" as `0x${string}`;
const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000003" as `0x${string}`;
const FUNDED_TX_HASH = (`0x${"a".repeat(64)}`) as `0x${string}`;
const COMPLETED_TX_HASH = (`0x${"b".repeat(64)}`) as `0x${string}`;
const RELEASED_TX_HASH = (`0x${"c".repeat(64)}`) as `0x${string}`;
const DISPUTED_TX_HASH = (`0x${"d".repeat(64)}`) as `0x${string}`;
const REFUNDED_TX_HASH = (`0x${"e".repeat(64)}`) as `0x${string}`;
const LINK_HASH = (`0x${"1".repeat(64)}`) as `0x${string}`;

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

function makeLink(overrides: Partial<ConsultationLinkRow> = {}): ConsultationLinkRow {
  return {
    id: "link-id-1",
    creator_user_id: "user-id-1",
    expert_address: SELLER_ADDRESS,
    title: "Consult",
    description: "Desc",
    price_usdc: "100.00",
    scheduled_at: "2030-01-02T00:00:00.000Z",
    timezone: "UTC",
    expires_at: "2030-01-01T00:00:00.000Z",
    duration_minutes: 30,
    meeting_url_encrypted: "encrypted",
    link_hash: LINK_HASH,
    status: "Open",
    created_at: "2026-04-10T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.applyDealPayoutBlock = async () => `0x${"f".repeat(64)}`;
  mocks.createAuditLogEntry = async () => undefined;
  mocks.getDealActionContextById = async () => ({
    buyer_address: BUYER_ADDRESS,
    completed_at: null,
    consultation_link_id: "link-id-1",
    id: "deal-id-funded",
    onchain_deal_id: fundedEvent.onchainDealId,
    released_at: null,
    risk_status: "Blocked",
    scheduled_at: "2030-01-02T00:00:00.000Z",
    seller_address: SELLER_ADDRESS,
    status: "Funded",
  });
  mocks.getByLinkHash = async () => makeLink();
  mocks.getByTxHash = async () => null;
  mocks.isInvalidStateTransitionHoldError = () => false;
  mocks.listPendingDenylistDealPayoutBlockRequests = async () => [];
  mocks.listPendingFundingHoldProcessedTransactions = async () => [];
  mocks.markDealPayoutBlockRequestApplied = async () => undefined;
  mocks.markDealPayoutBlockRequestFailure = async () => undefined;
  mocks.markDealPayoutBlockRequestNonActionable = async () => undefined;
  mocks.processConfirmedCompletedEventOnce = async () => ({
    alreadyProcessed: false,
    dealId: "deal-id-completed",
  });
  mocks.processConfirmedDisputedEventOnce = async () => ({
    alreadyProcessed: false,
    dealId: "deal-id-disputed",
  });
  mocks.processConfirmedFundedEventOnce = async () => ({
    alreadyProcessed: false,
    dealId: "deal-id-funded",
    holdApplied: null,
  });
  mocks.processConfirmedRefundedEventOnce = async () => ({
    alreadyProcessed: false,
    dealId: "deal-id-refunded",
  });
  mocks.processConfirmedReleasedEventOnce = async () => ({
    alreadyProcessed: false,
    dealId: "deal-id-released",
  });
  mocks.screenWalletsBatch = async () => [];
  mocks.updateProcessedTransactionHoldApplied = async () => undefined;
});

describe("deal event idempotency", () => {
  test("funded event processes atomically and appends audit logging", async () => {
    let auditCalls = 0;
    let atomicCalls = 0;
    let capturedInput: unknown = null;
    let capturedScreeningInput: unknown[] | null = null;

    mocks.processConfirmedFundedEventOnce = async (...args: unknown[]) => {
      atomicCalls += 1;
      capturedInput = args[0];

      return {
        alreadyProcessed: false,
        dealId: "deal-id-funded",
        holdApplied: null,
      };
    };
    mocks.createAuditLogEntry = async () => {
      auditCalls += 1;
    };
    mocks.screenWalletsBatch = async (...args: unknown[]) => {
      capturedScreeningInput = args;
      return [];
    };

    const result = await processConfirmedFundedEvent(fundedEvent);

    assert.deepEqual(result, {
      dealId: "deal-id-funded",
      result: "processed",
      txHash: fundedEvent.txHash,
    });
    assert.equal(atomicCalls, 1);
    assert.equal(auditCalls, 1);
    assert.deepEqual(capturedScreeningInput, [
      [fundedEvent.buyerAddress, fundedEvent.sellerAddress],
      {
        action: "post_funding_sync",
        actorWallet: null,
        dealId: "deal-id-funded",
      },
    ]);
    assert.deepEqual(capturedInput, {
      buyerAddress: fundedEvent.buyerAddress,
      consultationLinkId: "link-id-1",
      consumeLink: true,
      eventType: fundedEvent.eventType,
      fundedAt: fundedEvent.fundedAt,
      onchainDealId: fundedEvent.onchainDealId,
      sellerAddress: fundedEvent.sellerAddress,
      status: "Funded",
      txHash: fundedEvent.txHash,
    });
  });

  test("funded clear screening marks hold as not required", async () => {
    const holdStateUpdates: unknown[][] = [];
    let holdCalls = 0;

    mocks.updateProcessedTransactionHoldApplied = async (...args: unknown[]) => {
      holdStateUpdates.push(args);
    };
    mocks.applyDealPayoutBlock = async () => {
      holdCalls += 1;
      return `0x${"f".repeat(64)}`;
    };
    mocks.screenWalletsBatch = async () => [
      {
        normalizedWallet: BUYER_ADDRESS.toLowerCase(),
        provider: null,
        rawSummary: {},
        reasonCode: "NO_HIT",
        result: "Clear",
        walletAddress: BUYER_ADDRESS,
      },
      {
        normalizedWallet: SELLER_ADDRESS.toLowerCase(),
        provider: null,
        rawSummary: {},
        reasonCode: "NO_HIT",
        result: "Clear",
        walletAddress: SELLER_ADDRESS,
      },
    ];

    await processConfirmedFundedEvent(fundedEvent);

    assert.deepEqual(holdStateUpdates, [[FUNDED_TX_HASH, null]]);
    assert.equal(holdCalls, 0);
  });

  test("funded blocked screening marks hold pending then applied", async () => {
    const holdStateUpdates: unknown[][] = [];
    const holdCalls: unknown[][] = [];

    mocks.updateProcessedTransactionHoldApplied = async (...args: unknown[]) => {
      holdStateUpdates.push(args);
    };
    mocks.applyDealPayoutBlock = async (...args: unknown[]) => {
      holdCalls.push(args);
      return `0x${"f".repeat(64)}`;
    };
    mocks.screenWalletsBatch = async () => [
      {
        normalizedWallet: BUYER_ADDRESS.toLowerCase(),
        provider: "chainalysis_sanctions_oracle",
        rawSummary: {},
        reasonCode: "OFAC_SANCTIONS",
        result: "Blocked",
        walletAddress: BUYER_ADDRESS,
      },
      {
        normalizedWallet: SELLER_ADDRESS.toLowerCase(),
        provider: null,
        rawSummary: {},
        reasonCode: "NO_HIT",
        result: "Clear",
        walletAddress: SELLER_ADDRESS,
      },
    ];

    await processConfirmedFundedEvent(fundedEvent);

    assert.deepEqual(holdStateUpdates, [
      [FUNDED_TX_HASH, false],
      [FUNDED_TX_HASH, true],
    ]);
    assert.deepEqual(holdCalls, [[fundedEvent.onchainDealId, true]]);
  });

  test("funded atomic duplicate returns already_processed and skips audit logging", async () => {
    let auditCalls = 0;
    let screeningCalls = 0;

    mocks.processConfirmedFundedEventOnce = async () => ({
      alreadyProcessed: true,
      dealId: "deal-id-funded",
      holdApplied: null,
    });
    mocks.createAuditLogEntry = async () => {
      auditCalls += 1;
    };
    mocks.screenWalletsBatch = async () => {
      screeningCalls += 1;
      return [];
    };

    const result = await processConfirmedFundedEvent(fundedEvent);

    assert.deepEqual(result, {
      result: "already_processed",
      txHash: fundedEvent.txHash,
    });
    assert.equal(auditCalls, 0);
    assert.equal(screeningCalls, 0);
  });

  test("pending hold retry clears terminal deals after InvalidStateTransition", async () => {
    const holdStateUpdates: unknown[][] = [];

    mocks.getDealActionContextById = async () => ({
      buyer_address: BUYER_ADDRESS,
      completed_at: null,
      consultation_link_id: "link-id-1",
      id: "deal-id-funded",
      onchain_deal_id: fundedEvent.onchainDealId,
      released_at: "2030-01-02T00:00:00.000Z",
      risk_status: "Blocked",
      scheduled_at: "2030-01-02T00:00:00.000Z",
      seller_address: SELLER_ADDRESS,
      status: "Released",
    });
    mocks.applyDealPayoutBlock = async () => {
      throw new Error("invalid state");
    };
    mocks.isInvalidStateTransitionHoldError = () => true;
    mocks.updateProcessedTransactionHoldApplied = async (...args: unknown[]) => {
      holdStateUpdates.push(args);
    };

    await processPendingFundingHoldForProcessedTransaction({
      dealId: "deal-id-funded",
      txHash: FUNDED_TX_HASH,
    });

    assert.deepEqual(holdStateUpdates, [[FUNDED_TX_HASH, null]]);
  });

  test("pending hold sweep retries only pending blocked records", async () => {
    const holdCalls: unknown[][] = [];

    mocks.listPendingFundingHoldProcessedTransactions = async () => [
      {
        dealId: "deal-id-funded",
        txHash: FUNDED_TX_HASH,
      },
    ];
    mocks.applyDealPayoutBlock = async (...args: unknown[]) => {
      holdCalls.push(args);
      return `0x${"f".repeat(64)}`;
    };

    await processPendingFundingHoldSweeps();

    assert.deepEqual(holdCalls, [[fundedEvent.onchainDealId, true]]);
  });

  test("denylist hold sweep applies pending holds and writes audit log", async () => {
    const holdCalls: unknown[][] = [];
    const appliedCalls: unknown[][] = [];
    const auditEntries: Array<Record<string, unknown>> = [];

    mocks.listPendingDenylistDealPayoutBlockRequests = async () => [
      {
        applied_at: null,
        blocked: true,
        created_at: "2026-05-07T12:00:00.000Z",
        deal_id: "deal-id-funded",
        id: "hold-request-1",
        last_error_code: null,
        last_error_message: null,
        onchain_deal_id: fundedEvent.onchainDealId,
        source: "denylist_add",
        status: "pending",
      },
    ];
    mocks.applyDealPayoutBlock = async (...args: unknown[]) => {
      holdCalls.push(args);
      return `0x${"f".repeat(64)}`;
    };
    mocks.markDealPayoutBlockRequestApplied = async (...args: unknown[]) => {
      appliedCalls.push(args);
    };
    mocks.createAuditLogEntry = async (entry: unknown) => {
      auditEntries.push(entry as Record<string, unknown>);
    };

    await processPendingDenylistHoldSweeps();

    assert.deepEqual(holdCalls, [[fundedEvent.onchainDealId, true]]);
    assert.deepEqual(appliedCalls, [["hold-request-1"]]);
    assert.equal(auditEntries.length, 1);
    assert.equal(auditEntries[0].action, "compliance.denylist_hold_applied");
    assert.deepEqual(auditEntries[0].metadata, {
      hold_request_id: "hold-request-1",
      onchain_deal_id: fundedEvent.onchainDealId,
      source: "denylist_add",
    });
  });

  test("denylist hold sweep marks terminal deals as non_actionable", async () => {
    const nonActionableCalls: unknown[][] = [];

    mocks.listPendingDenylistDealPayoutBlockRequests = async () => [
      {
        applied_at: null,
        blocked: true,
        created_at: "2026-05-07T12:00:00.000Z",
        deal_id: "deal-id-funded",
        id: "hold-request-1",
        last_error_code: null,
        last_error_message: null,
        onchain_deal_id: fundedEvent.onchainDealId,
        source: "denylist_add",
        status: "pending",
      },
    ];
    mocks.applyDealPayoutBlock = async () => {
      throw new Error("invalid state");
    };
    mocks.isInvalidStateTransitionHoldError = () => true;
    mocks.markDealPayoutBlockRequestNonActionable = async (...args: unknown[]) => {
      nonActionableCalls.push(args);
    };

    await processPendingDenylistHoldSweeps();

    assert.deepEqual(nonActionableCalls, [[
      "hold-request-1",
      "INVALID_STATE_TRANSITION",
      "Deal reached a terminal state before the payout block could be applied.",
    ]]);
  });

  test("denylist hold sweep leaves transient failures pending", async () => {
    const failureCalls: unknown[][] = [];

    mocks.listPendingDenylistDealPayoutBlockRequests = async () => [
      {
        applied_at: null,
        blocked: true,
        created_at: "2026-05-07T12:00:00.000Z",
        deal_id: "deal-id-funded",
        id: "hold-request-1",
        last_error_code: null,
        last_error_message: null,
        onchain_deal_id: fundedEvent.onchainDealId,
        source: "denylist_add",
        status: "pending",
      },
    ];
    mocks.applyDealPayoutBlock = async () => {
      throw new Error("rpc timeout");
    };
    mocks.markDealPayoutBlockRequestFailure = async (...args: unknown[]) => {
      failureCalls.push(args);
    };

    await processPendingDenylistHoldSweeps();

    assert.deepEqual(failureCalls, [[
      "hold-request-1",
      "Error",
      "rpc timeout",
    ]]);
  });

  test("funded unknown link hash is skipped without atomic processing", async () => {
    let atomicCalls = 0;

    mocks.getByLinkHash = async () => null;
    mocks.processConfirmedFundedEventOnce = async () => {
      atomicCalls += 1;
      return {
        alreadyProcessed: false,
        dealId: "deal-id-funded",
        holdApplied: null,
      };
    };

    const result = await processConfirmedFundedEvent(fundedEvent);

    assert.deepEqual(result, {
      linkHash: fundedEvent.linkHash,
      reason: "UNKNOWN_LINK_HASH",
      result: "skipped",
      txHash: fundedEvent.txHash,
    });
    assert.equal(atomicCalls, 0);
  });

  test("funded effective-expired raw Open link does not request consume transition", async () => {
    let capturedInput: unknown = null;

    mocks.getByLinkHash = async () => makeLink({
      expires_at: "2020-01-01T00:00:00.000Z",
      status: "Open",
    });
    mocks.processConfirmedFundedEventOnce = async (...args: unknown[]) => {
      capturedInput = args[0];

      return {
        alreadyProcessed: false,
        dealId: "deal-id-funded",
        holdApplied: null,
      };
    };

    const result = await processConfirmedFundedEvent(fundedEvent);

    assert.deepEqual(result, {
      dealId: "deal-id-funded",
      result: "processed",
      txHash: fundedEvent.txHash,
    });
    assert.deepEqual(capturedInput, {
      buyerAddress: fundedEvent.buyerAddress,
      consultationLinkId: "link-id-1",
      consumeLink: false,
      eventType: fundedEvent.eventType,
      fundedAt: fundedEvent.fundedAt,
      onchainDealId: fundedEvent.onchainDealId,
      sellerAddress: fundedEvent.sellerAddress,
      status: "Funded",
      txHash: fundedEvent.txHash,
    });
  });

  test("funded blocked post-funding appends compliance alert audit log", async () => {
    const auditEntries: Array<Record<string, unknown>> = [];
    let screeningInput: unknown[] | null = null;

    mocks.createAuditLogEntry = async (entry: unknown) => {
      auditEntries.push(entry as Record<string, unknown>);
    };
    mocks.screenWalletsBatch = async (...args: unknown[]) => {
      screeningInput = args;

      return [
        {
          normalizedWallet: BUYER_ADDRESS.toLowerCase(),
          provider: "chainalysis_sanctions_oracle",
          rawSummary: {},
          reasonCode: "OFAC_SANCTIONS",
          result: "Blocked",
          walletAddress: BUYER_ADDRESS,
        },
        {
          normalizedWallet: SELLER_ADDRESS.toLowerCase(),
          provider: null,
          rawSummary: {},
          reasonCode: "NO_HIT",
          result: "Clear",
          walletAddress: SELLER_ADDRESS,
        },
      ];
    };

    const result = await processConfirmedFundedEvent(fundedEvent);

    assert.deepEqual(result, {
      dealId: "deal-id-funded",
      result: "processed",
      txHash: fundedEvent.txHash,
    });
    assert.deepEqual(screeningInput, [
      [BUYER_ADDRESS, SELLER_ADDRESS],
      {
        action: "post_funding_sync",
        actorWallet: null,
        dealId: "deal-id-funded",
      },
    ]);
    assert.equal(auditEntries.length, 2);
    assert.equal(auditEntries[1].action, "compliance.blocked_post_funding");
    assert.deepEqual(auditEntries[1].metadata, {
      block_number: fundedEvent.blockNumber.toString(10),
      buyer_address: fundedEvent.buyerAddress,
      consultation_link_id: "link-id-1",
      event_type: fundedEvent.eventType,
      log_index: fundedEvent.logIndex,
      onchain_deal_id: fundedEvent.onchainDealId,
      seller_address: fundedEvent.sellerAddress,
      tx_hash: fundedEvent.txHash,
    });
  });

  test("completed duplicate marker returns already_processed and skips audit logging", async () => {
    let auditCalls = 0;
    mocks.processConfirmedCompletedEventOnce = async () => ({
      alreadyProcessed: true,
      dealId: "deal-id-completed",
    });
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

  test("completed event passes completed timestamp to atomic repository", async () => {
    let capturedInput: unknown = null;

    mocks.processConfirmedCompletedEventOnce = async (...args: unknown[]) => {
      [capturedInput] = args;
      return { alreadyProcessed: false, dealId: "deal-id-completed" };
    };

    const result = await processConfirmedCompletedEvent(completedEvent);

    assert.deepEqual(result, {
      dealId: "deal-id-completed",
      result: "processed",
      txHash: completedEvent.txHash,
    });
    assert.deepEqual(capturedInput, {
      completedAt: completedEvent.completedAt,
      eventType: completedEvent.eventType,
      onchainDealId: completedEvent.onchainDealId,
      txHash: completedEvent.txHash,
    });
  });

  test("completed already-converged event with a new marker still returns processed", async () => {
    mocks.processConfirmedCompletedEventOnce = async () => ({
      alreadyProcessed: false,
      dealId: "deal-id-completed",
    });

    const result = await processConfirmedCompletedEvent(completedEvent);

    assert.deepEqual(result, {
      dealId: "deal-id-completed",
      result: "processed",
      txHash: completedEvent.txHash,
    });
  });

  test("released duplicate marker returns already_processed and skips audit logging", async () => {
    let auditCalls = 0;
    mocks.processConfirmedReleasedEventOnce = async () => ({
      alreadyProcessed: true,
      dealId: "deal-id-released",
    });
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

  test("released event passes onchain deal id and released timestamp to atomic repository", async () => {
    let capturedInput: unknown = null;

    mocks.processConfirmedReleasedEventOnce = async (...args: unknown[]) => {
      [capturedInput] = args;
      return { alreadyProcessed: false, dealId: "deal-id-released" };
    };

    const result = await processConfirmedReleasedEvent(releasedEvent);

    assert.deepEqual(result, {
      dealId: "deal-id-released",
      result: "processed",
      txHash: releasedEvent.txHash,
    });
    assert.deepEqual(capturedInput, {
      eventType: releasedEvent.eventType,
      onchainDealId: releasedEvent.onchainDealId,
      releasedAt: releasedEvent.releasedAt,
      txHash: releasedEvent.txHash,
    });
  });

  test("released already-converged event with a new marker still returns processed", async () => {
    mocks.processConfirmedReleasedEventOnce = async () => ({
      alreadyProcessed: false,
      dealId: "deal-id-released",
    });

    const result = await processConfirmedReleasedEvent(releasedEvent);

    assert.deepEqual(result, {
      dealId: "deal-id-released",
      result: "processed",
      txHash: releasedEvent.txHash,
    });
  });

  test("disputed duplicate marker returns already_processed and skips audit logging", async () => {
    let auditCalls = 0;
    mocks.processConfirmedDisputedEventOnce = async () => ({
      alreadyProcessed: true,
      dealId: "deal-id-disputed",
    });
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

  test("disputed event passes onchain deal id to atomic repository", async () => {
    let capturedInput: unknown = null;

    mocks.processConfirmedDisputedEventOnce = async (...args: unknown[]) => {
      [capturedInput] = args;
      return { alreadyProcessed: false, dealId: "deal-id-disputed" };
    };

    const result = await processConfirmedDisputedEvent(disputedEvent);

    assert.deepEqual(result, {
      dealId: "deal-id-disputed",
      result: "processed",
      txHash: disputedEvent.txHash,
    });
    assert.deepEqual(capturedInput, {
      eventType: disputedEvent.eventType,
      onchainDealId: disputedEvent.onchainDealId,
      txHash: disputedEvent.txHash,
    });
  });

  test("disputed already-converged event with a new marker still returns processed", async () => {
    mocks.processConfirmedDisputedEventOnce = async () => ({
      alreadyProcessed: false,
      dealId: "deal-id-disputed",
    });

    const result = await processConfirmedDisputedEvent(disputedEvent);

    assert.deepEqual(result, {
      dealId: "deal-id-disputed",
      result: "processed",
      txHash: disputedEvent.txHash,
    });
  });

  test("refunded duplicate marker returns already_processed and skips audit logging", async () => {
    let auditCalls = 0;
    mocks.processConfirmedRefundedEventOnce = async () => ({
      alreadyProcessed: true,
      dealId: "deal-id-refunded",
    });
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

  test("refunded event passes onchain deal id to atomic repository", async () => {
    let capturedInput: unknown = null;

    mocks.processConfirmedRefundedEventOnce = async (...args: unknown[]) => {
      [capturedInput] = args;
      return { alreadyProcessed: false, dealId: "deal-id-refunded" };
    };

    const result = await processConfirmedRefundedEvent(refundedEvent);

    assert.deepEqual(result, {
      dealId: "deal-id-refunded",
      result: "processed",
      txHash: refundedEvent.txHash,
    });
    assert.deepEqual(capturedInput, {
      eventType: refundedEvent.eventType,
      onchainDealId: refundedEvent.onchainDealId,
      txHash: refundedEvent.txHash,
    });
  });

  test("refunded already-converged event with a new marker still returns processed", async () => {
    mocks.processConfirmedRefundedEventOnce = async () => ({
      alreadyProcessed: false,
      dealId: "deal-id-refunded",
    });

    const result = await processConfirmedRefundedEvent(refundedEvent);

    assert.deepEqual(result, {
      dealId: "deal-id-refunded",
      result: "processed",
      txHash: refundedEvent.txHash,
    });
  });
});
