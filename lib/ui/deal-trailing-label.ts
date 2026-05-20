import type { DealStatus } from "@/lib/api/deals";

export function dealTrailingLabel(status: DealStatus): string {
  switch (status) {
    case "Funded":         return "Awaiting consultation";
    case "ConfirmPending": return "Awaiting buyer confirm";
    case "Released":       return "Settled";
    case "Disputed":       return "In review";
    case "Refunded":       return "Refunded";
    default:               return "";
  }
}
