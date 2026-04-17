import type { DealResolutionType, DealStatus } from "@/lib/api/deals";

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
    bg: "var(--danger-muted)",
    color: "var(--danger)",
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

export const DEAL_RESOLUTION_LABELS: Record<DealResolutionType, string> = {
  admin_refund: "Refunded after dispute",
  admin_release: "Released after dispute",
  auto_release: "Auto-released",
  buyer_confirmed: "Released by buyer",
};

export function getDealDisplayConfig(input: {
  resolution_type: DealResolutionType | null;
  status: DealStatus;
}): DealStatusConfig {
  const baseConfig = DEAL_STATUS_CONFIG[input.status];

  if (!input.resolution_type) {
    return baseConfig;
  }

  return {
    ...baseConfig,
    label: DEAL_RESOLUTION_LABELS[input.resolution_type],
  };
}
