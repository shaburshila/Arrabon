"use client";

import { Icon } from "@/components/icons";
import { Modal } from "@/components/shared/modal";

interface Props {
  onApprove: () => void;
  onReject: () => void;
  open: boolean;
  siweMessage?: string;
}

export function SiweSignModal({ open, onApprove, onReject, siweMessage }: Props) {
  return (
    <Modal open={open} width={460} onClose={onReject}>
      <button
        aria-label="Close"
        className="modal__close"
        type="button"
        onClick={onReject}
      >
        <Icon name="utility-close" size={14} />
      </button>

      <div className="stack-20">
        <div className="row" style={{ gap: 14 }}>
          <span
            style={{
              background: "var(--gold-soft)",
              borderRadius: 12,
              color: "var(--gold-deep)",
              display: "inline-grid",
              flexShrink: 0,
              height: 44,
              placeItems: "center",
              width: 44,
            }}
          >
            <Icon name="status-locked-meeting-url-hidden" size={20} />
          </span>
          <div>
            <p className="tiny" style={{ marginBottom: 4 }}>
              Wallet signature requested
            </p>
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "-0.005em",
                margin: 0,
              }}
            >
              Sign in with Ethereum
            </h3>
          </div>
        </div>

        <p className="small" style={{ color: "var(--muted)", margin: 0 }}>
          Arrabon needs you to sign this message to verify wallet ownership.{" "}
          <strong style={{ color: "var(--ink)" }}>
            No gas fee, no transaction
          </strong>{" "}
          — only a signature.
        </p>

        {siweMessage && (
          <div
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border-soft)",
              borderRadius: "var(--r-2)",
              color: "var(--ink-soft)",
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              lineHeight: 1.55,
              maxHeight: 220,
              overflow: "auto",
              padding: "14px 16px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {siweMessage}
          </div>
        )}

        <div className="row" style={{ gap: 10 }}>
          <button
            className="btn btn--ghost btn--block"
            type="button"
            onClick={onReject}
          >
            Reject
          </button>
          <button
            className="btn btn--primary btn--block"
            type="button"
            onClick={onApprove}
          >
            Sign message
          </button>
        </div>
      </div>
    </Modal>
  );
}
