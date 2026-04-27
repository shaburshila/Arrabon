import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "@/lib/api/auth";
import {
  createInitialFundingState,
  getFundingErrorState,
} from "@/hooks/use-funding-flow";

describe("useFundingFlow helpers", () => {
  test("creates an idle state with cleared compliance fields", () => {
    assert.deepEqual(createInitialFundingState(), {
      complianceReasonCode: null,
      complianceWallet: null,
      error: null,
      step: "idle",
      txHash: null,
    });
  });

  test("maps blocked compliance errors to compliance_blocked state", () => {
    const state = getFundingErrorState(
      new ApiError(403, {
        code: "COMPLIANCE_BLOCKED",
        error: "Wallet blocked by compliance screening.",
        reason_code: "OFAC_SANCTIONS",
        wallet_address: "0x00000000000000000000000000000000000000AA",
      }),
    );

    assert.deepEqual(state, {
      complianceReasonCode: "OFAC_SANCTIONS",
      complianceWallet: "0x00000000000000000000000000000000000000AA",
      error: null,
      step: "compliance_blocked",
    });
  });

  test("maps blocked compliance errors without reason code to generic compliance_blocked state", () => {
    const state = getFundingErrorState(
      new ApiError(403, {
        code: "COMPLIANCE_BLOCKED",
        error: "Wallet blocked by compliance screening.",
        wallet_address: "0x00000000000000000000000000000000000000AA",
      }),
    );

    assert.deepEqual(state, {
      complianceReasonCode: null,
      complianceWallet: "0x00000000000000000000000000000000000000AA",
      error: null,
      step: "compliance_blocked",
    });
  });

  test("keeps provider unavailable on the failed path", () => {
    const state = getFundingErrorState(
      new ApiError(403, {
        code: "COMPLIANCE_BLOCKED",
        error: "Wallet blocked by compliance screening.",
        reason_code: "PROVIDER_UNAVAILABLE",
        wallet_address: "0x00000000000000000000000000000000000000AA",
      }),
    );

    assert.deepEqual(state, {
      complianceReasonCode: null,
      complianceWallet: null,
      error: "Wallet blocked by compliance screening.",
      step: "failed",
    });
  });

  test("falls back to failed when wallet_address is missing or invalid", () => {
    const state = getFundingErrorState(
      new ApiError(403, {
        code: "COMPLIANCE_BLOCKED",
        error: "Wallet blocked by compliance screening.",
        reason_code: "LOCAL_DENYLIST",
        wallet_address: "not-a-wallet",
      }),
    );

    assert.deepEqual(state, {
      complianceReasonCode: "LOCAL_DENYLIST",
      complianceWallet: null,
      error: null,
      step: "compliance_blocked",
    });
  });
});
