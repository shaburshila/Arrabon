import "server-only";

import { resolveEffectiveConsultationLinkStatus } from "@/lib/constants/consultation-links";
import {
  DealsRepositoryError,
  getByConsultationLinkId,
  getByOnchainDealId,
  insertConfirmedDeal,
  type InsertConfirmedDealInput,
} from "@/server/repositories/deals";
import {
  getById,
  updateStatus,
} from "@/server/repositories/consultation-links";

function isMatchingConfirmedDeal(
  input: InsertConfirmedDealInput,
  existingDeal: {
    consultation_link_id: string;
    onchain_deal_id: string;
  },
): boolean {
  return (
    existingDeal.consultation_link_id === input.consultationLinkId &&
    existingDeal.onchain_deal_id === input.onchainDealId
  );
}

export async function handleFundedEvent(
  input: InsertConfirmedDealInput,
  now: Date = new Date(),
) {
  const consultationLink = await getById(input.consultationLinkId);

  if (!consultationLink) {
    throw new Error(
      `Consultation link ${input.consultationLinkId} was not found for funded event handling.`,
    );
  }

  const effectiveStatus = resolveEffectiveConsultationLinkStatus(consultationLink, now);
  const shouldSkipConsumedTransition =
    effectiveStatus === "Cancelled" ||
    effectiveStatus === "Expired";

  const existingDealByLink = await getByConsultationLinkId(input.consultationLinkId);

  if (existingDealByLink) {
    if (!isMatchingConfirmedDeal(input, existingDealByLink)) {
      throw new Error(
        `Consultation link ${input.consultationLinkId} is already bound to onchain deal ${existingDealByLink.onchain_deal_id}.`,
      );
    }

    if (!shouldSkipConsumedTransition) {
      await updateStatus(input.consultationLinkId, "Consumed");
    }

    return existingDealByLink;
  }

  const existingDealByOnchainId = await getByOnchainDealId(input.onchainDealId);

  if (existingDealByOnchainId) {
    if (!isMatchingConfirmedDeal(input, existingDealByOnchainId)) {
      throw new Error(
        `Onchain deal ${input.onchainDealId} is already bound to consultation link ${existingDealByOnchainId.consultation_link_id}.`,
      );
    }

    if (!shouldSkipConsumedTransition) {
      await updateStatus(input.consultationLinkId, "Consumed");
    }

    return existingDealByOnchainId;
  }

  let deal;

  try {
    deal = await insertConfirmedDeal(input);
  } catch (error) {
    if (
      error instanceof DealsRepositoryError &&
      error.code === "23505"
    ) {
      const recoveredDeal =
        (await getByOnchainDealId(input.onchainDealId)) ??
        (await getByConsultationLinkId(input.consultationLinkId));

      if (recoveredDeal && isMatchingConfirmedDeal(input, recoveredDeal)) {
        if (!shouldSkipConsumedTransition) {
          await updateStatus(input.consultationLinkId, "Consumed");
        }

        return recoveredDeal;
      }
    }

    throw error;
  }

  // If the link was already cancelled or expired offchain, we still persist the
  // funded deal because the confirmed onchain event is the source of truth.
  // In that terminal-link path we intentionally do not force the link into
  // Consumed, because that would attempt an invalid transition and create
  // inconsistent offchain handling for an already terminal record.
  if (!shouldSkipConsumedTransition) {
    await updateStatus(input.consultationLinkId, "Consumed");
  }

  return deal;
}
