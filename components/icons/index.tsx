import type { CSSProperties, ReactNode } from "react";

export type IconName =
  | "status-confirm-pending"
  | "status-copy-link"
  | "status-disputed"
  | "status-error"
  | "status-expired"
  | "status-external-link-view-deal"
  | "status-funded-escrow-held"
  | "status-locked-meeting-url-hidden"
  | "status-open"
  | "status-payment-pending"
  | "status-refunded"
  | "status-released"
  | "status-reveal-meeting-url-available"
  | "utility-calendar"
  | "utility-close"
  | "utility-copy-address"
  | "utility-info"
  | "utility-more-horizontal"
  | "utility-more-vertical"
  | "utility-receipt"
  | "utility-secure-subtle"
  | "utility-settings"
  | "utility-sync-indexing"
  | "utility-time"
  | "utility-transaction-confirmed"
  | "utility-transaction-failed"
  | "utility-transaction-pending"
  | "utility-user"
  | "utility-wallet-connected"
  | "utility-wallet-disconnected"
  | "utility-wrong-network";

const icons: Record<IconName, ReactNode> = {
  "status-confirm-pending": (
    <>
      <path d="M8 4h8" />
      <path d="M8 20h8" />
      <path d="M9 4c0 4 6 4 6 8s-6 4-6 8" />
      <path d="M15 4c0 4-6 4-6 8s6 4 6 8" />
    </>
  ),
  "status-copy-link": (
    <>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M8.2 9.8 6.8 11.2a4 4 0 0 0 5.7 5.7l1.4-1.4" />
      <path d="M15.8 14.2l1.4-1.4a4 4 0 0 0-5.7-5.7l-1.4 1.4" />
    </>
  ),
  "status-disputed": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6" />
      <path d="M12 17h.01" />
    </>
  ),
  "status-error": (
    <>
      <path d="M12 3 3 7v10l9 4 9-4V7l-9-4Z" />
      <path d="M12 8v5" />
      <path d="M12 17h.01" />
    </>
  ),
  "status-expired": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l4 2" />
    </>
  ),
  "status-external-link-view-deal": (
    <>
      <path d="M14 4h6v6" />
      <path d="M10 14 20 4" />
      <path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" />
    </>
  ),
  "status-funded-escrow-held": (
    <>
      <rect x="6" y="10" width="12" height="9" rx="2" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" />
      <path d="M12 14v2" />
    </>
  ),
  "status-locked-meeting-url-hidden": (
    <>
      <rect x="6" y="10" width="12" height="10" rx="2" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" />
    </>
  ),
  "status-open": (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" fill="currentColor" r="3" stroke="none" />
    </>
  ),
  "status-payment-pending": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  "status-refunded": (
    <>
      <path d="M4 12a8 8 0 1 0 2.3-5.7" />
      <path d="M4 5v7h7" />
    </>
  ),
  "status-released": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  "status-reveal-meeting-url-available": (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "utility-calendar": (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M4 10h16" />
    </>
  ),
  "utility-close": (
    <>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </>
  ),
  "utility-copy-address": (
    <>
      <rect x="8" y="8" width="10" height="10" rx="2" />
      <rect x="5" y="5" width="10" height="10" rx="2" />
    </>
  ),
  "utility-info": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
  "utility-more-horizontal": (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  "utility-more-vertical": (
    <>
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </>
  ),
  "utility-receipt": (
    <>
      <path d="M7 3h10a2 2 0 0 1 2 2v16l-3-2-3 2-3-2-3 2V5a2 2 0 0 1 2-2Z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </>
  ),
  "utility-secure-subtle": (
    <path d="M12 3 5 6v5c0 5 3.5 8 7 10 3.5-2 7-5 7-10V6l-7-3Z" />
  ),
  "utility-settings": (
    <>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V22a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1H22a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  "utility-sync-indexing": (
    <>
      <path d="M21 12a9 9 0 0 1-15.5 6.2" />
      <path d="M3 12a9 9 0 0 1 15.5-6.2" />
      <path d="M18.5 3.8v5h-5" />
      <path d="M5.5 20.2v-5h5" />
    </>
  ),
  "utility-time": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  "utility-transaction-confirmed": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  "utility-transaction-failed": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6" />
      <path d="m15 9-6 6" />
    </>
  ),
  "utility-transaction-pending": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  "utility-user": (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  "utility-wallet-connected": (
    <>
      <path d="M3 7h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3z" />
      <path d="M3 7V5a2 2 0 0 1 2-2h13" />
      <circle cx="17" cy="13" fill="currentColor" r="1.5" stroke="none" />
    </>
  ),
  "utility-wallet-disconnected": (
    <>
      <path d="M3 7h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3z" />
      <path d="M3 7V5a2 2 0 0 1 2-2h13" />
    </>
  ),
  "utility-wrong-network": (
    <>
      <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
      <path d="m9 9 6 6" />
      <path d="m15 9-6 6" />
    </>
  ),
};

interface IconProps {
  name: IconName;
  size?: number;
  style?: CSSProperties;
  className?: string;
  "aria-label"?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

export function Icon({
  name,
  size = 24,
  style,
  className,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
}: IconProps) {
  return (
    <svg
      aria-hidden={ariaLabel ? undefined : (ariaHidden ?? true)}
      aria-label={ariaLabel}
      className={className}
      fill="none"
      height={size}
      role={ariaLabel ? "img" : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      style={style}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {icons[name]}
    </svg>
  );
}
