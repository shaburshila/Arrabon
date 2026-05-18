import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  calculateFee,
  calculateTotalWithFee,
  formatUsdcAmount,
  parseUsdcAmount,
} from "@/lib/fees/calculate-fee";

describe("calculateFee", () => {
  test("applies the minimum fee floor", () => {
    assert.equal(calculateFee(parseUsdcAmount("10")), parseUsdcAmount("1.5"));
    assert.equal(calculateFee(parseUsdcAmount("50")), parseUsdcAmount("1.5"));
  });

  test("applies percentage fee for mid-range prices", () => {
    assert.equal(calculateFee(parseUsdcAmount("75")), parseUsdcAmount("2.25"));
    assert.equal(calculateFee(parseUsdcAmount("100")), parseUsdcAmount("3"));
  });

  test("applies the maximum fee cap", () => {
    assert.equal(calculateFee(parseUsdcAmount("1000")), parseUsdcAmount("30"));
    assert.equal(calculateFee(parseUsdcAmount("100000")), parseUsdcAmount("30"));
  });

  test("computes totals with fee", () => {
    assert.equal(calculateTotalWithFee(parseUsdcAmount("100")), parseUsdcAmount("103"));
  });
});

describe("formatUsdcAmount", () => {
  test("formats amounts with at least two decimals", () => {
    assert.equal(formatUsdcAmount(parseUsdcAmount("1.5")), "1.50");
    assert.equal(formatUsdcAmount(parseUsdcAmount("2.25")), "2.25");
    assert.equal(formatUsdcAmount(parseUsdcAmount("100")), "100.00");
  });
});
