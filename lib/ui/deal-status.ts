import type { DealStatus } from "@/lib/api/deals";

export interface DealStatusConfig {
  bg: string;
  color: string;
  label: string;
}

export const DEAL_STATUS_CONFIG: Record<DealStatus, DealStatusConfig> = {
  ConfirmPending: {
    bg: "var(--warning-muted)",
    color: "var(--warning)",
    label: "Awaiting confirmation",
  },
  Disputed: {
    bg: "var(--warning-muted)",
    color: "var(--warning)",
    label: "Disputed",
  },
  Funded: {
    bg: "var(--accent-muted)",
    color: "var(--accent)",
    label: "Funded",
  },
  Refunded: {
    bg: "var(--muted-bg)",
    color: "var(--muted)",
    label: "Refunded",
  },
  Released: {
    bg: "var(--success-muted)",
    color: "var(--success)",
    label: "Released",
  },
};
