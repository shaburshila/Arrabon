import type { Hex } from "viem";

interface ConsumedLinkRecoveryInput {
  dealId: string | null;
  status: "Consumed" | string | null | undefined;
  txHash: Hex | null;
}

export function shouldShowConsumedLinkPrivateNotice(
  input: ConsumedLinkRecoveryInput,
): boolean {
  return input.status === "Consumed" && input.txHash === null;
}
