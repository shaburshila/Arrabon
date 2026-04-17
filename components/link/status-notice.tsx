"use client";

// Shows a clear notice for terminal / unavailable link states.

import { Notice } from "@/components/shared/notice";

type NoticeType = "cancelled" | "consumed_indexing" | "error" | "expired" | "not_found";

interface StatusNoticeProps {
  type: NoticeType;
  message?: string;
}

const config: Record<NoticeType, { body: string; title: string; tone: "danger" | "info" | "muted" | "warning" }> = {
  cancelled: {
    body: "This consultation link has been cancelled by the seller.",
    title: "Link cancelled",
    tone: "warning",
  },
  consumed_indexing: {
    body: "Funding was confirmed on chain. Waiting for the deal to be indexed.",
    title: "Deal indexing...",
    tone: "info",
  },
  error: {
    body: "Failed to load this link. Please refresh and try again.",
    title: "Something went wrong",
    tone: "danger",
  },
  expired: {
    body: "This consultation link has passed its booking deadline.",
    title: "Link expired",
    tone: "warning",
  },
  not_found: {
    body: "This consultation link does not exist or has been removed.",
    title: "Link not found",
    tone: "muted",
  },
};

export function StatusNotice({ type, message }: StatusNoticeProps) {
  const c = config[type];

  return (
    <Notice
      message={message || c.body}
      title={c.title}
      tone={c.tone}
    />
  );
}
