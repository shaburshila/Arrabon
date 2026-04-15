import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  ConsultationLinkValidationError,
  parseCreateConsultationLinkInput,
} from "../../lib/validators/consultation-links";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    description: "Consultation details",
    duration_minutes: 60,
    expires_at: "2026-01-01T00:55:00.000Z",
    grace_period_minutes: 15,
    meeting_url: "https://meet.example.com/room",
    price_usdc: "100",
    scheduled_at: "2026-01-01T01:00:00.000Z",
    timezone: "UTC",
    title: "Strategy call",
    ...overrides,
  };
}

describe("parseCreateConsultationLinkInput description", () => {
  test("allows a missing description and normalizes it to an empty string", () => {
    const payload = makePayload();
    delete payload.description;

    const result = parseCreateConsultationLinkInput(payload, NOW);

    assert.equal(result.description, "");
  });

  test("allows an empty description", () => {
    const result = parseCreateConsultationLinkInput(
      makePayload({ description: "" }),
      NOW,
    );

    assert.equal(result.description, "");
  });

  test("trims whitespace-only descriptions to an empty string", () => {
    const result = parseCreateConsultationLinkInput(
      makePayload({ description: "   " }),
      NOW,
    );

    assert.equal(result.description, "");
  });

  test("trims a provided description", () => {
    const result = parseCreateConsultationLinkInput(
      makePayload({ description: "  hello  " }),
      NOW,
    );

    assert.equal(result.description, "hello");
  });

  test("rejects non-string descriptions", () => {
    assert.throws(
      () => parseCreateConsultationLinkInput(
        makePayload({ description: 123 }),
        NOW,
      ),
      (error: unknown) => {
        assert.ok(error instanceof ConsultationLinkValidationError);
        assert.deepEqual(error.issues, [
          {
            field: "description",
            message: "Expected a string.",
          },
        ]);
        return true;
      },
    );
  });
});
