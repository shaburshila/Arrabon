import type { CSSProperties } from "react";

import { Icon } from "@/components/icons";
import type { DealRiskStatus } from "@/lib/db/types";

const riskConfig: Record<
  DealRiskStatus,
  { color: string; icon: "utility-shield-check" | "utility-alert" | "utility-secure-subtle"; label: string; pillClass: string }
> = {
  Clear:   { color: "var(--green)",  icon: "utility-shield-check",   label: "Clear",   pillClass: "pill pill--green" },
  Review:  { color: "var(--amber)",  icon: "utility-alert",          label: "Review",  pillClass: "pill pill--amber" },
  Blocked: { color: "var(--red)",    icon: "utility-secure-subtle",  label: "Blocked", pillClass: "pill pill--red" },
};

export function RiskBadge({
  riskStatus,
  style,
}: {
  riskStatus: DealRiskStatus;
  size?: "md" | "sm";
  style?: CSSProperties;
}) {
  const cfg = riskConfig[riskStatus];
  return (
    <span className={cfg.pillClass} style={style}>
      <Icon name={cfg.icon} size={12} style={{ color: cfg.color }} />
      {cfg.label}
    </span>
  );
}
