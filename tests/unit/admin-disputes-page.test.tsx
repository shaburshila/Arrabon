import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AdminDisputeResolveControls } from "@/app/admin/disputes/resolve-controls";
import type { AdminDealReview } from "@/lib/api/admin-deals";

function makeDeal(overrides: Partial<AdminDealReview> = {}): AdminDealReview {
  return {
    buyer_address: "0x0000000000000000000000000000000000000002",
    compliance_summary: {
      checks_count: 0,
      deal_id: "deal-id-1",
      providers: [],
      risk_status: "Clear",
      wallets: [],
    },
    completed_at: "2026-04-10T00:00:00.000Z",
    consultation_link_id: "link-id-1",
    created_at: "2026-04-08T00:00:00.000Z",
    duration_minutes: 60,
    expires_at: "2026-04-09T00:00:00.000Z",
    id: "deal-id-1",
    onchain_deal_id: "42",
    price_usdc: "100",
    release_deadline_at: "2026-04-11T02:00:00.000Z",
    released_at: null,
    risk_status: "Clear",
    resolution_type: null,
    resolved_at: null,
    resolved_by_wallet: null,
    resolved_from_status: null,
    scheduled_at: "2026-04-09T01:00:00.000Z",
    seller_address: "0x0000000000000000000000000000000000000001",
    status: "Disputed",
    timezone: "UTC",
    title: "Consultation",
    tx_hash: null,
    ...overrides,
  };
}

function renderResolveControls(
  deal: AdminDealReview,
  acknowledgedReviewRisk: boolean,
) {
  return renderToStaticMarkup(
    createElement(AdminDisputeResolveControls, {
      acknowledgedReviewRisk,
      confirmForDeal: null,
      deal,
      isResolving: false,
      onAcknowledgeReviewRiskChange: () => undefined,
      onConfirmingChange: () => undefined,
      onResolve: () => undefined,
    }),
  );
}

describe("AdminDisputeResolveControls", () => {
  test("shows legal-hold notice and disables inline resolve for blocked deals", () => {
    const html = renderResolveControls(makeDeal({ risk_status: "Blocked" }), false);

    assert.match(html, /Legal hold/);
    assert.match(html, /Funds in legal hold\./);
    assert.match(html, /Release to seller/);
    assert.match(html, /Refund to buyer/);
    assert.match(html, /Funds are in legal hold\./);
    assert.equal((html.match(/disabled=""/g) ?? []).length, 2);
  });

  test("keeps review deals disabled until risk is acknowledged", () => {
    const html = renderResolveControls(makeDeal({ risk_status: "Review" }), false);

    assert.match(html, /Manual review required/);
    assert.match(html, /Acknowledge the review risk before resolving this dispute\./);
    assert.match(html, /I understand the compliance review risk and want to continue\./);
    assert.equal((html.match(/disabled=""/g) ?? []).length, 2);
  });

  test("enables review deals after acknowledgement", () => {
    const html = renderResolveControls(makeDeal({ risk_status: "Review" }), true);

    assert.match(html, /Manual review required/);
    assert.doesNotMatch(html, /Acknowledge the review risk before resolving this dispute\./);
    assert.equal((html.match(/disabled=""/g) ?? []).length, 0);
  });

  test("keeps clear deals immediately actionable", () => {
    const html = renderResolveControls(makeDeal({ risk_status: "Clear" }), false);

    assert.doesNotMatch(html, /Legal hold/);
    assert.doesNotMatch(html, /Manual review required/);
    assert.equal((html.match(/disabled=""/g) ?? []).length, 0);
  });
});

describe("admin disputes list labels", () => {
  test("renders confirm-pending blocked deals with non-dispute lifecycle copy", async () => {
    const module = await import("@/app/admin/disputes/ui");
    const html = renderToStaticMarkup(
      createElement("div", null, [
        createElement("span", { key: "status" }, module["adminDealStatusLabel"]("ConfirmPending")),
        createElement("span", { key: "link" }, module["adminDealLinkLabel"]("ConfirmPending")),
      ]),
    );

    assert.match(html, /Awaiting confirmation/);
    assert.match(html, /View blocked deal/);
    assert.doesNotMatch(html, /View dispute/);
  });
});
