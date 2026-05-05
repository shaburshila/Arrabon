import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import { DealGuidanceCard } from "../../components/deal/deal-guidance-card";

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
