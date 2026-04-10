import type { ConsultationLinkRow, ConsultationLinkStatus } from "@/lib/db/types";

export function resolveEffectiveConsultationLinkStatus(
  row: ConsultationLinkRow,
  now: Date,
): ConsultationLinkStatus {
  if (row.status === "Open" && new Date(row.expires_at).getTime() <= now.getTime()) {
    return "Expired";
  }

  return row.status;
}
