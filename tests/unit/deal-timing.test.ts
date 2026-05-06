import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  hasScheduledTimeStarted,
  isBuyerDisputable,
  isBuyerReleasable,
  isSellerAutoReleaseAvailable,
} from "../../lib/ui/deal-timing";

const SCHEDULED_AT = "2026-05-06T12:00:00.000Z";
const DURATION_MINUTES = 60;
const DEADLINE_AT = "2026-05-08T13:00:00.000Z";

describe("deal timing helpers", () => {
  test("treats funded dispute as unavailable before scheduled_at and available at scheduled_at", () => {
    const originalNow = Date.now;

    try {
      Date.now = () => new Date("2026-05-06T11:59:59.000Z").getTime();
      assert.equal(hasScheduledTimeStarted(SCHEDULED_AT), false);
      assert.equal(
        isBuyerDisputable({
          durationMinutes: DURATION_MINUTES,
          scheduledAt: SCHEDULED_AT,
          status: "Funded",
        }),
        false,
      );

      Date.now = () => new Date(SCHEDULED_AT).getTime();
      assert.equal(hasScheduledTimeStarted(SCHEDULED_AT), true);
      assert.equal(
        isBuyerDisputable({
          durationMinutes: DURATION_MINUTES,
          scheduledAt: SCHEDULED_AT,
          status: "Funded",
        }),
        true,
      );
    } finally {
      Date.now = originalNow;
    }
  });

  test("allows buyer release and dispute at the exact fixed deadline", () => {
    const originalNow = Date.now;
    Date.now = () => new Date(DEADLINE_AT).getTime();

    try {
      assert.equal(
        isBuyerDisputable({
          durationMinutes: DURATION_MINUTES,
          scheduledAt: SCHEDULED_AT,
          status: "ConfirmPending",
        }),
        true,
      );
      assert.equal(
        isBuyerReleasable({
          durationMinutes: DURATION_MINUTES,
          scheduledAt: SCHEDULED_AT,
          status: "ConfirmPending",
        }),
        true,
      );
    } finally {
      Date.now = originalNow;
    }
  });

  test("blocks buyer release and dispute after the fixed deadline", () => {
    const originalNow = Date.now;
    Date.now = () => new Date("2026-05-08T13:00:01.000Z").getTime();

    try {
      assert.equal(
        isBuyerDisputable({
          durationMinutes: DURATION_MINUTES,
          scheduledAt: SCHEDULED_AT,
          status: "ConfirmPending",
        }),
        false,
      );
      assert.equal(
        isBuyerReleasable({
          durationMinutes: DURATION_MINUTES,
          scheduledAt: SCHEDULED_AT,
          status: "ConfirmPending",
        }),
        false,
      );
    } finally {
      Date.now = originalNow;
    }
  });

  test("allows auto-release only for the seller after the fixed deadline", () => {
    const originalNow = Date.now;

    try {
      Date.now = () => new Date(DEADLINE_AT).getTime();
      assert.equal(
        isSellerAutoReleaseAvailable({
          durationMinutes: DURATION_MINUTES,
          isSeller: true,
          scheduledAt: SCHEDULED_AT,
          status: "ConfirmPending",
        }),
        false,
      );

      Date.now = () => new Date("2026-05-08T13:00:01.000Z").getTime();
      assert.equal(
        isSellerAutoReleaseAvailable({
          durationMinutes: DURATION_MINUTES,
          isSeller: true,
          scheduledAt: SCHEDULED_AT,
          status: "ConfirmPending",
        }),
        true,
      );
      assert.equal(
        isSellerAutoReleaseAvailable({
          durationMinutes: DURATION_MINUTES,
          isSeller: false,
          scheduledAt: SCHEDULED_AT,
          status: "ConfirmPending",
        }),
        false,
      );
    } finally {
      Date.now = originalNow;
    }
  });
});
