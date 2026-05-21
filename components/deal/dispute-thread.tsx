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
          <p className="eyebrow">Dispute discussion</p>
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

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn
              disabled={body.trim().length === 0}
              loading={submitting}
              onClick={submit}
              size="md"
              variant="primary"
            >
              Post message
            </Btn>
          </div>
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
  const isYou = currentWallet?.toLowerCase() === message.author_wallet.toLowerCase();
  const monogram = ROLE_LABELS[message.author_role][0];

  return (
    <article style={messageRowStyle(compact)}>
      <span style={avatarStyle(isYou)} aria-hidden>
        {monogram}
      </span>
      <div style={messageContentStyle}>
        <div style={messageMetaStyle}>
          <span style={authorNameStyle}>
            {ROLE_LABELS[message.author_role]}{isYou && " (you)"}
          </span>
          <span style={timestampStyle}>· {formatDate(message.created_at)}</span>
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
      </div>
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
  color: "var(--ink)",
  fontSize: 13,
  fontWeight: 600,
  minHeight: 34,
  padding: "0 10px",
};

function messagesStyle(compact: boolean) {
  return {
    display: "flex",
    flexDirection: "column" as const,
    gap: compact ? 12 : 16,
  };
}

function messageRowStyle(compact: boolean) {
  return {
    alignItems: "flex-start",
    display: "flex",
    gap: compact ? 10 : 12,
  };
}

function avatarStyle(isYou: boolean) {
  return {
    alignItems: "center",
    background: isYou ? "var(--gold-soft)" : "var(--surface-2)",
    border: isYou ? "1px solid color-mix(in srgb, var(--gold) 40%, transparent)" : "1px solid var(--border)",
    borderRadius: "50%",
    color: isYou ? "var(--gold-deep)" : "var(--muted)",
    display: "inline-grid",
    flexShrink: 0,
    fontFamily: "var(--font-serif)",
    fontSize: 14,
    fontWeight: 600,
    height: 32,
    placeItems: "center",
    width: 32,
  } as const;
}

const messageContentStyle = {
  flex: 1,
  minWidth: 0,
};

const messageMetaStyle = {
  alignItems: "baseline",
  display: "flex",
  gap: 6,
  marginBottom: 4,
};

const authorNameStyle = {
  color: "var(--ink)",
  fontSize: 13,
  fontWeight: 600,
};

const timestampStyle = {
  color: "var(--muted)",
  fontSize: 12,
};

const bodyStyle = {
  color: "var(--ink-soft)",
  fontSize: 14,
  lineHeight: 1.5,
  margin: 0,
  overflowWrap: "anywhere" as const,
  whiteSpace: "pre-wrap" as const,
};

const evidenceLinkStyle = {
  color: "var(--gold)",
  display: "inline-block",
  fontSize: 13,
  fontWeight: 600,
  marginTop: 4,
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
  color: "var(--ink)",
  display: "flex",
  flexDirection: "column" as const,
  fontSize: 13,
  fontWeight: 600,
  gap: 6,
};

const textareaStyle = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--ink)",
  font: "inherit",
  minHeight: 110,
  padding: 12,
  resize: "vertical" as const,
};

const inputStyle = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--ink)",
  font: "inherit",
  minHeight: 42,
  padding: "0 12px",
};
