"use client";

// Create consultation link form.
// POST /api/links is a private SIWE endpoint, so wallet connect + SIWE are required.

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { Address } from "viem";

import type { WalletSessionState } from "@/hooks/use-wallet-session";
import { ApiError } from "@/lib/api/auth";
import { createLink, type CreateLinkInput } from "@/lib/api/links";
import { getComplianceWalletAddress } from "@/lib/base/compliance";
import { ActionPanel } from "@/components/shared/action-panel";
import { Btn } from "@/components/shared/btn";
import { ComplianceBlockedNotice } from "@/components/shared/compliance-blocked-notice";
import { CopyBtn } from "@/components/shared/copy-btn";
import { DetailRow } from "@/components/shared/detail-row";
import { FormField } from "@/components/shared/form-field";
import { InnerSection } from "@/components/shared/inner-section";
import { Notice } from "@/components/shared/notice";
import { SectionLabel } from "@/components/shared/section-label";
import { TextArea } from "@/components/shared/text-area";
import { TextInput } from "@/components/shared/text-input";
import { TokenAmountRow } from "@/components/shared/token-amount-row";
import { WalletSessionCard } from "@/components/shared/wallet-session-card";
import { truncateAddress } from "@/lib/ui/address";

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

interface CreateLinkComplianceState {
  isBlocked: boolean;
  complianceReasonCode: string | null;
  complianceWallet: Address | null;
}

type PrimaryAction = {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onClick?: () => void;
  type: "button" | "submit";
};

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

export function createInitialCreateLinkComplianceState(): CreateLinkComplianceState {
  return {
    isBlocked: false,
    complianceReasonCode: null,
    complianceWallet: null,
  };
}

export function getCreateLinkErrorState(err: unknown): {
  compliance: CreateLinkComplianceState;
  error: string | null;
} {
  if (
    err instanceof ApiError &&
    err.code === "COMPLIANCE_BLOCKED" &&
    err.reason_code !== "PROVIDER_UNAVAILABLE"
  ) {
    return {
      compliance: {
        isBlocked: true,
        complianceReasonCode: err.reason_code ?? null,
        complianceWallet: getComplianceWalletAddress(err.body),
      },
      error: null,
    };
  }

  return {
    compliance: createInitialCreateLinkComplianceState(),
    error:
      err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Failed to create link.",
  };
}

export function CreateLinkForm({ session }: { session: WalletSessionState }) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compliance, setCompliance] = useState<CreateLinkComplianceState>(createInitialCreateLinkComplianceState);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expirationAutoFilled, setExpirationAutoFilled] = useState(true);

  const canCreate = session.isConnected && session.isCorrectChain && session.siweStatus === "authenticated";
  const sellerAddress = session.address ? truncateAddress(session.address) : "Connect wallet";

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

  function getPrimaryAction(): PrimaryAction {
    if (!session.isConnected) {
      return {
        label: "Connect wallet",
        onClick: () => session.connect(),
        type: "button",
      };
    }

    if (!session.isCorrectChain) {
      return {
        label: "Switch to Base",
        onClick: () => session.switchToCorrectChain(),
        type: "button",
      };
    }

    if (session.siweStatus === "loading") {
      return {
        disabled: true,
        label: "Checking session...",
        loading: true,
        type: "button",
      };
    }

    if (session.isSigningIn) {
      return {
        disabled: true,
        label: "Signing in...",
        loading: true,
        type: "button",
      };
    }

    if (session.siweStatus !== "authenticated") {
      return {
        label: "Sign in with Ethereum",
        onClick: () => session.signIn(),
        type: "button",
      };
    }

    return {
      label: submitting ? "Creating link..." : "Create consultation link",
      loading: submitting,
      type: "submit",
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canCreate || submitting) return;

    setSubmitting(true);
    setError(null);
    setCompliance(createInitialCreateLinkComplianceState());

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
      const nextState = getCreateLinkErrorState(err);
      setCompliance(nextState.compliance);
      setError(nextState.error);
    } finally {
      setSubmitting(false);
    }
  }

  if (shareUrl) {
    return (
      <>
        <PageHeader />
        <ActionPanel style={successPanelStyle}>
          <div style={successIconStyle} aria-hidden>
            ✓
          </div>
          <div style={successHeaderStyle}>
            <h2 style={panelTitleStyle}>Link created</h2>
            <p style={panelSubtitleStyle}>
              Your consultation link is live and ready to share.
            </p>
          </div>

          <InnerSection style={shareSectionStyle}>
            <p style={shareLabelStyle}>Share link</p>
            <p style={shareUrlStyle}>{shareUrl}</p>
          </InnerSection>

          <div style={successActionsStyle}>
            <CopyBtn fullWidth text={shareUrl} label="Copy link" />
            <Btn
              fullWidth
              onClick={() => setShareUrl(null)}
              variant="ghost"
            >
              Create another
            </Btn>
            <Link
              href="/my-links"
              style={{ display: "block", textDecoration: "none", width: "100%" }}
            >
              <Btn fullWidth variant="secondary">
                View my links
              </Btn>
            </Link>
          </div>
        </ActionPanel>
      </>
    );
  }

  const primaryAction = getPrimaryAction();

  return (
    <>
      <PageHeader />

      <WalletSessionCard session={session} hideActions />

      <form onSubmit={handleSubmit}>
        <ActionPanel style={formPanelStyle}>
          <div style={panelHeaderStyle}>
            <h2 style={panelTitleStyle}>Create link</h2>
            <p style={panelSubtitleStyle}>
              Define the consultation, payment, and access details for this booking.
            </p>
          </div>

          <SectionLabel>Consultation</SectionLabel>
          <InnerSection style={sectionStackStyle}>
            <FormField label="Title">
              <TextInput
                id="title"
                onChange={(e) => setField("title", e.target.value)}
                placeholder="e.g. 30-min Strategy Call"
                required
                type="text"
                value={form.title}
              />
            </FormField>
            <Divider />
            <FormField label="Description">
              <TextArea
                id="description"
                onChange={(e) => setField("description", e.target.value)}
                placeholder="What will you cover in this consultation?"
                rows={4}
                value={form.description}
              />
            </FormField>
          </InnerSection>

          <SectionLabel>Payment</SectionLabel>
          <InnerSection style={sectionStackStyle}>
            <TokenAmountRow
              amount={form.price_usdc}
              label="Price"
              onChange={(value) => setField("price_usdc", value)}
              required
              sublabel="You will receive this amount in full. Buyer pays an additional platform fee (3%, min $1.50, max $30)."
              token="USDC"
            />
            <Divider />
            <DetailRow
              bordered={false}
              label="Seller"
              value={sellerAddress}
            />
          </InnerSection>

          <SectionLabel>Schedule</SectionLabel>
          <InnerSection style={sectionStackStyle}>
            <div style={twoColumnRowStyle}>
              <FormField label="Date">
                <TextInput
                  id="scheduled_date"
                  onChange={(e) => setField("scheduled_date", e.target.value)}
                  required
                  type="date"
                  value={form.scheduled_date}
                />
              </FormField>
              <FormField label="Time">
                <TextInput
                  id="scheduled_time"
                  onChange={(e) => setField("scheduled_time", e.target.value)}
                  required
                  type="time"
                  value={form.scheduled_time}
                />
              </FormField>
            </div>
            <Divider />

            <FormField label="Duration (min)">
              <TextInput
                id="duration_minutes"
                max="1440"
                min="1"
                onChange={(e) => setField("duration_minutes", e.target.value)}
                required
                type="number"
                value={form.duration_minutes}
              />
            </FormField>

            <div>
              <DetailRow
                bordered={false}
                label="Timezone"
                value={form.timezone}
              />
              <p style={helperTextStyle}>
                Times are saved from your current browser timezone.
              </p>
            </div>
          </InnerSection>

          <SectionLabel>Link expiration</SectionLabel>
          <InnerSection style={sectionStackStyle}>
            <div style={twoColumnRowStyle}>
              <FormField label="Expiration date">
                <TextInput
                  id="expires_date"
                  onChange={(e) => setExpirationField("expires_date", e.target.value)}
                  required
                  type="date"
                  value={form.expires_date}
                />
              </FormField>
              <FormField label="Expiration time">
                <TextInput
                  id="expires_time"
                  onChange={(e) => setExpirationField("expires_time", e.target.value)}
                  required
                  type="time"
                  value={form.expires_time}
                />
              </FormField>
            </div>
            <p style={helperTextStyle}>
              Can be at or before the scheduled time.
            </p>
          </InnerSection>

          <SectionLabel>Private meeting</SectionLabel>
          <InnerSection style={sectionStackStyle}>
            <FormField
              helper="Revealed only after funding."
              label="Meeting URL"
            >
              <TextInput
                id="meeting_url"
                onChange={(e) => setField("meeting_url", e.target.value)}
                placeholder="https://meet.example.com/your-room"
                required
                type="url"
                value={form.meeting_url}
              />
            </FormField>
          </InnerSection>

          {compliance.isBlocked ? (
            <ComplianceBlockedNotice
              reasonCode={compliance.complianceReasonCode}
              walletAddress={compliance.complianceWallet}
            />
          ) : null}

          <div aria-live="polite" role="status">
            {!compliance.isBlocked && error ? (
              <Notice
                message={error}
                title="Could not create link"
                tone="danger"
              />
            ) : null}
          </div>

          <Notice
            message="Funds are held in escrow on Base until the consultation is confirmed or disputed."
            tone="info"
          />

          <Btn
            disabled={primaryAction.disabled}
            fullWidth
            loading={primaryAction.loading}
            onClick={primaryAction.onClick}
            type={primaryAction.type}
          >
            {primaryAction.label}
          </Btn>
        </ActionPanel>
      </form>
    </>
  );
}

function PageHeader() {
  return (
    <div style={headerStyle}>
      <h1 style={h1Style}>Create consultation link</h1>
      <p style={subtitleStyle}>
        Set the terms, share the link, and let the buyer fund escrow on Base.
      </p>
    </div>
  );
}

function Divider() {
  return <div style={dividerStyle} />;
}

const headerStyle = {
  paddingBottom: 4,
};

const h1Style = {
  fontSize: 24,
  fontWeight: 800,
  letterSpacing: "0",
  margin: "0 0 8px",
};

const subtitleStyle = {
  color: "var(--muted)",
  fontSize: 15,
  lineHeight: 1.5,
  margin: 0,
};

const formPanelStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 14,
  padding: 18,
};

const panelHeaderStyle = {
  borderBottom: "1px solid var(--subtle-border)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
  padding: "2px 4px 14px",
};

const panelTitleStyle = {
  color: "var(--foreground)",
  fontSize: 18,
  fontWeight: 600,
  margin: 0,
};

const panelSubtitleStyle = {
  color: "var(--muted)",
  fontSize: 14,
  lineHeight: 1.45,
  margin: 0,
};

const sectionStackStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 14,
};

const twoColumnRowStyle = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
};

const helperTextStyle = {
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.45,
  margin: "4px 0 0",
};

const dividerStyle = {
  borderTop: "1px solid var(--subtle-border)",
  height: 0,
};

const successPanelStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
  padding: 20,
  textAlign: "center" as const,
};

const successIconStyle = {
  alignItems: "center",
  alignSelf: "center",
  background: "var(--success-muted)",
  border: "1px solid var(--success)",
  borderRadius: "50%",
  color: "var(--success)",
  display: "inline-flex",
  fontSize: 18,
  fontWeight: 600,
  height: 44,
  justifyContent: "center",
  width: 44,
};

const successHeaderStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
};

const shareSectionStyle = {
  textAlign: "left" as const,
};

const shareLabelStyle = {
  color: "var(--muted)",
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.08em",
  margin: "0 0 8px",
  textTransform: "uppercase" as const,
};

const shareUrlStyle = {
  color: "var(--foreground)",
  fontSize: 14,
  lineHeight: 1.45,
  margin: 0,
  fontFamily: "var(--font-mono, monospace)",
  wordBreak: "break-all" as const,
};

const successActionsStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
};
