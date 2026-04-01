import "server-only";

import type { NormalizedFundedEvent } from "@/lib/base/consult-escrow";
import { createAuditLogEntry } from "@/server/repositories/audit-log";
import { getByLinkHash } from "@/server/repositories/consultation-links";
import {
  getByTxHash,
  insertProcessedTransaction,
  ProcessedTransactionsRepositoryError,
} from "@/server/repositories/processed-transactions";
import { handleFundedEvent } from "@/server/services/deals";

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
    return {
      result: "already_processed",
      txHash: event.txHash,
    };
  }

  const consultationLink = await getByLinkHash(event.linkHash);

  if (!consultationLink) {
    logUnknownLinkHash(event);

    return {
      linkHash: event.linkHash,
      reason: "UNKNOWN_LINK_HASH",
      result: "skipped",
      txHash: event.txHash,
    };
  }

  const deal = await handleFundedEvent({
    buyerAddress: event.buyerAddress,
    consultationLinkId: consultationLink.id,
    fundedAt: event.fundedAt,
    onchainDealId: event.onchainDealId,
    sellerAddress: event.sellerAddress,
    status: "Funded",
    txHash: event.txHash,
  });

  await appendFundingSyncAuditLog({
    consultationLinkId: consultationLink.id,
    dealId: deal.id,
    event,
  });

  const markerInsertResult = await insertProcessedTransaction({
    dealId: deal.id,
    eventType: event.eventType,
    txHash: event.txHash,
  });

  if (markerInsertResult.duplicate) {
    return {
      dealId: deal.id,
      result: "processed",
      txHash: event.txHash,
    };
  }

  return {
    dealId: deal.id,
    result: "processed",
    txHash: event.txHash,
  };
}

export async function processConfirmedDealEvent(
  event: NormalizedFundedEvent,
): Promise<DealEventProcessingResult> {
  try {
    switch (event.eventType) {
      case "Funded":
        return await processConfirmedFundedEvent(event);
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
