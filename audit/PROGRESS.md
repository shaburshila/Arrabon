## Phase A (plan-2) — completed
- app/page.tsx — SiteFooter padding 64+48 → 32+24 vertical (added `footerSectionStyle`)
- app/globals.css — site-footer__grid padding-bottom 36→24, site-footer__base padding-top 24→18, landing-scroll-hint bottom 24→64, landing-hero-section padding-bottom 0→120

## Phase B (plan-2) — completed
- app/my-deals/page.tsx — StatusPill теперь получает icon prop
- app/my-links/page.tsx — StatusPill icon prop + getMyLinkBadge возвращает icon для link statuses (импорт IconName)
- app/globals.css — list-row pill column 110px → minmax(160px, auto), trailing column 150→160
- lib/ui/deal-status.ts — ConfirmPending label сокращён "Awaiting confirmation" → "Confirm Pending"

## Phase C (plan-2) — completed
- components/link/create-link-form.tsx — restructured: removed PageHeader, WalletSessionCard, duplicate h2 "Create link"; one ActionPanel split into 5 separate Card blocks (Consultation / Payment / Schedule / Link expiration / Private meeting) with SectionLabel and gap 24; removed unused styles (headerStyle, h1Style, subtitleStyle, panelHeaderStyle, formPanelStyle, dividerStyle, Divider function, InnerSections); gold "Funds held in escrow" Notice now outside cards; submit Btn размер lg
- app/create/page.tsx — добавлен page header (h1 serif 40px Cormorant + lede) над split layout
- app/globals.css — `.create-split__preview` получил `align-self: start` (defensive sticky fix); top остался 88px

## Plan-2 — completed

Все 3 фазы плана №2 закрыты. См. отдельные секции выше.

**Final checks:**
- `npm run typecheck` — clean
- `npm run build` — clean
- `npm run test:unit` — 12/12 passing
- `npm run test:unit:compliance-plain` (включает CreateLinkForm helpers) — 57/57 passing

**Notes / deviations:**
- WalletSessionCard полностью удалён из CreateLinkForm (включая импорт и success branch ничего не теряет — top-pill в shell справляется).
- `panelTitleStyle` и `panelSubtitleStyle` сохранены — используются в success branch (Link created card).
- В app/my-deals "Awaiting confirmation" в admin/disputes/ui.ts оставлен как есть (вне scope плана-2).
