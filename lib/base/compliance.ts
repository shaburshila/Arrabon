import { getAddress, type Address } from "viem";

export function getComplianceWalletAddress(body: unknown): Address | null {
  if (!body || typeof body !== "object" || !("wallet_address" in body)) {
    return null;
  }

  const walletAddress = (body as { wallet_address?: unknown }).wallet_address;

  if (typeof walletAddress !== "string") {
    return null;
  }

  try {
    return getAddress(walletAddress) as Address;
  } catch {
    return null;
  }
}
