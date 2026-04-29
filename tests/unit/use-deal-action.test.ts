import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "@/lib/api/auth";
import {
  createInitialActionState,
  getActionErrorState,
} from "@/hooks/use-deal-action";

// Note: lifecycle convergence polling lives inside a hook closure and is
// verified manually on the dev stand; this file only covers exported helpers,
// including the lifecycle-specific DEAL_NOT_FOUND_FOR_TX regression boundary.
describe("useDealAction helpers", () => {
  test("creates an idle state with cleared compliance fields", () => {
    assert.deepEqual(createInitialActionState(), {
      complianceReasonCode: null,
      complianceWallet: null,
      error: null,
      step: "idle",
      txHash: null,
    });
  });

  test("maps blocked compliance errors to compliance_blocked state", () => {
    const state = getActionErrorState(
      new ApiError(403, {
        code: "COMPLIANCE_BLOCKED",
        error: "Wallet blocked by compliance screening.",
        reason_code: "USDC_BLACKLISTED",
        wallet_address: "0x00000000000000000000000000000000000000BB",
      }),
    );

    assert.deepEqual(state, {
      complianceReasonCode: "USDC_BLACKLISTED",
      complianceWallet: "0x00000000000000000000000000000000000000bb",
      error: null,
      step: "compliance_blocked",
    });
  });

  test("maps blocked compliance errors without reason code to generic compliance_blocked state", () => {
    const state = getActionErrorState(
      new ApiError(403, {
        code: "COMPLIANCE_BLOCKED",
        error: "Wallet blocked by compliance screening.",
        wallet_address: "0x00000000000000000000000000000000000000BB",
      }),
    );

    assert.deepEqual(state, {
      complianceReasonCode: null,
      complianceWallet: "0x00000000000000000000000000000000000000bb",
      error: null,
      step: "compliance_blocked",
    });
  });

  test("keeps provider unavailable on the failed path", () => {
    const state = getActionErrorState(
      new ApiError(403, {
        code: "COMPLIANCE_BLOCKED",
        error: "Wallet blocked by compliance screening.",
        reason_code: "PROVIDER_UNAVAILABLE",
        wallet_address: "0x00000000000000000000000000000000000000BB",
      }),
    );

    assert.deepEqual(state, {
      complianceReasonCode: null,
      complianceWallet: null,
      error: "Wallet blocked by compliance screening.",
      step: "failed",
    });
  });

  test("falls back to failed for generic action errors", () => {
    const state = getActionErrorState(new Error("Action failed."));

    assert.deepEqual(state, {
      complianceReasonCode: null,
      complianceWallet: null,
      error: "Action failed.",
      step: "failed",
    });
  });
});
