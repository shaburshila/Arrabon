import type { DealReadModel } from "@/lib/api/deals";
import { DEAL_LIFECYCLE, DISPUTE_LIFECYCLE, lifecycleStateOf } from "@/lib/ui/deal-lifecycle";
import { formatDate } from "@/lib/ui/date";

// Some timestamp fields exist on MyDeal but not on DealReadModel — treat as optional.
type DealWithOptionalDates = DealReadModel & {
  created_at?: string | null;
  funded_at?: string | null;
  released_at?: string | null;
};

const allSteps = [...DEAL_LIFECYCLE, ...DISPUTE_LIFECYCLE];

function stepDate(key: string, deal: DealWithOptionalDates): string | null {
  switch (key) {
    case "Open":          return deal.created_at ?? null;
    case "Funded":        return deal.funded_at ?? null;
    case "ConfirmPending": return deal.completed_at ?? null;
    case "Released":      return deal.released_at ?? deal.resolved_at ?? null;
    case "Disputed":
    case "Refunded":      return deal.resolved_at ?? null;
    default:              return null;
  }
}

export function LifecycleTimeline({ deal }: { deal: DealWithOptionalDates }) {
  const lifecycle = lifecycleStateOf(deal.status);
  const last = lifecycle.length - 1;

  return (
    <div className="timeline">
      {lifecycle.map((step, i) => {
        const data = allSteps.find((s) => s.key === step.key);
        const date = stepDate(step.key, deal);

        return (
          <div key={step.key} className="timeline__row">
            <div style={{ display: "grid", gridTemplateRows: "20px 1fr" }}>
              <div className={`timeline__node timeline__node--${step.state}`} />
              {i < last && (
                <div
                  className={`timeline__line${step.state === "done" ? " timeline__line--done" : ""}`}
                />
              )}
            </div>
            <div className="timeline__content">
              <p className={`timeline__title${step.state === "idle" ? " timeline__title--idle" : ""}`}>
                {data?.title ?? step.key}
              </p>
              {data?.desc && step.state !== "idle" && (
                <p className="timeline__desc">{data.desc}</p>
              )}
              {step.state !== "idle" && date && (
                <p className="timeline__meta">{formatDate(date)}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
