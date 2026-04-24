"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { DealStatus } from "@/lib/api/deals";
import {
  createDisputeMessage,
  fetchDisputeMessages,
  type DisputeMessage,
  type DisputeMessageAuthorRole,
} from "@/lib/api/dispute-messages";
import { ApiError } from "@/lib/api/auth";
import { truncateAddress } from "@/lib/ui/address";
import { formatDate } from "@/lib/ui/date";
import { ActionPanel } from "@/components/shared/action-panel";
import { Btn } from "@/components/shared/btn";
import { Notice } from "@/components/shared/notice";
import { StatusPill } from "@/components/shared/status-pill";

interface DisputeThreadProps {
  canPost: boolean;
  canView: boolean;
  compact?: boolean;
  currentWallet: string | null;
  dealId: string;
  dealStatus: DealStatus;
  embedded?: boolean;
}

const ROLE_LABELS: Record<DisputeMessageAuthorRole, string> = {
  admin: "Admin",
  buyer: "Buyer",
  seller: "Seller",
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return error instanceof Error ? error.message : fallback;
}

export function DisputeThread({
  canPost,
  canView,
  compact = false,
  currentWallet,
  dealId,
  dealStatus,
  embedded = false,
}: DisputeThreadProps) {
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const readOnly = dealStatus !== "Disputed";
  const showForm = canPost && !readOnly;
  const notice = useMemo(() => {
    if (readOnly) {
      return "This dispute is resolved. The discussion is read-only.";
    }

    return "Only share evidence you are comfortable showing to the other party and the admin.";
  }, [readOnly]);

  const loadMessages = useCallback(async () => {
    if (!canView) {
      setMessages([]);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      setMessages(await fetchDisputeMessages(dealId));
    } catch (error) {
      setLoadError(getErrorMessage(error, "Failed to load dispute messages."));
    } finally {
      setLoading(false);
    }
  }, [canView, dealId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const submit = useCallback(async () => {
    if (!showForm || submitting) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const created = await createDisputeMessage(dealId, {
        body,
        evidence_url: evidenceUrl,
      });

      setMessages((prev) => [...prev, created]);
      setBody("");
      setEvidenceUrl("");
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Failed to add dispute message."));
    } finally {
      setSubmitting(false);
    }
  }, [body, dealId, evidenceUrl, showForm, submitting]);

  if (!canView) {
    return null;
  }

  const content = (
    <>
      <div style={headerStyle(compact)}>
        <div>
          <p style={eyebrowStyle}>Dispute discussion</p>
          <h2 style={titleStyle(compact)}>Messages and evidence</h2>
        </div>
        <button
          disabled={loading}
          onClick={loadMessages}
          style={refreshButtonStyle}
          type="button"
        >
          Refresh
        </button>
      </div>

      <Notice message={notice} tone={readOnly ? "muted" : "info"} />

      {loading && (
        <Notice message="Loading messages..." tone="muted" />
      )}

      {loadError && (
        <Notice message={loadError} tone="danger" />
      )}

      {!loading && !loadError && messages.length === 0 && (
        <Notice message="No dispute messages yet." tone="muted" />
      )}

      {messages.length > 0 && (
        <div style={messagesStyle(compact)}>
          {messages.map((message) => (
            <MessageCard
              compact={compact}
              currentWallet={currentWallet}
              key={message.id}
              message={message}
            />
          ))}
        </div>
      )}

      {showForm && (
        <div style={formStyle(compact)}>
          <label style={labelStyle}>
            Message
            <textarea
              maxLength={3000}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write your position or response."
              style={textareaStyle}
              value={body}
            />
          </label>

          <label style={labelStyle}>
            Evidence link, optional
            <input
              onChange={(event) => setEvidenceUrl(event.target.value)}
              placeholder="https://..."
              style={inputStyle}
              type="url"
              value={evidenceUrl}
            />
          </label>

          {submitError && (
            <Notice message={submitError} tone="danger" />
          )}

          <Btn
            disabled={body.trim().length === 0}
            loading={submitting}
            onClick={submit}
            variant="primary"
          >
            Add message
          </Btn>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div style={cardStyle(compact, embedded)}>{content}</div>;
  }

  return (
    <ActionPanel as="section" style={cardStyle(compact, embedded)}>
      {content}
    </ActionPanel>
  );
}

function MessageCard({
  compact,
  currentWallet,
  message,
}: {
  compact: boolean;
  currentWallet: string | null;
  message: DisputeMessage;
}) {
  const isCurrentWallet =
    currentWallet?.toLowerCase() === message.author_wallet.toLowerCase();

  return (
    <article style={messageStyle(isCurrentWallet, compact)}>
      <div style={messageMetaStyle}>
        <StatusPill
          label={ROLE_LABELS[message.author_role]}
          tone={roleTone(message.author_role)}
        />
        <span>{truncateAddress(message.author_wallet)}</span>
        <span>{formatDate(message.created_at)}</span>
      </div>
      <p style={bodyStyle}>{message.body}</p>
      {message.evidence_url && (
        <a
          href={message.evidence_url}
          rel="noreferrer"
          style={evidenceLinkStyle}
          target="_blank"
        >
          Open evidence link
        </a>
      )}
    </article>
  );
}

function cardStyle(compact: boolean, embedded: boolean) {
  return {
    borderTop: embedded ? "1px solid var(--border)" : undefined,
    display: "flex",
    flexDirection: "column" as const,
    gap: compact ? 10 : 14,
    padding: embedded ? "14px 0 0" : compact ? 14 : 20,
  };
}

function headerStyle(compact: boolean) {
  return {
    alignItems: "flex-start",
    display: "flex",
    gap: compact ? 8 : 12,
    justifyContent: "space-between",
  };
}

const eyebrowStyle = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  margin: "0 0 6px",
  textTransform: "uppercase" as const,
};

function titleStyle(compact: boolean) {
  return {
    fontSize: compact ? 16 : 18,
    lineHeight: 1.3,
    margin: 0,
  };
}

const refreshButtonStyle = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: 13,
  fontWeight: 700,
  minHeight: 34,
  padding: "0 10px",
};

function messagesStyle(compact: boolean) {
  return {
    display: "flex",
    flexDirection: "column" as const,
    gap: compact ? 8 : 10,
  };
}

function messageStyle(isCurrentWallet: boolean, compact: boolean) {
  return {
    background: isCurrentWallet ? "var(--accent-muted)" : "var(--surface-raised)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    display: "flex",
    flexDirection: "column" as const,
    gap: compact ? 6 : 8,
    padding: compact ? 10 : 12,
  } as const;
}

const messageMetaStyle = {
  alignItems: "center",
  color: "var(--muted)",
  display: "flex",
  flexWrap: "wrap" as const,
  fontSize: 12,
  gap: 8,
};

function roleTone(role: DisputeMessageAuthorRole): "accent" | "danger" | "success" {
  if (role === "admin") return "danger";
  if (role === "buyer") return "accent";
  return "success";
}

const bodyStyle = {
  fontSize: 14,
  lineHeight: 1.5,
  margin: 0,
  overflowWrap: "anywhere" as const,
  whiteSpace: "pre-wrap" as const,
};

const evidenceLinkStyle = {
  alignSelf: "flex-start",
  color: "var(--accent)",
  fontSize: 13,
  fontWeight: 700,
};

function formStyle(compact: boolean) {
  return {
    borderTop: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column" as const,
    gap: compact ? 10 : 12,
    paddingTop: compact ? 12 : 14,
  };
}

const labelStyle = {
  color: "var(--foreground)",
  display: "flex",
  flexDirection: "column" as const,
  fontSize: 13,
  fontWeight: 700,
  gap: 6,
};

const textareaStyle = {
  background: "var(--surface-raised)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  font: "inherit",
  minHeight: 110,
  padding: 12,
  resize: "vertical" as const,
};

const inputStyle = {
  background: "var(--surface-raised)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  font: "inherit",
  minHeight: 42,
  padding: "0 12px",
};
