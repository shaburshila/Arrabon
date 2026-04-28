import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { canSubmitDenylistRemoval } from "@/app/admin/denylist/page";

describe("admin denylist page helpers", () => {
  test("rejects empty removal comments", () => {
    assert.equal(canSubmitDenylistRemoval(""), false);
    assert.equal(canSubmitDenylistRemoval("   "), false);
  });

  test("accepts non-empty removal comments", () => {
    assert.equal(canSubmitDenylistRemoval("cleared by legal"), true);
  });
});
