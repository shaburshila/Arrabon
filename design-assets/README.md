# Arrabon Production Icon Assets v2

Corrected according to final icon direction.

## Fixed in v2

- `status/funded-escrow-held.svg` now uses `#C6A15B` and a lock/held-funds metaphor.
- `status/open.svg` now uses muted `#6C6C6C`, not Coinbase blue.
- `status/refunded.svg` now uses muted `#6C6C6C`. If product later wants a distinct refund color, introduce a CSS token such as `--status-refunded`.
- All status and utility SVGs include `role="img"` and `aria-label`.
- `copy-link.svg` and `copy-address.svg` now have distinct visual metaphors.
- PWA PNG sizes now include `192x192` and `512x512`.
- Canonical `favicon.svg` is included in both `/favicon` and `/public`.
- Seal SVG uses path-based text; no `<text>` element is used.

## Usage rules

1. Use Alpha Lock as the only primary app icon.
2. Use Arrabon Seal only in secondary trust/legal contexts: receipts, legal docs, confirmation screens, trust marks.
3. Use simplified Alpha Lock for favicon.
4. Do not use Seal as a small UI icon.
5. Funded = escrow/lock/held funds.
6. Released = check/success.
7. Gold is brand/trust accent, not a universal status color.
8. Utility/status icons use 2px stroke, rounded caps, rounded joins.

## Suggested CSS tokens

```css
:root {
  --color-graphite: #161616;
  --color-stone: #2A2A2E;
  --color-ivory: #F5F1E8;
  --color-gold: #C6A15B;
  --color-muted: #6C6C6C;

  --status-open: var(--color-muted);
  --status-funded: var(--color-gold);
  --status-released: #22C55E;
  --status-payment-pending: #F59E0B;
  --status-confirm-pending: #F59E0B;
  --status-disputed: #EF4444;
  --status-error: #EF4444;
  --status-refunded: var(--color-muted);
  --status-expired: var(--color-muted);
}
```

## Recommended Next.js placement

```txt
public/favicon.svg
public/favicon.ico
public/icons/icon-192.png
public/icons/icon-512.png
```

## v3 cleanup

- Fixed `status/open.svg`: inner dot now uses `#6C6C6C` in the standalone colored file, while the `currentColor` variant remains CSS-controlled.
- `arrabon-seal-one-color-black.svg` now uses brand Graphite `#161616`, not pure black.
- `utility/time.svg` is now visually distinct from transaction pending.
- Restored `utility/info.svg`, `utility/more-horizontal.svg`, and `utility/more-vertical.svg`.
- Synchronized `wallet-connected.svg` dot radius with the sprite version.
- Added `DEPLOYMENT.md` to clarify canonical public assets vs source/export folders.
- `favicon/favicon.svg` and `favicon/alpha-lock-favicon.svg` are intentionally identical aliases: use `favicon.svg` for deployment and `alpha-lock-favicon.svg` as the descriptive source asset.
