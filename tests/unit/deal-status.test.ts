import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  isDealStatusPollable,
  type DealStatus,
} from "../../lib/api/deals";

describe("isDealStatusPollable", () => {
  test("returns true for deal statuses that can still transition", () => {
    const pollableStatuses: DealStatus[] = [
      "ConfirmPending",
      "Disputed",
      "Funded",
    ];

    for (const status of pollableStatuses) {
      assert.equal(isDealStatusPollable(status), true);
    }
  });

  test("returns false for terminal deal statuses", () => {
    const terminalStatuses: DealStatus[] = [
      "Refunded",
      "Released",
    ];

    for (const status of terminalStatuses) {
      assert.equal(isDealStatusPollable(status), false);
    }
  });
});
