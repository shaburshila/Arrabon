import type { DealResolutionType, DealStatus } from "@/lib/api/deals";
import type { IconName } from "@/components/icons";

export interface DealStatusConfig {
  bg: string;
  color: string;
  icon: IconName;
  label: string;
}

export const DEAL_STATUS_CONFIG: Record<DealStatus, DealStatusConfig> = {
  ConfirmPending: {
    bg: "var(--amber-bg)",
    color: "var(--amber)",
    icon: "utility-hourglass",
    label: "Confirm Pending",
  },
  Disputed: {
    bg: "var(--red-bg)",
    color: "var(--red)",
    icon: "utility-alert",
    label: "Disputed",
  },
  Funded: {
    bg: "var(--blue-bg)",
    color: "var(--blue)",
    icon: "utility-lock",
    label: "Funded",
  },
  Refunded: {
    bg: "var(--purple-bg)",
    color: "var(--purple)",
    icon: "status-refunded",
    label: "Refunded",
  },
  Released: {
    bg: "var(--green-bg)",
    color: "var(--green)",
    icon: "utility-check",
    label: "Released",
  },
};

export type StatusTone = "blue" | "amber" | "green" | "red" | "purple" | "gray";

export function toneFromStatus(status: DealStatus): StatusTone {
  switch (status) {
    case "Funded":
      return "blue";
    case "ConfirmPending":
      return "amber";
    case "Released":
      return "green";
    case "Disputed":
      return "red";
    case "Refunded":
      return "purple";
    default:
      return "gray";
  }
}

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
