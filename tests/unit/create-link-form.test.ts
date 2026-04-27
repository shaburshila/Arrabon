import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "@/lib/api/auth";
import {
  createInitialCreateLinkComplianceState,
  getCreateLinkErrorState,
} from "@/components/link/create-link-form";

describe("CreateLinkForm helpers", () => {
  test("creates an empty compliance state", () => {
    assert.deepEqual(createInitialCreateLinkComplianceState(), {
      isBlocked: false,
      complianceReasonCode: null,
      complianceWallet: null,
    });
  });

  test("maps non-retryable compliance blocks to notice state", () => {
    const result = getCreateLinkErrorState(
      new ApiError(403, {
        code: "COMPLIANCE_BLOCKED",
        error: "Wallet blocked by compliance screening.",
        reason_code: "LOCAL_DENYLIST",
        wallet_address: "0x00000000000000000000000000000000000000AA",
      }),
    );

    assert.deepEqual(result, {
      compliance: {
        isBlocked: true,
        complianceReasonCode: "LOCAL_DENYLIST",
        complianceWallet: "0x00000000000000000000000000000000000000AA",
      },
      error: null,
    });
  });

  test("keeps provider unavailable on the standard error branch", () => {
    const result = getCreateLinkErrorState(
      new ApiError(403, {
        code: "COMPLIANCE_BLOCKED",
        error: "Compliance screening is temporarily unavailable.",
        reason_code: "PROVIDER_UNAVAILABLE",
        wallet_address: "0x00000000000000000000000000000000000000AA",
      }),
    );

    assert.deepEqual(result, {
      compliance: {
        isBlocked: false,
        complianceReasonCode: null,
        complianceWallet: null,
      },
      error: "Compliance screening is temporarily unavailable.",
    });
  });

  test("keeps notice state even when wallet address is missing", () => {
    const result = getCreateLinkErrorState(
      new ApiError(403, {
        code: "COMPLIANCE_BLOCKED",
        error: "Wallet blocked by compliance screening.",
        reason_code: null,
      }),
    );

    assert.deepEqual(result, {
      compliance: {
        isBlocked: true,
        complianceReasonCode: null,
        complianceWallet: null,
      },
      error: null,
    });
  });

  test("maps generic api errors to standard error state", () => {
    const result = getCreateLinkErrorState(
      new ApiError(400, {
        error: "Invalid input.",
      }),
    );

    assert.deepEqual(result, {
      compliance: {
        isBlocked: false,
        complianceReasonCode: null,
        complianceWallet: null,
      },
      error: "Invalid input.",
    });
  });
});
