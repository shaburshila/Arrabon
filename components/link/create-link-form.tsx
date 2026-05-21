"use client";

// Create consultation link form.
// POST /api/links is a private SIWE endpoint, so wallet connect + SIWE are required.

import Link from "next/link";
import { useState, useEffect, type FormEvent } from "react";
import type { Address } from "viem";

import type { WalletSessionState } from "@/hooks/use-wallet-session";
import { ApiError } from "@/lib/api/auth";
import { createLink, type CreateLinkInput } from "@/lib/api/links";
import { getComplianceWalletAddress } from "@/lib/base/compliance";
import { Icon } from "@/components/icons";
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

interface Props {
  session: WalletSessionState;
  onValuesChange?: (values: FormState) => void;
}

export function CreateLinkForm(props: Props) {
  const { session } = props;
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    props.onValuesChange?.(form);
  }, [form, props.onValuesChange]);
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
        <ActionPanel style={successPanelStyle}>
          <div style={successIconStyle} aria-hidden>
            ✓
          </div>
          <div style={successHeaderStyle}>
            <h2 className="h2">Link created</h2>
            <p className="lede">
              Your consultation link is live and ready to share.
            </p>
          </div>

          <InnerSection style={shareSectionStyle}>
            <p className="tiny">Share link</p>
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
    <form onSubmit={handleSubmit} style={formStackStyle}>
      <ActionPanel style={cardPaddedStyle}>
        <div style={sectionStackStyle}>
          <SectionLabel>Consultation</SectionLabel>
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
          <FormField label="Description" helper="A short note for the buyer.">
            <TextArea
              id="description"
              onChange={(e) => setField("description", e.target.value)}
              placeholder="What will you cover in this consultation?"
              rows={4}
              value={form.description}
            />
          </FormField>
        </div>
      </ActionPanel>

      <ActionPanel style={cardPaddedStyle}>
        <div style={sectionStackStyle}>
          <SectionLabel>Payment</SectionLabel>
          <TokenAmountRow
            amount={form.price_usdc}
            label="Price"
            onChange={(value) => setField("price_usdc", value)}
            required
            sublabel="You will receive this amount in full. Buyer pays an additional 3% platform fee (min $1.50, max $30)."
            token="USDC"
          />
          <hr style={ruleStyle} />
          <DetailRow bordered={false} label="Seller wallet" mono value={sellerAddress} />
          <DetailRow bordered={false} label="Settlement" value="Base · USDC" />
        </div>
      </ActionPanel>

      <ActionPanel style={cardPaddedStyle}>
        <div style={sectionStackStyle}>
          <SectionLabel>Schedule</SectionLabel>
          <div className="field__row">
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
          <FormField label="Duration (minutes)">
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
          <FormField helper="Locked to your browser's timezone." label="Timezone">
            <TextInput disabled id="timezone" type="text" value={form.timezone} />
          </FormField>
        </div>
      </ActionPanel>

      <ActionPanel style={cardPaddedStyle}>
        <div style={sectionStackStyle}>
          <SectionLabel>Link expiration</SectionLabel>
          <div className="field__row">
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
            The link cannot be funded after this time. Defaults to 5 minutes before the consultation.
          </p>
        </div>
      </ActionPanel>

      <ActionPanel style={cardPaddedStyle}>
        <div style={sectionStackStyle}>
          <SectionLabel>Private meeting</SectionLabel>
          <FormField helper="Revealed only after the buyer funds escrow." label="Meeting URL">
            <TextInput
              id="meeting_url"
              onChange={(e) => setField("meeting_url", e.target.value)}
              placeholder="https://meet.example.com/your-room"
              required
              type="url"
              value={form.meeting_url}
            />
          </FormField>
        </div>
      </ActionPanel>

      {compliance.isBlocked && (
        <ComplianceBlockedNotice
          reasonCode={compliance.complianceReasonCode}
          walletAddress={compliance.complianceWallet}
        />
      )}
      {!compliance.isBlocked && error && (
        <Notice message={error} title="Could not create link" tone="danger" />
      )}

      <Notice
        icon="utility-secure-subtle"
        message="USDC is locked in the Arrabon contract on Base until the consultation is confirmed or disputed."
        title="Funds held in escrow"
        tone="gold"
      />

      <Btn
        disabled={primaryAction.disabled}
        fullWidth
        loading={primaryAction.loading}
        onClick={primaryAction.onClick}
        size="lg"
        type={primaryAction.type}
      >
        {primaryAction.label}
        {primaryAction.type === "submit" && !primaryAction.loading && (
          <Icon name="utility-arrow-right" size={16} />
        )}
      </Btn>
    </form>
  );
}

const formStackStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 24,
};

const cardPaddedStyle = {
  padding: 28,
};

const sectionStackStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 20,
};

const ruleStyle = { background: "var(--rule)", border: 0, height: 1, margin: 0 };

const helperTextStyle = {
  color: "var(--muted-2)",
  fontSize: 12,
  lineHeight: 1.45,
  margin: 0,
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

const shareUrlStyle = {
  color: "var(--ink)",
  fontSize: 14,
  lineHeight: 1.45,
  margin: 0,
  fontFamily: "var(--font-mono)",
  wordBreak: "break-all" as const,
};

const successActionsStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
};
