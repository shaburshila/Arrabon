import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { shouldShowFlaggedDeal } from "@/app/admin/disputes/ui";

describe("admin disputes ui helpers", () => {
  test("shows all deals when flagged filter is off", () => {
    assert.equal(shouldShowFlaggedDeal("Clear", false), true);
    assert.equal(shouldShowFlaggedDeal("Review", false), true);
    assert.equal(shouldShowFlaggedDeal("Blocked", false), true);
  });

  test("filters clear deals when flagged filter is on", () => {
    assert.equal(shouldShowFlaggedDeal("Clear", true), false);
    assert.equal(shouldShowFlaggedDeal("Review", true), true);
    assert.equal(shouldShowFlaggedDeal("Blocked", true), true);
  });
});
