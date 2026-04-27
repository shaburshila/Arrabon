import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ComplianceBlockedNotice } from "@/components/shared/compliance-blocked-notice";

const TEST_WALLET = "0x00000000000000000000000000000000000000AA";

describe("ComplianceBlockedNotice", () => {
  test("renders a danger notice with truncated wallet and verification link", () => {
    const html = renderToStaticMarkup(
      createElement(ComplianceBlockedNotice, {
        reasonCode: "LOCAL_DENYLIST",
        walletAddress: TEST_WALLET,
      }),
    );

    assert.match(html, /Local compliance policy blocked this action/);
    assert.match(html, /0x0000\.\.\.00AA/);
    assert.match(html, /mailto:support@baseconsult\.link/);
    assert.match(html, /Contact support/);
  });

  test("renders no link when the display mapping has no verification url", () => {
    const html = renderToStaticMarkup(
      createElement(ComplianceBlockedNotice, {
        reasonCode: "UNKNOWN_REASON",
        walletAddress: TEST_WALLET,
      }),
    );

    assert.match(html, /Compliance screening blocked this action/);
    assert.doesNotMatch(html, /href=/);
  });

  test("returns null for retryable provider-unavailable cases", () => {
    const result = ComplianceBlockedNotice({
      reasonCode: "PROVIDER_UNAVAILABLE",
      walletAddress: TEST_WALLET,
    });

    assert.equal(result, null);
  });

  test("renders without a wallet row when wallet address is missing", () => {
    const html = renderToStaticMarkup(
      createElement(ComplianceBlockedNotice, {
        reasonCode: "OFAC_SANCTIONS",
        walletAddress: null,
      }),
    );

    assert.match(html, /Sanctions screening blocked this action/);
    assert.doesNotMatch(html, /Wallet:/);
  });
});
