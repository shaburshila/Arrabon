import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  DisputeMessageValidationError,
  parseCreateDisputeMessageBody,
} from "../../lib/validators/dispute-messages";

describe("parseCreateDisputeMessageBody", () => {
  test("trims body and normalizes missing evidence url to null", () => {
    assert.deepEqual(
      parseCreateDisputeMessageBody({ body: "  Seller did not join.  " }),
      {
        body: "Seller did not join.",
        evidence_url: null,
      },
    );
  });

  test("normalizes empty evidence url to null", () => {
    assert.deepEqual(
      parseCreateDisputeMessageBody({
        body: "Here is my position.",
        evidence_url: "   ",
      }),
      {
        body: "Here is my position.",
        evidence_url: null,
      },
    );
  });

  test("accepts a valid evidence url", () => {
    assert.deepEqual(
      parseCreateDisputeMessageBody({
        body: "Screen recording attached.",
        evidence_url: " https://example.com/evidence ",
      }),
      {
        body: "Screen recording attached.",
        evidence_url: "https://example.com/evidence",
      },
    );
  });

  test("rejects invalid evidence url", () => {
    assert.throws(
      () => parseCreateDisputeMessageBody({
        body: "Bad link.",
        evidence_url: "not-a-url",
      }),
      DisputeMessageValidationError,
    );
  });

  test("rejects empty body", () => {
    assert.throws(
      () => parseCreateDisputeMessageBody({
        body: "   ",
      }),
      DisputeMessageValidationError,
    );
  });
});
