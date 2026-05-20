import type { DealStatus } from "@/lib/api/deals";

export const DEAL_LIFECYCLE = [
  {
    key: "Open",
    title: "Link created",
    desc: "Seller created the consultation link.",
  },
  {
    key: "Funded",
    title: "Escrow funded",
    desc: "Buyer locked USDC onchain. Meeting link revealed.",
  },
  {
    key: "ConfirmPending",
    title: "Seller confirmed",
    desc: "Consultation marked complete by seller. Buyer to release.",
  },
  {
    key: "Released",
    title: "Funds released",
    desc: "Payment released to seller. Deal closed.",
  },
] as const;

export const DISPUTE_LIFECYCLE = [
  {
    key: "Disputed",
    title: "Dispute opened",
    desc: "Awaiting admin review and resolution.",
  },
  {
    key: "Refunded",
    title: "Refund issued",
    desc: "Funds returned to buyer per admin decision.",
  },
] as const;

type StepState = "current" | "done" | "idle";

export interface LifecycleStep {
  key: string;
  state: StepState;
}

export function lifecycleStateOf(status: DealStatus): LifecycleStep[] {
  if (status === "Disputed" || status === "Refunded") {
    const seq: string[] = [
      "Open",
      "Funded",
      "ConfirmPending",
      "Disputed",
      ...(status === "Refunded" ? ["Refunded"] : []),
    ];
    const cur = seq.indexOf(status);
    return seq.map((k, i) => ({
      key: k,
      state: i < cur ? "done" : i === cur ? "current" : "idle",
    }));
  }

  const happyPath = ["Open", "Funded", "ConfirmPending", "Released"];
  const cur = happyPath.indexOf(status);
  return happyPath.map((k, i) => ({
    key: k,
    state: i < cur ? "done" : i === cur ? "current" : "idle",
  }));
}
