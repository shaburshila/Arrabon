import type { DealStatus } from "@/lib/api/deals";
import { computeReleaseDeadlineMs } from "@/lib/constants/deals";

function parseIsoToMs(value: string): number | null {
  const parsed = new Date(value).getTime();

  return Number.isNaN(parsed) ? null : parsed;
}

export function hasScheduledTimeStarted(scheduledAt: string): boolean {
  const scheduledAtMs = parseIsoToMs(scheduledAt);

  return scheduledAtMs !== null && Date.now() >= scheduledAtMs;
}

export function getReleaseDeadlineAt(input: {
  durationMinutes: number;
  scheduledAt: string;
}): string | null {
  const scheduledAtMs = parseIsoToMs(input.scheduledAt);

  if (scheduledAtMs === null) {
    return null;
  }

  return new Date(
    computeReleaseDeadlineMs(scheduledAtMs, input.durationMinutes),
  ).toISOString();
}

export function isBuyerDisputable(input: {
  durationMinutes: number;
  scheduledAt: string;
  status: DealStatus;
}): boolean {
  if (input.status === "Funded") {
    return hasScheduledTimeStarted(input.scheduledAt);
  }

  if (input.status !== "ConfirmPending") {
    return false;
  }

  const deadlineAt = getReleaseDeadlineAt(input);

  if (!deadlineAt) {
    return false;
  }

  return Date.now() <= new Date(deadlineAt).getTime();
}

export function isBuyerReleasable(input: {
  durationMinutes: number;
  scheduledAt: string;
  status: DealStatus;
}): boolean {
  if (input.status !== "ConfirmPending") {
    return false;
  }

  const deadlineAt = getReleaseDeadlineAt(input);

  if (!deadlineAt) {
    return false;
  }

  return Date.now() <= new Date(deadlineAt).getTime();
}

export function isSellerAutoReleaseAvailable(input: {
  durationMinutes: number;
  isSeller: boolean;
  scheduledAt: string;
  status: DealStatus;
}): boolean {
  if (!input.isSeller || input.status !== "ConfirmPending") {
    return false;
  }

  const deadlineAt = getReleaseDeadlineAt(input);

  if (!deadlineAt) {
    return false;
  }

  return Date.now() > new Date(deadlineAt).getTime();
}
