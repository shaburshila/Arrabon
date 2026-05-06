import "server-only";

import type {
  NormalizedCompletedEvent,
  NormalizedDealLifecycleEvent,
  NormalizedDisputedEvent,
  NormalizedFundedEvent,
  NormalizedRefundedEvent,
  NormalizedReleasedEvent,
} from "@/lib/base/consult-escrow";
import {
  applyDealPayoutBlock,
  isInvalidStateTransitionHoldError,
} from "@/lib/base/compliance-hold";
import { resolveEffectiveConsultationLinkStatus } from "@/lib/constants/consultation-links";
import { createAuditLogEntry } from "@/server/repositories/audit-log";
import { getByLinkHash } from "@/server/repositories/consultation-links";
import {
  listPendingDenylistDealPayoutBlockRequests,
  markDealPayoutBlockRequestApplied,
  markDealPayoutBlockRequestFailure,
  markDealPayoutBlockRequestNonActionable,
} from "@/server/repositories/deal-payout-block-requests";
import {
  getByTxHash,
  listPendingFundingHoldProcessedTransactions,
  processConfirmedCompletedEventOnce,
  processConfirmedDisputedEventOnce,
  processConfirmedFundedEventOnce,
  processConfirmedRefundedEventOnce,
  processConfirmedReleasedEventOnce,
  ProcessedTransactionsRepositoryError,
  updateProcessedTransactionHoldApplied,
} from "@/server/repositories/processed-transactions";
import {
  DealsRepositoryError,
  getDealActionContextById,
} from "@/server/repositories/deals";
import { screenWalletsBatch } from "@/server/services/compliance";

export class DealEventSyncServiceError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "DealEventSyncServiceError";
    this.code = code;
  }
}

async function appendDenylistHoldAppliedAuditLog(input: {
  dealId: string;
  onchainDealId: string;
  requestId: string;
}) {
  try {
    await createAuditLogEntry({
      action: "compliance.denylist_hold_applied",
      actorAddress: null,
      entityId: input.dealId,
      entityType: "deal",
      metadata: {
        hold_request_id: input.requestId,
        onchain_deal_id: input.onchainDealId,
        source: "denylist_add",
      },
    });
  } catch (error) {
    console.error("Failed to append denylist hold applied audit log.", {
      dealId: input.dealId,
      error,
      onchainDealId: input.onchainDealId,
      requestId: input.requestId,
    });
  }
}

export type DealEventProcessingResult =
  | {
    result: "already_processed";
    txHash: string;
  }
  | {
    dealId: string | null;
    result: "processed";
    txHash: string;
  }
  | {
    linkHash: string;
    reason: "UNKNOWN_LINK_HASH";
    result: "skipped";
    txHash: string;
  };

async function appendFundingSyncAuditLog(input: {
  consultationLinkId: string;
  dealId: string;
  event: NormalizedFundedEvent;
}) {
  try {
    // Sync-path audit is intentionally fail-open so confirmed chain state can still converge.
    await createAuditLogEntry({
      action: "deal_event_funded_synced",
      actorAddress: null,
      entityId: input.dealId,
      entityType: "deal",
      metadata: {
        block_number: input.event.blockNumber.toString(10),
        consultation_link_id: input.consultationLinkId,
        event_type: input.event.eventType,
        link_hash: input.event.linkHash,
        log_index: input.event.logIndex,
        onchain_deal_id: input.event.onchainDealId,
        tx_hash: input.event.txHash,
      },
    });
  } catch (error) {
    console.error("Failed to append funding sync audit log.", {
      consultationLinkId: input.consultationLinkId,
      dealId: input.dealId,
      error,
      txHash: input.event.txHash,
    });
  }
}

async function appendBlockedPostFundingAuditLog(input: {
  buyerAddress: string;
  consultationLinkId: string;
  dealId: string;
  event: NormalizedFundedEvent;
  sellerAddress: string;
}) {
  try {
    await createAuditLogEntry({
      action: "compliance.blocked_post_funding",
      actorAddress: null,
      entityId: input.dealId,
      entityType: "deal",
      metadata: {
        block_number: input.event.blockNumber.toString(10),
        buyer_address: input.buyerAddress,
        consultation_link_id: input.consultationLinkId,
        event_type: input.event.eventType,
        log_index: input.event.logIndex,
        onchain_deal_id: input.event.onchainDealId,
        seller_address: input.sellerAddress,
        tx_hash: input.event.txHash,
      },
    });
  } catch (error) {
    console.error("Failed to append blocked post-funding audit log.", {
      consultationLinkId: input.consultationLinkId,
      dealId: input.dealId,
      error,
      txHash: input.event.txHash,
    });
  }
}

function createAlreadyProcessedResult(txHash: string): DealEventProcessingResult {
  return {
    result: "already_processed",
    txHash,
  };
}

function requireProcessedDealId(
  dealId: string | null,
  txHash: string,
): string {
  if (!dealId) {
    throw new Error(`Lifecycle event ${txHash} was processed without a linked deal id.`);
  }

  return dealId;
}

async function appendLifecycleSyncAuditLog(input: {
  action: "deal_event_completed_synced" | "deal_event_disputed_synced" | "deal_event_refunded_synced" | "deal_event_released_synced";
  dealId: string;
  event: NormalizedCompletedEvent | NormalizedDisputedEvent | NormalizedRefundedEvent | NormalizedReleasedEvent;
}) {
  try {
    await createAuditLogEntry({
      action: input.action,
      actorAddress: null,
      entityId: input.dealId,
      entityType: "deal",
      metadata: {
        block_number: input.event.blockNumber.toString(10),
        event_type: input.event.eventType,
        log_index: input.event.logIndex,
        onchain_deal_id: input.event.onchainDealId,
        tx_hash: input.event.txHash,
      },
    });
  } catch (error) {
    console.error("Failed to append lifecycle sync audit log.", {
      action: input.action,
      dealId: input.dealId,
      error,
      txHash: input.event.txHash,
    });
  }
}

function logUnknownLinkHash(event: NormalizedFundedEvent) {
  console.error("Skipping confirmed funding event because link_hash is unknown.", {
    blockNumber: event.blockNumber.toString(10),
    eventType: event.eventType,
    linkHash: event.linkHash,
    logIndex: event.logIndex,
    onchainDealId: event.onchainDealId,
    txHash: event.txHash,
  });
}

async function getDealActionContextOrThrow(dealId: string) {
  try {
    return await getDealActionContextById(dealId);
  } catch (error) {
    if (error instanceof DealsRepositoryError) {
      throw new DealEventSyncServiceError(
        error.message,
        error.code ?? "DEAL_LOAD_FAILED",
      );
    }

    throw error;
  }
}

async function markFundingHoldPending(txHash: string) {
  await updateProcessedTransactionHoldApplied(txHash, false);
}

async function markFundingHoldApplied(txHash: string) {
  await updateProcessedTransactionHoldApplied(txHash, true);
}

async function clearFundingHoldRequirement(txHash: string) {
  await updateProcessedTransactionHoldApplied(txHash, null);
}

export async function processPendingFundingHoldForProcessedTransaction(input: {
  dealId: string;
  txHash: string;
}) {
  const context = await getDealActionContextOrThrow(input.dealId);

  if (!context) {
    throw new DealEventSyncServiceError(
      `Deal ${input.dealId} is missing during hold sync.`,
      "DEAL_NOT_FOUND",
    );
  }

  try {
    await applyDealPayoutBlock(context.onchain_deal_id, true);
    await markFundingHoldApplied(input.txHash);
  } catch (error) {
    if (
      isInvalidStateTransitionHoldError(error) &&
      (context.status === "Released" || context.status === "Refunded")
    ) {
      await clearFundingHoldRequirement(input.txHash);
      return;
    }

    throw error;
  }
}

export async function processPendingFundingHoldSweeps(): Promise<void> {
  const pendingTransactions = await listPendingFundingHoldProcessedTransactions();

  for (const pendingTransaction of pendingTransactions) {
    await processPendingFundingHoldForProcessedTransaction({
      dealId: pendingTransaction.dealId,
      txHash: pendingTransaction.txHash,
    });
  }
}

export async function processPendingDenylistHoldSweeps(): Promise<void> {
  const pendingRequests = await listPendingDenylistDealPayoutBlockRequests();

  for (const request of pendingRequests) {
    try {
      await applyDealPayoutBlock(request.onchain_deal_id, request.blocked);
      await markDealPayoutBlockRequestApplied(request.id);
      await appendDenylistHoldAppliedAuditLog({
        dealId: request.deal_id,
        onchainDealId: request.onchain_deal_id,
        requestId: request.id,
      });
    } catch (error) {
      if (isInvalidStateTransitionHoldError(error)) {
        await markDealPayoutBlockRequestNonActionable(
          request.id,
          "INVALID_STATE_TRANSITION",
          "Deal reached a terminal state before the payout block could be applied.",
        );
        continue;
      }

      await markDealPayoutBlockRequestFailure(
        request.id,
        error instanceof Error ? error.name : "HOLD_APPLY_FAILED",
        error instanceof Error ? error.message : "Failed to apply payout block hold.",
      );
    }
  }
}

export async function processConfirmedFundedEvent(
  event: NormalizedFundedEvent,
): Promise<DealEventProcessingResult> {
  const existingMarker = await getByTxHash(event.txHash);

  if (existingMarker) {
    return createAlreadyProcessedResult(event.txHash);
  }

  const consultationLink = await getByLinkHash(event.linkHash);

  if (!consultationLink) {
    // Unknown link hashes are skipped without a marker so future replays do not treat them as converged.
    logUnknownLinkHash(event);

    return {
      linkHash: event.linkHash,
      reason: "UNKNOWN_LINK_HASH",
      result: "skipped",
      txHash: event.txHash,
    };
  }

  const effectiveStatus = resolveEffectiveConsultationLinkStatus(
    consultationLink,
    new Date(),
  );
  const shouldSkipConsumedTransition =
    effectiveStatus === "Cancelled" ||
    effectiveStatus === "Expired";

  const fundedResult = await processConfirmedFundedEventOnce({
    buyerAddress: event.buyerAddress,
    consumeLink: !shouldSkipConsumedTransition,
    eventType: event.eventType,
    fundedAt: event.fundedAt,
    consultationLinkId: consultationLink.id,
    onchainDealId: event.onchainDealId,
    sellerAddress: event.sellerAddress,
    status: "Funded",
    txHash: event.txHash,
  });

  if (fundedResult.alreadyProcessed) {
    return createAlreadyProcessedResult(event.txHash);
  }

  if (!fundedResult.dealId) {
    throw new Error(
      `Funded event ${event.txHash} was processed without a linked deal id.`,
    );
  }

  await appendFundingSyncAuditLog({
    consultationLinkId: consultationLink.id,
    dealId: fundedResult.dealId,
    event,
  });

  const screeningResults = await screenWalletsBatch(
    [event.buyerAddress, event.sellerAddress],
    {
      action: "post_funding_sync",
      actorWallet: null,
      dealId: fundedResult.dealId,
    },
  );

  if (screeningResults.some((result) => result.result === "Blocked")) {
    await markFundingHoldPending(event.txHash);
    await appendBlockedPostFundingAuditLog({
      buyerAddress: event.buyerAddress,
      consultationLinkId: consultationLink.id,
      dealId: fundedResult.dealId,
      event,
      sellerAddress: event.sellerAddress,
    });
    await processPendingFundingHoldForProcessedTransaction({
      dealId: fundedResult.dealId,
      txHash: event.txHash,
    });
  } else {
    await clearFundingHoldRequirement(event.txHash);
  }

  return {
    dealId: fundedResult.dealId,
    result: "processed",
    txHash: event.txHash,
  };
}

export async function processConfirmedCompletedEvent(
  event: NormalizedCompletedEvent,
): Promise<DealEventProcessingResult> {
  const processingResult = await processConfirmedCompletedEventOnce({
    completedAt: event.completedAt,
    eventType: event.eventType,
    onchainDealId: event.onchainDealId,
    txHash: event.txHash,
  });

  if (processingResult.alreadyProcessed) {
    return createAlreadyProcessedResult(event.txHash);
  }

  const dealId = requireProcessedDealId(processingResult.dealId, event.txHash);

  await appendLifecycleSyncAuditLog({
    action: "deal_event_completed_synced",
    dealId,
    event,
  });

  return {
    dealId,
    result: "processed",
    txHash: event.txHash,
  };
}

export async function processConfirmedReleasedEvent(
  event: NormalizedReleasedEvent,
): Promise<DealEventProcessingResult> {
  const processingResult = await processConfirmedReleasedEventOnce({
    eventType: event.eventType,
    onchainDealId: event.onchainDealId,
    releasedAt: event.releasedAt,
    txHash: event.txHash,
  });

  if (processingResult.alreadyProcessed) {
    return createAlreadyProcessedResult(event.txHash);
  }

  const dealId = requireProcessedDealId(processingResult.dealId, event.txHash);

  await appendLifecycleSyncAuditLog({
    action: "deal_event_released_synced",
    dealId,
    event,
  });

  return {
    dealId,
    result: "processed",
    txHash: event.txHash,
  };
}

export async function processConfirmedDisputedEvent(
  event: NormalizedDisputedEvent,
): Promise<DealEventProcessingResult> {
  const processingResult = await processConfirmedDisputedEventOnce({
    eventType: event.eventType,
    onchainDealId: event.onchainDealId,
    txHash: event.txHash,
  });

  if (processingResult.alreadyProcessed) {
    return createAlreadyProcessedResult(event.txHash);
  }

  const dealId = requireProcessedDealId(processingResult.dealId, event.txHash);

  await appendLifecycleSyncAuditLog({
    action: "deal_event_disputed_synced",
    dealId,
    event,
  });

  return {
    dealId,
    result: "processed",
    txHash: event.txHash,
  };
}

export async function processConfirmedRefundedEvent(
  event: NormalizedRefundedEvent,
): Promise<DealEventProcessingResult> {
  const processingResult = await processConfirmedRefundedEventOnce({
    eventType: event.eventType,
    onchainDealId: event.onchainDealId,
    txHash: event.txHash,
  });

  if (processingResult.alreadyProcessed) {
    return createAlreadyProcessedResult(event.txHash);
  }

  const dealId = requireProcessedDealId(processingResult.dealId, event.txHash);

  await appendLifecycleSyncAuditLog({
    action: "deal_event_refunded_synced",
    dealId,
    event,
  });

  return {
    dealId,
    result: "processed",
    txHash: event.txHash,
  };
}

export async function processConfirmedDealEvent(
  event: NormalizedDealLifecycleEvent,
): Promise<DealEventProcessingResult> {
  try {
    switch (event.eventType) {
      case "Completed":
        return await processConfirmedCompletedEvent(event);
      case "Disputed":
        return await processConfirmedDisputedEvent(event);
      case "Funded":
        return await processConfirmedFundedEvent(event);
      case "Refunded":
        return await processConfirmedRefundedEvent(event);
      case "Released":
        return await processConfirmedReleasedEvent(event);
    }
  } catch (error) {
    if (error instanceof ProcessedTransactionsRepositoryError) {
      throw new DealEventSyncServiceError(
        error.message,
        error.code ?? "PROCESSED_TRANSACTION_WRITE_FAILED",
      );
    }

    if (error instanceof Error) {
      throw new DealEventSyncServiceError(
        error.message,
        "DEAL_EVENT_PROCESSING_FAILED",
      );
    }

    throw new DealEventSyncServiceError(
      "Unknown deal event processing failure.",
      "DEAL_EVENT_PROCESSING_FAILED",
    );
  }
}
