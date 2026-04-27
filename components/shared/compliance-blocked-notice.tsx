import type { CSSProperties } from "react";
import type { Address } from "viem";

import { getComplianceDisplay } from "@/lib/compliance/display";
import { truncateAddress } from "@/lib/ui/address";
import { Notice } from "@/components/shared/notice";

export function ComplianceBlockedNotice({
  reasonCode,
  walletAddress,
}: {
  reasonCode: string | null;
  walletAddress: Address;
}) {
  const display = getComplianceDisplay(reasonCode);

  if (display.isRetryable) {
    return null;
  }

  return (
    <Notice
      message={
        <div style={stackStyle}>
          <p style={paragraphStyle}>{display.message}</p>
          <p style={metaStyle}>
            Wallet: <span style={walletStyle}>{truncateAddress(walletAddress)}</span>
          </p>
          {display.verificationUrl && display.verificationLabel && (
            <a
              href={display.verificationUrl}
              rel="noopener noreferrer"
              style={linkStyle}
              target="_blank"
            >
              {display.verificationLabel}
            </a>
          )}
        </div>
      }
      title={display.title}
      tone="danger"
    />
  );
}

const stackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const paragraphStyle: CSSProperties = {
  color: "inherit",
  margin: 0,
};

const metaStyle: CSSProperties = {
  color: "inherit",
  margin: 0,
};

const walletStyle: CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontWeight: 600,
};

const linkStyle: CSSProperties = {
  color: "inherit",
  fontSize: 14,
  fontWeight: 600,
  textDecoration: "underline",
};
