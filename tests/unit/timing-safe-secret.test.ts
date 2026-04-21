import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { timingSafeEqualSecret } from "../../lib/crypto/timing-safe-secret";

describe("timingSafeEqualSecret", () => {
  test("accepts identical secrets", () => {
    assert.equal(timingSafeEqualSecret("secret-value", "secret-value"), true);
  });

  test("rejects different secrets with equal length", () => {
    assert.equal(timingSafeEqualSecret("secret-value", "secret-other"), false);
  });

  test("rejects different secrets with different length without throwing", () => {
    assert.equal(timingSafeEqualSecret("secret-value", "short"), false);
  });
});
