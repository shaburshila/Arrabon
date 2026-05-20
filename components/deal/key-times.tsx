"use client";

import type { DealReadModel } from "@/lib/api/deals";
import { ActionPanel } from "@/components/shared/action-panel";
import { LifecycleTimeline } from "@/components/deal/lifecycle-timeline";

interface KeyTimesProps {
  deal: DealReadModel;
  isSeller: boolean;
}

export function KeyTimes({ deal }: KeyTimesProps) {
  return (
    <ActionPanel as="section" style={{ padding: 20 }}>
      <p style={sectionLabelStyle}>Lifecycle</p>
      <LifecycleTimeline deal={deal} />
    </ActionPanel>
  );
}

const sectionLabelStyle = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  margin: "0 0 20px",
  textTransform: "uppercase" as const,
};
