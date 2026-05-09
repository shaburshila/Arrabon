import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  shouldShowConsumedLinkPrivateNotice,
} from "@/app/link/[id]/consumed-link-state";

describe("consumed link state helpers", () => {
  test("shows private notice for consumed links without local tx hash", () => {
    assert.equal(
      shouldShowConsumedLinkPrivateNotice({
        dealId: null,
        status: "Consumed",
        txHash: null,
      }),
      true,
    );

    assert.equal(
      shouldShowConsumedLinkPrivateNotice({
        dealId: null,
        status: "Consumed",
        txHash: `0x${"a".repeat(64)}`,
      }),
      false,
    );

    assert.equal(
      shouldShowConsumedLinkPrivateNotice({
        dealId: "deal-id-1",
        status: "Consumed",
        txHash: null,
      }),
      true,
    );
  });
});
