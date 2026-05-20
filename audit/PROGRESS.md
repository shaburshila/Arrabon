# PROGRESS — Arrabon redesign implementation

## Phase 0 — completed
- lib/ui/deal-status.ts — added StatusTone type + toneFromStatus helper (covers 5 existing DealStatus values)
- components/shared/btn.tsx — added className (btn btn--{variant} btn--{size}) alongside inline styles
- components/app/top-nav.tsx — added topnav-desktop-nav className to primary nav element
- app/globals.css — added .btn, .btn--*, .btn--block CSS rules + @media (max-width:768px) .topnav-desktop-nav{display:none}
- app/admin/denylist/helpers.ts — extracted canSubmitDenylistRemoval to dedicated module (Next.js disallows arbitrary named exports from page files)
- app/admin/denylist/page.tsx — imports canSubmitDenylistRemoval from ./helpers
- tests/unit/admin-denylist-page.test.ts — updated import path to @/app/admin/denylist/helpers

## Phase 1 — completed
- components/deal/deal-status-card.tsx — decomposed to hero only (no DetailRows, no role pill); uses toneFromStatus + getGuidanceMessageAt subtitle
- components/deal/deal-details-card.tsx — new component for right column (amount, IDs, addresses, dates, tx hash)
- components/deal/receipt-inset.tsx — new component for settlement CTA (View receipt link)

## Phase 2 — completed
- app/globals.css — added .deal-split CSS (1.6fr/1fr grid, responsive)
- app/deal/[id]/page.tsx — split layout with deal-split__left (KeyTimes, MeetingUrl, DisputeThread) and deal-split__right (DealDetailsCard, DealActionsCard, ReceiptInset); removed DealGuidanceCard; updated DealStatusCard props to isBuyer/isSeller/isParticipant

## Phase 3 — completed
- components/link/link-summary.tsx — restructured into clean info card (deal-hero__amount classes, trust strip, no kitchen-sink strips)
- app/globals.css — added .link-page, .link-page__inner, .link-page__topbar, .link-split, .link-split__right
- app/link/[id]/page.tsx — split layout 1fr/380px, real Alpha Lock SVG brand, sticky right column, Icon back button
- components/link/link-action-card.tsx — SiweSignModal wired into Sign in with Ethereum button

## Phase 4 — completed
- components/link/link-preview-card.tsx — new LinkPreviewCard component with real-time preview values
- app/globals.css — added .create-split, .create-split__preview (sticky at top:88px)
- components/link/create-link-form.tsx — added optional onValuesChange prop + useEffect to sync form state
- app/create/page.tsx — create-split layout 1.8fr/1fr, sticky preview, maxWidth=1100

## Phase 5 — completed
- app/globals.css — added .list-row* CSS (5-col grid, responsive 2-col mobile with grid-areas)
- lib/ui/deal-trailing-label.ts — new helper dealTrailingLabel() (5 existing DealStatus values only)
- app/my-deals/page.tsx — DealRow replaced with list-row grid layout; maxWidth 960→1180; removed 8 unused style constants
- app/my-links/page.tsx — LinkRow replaced with list-row grid layout; removed CopyIconButton; maxWidth 960→1180; removed 8 unused style constants

## Phase 6 — completed
- app/admin/disputes/page.tsx — maxWidth 860→1180; removed WalletSessionCard render + import
- app/admin/disputes/[id]/page.tsx — maxWidth 860→1180; removed WalletSessionCard render + import
- app/admin/denylist/page.tsx — maxWidth 860→1180; removed WalletSessionCard render + import
- app/globals.css — added .admin-info, .admin-info__label, .admin-info__value, .admin-info__value--mono CSS

## Phase 7 — completed
- app/deal/[id]/receipt/page.tsx — top seal: 64→96px, tone gold-line→auto; footer seal: 18→36px, tone auto→gold-line
- components/shared/notice.tsx — added optional icon?: IconName prop; renders Icon in iconWrapStyle slot to the left of title/message

**Notes / deviations**
- DealStatus union currently only has 5 values (ConfirmPending, Disputed, Funded, Refunded, Released) — lib/api/deals.ts is off-limits per plan rules, so toneFromStatus and dealTrailingLabel only cover those 5 (not Open/PaymentPending/Expired/Cancelled from plan's example code). TypeScript exhaustive-check would fail otherwise.
- Pre-existing typecheck error (canSubmitDenylistRemoval not exported from page) fixed by extracting to app/admin/denylist/helpers.ts — Next.js does not allow arbitrary named exports from page files.
- Phase 6 Step 6.1 Info→admin-info replacement marked optional in plan; skipped to avoid risk. admin-info CSS rules added to globals.css for future use.
- Phase 7 Step 7.2 (Notice icon) is P3-optional in plan; implemented since it was straightforward and non-breaking.

