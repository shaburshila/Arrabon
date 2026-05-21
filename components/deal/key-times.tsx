"use client";

import type { DealReadModel } from "@/lib/api/deals";
import { ActionPanel } from "@/components/shared/action-panel";
import { LifecycleTimeline } from "@/components/deal/lifecycle-timeline";
import { StatusPill } from "@/components/shared/status-pill";
import { getDealDisplayConfig, toneFromStatus } from "@/lib/ui/deal-status";

interface KeyTimesProps {
  deal: DealReadModel;
  isSeller: boolean;
}

export function KeyTimes({ deal }: KeyTimesProps) {
  const badge = getDealDisplayConfig({ resolution_type: deal.resolution_type, status: deal.status });
  const tone = toneFromStatus(deal.status);
  return (
    <ActionPanel as="section" style={{ padding: 28 }}>
      <div style={headRowStyle}>
        <p className="section-label section-label--no-rule">Lifecycle</p>
        <StatusPill label={badge.label} size="md" tone={tone} />
      </div>
      <LifecycleTimeline deal={deal} />
    </ActionPanel>
  );
}

const headRowStyle = {
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 20,
};
