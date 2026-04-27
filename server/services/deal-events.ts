import "server-only";

import type {
  NormalizedCompletedEvent,
  NormalizedDealLifecycleEvent,
  NormalizedDisputedEvent,
  NormalizedFundedEvent,
  NormalizedRefundedEvent,
  NormalizedReleasedEvent,
} from "@/lib/base/consult-escrow";
import { resolveEffectiveConsultationLinkStatus } from "@/lib/constants/consultation-links";
import { createAuditLogEntry } from "@/server/repositories/audit-log";
import { consumeLatestAdminResolutionIntent } from "@/server/repositories/admin-resolution-intents";
import { getByLinkHash } from "@/server/repositories/consultation-links";
import {
  setConfirmPendingByOnchainDealId,
  setDisputedByOnchainDealId,
  setRefundedByOnchainDealId,
  setReleasedByOnchainDealId,
} from "@/server/repositories/deals";
import {
  getByTxHash,
  insertProcessedTransaction,
  processConfirmedFundedEventOnce,
  ProcessedTransactionsRepositoryError,
} from "@/server/repositories/processed-transactions";
import { screenWalletsBatch } from "@/server/services/compliance";

export class DealEventSyncServiceError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "DealEventSyncServiceError";
    this.code = code;
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
    await appendBlockedPostFundingAuditLog({
      buyerAddress: event.buyerAddress,
      consultationLinkId: consultationLink.id,
      dealId: fundedResult.dealId,
      event,
      sellerAddress: event.sellerAddress,
    });
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
  const existingMarker = await getByTxHash(event.txHash);

  if (existingMarker) {
    return createAlreadyProcessedResult(event.txHash);
  }

  const deal = await setConfirmPendingByOnchainDealId(
    event.onchainDealId,
    event.completedAt,
  );

  const marker = await insertProcessedTransaction({
    dealId: deal.id,
    eventType: event.eventType,
    txHash: event.txHash,
  });

  if (marker.duplicate) {
    return createAlreadyProcessedResult(event.txHash);
  }

  await appendLifecycleSyncAuditLog({
    action: "deal_event_completed_synced",
    dealId: deal.id,
    event,
  });

  return {
    dealId: deal.id,
    result: "processed",
    txHash: event.txHash,
  };
}

export async function processConfirmedReleasedEvent(
  event: NormalizedReleasedEvent,
): Promise<DealEventProcessingResult> {
  const existingMarker = await getByTxHash(event.txHash);

  if (existingMarker) {
    return createAlreadyProcessedResult(event.txHash);
  }

  const adminIntent = await consumeLatestAdminResolutionIntent({
    onchainDealId: event.onchainDealId,
    resolution: "release",
  });

  const deal = await setReleasedByOnchainDealId(
    event.onchainDealId,
    event.releasedAt,
    adminIntent?.admin_wallet,
  );

  const marker = await insertProcessedTransaction({
    dealId: deal.id,
    eventType: event.eventType,
    txHash: event.txHash,
  });

  if (marker.duplicate) {
    return createAlreadyProcessedResult(event.txHash);
  }

  await appendLifecycleSyncAuditLog({
    action: "deal_event_released_synced",
    dealId: deal.id,
    event,
  });

  return {
    dealId: deal.id,
    result: "processed",
    txHash: event.txHash,
  };
}

export async function processConfirmedDisputedEvent(
  event: NormalizedDisputedEvent,
): Promise<DealEventProcessingResult> {
  const existingMarker = await getByTxHash(event.txHash);

  if (existingMarker) {
    return createAlreadyProcessedResult(event.txHash);
  }

  const deal = await setDisputedByOnchainDealId(event.onchainDealId);

  const marker = await insertProcessedTransaction({
    dealId: deal.id,
    eventType: event.eventType,
    txHash: event.txHash,
  });

  if (marker.duplicate) {
    return createAlreadyProcessedResult(event.txHash);
  }

  await appendLifecycleSyncAuditLog({
    action: "deal_event_disputed_synced",
    dealId: deal.id,
    event,
  });

  return {
    dealId: deal.id,
    result: "processed",
    txHash: event.txHash,
  };
}

export async function processConfirmedRefundedEvent(
  event: NormalizedRefundedEvent,
): Promise<DealEventProcessingResult> {
  const existingMarker = await getByTxHash(event.txHash);

  if (existingMarker) {
    return createAlreadyProcessedResult(event.txHash);
  }

  const adminIntent = await consumeLatestAdminResolutionIntent({
    onchainDealId: event.onchainDealId,
    resolution: "refund",
  });

  const deal = await setRefundedByOnchainDealId(
    event.onchainDealId,
    undefined,
    adminIntent?.admin_wallet,
  );

  const marker = await insertProcessedTransaction({
    dealId: deal.id,
    eventType: event.eventType,
    txHash: event.txHash,
  });

  if (marker.duplicate) {
    return createAlreadyProcessedResult(event.txHash);
  }

  await appendLifecycleSyncAuditLog({
    action: "deal_event_refunded_synced",
    dealId: deal.id,
    event,
  });

  return {
    dealId: deal.id,
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
