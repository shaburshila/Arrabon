import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { RiskBadge } from "@/components/admin/risk-badge";

describe("RiskBadge", () => {
  test("renders clear status", () => {
    const html = renderToStaticMarkup(createElement(RiskBadge, { riskStatus: "Clear" }));
    assert.match(html, /Clear/);
  });

  test("renders review status", () => {
    const html = renderToStaticMarkup(createElement(RiskBadge, { riskStatus: "Review" }));
    assert.match(html, /Review/);
  });

  test("renders blocked status", () => {
    const html = renderToStaticMarkup(createElement(RiskBadge, { riskStatus: "Blocked" }));
    assert.match(html, /Blocked/);
  });
});
