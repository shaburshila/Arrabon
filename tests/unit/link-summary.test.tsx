import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { LinkSummary } from "@/components/link/link-summary";
import { formatDate } from "@/lib/ui/date";
import type { PublicLink } from "@/lib/api/links";

function makeLink(): PublicLink {
  return {
    deal_id: null,
    description: "Private strategy session",
    duration_minutes: 60,
    expires_at: "2026-04-28T10:00:00.000Z",
    id: "link-id-1",
    meeting_url_revealed: false,
    price_usdc: "100.00",
    scheduled_at: "2026-04-28T12:00:00.000Z",
    seller_address: "0x00000000000000000000000000000000000000BB",
    status: "Open",
    timezone: "UTC",
    title: "Consult",
  };
}

describe("LinkSummary", () => {
  test("renders a clear payment deadline based on expires_at", () => {
    const link = makeLink();
    const expiresText = formatDate(link.expires_at, {
      showTimeZoneName: true,
      timeZone: link.timezone,
    });
    const scheduledText = formatDate(link.scheduled_at, {
      showTimeZoneName: true,
      timeZone: link.timezone,
    });

    const html = renderToStaticMarkup(createElement(LinkSummary, { link }));

    assert.match(html, /Payment must be made before/);
    assert.match(html, new RegExp(expiresText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, new RegExp(scheduledText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    const paymentSentenceStart = html.indexOf("Payment must be made before");
    const expiresInSentence = html.indexOf(expiresText, paymentSentenceStart);
    const scheduledInSentence = html.indexOf(scheduledText, paymentSentenceStart);

    assert.notEqual(paymentSentenceStart, -1);
    assert.notEqual(expiresInSentence, -1);
    assert.equal(scheduledInSentence, -1);
  });
});
