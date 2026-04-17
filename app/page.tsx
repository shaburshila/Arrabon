"use client";

// / — Seller entry surface.
// Allows seller to connect wallet, sign in, and create a consultation link.
// POST /api/links is a private SIWE endpoint → wallet connect + SIWE required.

import { useState } from "react";

import Link from "next/link";

import { useWalletSession } from "@/hooks/use-wallet-session";
import { createLink, type CreateLinkInput } from "@/lib/api/links";
import { ApiError } from "@/lib/api/auth";
import { WalletSessionCard } from "@/components/shared/wallet-session-card";
import { Btn } from "@/components/shared/btn";
import { CopyBtn } from "@/components/shared/copy-btn";

const DEFAULT_EXPIRATION_OFFSET_MS = 5 * 60 * 1000;

interface FormState {
  title: string;
  description: string;
  price_usdc: string;
  scheduled_date: string;
  scheduled_time: string;
  expires_date: string;
  expires_time: string;
  timezone: string;
  duration_minutes: string;
  meeting_url: string;
}

const emptyForm: FormState = {
  description: "",
  duration_minutes: "60",
  expires_date: "",
  expires_time: "",
  meeting_url: "",
  price_usdc: "",
  scheduled_date: "",
  scheduled_time: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  title: "",
};

export default function HomePage() {
  const session = useWalletSession();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expirationAutoFilled, setExpirationAutoFilled] = useState(true);

  const canCreate = session.isConnected && session.isCorrectChain && session.siweStatus === "authenticated";

  function splitLocalDateTime(value: Date): { date: string; time: string } {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    const hours = String(value.getHours()).padStart(2, "0");
    const minutes = String(value.getMinutes()).padStart(2, "0");

    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}`,
    };
  }

  function getDefaultExpiration(date: string, time: string) {
    if (!date || !time) {
      return null;
    }

    const scheduledAt = new Date(`${date}T${time}`);

    if (Number.isNaN(scheduledAt.getTime())) {
      return null;
    }

    return splitLocalDateTime(
      new Date(scheduledAt.getTime() - DEFAULT_EXPIRATION_OFFSET_MS),
    );
  }

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (
        expirationAutoFilled &&
        (field === "scheduled_date" || field === "scheduled_time")
      ) {
        const defaultExpiration = getDefaultExpiration(
          field === "scheduled_date" ? value : next.scheduled_date,
          field === "scheduled_time" ? value : next.scheduled_time,
        );

        if (defaultExpiration) {
          next.expires_date = defaultExpiration.date;
          next.expires_time = defaultExpiration.time;
        }
      }

      return next;
    });
  }

  function setExpirationField(field: "expires_date" | "expires_time", value: string) {
    setExpirationAutoFilled(false);
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      if (!form.scheduled_date || !form.scheduled_time) {
        throw new Error("Scheduled date and time are required.");
      }

      if (!form.expires_date || !form.expires_time) {
        throw new Error("Expiration date and time are required.");
      }

      const scheduledAt = new Date(`${form.scheduled_date}T${form.scheduled_time}`);
      const expiresAt = new Date(`${form.expires_date}T${form.expires_time}`);

      if (Number.isNaN(scheduledAt.getTime()) || Number.isNaN(expiresAt.getTime())) {
        throw new Error("Scheduled and expiration times must be valid.");
      }

      const now = new Date();

      if (scheduledAt.getTime() <= now.getTime()) {
        throw new Error("Scheduled time must be later than the current time.");
      }

      if (expiresAt.getTime() <= now.getTime()) {
        throw new Error("Expiration must be later than the current time.");
      }

      if (expiresAt.getTime() > scheduledAt.getTime()) {
        throw new Error("Expiration must be at or before the scheduled time.");
      }

      const input: CreateLinkInput = {
        description: form.description,
        duration_minutes: parseInt(form.duration_minutes, 10),
        expires_at: expiresAt.toISOString(),
        meeting_url: form.meeting_url,
        price_usdc: form.price_usdc,
        scheduled_at: scheduledAt.toISOString(),
        timezone: form.timezone,
        title: form.title,
      };

      const result = await createLink(input);
      const fullUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}${result.share_url}`
          : result.share_url;
      setShareUrl(fullUrl);
      setForm(emptyForm);
      setExpirationAutoFilled(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to create link.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={mainStyle}>
      <div style={pageStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={logoStyle}>Base Consult Link</span>
            <div style={{ display: "flex", gap: 12 }}>
              <Link href="/my-links" style={{ color: "var(--accent)", fontSize: 13, fontWeight: 500 }}>
                My links
              </Link>
              <Link href="/my-deals" style={{ color: "var(--accent)", fontSize: 13, fontWeight: 500 }}>
                My deals →
              </Link>
            </div>
          </div>
          <h1 style={h1Style}>Create consultation link</h1>
          <p style={subtitleStyle}>
            Set up a single-use consultation slot. Your client pays USDC into escrow when they book.
          </p>
        </div>

        {/* Wallet + session */}
        <WalletSessionCard session={session} />

        {/* Success — show share URL */}
        {shareUrl && (
          <div
            style={{
              background: "var(--success-muted)",
              border: "1px solid var(--success)",
              borderRadius: "var(--radius)",
              padding: 20,
            }}
          >
            <p
              style={{
                color: "var(--success)",
                fontSize: 13,
                fontWeight: 600,
                margin: "0 0 10px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Link created
            </p>
            <p
              style={{
                color: "var(--foreground)",
                fontSize: 14,
                margin: "0 0 12px",
                wordBreak: "break-all",
              }}
            >
              {shareUrl}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <CopyBtn text={shareUrl} label="Copy link" />
              <Btn
                onClick={() => setShareUrl(null)}
                variant="ghost"
              >
                Create another
              </Btn>
            </div>
          </div>
        )}

        {/* Create form */}
        {!shareUrl && (
          <form
            onSubmit={handleSubmit}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow-card)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              padding: 20,
            }}
          >
            <Field
              id="title"
              label="Title"
              required
              type="text"
              value={form.title}
              onChange={(v) => setField("title", v)}
              placeholder="e.g. 30-min Strategy Call"
            />

            <Field
              id="description"
              label="Description"
              type="textarea"
              value={form.description}
              onChange={(v) => setField("description", v)}
              placeholder="What will you cover in this consultation?"
            />

            <Field
              id="price_usdc"
              label="Price (USDC)"
              required
              type="number"
              value={form.price_usdc}
              onChange={(v) => setField("price_usdc", v)}
              placeholder="100"
              min="10"
              max="1000"
            />

            <ScheduledDateTimeField
              idPrefix="scheduled"
              label="Scheduled date & time"
              dateValue={form.scheduled_date}
              timeValue={form.scheduled_time}
              onDateChange={(v) => setField("scheduled_date", v)}
              onTimeChange={(v) => setField("scheduled_time", v)}
            />

            <ScheduledDateTimeField
              idPrefix="expires"
              label="Link expires at"
              dateValue={form.expires_date}
              timeValue={form.expires_time}
              onDateChange={(v) => setExpirationField("expires_date", v)}
              onTimeChange={(v) => setExpirationField("expires_time", v)}
            />

            <Field
              id="timezone"
              label="Timezone (display only)"
              required
              type="text"
              value={form.timezone}
              onChange={(v) => setField("timezone", v)}
              placeholder="Europe/Berlin"
            />

            <Field
              id="duration_minutes"
              label="Duration (min)"
              required
              type="number"
              value={form.duration_minutes}
              onChange={(v) => setField("duration_minutes", v)}
              min="1"
            />

            <Field
              id="meeting_url"
              label="Meeting URL (kept secret until funded)"
              required
              type="url"
              value={form.meeting_url}
              onChange={(v) => setField("meeting_url", v)}
              placeholder="https://meet.example.com/your-room"
            />

            <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
              Link is single-use and expires at the selected date and time.
            </p>

            {error && (
              <div
                style={{
                  background: "var(--danger-muted)",
                  border: "1px solid var(--danger)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--danger)",
                  fontSize: 13,
                  padding: "10px 14px",
                }}
              >
                {error}
              </div>
            )}

            <Btn
              disabled={!canCreate}
              disabledReason={
                !session.isConnected
                  ? "Connect wallet first"
                  : !session.isCorrectChain
                    ? "Switch to the correct network"
                    : session.siweStatus !== "authenticated"
                      ? "Sign in with Ethereum first"
                      : undefined
              }
              fullWidth
              loading={submitting}
              type="submit"
            >
              Create consultation link
            </Btn>
          </form>
        )}
      </div>
    </main>
  );
}

// Simple form field component
function Field({
  id,
  label,
  max,
  min,
  onChange,
  placeholder,
  required,
  type,
  value,
}: {
  id: string;
  label: string;
  max?: string;
  min?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type: "number" | "text" | "textarea" | "url";
  value: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={id}
        style={fieldLabelStyle}
      >
        {label}
        {required && <span style={{ color: "var(--danger)", marginLeft: 2 }}>*</span>}
      </label>
      {type === "textarea" ? (
        <textarea
          id={id}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          rows={3}
          style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
          value={value}
        />
      ) : (
        <input
          id={id}
          max={max}
          min={min}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          style={inputStyle}
          type={type}
          value={value}
        />
      )}
    </div>
  );
}

function ScheduledDateTimeField({
  dateValue,
  idPrefix,
  label,
  onDateChange,
  onTimeChange,
  timeValue,
}: {
  dateValue: string;
  idPrefix: string;
  label: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  timeValue: string;
}) {
  const dateId = `${idPrefix}_date`;
  const timeId = `${idPrefix}_time`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label htmlFor={dateId} style={fieldLabelStyle}>
        {label}
        <span style={{ color: "var(--danger)", marginLeft: 2 }}>*</span>
      </label>
      <div style={scheduledDateTimeRowStyle}>
        <input
          id={dateId}
          onChange={(e) => onDateChange(e.target.value)}
          required
          style={scheduledDateInputStyle}
          type="date"
          value={dateValue}
        />
        <input
          id={timeId}
          onChange={(e) => onTimeChange(e.target.value)}
          required
          style={scheduledTimeInputStyle}
          type="time"
          value={timeValue}
        />
      </div>
    </div>
  );
}

const mainStyle = {
  display: "flex",
  justifyContent: "center",
  minHeight: "100vh",
  padding: "24px 16px 48px",
} as const;

const pageStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
  maxWidth: 480,
  width: "100%",
};

const headerStyle = {
  paddingBottom: 4,
} as const;

const logoStyle = {
  color: "var(--accent)",
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
};

const h1Style = {
  fontSize: 24,
  fontWeight: 800,
  letterSpacing: "-0.02em",
  margin: "0 0 8px",
} as const;

const subtitleStyle = {
  color: "var(--muted)",
  fontSize: 15,
  lineHeight: 1.5,
  margin: 0,
} as const;

const fieldLabelStyle = {
  color: "var(--muted)",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
} as const;

const inputStyle = {
  background: "var(--surface-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--foreground)",
  fontSize: 15,
  minHeight: 44,
  outline: "none",
  padding: "10px 14px",
  width: "100%",
} as const;

const scheduledDateTimeRowStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
} as const;

const scheduledDateInputStyle = {
  ...inputStyle,
  flex: "2 1 170px",
  minWidth: 0,
  width: 0,
} as const;

const scheduledTimeInputStyle = {
  ...inputStyle,
  flex: "1 1 110px",
  minWidth: 0,
  width: 0,
} as const;
