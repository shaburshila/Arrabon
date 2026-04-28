import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { getAdminResolveAvailability } from "@/app/admin/disputes/[id]/page";

describe("admin dispute detail ui helpers", () => {
  test("blocks resolution for blocked risk", () => {
    assert.deepEqual(getAdminResolveAvailability("Blocked", false), {
      blocked: true,
      disabled: true,
      disabledReason: "Funds are in legal hold.",
      requiresAcknowledge: false,
    });
  });

  test("requires acknowledge for review risk", () => {
    assert.deepEqual(getAdminResolveAvailability("Review", false), {
      blocked: false,
      disabled: true,
      disabledReason: "Acknowledge the review risk before resolving this dispute.",
      requiresAcknowledge: true,
    });
  });

  test("enables resolution after review acknowledge", () => {
    assert.deepEqual(getAdminResolveAvailability("Review", true), {
      blocked: false,
      disabled: false,
      disabledReason: null,
      requiresAcknowledge: true,
    });
  });

  test("keeps clear deals enabled", () => {
    assert.deepEqual(getAdminResolveAvailability("Clear", false), {
      blocked: false,
      disabled: false,
      disabledReason: null,
      requiresAcknowledge: false,
    });
  });
});
