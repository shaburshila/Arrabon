import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import {
  DealGuidanceCard,
  getGuidanceMessageAt,
} from "../../components/deal/deal-guidance-card";

function renderCard(
  overrides: Partial<Parameters<typeof DealGuidanceCard>[0]> = {},
): string {
  return renderToStaticMarkup(
    createElement(DealGuidanceCard, {
      dealStatus: "Funded",
      isBuyer: true,
      isSeller: false,
      isViewer: false,
      priceUsdc: "100.00",
      releaseDeadlineAt: null,
      riskStatus: "Clear",
      scheduledAt: "2026-05-06T12:00:00.000Z",
      ...overrides,
    }),
  );
}

describe("DealGuidanceCard compliance messaging", () => {
  test("keeps the normal active guidance when risk status is clear", () => {
    const result = renderCard({
      dealStatus: "Funded",
      riskStatus: "Clear",
    });

    assert.match(result, /Your booking is confirmed/i);
    assert.doesNotMatch(result, /compliance review/i);
    assert.doesNotMatch(result, /payouts are temporarily paused/i);
  });

  test("tells the buyer that funded dispute opens after scheduled time", () => {
    const originalNow = Date.now;
    Date.now = () => new Date("2026-05-06T11:00:00.000Z").getTime();

    try {
      const result = renderCard({
        dealStatus: "Funded",
        riskStatus: "Clear",
        scheduledAt: "2026-05-06T12:00:00.000Z",
      });

      assert.match(result, /you can open a dispute after that time/i);
    } finally {
      Date.now = originalNow;
    }
  });

  test("shows a live buyer deadline countdown before the confirm/dispute window closes", () => {
    const message = getGuidanceMessageAt({
      dealStatus: "ConfirmPending",
      isBuyer: true,
      isSeller: false,
      isViewer: false,
      priceUsdc: "100.00",
      releaseDeadlineAt: "2026-05-08T13:00:00.000Z",
      riskStatus: "Clear",
      scheduledAt: "2026-05-06T12:00:00.000Z",
    }, new Date("2026-05-08T12:30:00.000Z").getTime());

    assert.match(message, /30 minutes left/i);
    assert.match(message, /Confirm payment release or open a dispute before the deadline/i);
  });

  test("shows seller waiting guidance before auto-release becomes available", () => {
    const message = getGuidanceMessageAt({
      dealStatus: "ConfirmPending",
      isBuyer: false,
      isSeller: true,
      isViewer: false,
      priceUsdc: "100.00",
      releaseDeadlineAt: "2026-05-08T13:00:00.000Z",
      riskStatus: "Clear",
      scheduledAt: "2026-05-06T12:00:00.000Z",
    }, new Date("2026-05-08T12:59:00.000Z").getTime());

    assert.match(message, /Waiting for the buyer to confirm payment release/i);
  });

  test("overrides active guidance for blocked deals", () => {
    const result = renderCard({
      dealStatus: "ConfirmPending",
      riskStatus: "Blocked",
    });

    assert.match(result, /payouts are temporarily paused/i);
    assert.match(result, /compliance review/i);
  });

  test("overrides active guidance for review deals", () => {
    const result = renderCard({
      dealStatus: "Disputed",
      riskStatus: "Review",
    });

    assert.match(result, /under compliance review/i);
    assert.match(result, /may be delayed/i);
  });

  test("does not override terminal guidance for released deals", () => {
    const result = renderCard({
      dealStatus: "Released",
      isBuyer: false,
      isSeller: true,
      riskStatus: "Blocked",
    });

    assert.match(result, /Payment of \$100\.00 USDC has been released to your wallet/i);
    assert.doesNotMatch(result, /payouts are temporarily paused/i);
  });
});
