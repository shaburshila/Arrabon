import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  DEAL_STATUS_CONFIG,
  getDealDisplayConfig,
} from "../../lib/ui/deal-status";

describe("getDealDisplayConfig", () => {
  test("labels admin release without changing Released colors", () => {
    const result = getDealDisplayConfig({
      resolution_type: "admin_release",
      status: "Released",
    });

    assert.equal(result.label, "Released after dispute");
    assert.equal(result.bg, DEAL_STATUS_CONFIG.Released.bg);
    assert.equal(result.color, DEAL_STATUS_CONFIG.Released.color);
  });

  test("labels admin refund without changing Refunded colors", () => {
    const result = getDealDisplayConfig({
      resolution_type: "admin_refund",
      status: "Refunded",
    });

    assert.equal(result.label, "Refunded after dispute");
    assert.equal(result.bg, DEAL_STATUS_CONFIG.Refunded.bg);
    assert.equal(result.color, DEAL_STATUS_CONFIG.Refunded.color);
  });

  test("labels auto release without changing Released colors", () => {
    const result = getDealDisplayConfig({
      resolution_type: "auto_release",
      status: "Released",
    });

    assert.equal(result.label, "Auto-released");
    assert.equal(result.bg, DEAL_STATUS_CONFIG.Released.bg);
    assert.equal(result.color, DEAL_STATUS_CONFIG.Released.color);
  });

  test("labels buyer-confirmed release without changing Released colors", () => {
    const result = getDealDisplayConfig({
      resolution_type: "buyer_confirmed",
      status: "Released",
    });

    assert.equal(result.label, "Released by buyer");
    assert.equal(result.bg, DEAL_STATUS_CONFIG.Released.bg);
    assert.equal(result.color, DEAL_STATUS_CONFIG.Released.color);
  });

  test("falls back to base status config when resolution type is missing", () => {
    assert.deepEqual(
      getDealDisplayConfig({
        resolution_type: null,
        status: "Released",
      }),
      DEAL_STATUS_CONFIG.Released,
    );
    assert.deepEqual(
      getDealDisplayConfig({
        resolution_type: null,
        status: "Refunded",
      }),
      DEAL_STATUS_CONFIG.Refunded,
    );
  });

  test("marks disputed as a danger state", () => {
    assert.equal(DEAL_STATUS_CONFIG.Disputed.bg, "var(--danger-muted)");
    assert.equal(DEAL_STATUS_CONFIG.Disputed.color, "var(--danger)");
  });
});
