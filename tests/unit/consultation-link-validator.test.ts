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
    meeting_url: "https://meet.example.com/room",
    price_usdc: "100",
    scheduled_at: "2026-01-01T01:00:00.000Z",
    timezone: "UTC",
    title: "Strategy call",
    ...overrides,
  };
}

describe("parseCreateConsultationLinkInput description", () => {
  test("rejects titles longer than 120 characters", () => {
    assert.throws(
      () => parseCreateConsultationLinkInput(
        makePayload({ title: "a".repeat(121) }),
        NOW,
      ),
      (error: unknown) => {
        assert.ok(error instanceof ConsultationLinkValidationError);
        assert.deepEqual(error.issues, [
          {
            field: "title",
            message: "Must be at most 120 characters.",
          },
        ]);
        return true;
      },
    );
  });

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

  test("rejects descriptions longer than 3000 characters", () => {
    assert.throws(
      () => parseCreateConsultationLinkInput(
        makePayload({ description: "a".repeat(3001) }),
        NOW,
      ),
      (error: unknown) => {
        assert.ok(error instanceof ConsultationLinkValidationError);
        assert.deepEqual(error.issues, [
          {
            field: "description",
            message: "Must be at most 3000 characters.",
          },
        ]);
        return true;
      },
    );
  });
});

describe("parseCreateConsultationLinkInput timezone", () => {
  test("accepts a valid IANA timezone", () => {
    const result = parseCreateConsultationLinkInput(
      makePayload({ timezone: "America/New_York" }),
      NOW,
    );

    assert.equal(result.timezone, "America/New_York");
  });

  test("rejects an invalid timezone", () => {
    assert.throws(
      () => parseCreateConsultationLinkInput(
        makePayload({ timezone: "Not/AZone" }),
        NOW,
      ),
      (error: unknown) => {
        assert.ok(error instanceof ConsultationLinkValidationError);
        assert.deepEqual(error.issues, [
          {
            field: "timezone",
            message: "Expected a valid IANA time zone.",
          },
        ]);
        return true;
      },
    );
  });
});

describe("parseCreateConsultationLinkInput expiration and removed grace period", () => {
  test("accepts a valid payload without client-provided grace_period_minutes", () => {
    const result = parseCreateConsultationLinkInput(makePayload(), NOW);

    assert.equal(result.durationMinutes, 60);
    assert.equal(result.expiresAt.toISOString(), "2026-01-01T00:55:00.000Z");
    assert.equal("gracePeriodMinutes" in result, false);
  });

  test("ignores client-provided grace_period_minutes", () => {
    const result = parseCreateConsultationLinkInput(
      makePayload({ grace_period_minutes: -999 }),
      NOW,
    );

    assert.equal(result.durationMinutes, 60);
    assert.equal("gracePeriodMinutes" in result, false);
  });

  test("rejects a missing expires_at", () => {
    const payload = makePayload();
    delete payload.expires_at;

    assert.throws(
      () => parseCreateConsultationLinkInput(payload, NOW),
      (error: unknown) => {
        assert.ok(error instanceof ConsultationLinkValidationError);
        assert.deepEqual(error.issues, [
          {
            field: "expires_at",
            message: "Expected a string.",
          },
        ]);
        return true;
      },
    );
  });

  test("rejects expires_at that is not later than now", () => {
    assert.throws(
      () => parseCreateConsultationLinkInput(
        makePayload({ expires_at: "2026-01-01T00:00:00.000Z" }),
        NOW,
      ),
      (error: unknown) => {
        assert.ok(error instanceof ConsultationLinkValidationError);
        assert.deepEqual(error.issues, [
          {
            field: "expires_at",
            message: "Must be later than the current time.",
          },
        ]);
        return true;
      },
    );
  });

  test("allows expires_at equal to scheduled_at", () => {
    const result = parseCreateConsultationLinkInput(
      makePayload({ expires_at: "2026-01-01T01:00:00.000Z" }),
      NOW,
    );

    assert.equal(result.expiresAt.toISOString(), "2026-01-01T01:00:00.000Z");
  });

  test("rejects expires_at after scheduled_at", () => {
    assert.throws(
      () => parseCreateConsultationLinkInput(
        makePayload({ expires_at: "2026-01-01T01:00:01.000Z" }),
        NOW,
      ),
      (error: unknown) => {
        assert.ok(error instanceof ConsultationLinkValidationError);
        assert.deepEqual(error.issues, [
          {
            field: "expires_at",
            message: "Must be at or before scheduled_at.",
          },
        ]);
        return true;
      },
    );
  });

  test("allows expires_at less than 5 minutes before scheduled_at", () => {
    const result = parseCreateConsultationLinkInput(
      makePayload({ expires_at: "2026-01-01T00:59:00.000Z" }),
      NOW,
    );

    assert.equal(result.expiresAt.toISOString(), "2026-01-01T00:59:00.000Z");
  });

  test("rejects duration over 1440 minutes", () => {
    assert.throws(
      () => parseCreateConsultationLinkInput(
        makePayload({ duration_minutes: 1441 }),
        NOW,
      ),
      (error: unknown) => {
        assert.ok(error instanceof ConsultationLinkValidationError);
        assert.deepEqual(error.issues, [
          {
            field: "duration_minutes",
            message: "Must be at most 1440.",
          },
        ]);
        return true;
      },
    );
  });

  test("rejects scheduled_at beyond 365 days", () => {
    assert.throws(
      () => parseCreateConsultationLinkInput(
        makePayload({
          expires_at: "2027-01-01T00:00:00.000Z",
          scheduled_at: "2027-01-02T00:00:01.000Z",
        }),
        NOW,
      ),
      (error: unknown) => {
        assert.ok(error instanceof ConsultationLinkValidationError);
        assert.deepEqual(error.issues, [
          {
            field: "scheduled_at",
            message: "Must be within 365 days.",
          },
        ]);
        return true;
      },
    );
  });

  test("rejects expires_at beyond 365 days", () => {
    assert.throws(
      () => parseCreateConsultationLinkInput(
        makePayload({
          expires_at: "2027-01-01T00:00:01.000Z",
          scheduled_at: "2027-01-01T00:00:01.000Z",
        }),
        NOW,
      ),
      (error: unknown) => {
        assert.ok(error instanceof ConsultationLinkValidationError);
        assert.ok(error.issues.some((issue) => (
          issue.field === "expires_at" &&
          issue.message === "Must be within 365 days."
        )));
        return true;
      },
    );
  });
});
