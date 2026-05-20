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

## Plan-3 — completed

### Phase G — LifecycleTimeline grid fix
- app/globals.css — .timeline → flex column, .timeline__row → grid 20px/1fr

### Phase H — Infinite loop fix on /create
- app/create/page.tsx — handleValuesChange wrapped in useCallback

### Phase I — Landing CTA accent + top-nav height
- app/globals.css — .landing-cta__title .accent added to italic-gold selectors
- components/app/top-nav.tsx — header padding 14→18, brand-mark 28→32

### Phase J — List rows typography
- app/globals.css — .list-row* font-sizes bumped for premium feel

### Phase K — Create page breathing
- app/create/page.tsx — pageHeaderStyle marginBottom 32→48, gap 10→12
- components/app/app-shell.tsx — mainStyle padding-top 88→104

**Final checks:**
- npm run typecheck — clean
- npm run build — clean
- npm run test:unit — 12/12 passing

## Plan-4 — completed

### Phase M — Timeline vertical line restored
- app/globals.css — removed `align-items: start` from .timeline__row

### Phase N — Header breathing
- components/app/app-shell.tsx — mainStyle padding 104→128 / bottom 48→64 (override too)
- app/deal/[id]/page.tsx — backLinkStyle marginBottom 0→16

### Phase O — Top-nav polish
- components/app/top-nav.tsx — brand fontSize 22→24
- components/app/wallet-status-pill.tsx — ChevronIcon → `<Icon name="utility-chevron-down" />`, pill avatar clean (no inner SVG); dropdown header still uses WalletSvg/AdminSvg at 16px

### Phase Q — Scroll-hint accurate scroll
- app/page.tsx — landing-scroll-hint onClick uses getBoundingClientRect on .landing-steps
- app/globals.css — scroll-margin-top: 64px on landing-* sections

**Final checks:** npm run typecheck clean, npm run build clean, npm run test:unit 12/12 passing.

## Plan-5 — completed

### Phase S — Style guide reference (no code; targets documented)
- app/globals.css — added `margin: 0` to .h-display, .h1, .h2, .h3, .lede, .body, .small, .tiny, .mono, .eyebrow

### Phase T — Page headers unified
- app/my-deals/page.tsx — h1 28→40 (className="h1"), sub 14→17 (className="lede"); removed h1Style/subStyle; pageHeaderStyle marginBottom 32
- app/my-links/page.tsx — same
- app/admin/disputes/page.tsx — h1 28→40 (className="h1"), sub className="lede"; removed h1Style/subtitleStyle
- app/admin/denylist/page.tsx — same; removed h1Style/subtitleStyle
- app/create/page.tsx — converted inline pageTitleStyle/pageSubStyle to className="h1"/"lede"; removed inline declarations

### Phase U — Sub-headings unified
- app/admin/disputes/page.tsx — dealTitle 18→28 serif (className="h2"); removed dealTitleStyle
- app/admin/denylist/page.tsx — sectionTitle 18→28 serif (className="h2"), description className="lede"; removed sectionTitleStyle/sectionDescriptionStyle
- (StepCard/BenefitCard cardTitleStyle and landing sectionH2Style left as-is per plan)

### Phase V — Eyebrows unified
- app/page.tsx — all 4 hero/section eyebrows + StepCard {n} + 3 footer heads now className="eyebrow"; removed inline eyebrowStyle/footerHeadStyle
- app/admin/disputes/page.tsx — infoLabelStyle aligned (600 weight, 0.08em, 10.5px)

### Phase W — Card padding standardized
- components/link/link-summary.tsx — padding "28px 32px"→"24px 28px"
- components/link/link-preview-card.tsx — padding 24→"24px 28px"
- components/link/create-link-form.tsx — cardPaddedStyle already "24px 28px"
- app/admin/disputes/page.tsx — dealCardStyle padding 20→"24px 28px", gap 16→20
- app/admin/disputes/page.tsx — infoStyle uses surface-2 bg, border-soft, r-2 radius, padding "12px 14px"

### Phase X — AppShell content gap 16→24
- components/app/app-shell.tsx — contentStyle gap 16→24

**Final checks:** npm run typecheck clean, npm run build clean, npm run test:unit 12/12 passing.

