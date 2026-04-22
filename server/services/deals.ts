import "server-only";

import { resolveEffectiveConsultationLinkStatus } from "@/lib/constants/consultation-links";
import {
  DealsRepositoryError,
  getByConsultationLinkId,
  getByOnchainDealId,
  insertConfirmedDealAndMaybeConsumeLink,
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
    deal = await insertConfirmedDealAndMaybeConsumeLink(input, {
      consumeLink: !shouldSkipConsumedTransition,
    });
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

  return deal;
}
