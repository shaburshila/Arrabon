import type { CSSProperties } from "react";

import type { DealRiskStatus } from "@/lib/db/types";
import { StatusPill } from "@/components/shared/status-pill";

const riskTone: Record<DealRiskStatus, "danger" | "success" | "warning"> = {
  Blocked: "danger",
  Clear: "success",
  Review: "warning",
};

export function RiskBadge({
  riskStatus,
  size = "sm",
  style,
}: {
  riskStatus: DealRiskStatus;
  size?: "md" | "sm";
  style?: CSSProperties;
}) {
  return (
    <StatusPill
      label={riskStatus}
      size={size}
      style={style}
      tone={riskTone[riskStatus]}
    />
  );
}
