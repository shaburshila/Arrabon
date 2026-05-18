import { formatUnits, parseUnits } from "viem";

export const USDC_DECIMALS = 6;
export const MIN_FEE_AMOUNT = BigInt(1_500_000);
export const MAX_FEE_AMOUNT = BigInt(30_000_000);
export const FEE_NUMERATOR = BigInt(300);
export const FEE_DENOMINATOR = BigInt(10_000);

export function parseUsdcAmount(amount: string): bigint {
  return parseUnits(amount, USDC_DECIMALS);
}

export function formatUsdcAmount(amount: bigint): string {
  const [whole, fraction = ""] = formatUnits(amount, USDC_DECIMALS).split(".");
  const trimmedFraction = fraction.replace(/0+$/, "");

  if (trimmedFraction.length === 0) {
    return `${whole}.00`;
  }

  if (trimmedFraction.length === 1) {
    return `${whole}.${trimmedFraction}0`;
  }

  return `${whole}.${trimmedFraction}`;
}

export function calculateFee(priceAmount: bigint): bigint {
  const percentFee = (priceAmount * FEE_NUMERATOR) / FEE_DENOMINATOR;

  if (percentFee < MIN_FEE_AMOUNT) {
    return MIN_FEE_AMOUNT;
  }

  if (percentFee > MAX_FEE_AMOUNT) {
    return MAX_FEE_AMOUNT;
  }

  return percentFee;
}

export function calculateTotalWithFee(priceAmount: bigint): bigint {
  return priceAmount + calculateFee(priceAmount);
}
