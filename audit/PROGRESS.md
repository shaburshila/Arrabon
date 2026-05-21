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

## Plan-6 — completed

### Phase Z — Landing scroll-hint viewport-fixed
- app/globals.css — .landing-scroll-hint absolute→fixed, bottom 64→40
- app/globals.css — .landing-hero-section padding-bottom 120→0
- app/page.tsx — hint opacity formula vh-based → y/80

### Phase AA — Wallet pill polish
- components/app/wallet-status-pill.tsx — added `·` separator (separatorStyle), truncatePill() with U+2026 ellipsis, connectedPillStyle gap 7→10, padding-left 10→14

### Phase II — Density baseline matches prototype
- app/globals.css — --dens 1.18→1

### Phase LL — Hero/Receipt gradients verified
- app/globals.css — .deal-hero::before already matches prototype (linear-gradient 135deg gold-soft 0% → transparent 50%, opacity 0.6)
- app/globals.css — .receipt::before adjusted to prototype: top -140→-120, size 600→400, removed z-index/opacity overrides

**Final checks:** npm run typecheck clean, npm run build clean, npm run test:unit 12/12 passing.

## Plan-7 — completed

### Phase JJ — maxWidth unified to 1180 (prototype standard)
- app/create/page.tsx — maxWidth 1100→1180
- (my-deals, my-links, deal/[id], admin pages already at 1180; receipt at 760 left untouched)

### Phase CC — my-deals/my-links content
- app/my-deals/page.tsx — removed "· Seller {addr}" from sub-meta; removed unused truncateAddress import
- components/shared/status-pill.tsx — iconSize sm 12→14, md 14→16
- app/globals.css — .list-row__price 14.5→16 mono with letter-spacing -0.01em; .list-row__price-token → sans, 11→10.5, weight 600, letter-spacing 0.04em uppercase, ml 4→6

### Phase KK — Card paddings unified to 28
- components/link/link-summary.tsx — padding "24px 28px"→28
- components/link/link-preview-card.tsx — padding "24px 28px"→28
- components/link/create-link-form.tsx — cardPaddedStyle padding "24px 28px"→28
- app/admin/disputes/page.tsx — dealCardStyle padding "24px 28px"→28
- app/admin/denylist/page.tsx — sectionStyle padding 20→28
- .deal-hero kept at 32px 36px per prototype

### Phase GG — Price format 0.00
- lib/ui/format.ts — new formatUsdcPrice helper (2 fixed decimals, en-US thousands)
- components/deal/deal-status-card.tsx — hero amount via formatUsdcPrice
- components/deal/deal-details-card.tsx — Amount DetailRow via formatUsdcPrice
- components/link/link-summary.tsx — amount-num via formatUsdcPrice
- app/my-deals/page.tsx — DealRow price via formatUsdcPrice
- app/my-links/page.tsx — LinkRow price via formatUsdcPrice
- app/deal/[id]/receipt/page.tsx — getReceiptSub + Amount DetailRow via formatUsdcPrice

### Phase PP — Cross-check findings
- components/app/top-nav.tsx — headerInnerStyle padding 18px 32px → 14px 32px (matches prototype)
- app/globals.css — .receipt padding 56px 48px → 56px 48px 40px (matches prototype)
- app/globals.css — .receipt__title font-size 32→42 (matches prototype)
- app/globals.css — .list-row padding 20px 24px → 18px 24px (matches prototype)
- app/globals.css — .list-row grid-template-columns: minmax(0,1fr) 130px minmax(160px,auto) 160px 28px → minmax(0,1fr) 160px 140px 160px 28px (matches prototype)
- All other table entries verified — already match prototype (deal-hero/amount-num/amount-token, deal-countdown, timeline/node, pill, status-icon, iconbtn, btn sizes, copy-field, toast, modal, landing-hero/cta/footer/admin grids and paddings)
- Brand mark size 32 and brand word font-size 24 left at current values per plan's explicit "оставь" notes

**Final checks:** npm run typecheck clean, npm run build clean, npm run test:unit 12/12 passing.

## Plan-8 — completed

### Phase QQ — Landing hero
- app/globals.css — .landing-hero h1 (clamp(36,5vw,56)→64px, lh 1.1→1.12, ls -0.02→-0.012em, margin-bottom 20→40)
- app/globals.css — .landing-hero__sub (16→19px, lh 1.65→1.5, max-width 52→50ch)

### Phase RR — Deal hero
- components/deal/deal-status-card.tsx — heroTitleStyle fontSize 28→36; replaced inline eyebrowStyle with .eyebrow class and heroSubtitleStyle with .body class + inline {color:muted, maxWidth:60ch, margin:0}; removed both unused style consts

### Phase SS — LinkSummary 4-section card
- components/link/link-summary.tsx — restructured monolithic div into 4 full-bleed sections divided by edge-to-edge hairline borders: header (28x32, border-bottom), description (20x32, muted, border-bottom), details (8x32x20), gold trust footer (16x32, full-bleed, border-top)
- cardStyle: removed padding/gap, added overflow:hidden
- titleStyle fontSize 28→32 (lineHeight 1.15)
- amount-num fontSize 36 (inline override of default 48)
- seller line split: non-mono "Seller" label + mono address span
- shield icon utility-secure-subtle 14→18
- trust text updated to prototype copy

### Phase TT — Receipt
- app/globals.css — .receipt__seal margin-bottom 8→28 (margin:0 auto 28px); .receipt__sub lh 1.6→1.5, max-width 48→44ch, margin-bottom 24→32; .receipt__details padding 0/20→22/24, added margin-bottom 24, removed border, added text-align:left; .receipt__foot gap 10→12, removed margin-top/width; .receipt__foot-text text-align:left + line-height 1.45, removed flex/wrap/justify; .receipt__foot-text strong display:block fontSize 13 margin-bottom 2 letter-spacing 0.005em
- app/deal/[id]/receipt/page.tsx — restructured foot to seal-left + 2-line text ("Secured by Arrabon" strong line + descriptor); moved smart-contract address to a centered <p className="small"> note below the receipt card

### Phase UU — Deal countdown
- app/globals.css — .deal-countdown__value removed font-family:var(--font-mono), fontSize 14→14.5px

### Phase VV — AppShell padding
- components/app/app-shell.tsx — mainStyle side padding 16→32
- app/globals.css — added @media (max-width:768px) main padding-left/right 16px !important

### Phase WW — Top-nav sticky [applied]
- components/app/top-nav.tsx — headerStyle position fixed→sticky, removed left/right/width
- components/app/app-shell.tsx — mainStyle padding-top 128→32 (final: 32px 32px 64px)
- app/globals.css — scroll-margin-top 64px kept (correct for sticky nav)

### Phase XX/YY — landing polish
- app/page.tsx — sectionH2Style → .h2 className on all 3 section headings (prototype match), removed sectionH2Style const
- app/page.tsx — cardStyle padding "28px 24px" → 28

**Final checks:** npm run typecheck clean, npm run build clean, npm run test:unit 12/12 passing.

## Plan-9 — Stage 1 (P0) completed
- app/page.tsx — landing section h2 size restored to 44px (.h1 + style override) — fixes plan-8 XX regression
- components/link/link-action-card.tsx — PaymentSummary rewritten with mono fee rows + rule + giant 28px serif "You pay" amount; title "Book consultation" → "Fund this deal"; removed now-unused DetailRow import
- app/not-found.tsx — title clamp(28,5vw,42) → .h-display .not-found__title (96px desktop); accent <em> → <span className="accent">; removed unused titleStyle/ledeStyle/accentStyle
- app/globals.css — .not-found__title + .not-found__sub + mobile breakpoints (768/480)

**Stage 1 checks:** npm run typecheck clean, npm run build clean, npm run test:unit 12/12 passing.

## Plan-9 — Stage 2 (P1) completed

### Group 2.A — Landing
- app/page.tsx — hero eyebrow margin-bottom 28; scroll-hint icon 14→16; sectionInner maxWidth 1180→1280
- app/page.tsx — fullBleedSection padding 64→0 (paddings moved to per-section CSS)
- app/globals.css — .landing-{steps,benefits,stats,cta} per-section paddings 32/64, 64/64, 56/56, 56/56
- app/globals.css — landing-cta__actions margin-top 4→12, landing-cta__trust margin-top 16 added
- app/page.tsx — SiteFooter ArrabonSeal brand mark added

### Group 2.B — Create
- app/create/page.tsx — AppShell maxWidth 1180→1100
- app/globals.css — .create-split gap 32→28
- components/link/create-link-form.tsx — sectionStackStyle gap 18→20
- components/link/create-link-form.tsx — Payment section + hr.rule + Settlement DetailRow
- components/link/link-preview-card.tsx — divider margin "16/0/0"→"20/0" + border:0, inset seal 36→56, inset gap 12→14

### Group 2.C — BuyerLink
- app/globals.css — .link-page__topbar margin-bottom 40→24; .link-split__right top 32→88
- app/link/[id]/page.tsx — back button → .btn .btn--quiet .btn--sm; inset seal card added below LinkActionCard
- components/link/link-action-card.tsx — helper text below Pay btn

### Group 2.D — Deal
- app/deal/[id]/page.tsx — back link → .btn .btn--quiet .btn--sm + "Back to" prefix
- app/globals.css — .deal-split__left/right gap 16→20
- components/deal/key-times.tsx — StatusPill next to "Lifecycle"; padding 20→28
- components/deal/deal-details-card.tsx — section-label "Details" added; padding "0 20"→28
- 2.D.3 (hero title fallback to deal.title) — SKIPPED: DealReadModel has no `title` field and STATUS_TITLES already covers all 5 DealStatus values (fallback unreachable). Adding a title field would require API/type changes, out of scope for visual-only plan.

### Group 2.E — Receipt
- app/deal/[id]/receipt/page.tsx — back link → .btn .btn--quiet .btn--sm
- app/deal/[id]/receipt/page.tsx — DetailRows reorder + Status row added; "Tx hash" → "Settlement tx"

### Group 2.F — MyDeals/MyLinks
- app/my-deals/page.tsx + my-links/page.tsx — tab labels with counts (FILTERS → useMemo)
- app/my-deals/page.tsx + my-links/page.tsx — chevron Icon size 14→16
- app/globals.css — .search-input* classes
- both pages — search box → className="search-input"; removed inline searchBoxStyle/searchInputStyle

### Group 2.G — Admin
- app/globals.css — .admin-subnav__brand, .admin-subnav__tabs, .admin-subnav__tab classes
- app/admin/{disputes,disputes/[id],denylist}/page.tsx — subnav restructured with tab segments + usePathname active state; removed adminNavLinkStyle
- app/admin/disputes/page.tsx — tab labels with counts (VIEW_OPTIONS → viewOptions useMemo; AdminDisputesView type made explicit)

### Group 2.H — NotFound
- app/not-found.tsx — Btn md→lg with utility-arrow-left icon

### Group 2.I — Shared
- app/globals.css — .section-label class with ::after divider line
- components/shared/section-label.tsx — use .section-label className
- components/shared/segmented-tabs.tsx — match prototype .tabs visual (surface-2, border, gap 2, padding 8/16, fontSize 13, shadow-1)
- components/app/app-shell.tsx — mainStyle padding 32/32/64 → 56/32/96; flushBottom bottom override 64→96

**Stage 2 checks:** npm run typecheck clean, npm run build clean, npm run test:unit 12/12 passing.

## Plan-9 — Stage 3 (P2) completed
- app/page.tsx — scroll-hint parallax translateY; stack header marginBottom 40→32; cardDescStyle 13.5/1.65→13/1.5; trust icons variable (utility-secure-subtle / utility-wallet-connected); footer copy 12→13
- components/link/create-link-form.tsx — submit arrow-right icon (conditional on submit + not loading)
- components/link/link-preview-card.tsx — Price detail row mono value + muted USDC format
- components/deal/deal-status-card.tsx — hero status Icon size 20→22
- app/deal/[id]/page.tsx — countdown "Live" label fontSize 12→13
- app/deal/[id]/receipt/page.tsx — Copy ID button added in top row next to back link
- app/admin/disputes/page.tsx — dispute card title h2→h3 serif 22 (both open + resolved lists)
- components/shared/detail-row.tsx — accent color var(--gold)→var(--gold-deep)

**Stage 3 checks:** npm run typecheck clean, npm run build clean, npm run test:unit 12/12 passing.

## Plan-10 — completed

### Phase 1 — Background gradient
- app/globals.css — body background-image: 2 radial gradients (1200x600 at 80%/-100, 900x500 at -10%/120) with var(--gold-soft); background-attachment: fixed
- app/globals.css — [data-theme="dark"] body — darker gradient overrides (0.08 / 0.05 alpha)

### Phase 2 — Forms (.input / .textarea / .amount-input / .field*)
- app/globals.css — added .field, .field__label, .field__help, .field__row, .input, .textarea, .select, .input--mono, .amount-input, .amount-input__token, .rule classes
- components/shared/text-input.tsx — replaced inline style with className="input" (style still passes through via ...props)
- components/shared/text-area.tsx — replaced inline style with className="textarea"
- components/shared/form-field.tsx — replaced inline styles with className="field" + .field__label / .field__help; labels no longer UPPERCASE
- components/shared/token-amount-row.tsx — rewritten with .amount-input grid: removed blue $ circle icon (slop), removed detached pill, integrated token chip with surface-2 + left-border; serif 28px / 500 input with focus-within gold ring; label + sublabel moved outside .amount-input
- components/link/create-link-form.tsx — twoColumnRowStyle → className="field__row" (2.6, removed const)

### Phase 3 — List rows typography revert
- app/globals.css — .list-row__title gap 3→4
- app/globals.css — .list-row__title-name 15.5/600/letter-spacing → 14.5/500 (no letter-spacing)
- app/globals.css — .list-row__title-sub removed margin-top
- app/globals.css — .list-row__price 16/600/letter-spacing → 14/500 (no letter-spacing)
- app/globals.css — .list-row__price-token 10.5/600/uppercase/0.04em/ml 6 → 11/default-weight/no-case/no-letter-spacing/ml 4
- app/globals.css — .list-row__trailing 13.5 → 13

**Final checks:** npm run typecheck clean, npm run build clean, npm run test:unit 12/12 passing.

### Notes
- background-attachment: fixed used because we don't have an .app wrapper — gradient stays fixed relative to viewport (visually identical to prototype where .app has min-height 100vh)
- form labels reverted from UPPERCASE — prototype uses normal case "Title" / "Description"
- TokenAmountRow blue $ circle was iconographic noise not in prototype — removed
- DEVIATION (Phase 3 .list-row__price-token): plan's "Замени блоки" code omitted font-family, but that element is nested inside .list-row__price (var(--font-mono)), so it would inherit mono — contradicting the plan's own table ("✓ оставить sans") and acceptance ("«USDC» — обычный case"). Kept `font-family: var(--font-sans)` explicit to honor stated intent.

## Plan-11 — typography sweep

### Phase A — Eyebrows / section-labels unified
- app/not-found.tsx — eyebrow → className="eyebrow"; removed eyebrowStyle
- components/deal/deal-status-card.tsx — already className="eyebrow" (plan-8 RR) — verified, no-op
- components/deal/dispute-thread.tsx — eyebrow → className; removed eyebrowStyle
- components/shared/legal-page-layout.tsx — eyebrow → className; removed eyebrowStyle
- components/link/link-preview-card.tsx — eyebrow → className; removed eyebrow const
- components/deal/key-times.tsx — sectionLabelStyle → className="section-label section-label--no-rule"
- app/globals.css — added .section-label--no-rule modifier
- components/link/funding-progress.tsx — sectionLabelStyle → className="section-label" (both branches)
- components/link/link-action-card.tsx — labelStyle → className="section-label" ("Your link" + "Fund this deal")
- components/deal/deal-details-card.tsx — detailsLabelStyle → className="section-label"
- app/link/[id]/page.tsx — insetSealLabelStyle → className="tiny"
- app/page.tsx SiteFooter — already className="eyebrow" — verified, no-op

**Phase A checks:** npm run typecheck clean, npm run build clean, npm run test:unit 12/12 passing.

### Phase B — fontWeight 800 / 700 violations
- components/link/create-link-form.tsx — success branch: panelTitleStyle → className="h2", panelSubtitleStyle → className="lede", shareLabelStyle → className="tiny"; removed those 3 consts; shareUrlStyle --foreground→--ink, font-mono fallback removed (note: no h1Style existed — already absent)
- components/shared/progress-steps.tsx — marker fontWeight 800 → 600
- app/error.tsx — full rewrite using .not-found pattern (.h-display .not-found__title + .eyebrow + .lede); removed gradient-text slop / fontWeight 800 codeStyle / --accent / --panel / --radius legacy tokens
- components/deal/dispute-thread.tsx — refreshButtonStyle + labelStyle fontWeight 700 → 600
- app/global-error.tsx — left as-is: self-contained (own --g-* vars, separate <html> root, cannot rely on globals.css / app components)

**Phase B checks:** npm run typecheck clean, npm run build clean, npm run test:unit 12/12 passing.

### Phase C — Legacy token cleanup
- Mechanical sweep across all components/**/*.tsx + app/**/*.tsx:
  - var(--foreground) → var(--ink)
  - var(--accent) / var(--accent-hover) → var(--gold-deep)
  - var(--radius) → var(--r-4); var(--radius-sm) → var(--r-3); var(--radius-lg) → var(--r-5)
  - var(--panel) → var(--surface); var(--panel-muted) → var(--surface-2); var(--panel-hover) → var(--surface-3)
  - var(--input-bg) → var(--surface); var(--input-border) → var(--border)
  - var(--surface-raised) → var(--surface-2)
- components/shared/progress-steps.tsx — active marker: labelColor → gold-deep (text), markerBg → var(--gold) (background per C.2 rule), markerColor → var(--gold-on)
- components/shared/wallet-session-card.tsx — DELETED (D.9: unused, no imports anywhere)
- Verified: grep for var(--foreground|--accent|--radius|--panel|--input-bg|--input-border|--surface-raised) in components/ app/ → 0 results
- globals.css :root aliases left intact (backward-compat, per plan)
- var(--muted-bg) / var(--accent-muted) left as-is — not in plan scope (separate aliases, --muted-bg flagged OK in plan future-work)
- app/global-error.tsx untouched — uses isolated --g-* vars, not design tokens

**Phase C checks:** npm run typecheck clean, npm run build clean, npm run test:unit 12/12 passing.

### Phase D — Specific page typography
- components/link/create-link-form.tsx — success branch done in Phase B (h2/lede/tiny classes); D.1 — no further work
- app/admin/disputes/[id]/page.tsx — h1Style → className="h2"; subtitleStyle → .small; 3× sectionTitleStyle (h2) → h3 className="h3"; 2× sectionDescriptionStyle → .small; metaStyle → .small; countStyle → .small; confirmTextStyle → .body; removed 7 unused consts; dealTitleStyle kept (22, per plan)
- app/error.tsx — done in Phase B (.h-display + .eyebrow + .lede not-found pattern)
- app/global-error.tsx — left as-is (self-contained, isolated --g-* vars)
- components/shared/legal-page-layout.tsx — titleStyle clamp(30-42) → className="h1"; updatedStyle → .small; removed both consts; contentStyle kept as layout container (flex/gap, lineHeight 1.7 — not type-scale)
- app/top-nav.tsx brandWordStyle — left at 24px (approved deviation per plan D.5)
- components/link/link-preview-card.tsx titleStyle — left at 22/500 serif (per plan D.6)
- components/deal/dispute-thread.tsx titleStyle(compact) — left as-is (single conditional-sized element; plan D.7 marked soft "оставить или поднять")
- components/shared/token-amount-row.tsx — verified clean from plan-10 rewrite (no amountInputStyle/tokenIconStyle/$ circle)
- components/shared/wallet-session-card.tsx — deleted (D.9, handled in Phase C)

**Phase D checks:** npm run typecheck clean, npm run build clean, npm run test:unit 12/12 passing.

### Phase E — Utility text consistency
- app/page.tsx — cardDescStyle → className="small" (StepCard + BenefitCard); removed const
- app/page.tsx — footerTagStyle → className="small" + inline maxWidth 32ch; removed const
- app/page.tsx — footerCopyStyle left inline (muted-2 color, not a type-scale class)
- app/link/[id]/page.tsx — "Loading…" → className="small"
- app/deal/[id]/page.tsx — "Loading deal…" → className="small"
- app/deal/[id]/receipt/page.tsx — "Loading receipt…" → className="small" + inline textAlign; removed loadingStyle const

### Phase F — Final
- Grep verification (components/**/*.tsx + app/**/*.tsx): fontWeight: 800 → 0, var(--foreground) → 0, var(--accent) → 0, var(--radius) → 0, var(--panel) → 0, var(--input-bg|--input-border) → 0
- Note: app/globals.css `.receipt` rule still uses var(--panel) — left as-is (stylesheet rule, not component inline style; Phase C scoped to .tsx per plan; alias remains valid backward-compat token)

**Final checks:** npm run typecheck clean, npm run build clean, npm run test:unit 12/12 passing.

## Plan-12

### Part I — Cleanup after plan-11
- app/admin/disputes/page.tsx + disputes/[id]/page.tsx + denylist/page.tsx — smallButtonStyle fontWeight 700→500
- components/link/funding-progress.tsx — stepMarkerStyle + recoveryLinkStyle fontWeight 700→600
- components/link/link-action-card.tsx — myLinksLinkStyle fontWeight 700→600
- app/my-links/page.tsx — LINK_STATUS_CONFIG.Consumed.bg var(--accent-muted) → var(--gold-soft)
- app/globals.css — .receipt background var(--panel) → var(--surface)
- app/admin/denylist/page.tsx — select style={selectStyle} → className="select"; removed selectStyle const
- components/shared/wallet-session-card.tsx — already deleted in plan-11 Phase C (verified absent)

**Part I checks:** npm run typecheck clean, npm run build clean, npm run test:unit 12/12 passing.

### Part II — Icons audit
- components/icons/index.tsx — added 7 generic icons (utility-alert, utility-check, utility-circle, utility-external-link, utility-hourglass, utility-lock, utility-shield-check); utility-shield NOT added (no path in plan; utility-secure-subtle already serves plain-shield role)
- components/icons/index.tsx — added stroke?: number prop to Icon (default 2, backward-compatible)
- components/shared/status-pill.tsx — iconSize md 16→13 / sm 14→12; pass stroke={2.2}
- lib/ui/deal-status.ts — Path B: ConfirmPending status-confirm-pending→utility-hourglass, Disputed status-disputed→utility-alert, Funded status-funded-escrow-held→utility-lock, Released status-released→utility-check (Refunded kept status-refunded)
- app/my-links/page.tsx — linkIconByStatus: Open→utility-circle, Consumed→utility-lock, Draft→utility-hourglass (Cancelled/Expired kept)
- components/admin/risk-badge.tsx — Clear→utility-shield-check, Review→utility-alert, Blocked kept utility-secure-subtle (plain shield)
- components/shared/notice.tsx — added getDefaultIcon(tone): danger/warning→alert, success→shield-check, gold→secure-subtle, info/muted→info; icon always rendered
- components/shared/copy-btn.tsx — after-click icon status-released → utility-check
- components/link/funding-progress.tsx — done marker status-released → utility-check stroke 3
- components/shared/arrabon-seal.tsx — verified, no changes (II.8)

**Part II checks:** npm run typecheck clean, npm run test:unit 12/12 passing; npm run build — first run surfaced a spurious `/_document PageNotFoundError` from a stale .next cache; clean rebuild (rm -rf .next) succeeded with full route table, exit 0.

## Plan-13 — completed

### Phase 1 — Content width fix
- components/app/app-shell.tsx — moved padding from outer <main> to inner <div> with boxSizing:border-box + margin:0 auto; maxWidth now correctly includes the 64px horizontal padding (content area = maxWidth − 64, matches prototype .page semantics)
- app/globals.css — mobile padding override: `main` → `main > div`

### Phase 2 — List sub-meta cleanup
- app/my-deals/page.tsx — DealRow sub-meta: removed deal.id prefix, only date+time remains
- app/my-links/page.tsx — LinkRow sub-meta: removed link.id prefix, only date+time remains

### Phase 3 — borderRadius literals → tokens
- borderRadius: 8 → var(--r-2), borderRadius: 16 → var(--r-4) across components/**/*.tsx + app/**/*.tsx (excl. global-error.tsx)
- Files: app/admin/disputes/page.tsx, disputes/[id]/page.tsx, denylist/page.tsx, disputes/resolve-controls.tsx, components/app/wallet-status-pill.tsx, components/deal/dispute-thread.tsx
- Note: dispute-thread.tsx had 3 borderRadius:8 not listed in the plan's table — included for consistency (same value, in scope). Remaining numeric values (999 pill-round, 12, 10, 4) left as-is — outside the plan's explicit "8 и 16" scope; 999 has no radius token.

### Phase 4 — Theme toggle as iconbtn
- components/shared/theme-toggle.tsx — replaced inline btnStyle with className="iconbtn"; removed btnStyle const (now transparent bg / 36×36 / var(--r-2), identical to bell button)

### Phase 5 — Landing hero centering
- components/app/app-shell.tsx — added flushTop?: boolean prop (Variant A); padding top is `${flushTop ? 0 : 56}px`
- app/page.tsx — HomePage uses <AppShell flushBottom flushTop maxWidth={1180}>

**Final checks:** npm run typecheck clean, npm run build clean (full route table, exit 0), npm run test:unit 12/12 passing.

## Plan-14 — Production readiness + A11y

### Part I — Production readiness
- Phase 1 (SSR theme flash): app/layout.tsx — inline theme script now falls back to prefers-color-scheme when no stored theme; body suppressHydrationWarning added
- Phase 2 (iOS dvh): app/globals.css — 100vh → 100dvh in .landing-hero-section, .not-found, main; components/app/app-shell.tsx — mainStyle minHeight 100vh → 100dvh
- Phase 3 (iOS input zoom): app/globals.css — @media (max-width:768px) bumps .input/.textarea/.select/.amount-input input/.search-input input to 16px
- Phase 4 (autofill): app/globals.css — -webkit-autofill box-shadow/text-fill overrides (light + dark)
- Phase 5 (color-mix fallback): app/globals.css — @supports not(color-mix) rgba() fallbacks for .notice--*, .btn--danger:hover, .admin-badge
- Phase 6 (print): app/globals.css — @media print: hides nav/tabs/toasts, white bg, black text, no shadows, page-break-inside avoid
- Phase 7 (clipboard fallback): components/shared/copy-btn.tsx + components/app/wallet-status-pill.tsx — execCommand textarea fallback for non-secure (HTTP) contexts

**Part I checks:** npm run typecheck clean, npm run build clean (exit 0), npm run test:unit 12/12 passing.

### Part II — A11y (WCAG 2.1 AA)
- Phase 8 (focus visibility): app/globals.css — :focus-visible outlines for .btn/.iconbtn/.copy-field__btn/.admin-subnav__tab/.bottom-tabs__item/.toast__close/.modal__close/.landing-scroll-hint/.list-row/.search-input input + a links
- Phase 9 (reduced motion): app/globals.css — @media (prefers-reduced-motion: reduce) block; app/page.tsx — HeroSection onScroll early-returns if reduced motion
- Phase 10 (live regions): components/shared/toast.tsx — container role=region aria-live=polite aria-label; each toast role=alert(danger)/status; 3× loading texts (link/deal/receipt) role=status aria-live=polite; components/link/funding-progress.tsx — section-label id + steps list aria-labelledby + aria-live
- Phase 11 (modal a11y): components/shared/modal.tsx — rewritten with role=dialog, aria-modal, aria-labelledby/describedby, focus trap (Tab cycle), auto-focus first element, return-focus on close; siwe-sign-modal.tsx — labelledBy + h3 id="siwe-modal-title"
- Phase 12 (skip link): app/layout.tsx — skip-link <a> as first body child; components/app/app-shell.tsx — main id="main-content"; app/globals.css — .skip-link styles
- Phase 13 (search aria-label): app/my-deals/page.tsx + my-links/page.tsx — aria-label on search inputs
- Phase 14 (color contrast): app/globals.css — --muted-2 #8B847B → #757067 (Variant A, 4.5:1); components/link/funding-progress.tsx + components/deal/dispute-thread.tsx — link color var(--gold) → var(--gold-deep) (gold-as-text fails AA); dark-mode [data-theme=dark] color:var(--gold) rules left (light-on-dark, contrast OK)
- Phase 15 (footer landmark): app/page.tsx SiteFooter — footer role=contentinfo, grid div → nav aria-label="Footer navigation"

**Final checks:** npm run typecheck clean, npm run build clean (compiled successfully, exit 0), npm run test:unit 12/12 passing.

## Plan-15 — top-nav + landing fixes

### Part I — Top-nav
- Phase 1: components/app/top-nav.tsx — brand mark always /alpha-lock-full-gold.svg; removed isDark state + useEffect + MutationObserver + useState/useEffect import
- Phase 2: components/app/wallet-status-pill.tsx — connectedPillStyle height 34 removed, padding "0 6 0 14"→"6 6 6 14" (content-based 36px); connectPillStyle/wrongNetPillStyle height removed, padding vertical 8px; pillAvatarStyle 22→24
- Phase 3: components/shared/theme-toggle.tsx — Icon size 15→16
- Phase 4: components/app/top-nav.tsx — removed duplicate inline border on bell button (.iconbtn class already provides it)
- Phase 5: app/globals.css — .iconbtn--tooltip:hover color var(--muted) → var(--muted-2)

**Part I checks:** npm run typecheck clean (exit 0), npm run test:unit 12/12 passing. npm run build deferred — environment network is down and next/font/google fetches fonts at build time (Retrying… TLS disconnect); to be run when network returns.

### Part II — Landing page
- Phase 6: app/page.tsx — SiteFooter brand <ArrabonSeal size=28> → <img src="/alpha-lock-full-gold.svg" 28×28> (matches top-nav); ArrabonSeal still used in hero/CTA/footer-base
- Phase 7: app/page.tsx — TRUST_ITEMS 3 distinct icons: utility-secure-subtle / utility-lock / utility-shield-check
- Phase 8: app/page.tsx — cardStyle added boxShadow var(--shadow-2) (StepCard + BenefitCard soft elevation)
- Phase 9: app/page.tsx — scroll-hint chevron stroke 1.6; CTA trust icons stroke 1.7; BenefitCard icons stroke 1.8
- Phase 10: app/page.tsx — removed no-op inline paddingTop:0 on .landing-cta__inner; stats wrapped in <div className="landing-stat">; CTA h2 className "landing-cta__title" → "h1 landing-cta__title"

**Part II checks:** npm run typecheck clean (exit 0), npm run test:unit 12/12 passing. npm run build deferred (same environment network blocker as Part I).

**Plan-15 — npm run build:** re-run after environment network recovered → compiled successfully, exit 0, full route table. All three checks now confirmed for Plan-15 (typecheck + build + test:unit 12/12).

## Plan-16 — completed (/create page audit)

### Part I — Structural

#### Phase 1 — ActionPanel defaults match prototype Card
- components/shared/action-panel.tsx — borderRadius var(--r-5)→var(--r-3); border var(--border)→var(--border-soft); boxShadow var(--shadow-panel)→var(--shadow-2)
- (affects ALL ActionPanel usage: create form, DealDetailsCard, KeyTimes, my-deals/my-links list panels, admin disputes — system-wide visual lighter/less rounded)

#### Phase 2 — Preview section-label + nested eyebrow
- components/link/link-preview-card.tsx — restructured preview: section-label "Preview" (marginBottom 18, with divider line via ::after) → stack-12 inner with eyebrow "Consultation" + h3 + description; removed descStyle const; description now `.small` class + inline color; placeholder "Consultation title" → "Untitled consultation"

#### Phase 3 — Preview inset padding 28
- components/link/link-preview-card.tsx — insetStyle padding "14px 16px" → 28

#### Phase 4 — Preview stack gap 20
- components/link/link-preview-card.tsx — stack.gap 16→20

**Part I checks:** npm run typecheck clean (exit 0), npm run build compiled successfully (exit 0), npm run test:unit 12/12 passing.

### Part II — Type / copy

#### Phase 5 — Inset title .tiny class
- components/link/link-preview-card.tsx — inset title → className="tiny" (CAPS 0.06em muted); subtitle → className="small" + inline color/marginTop 4; removed insetTitleStyle/insetSubStyle consts

#### Phase 6 — Description helper
- components/link/create-link-form.tsx — Description helper appended ". Markdown not supported."

#### Phase 7 — Payment sublabel wording
- components/link/create-link-form.tsx — TokenAmountRow sublabel: "You will receive" → "You receive"; "3% platform fee" → "3% fee"

#### Phase 8 — Duration "min" → "minutes"
- components/link/link-preview-card.tsx — Duration DetailRow value

#### Phase 9 — Preview cardStyle boxShadow
- components/link/link-preview-card.tsx — cardStyle: border var(--border)→var(--border-soft); added boxShadow var(--shadow-2)

**Part II checks:** npm run typecheck clean (exit 0), npm run build compiled successfully (exit 0), npm run test:unit 12/12 passing.

### Part III — Page header

#### Phase 10 — pageHeader marginBottom 40
- app/create/page.tsx — pageHeaderStyle marginBottom 48→40 (matches prototype .page__head)

**Part III checks:** npm run typecheck clean (exit 0), npm run build compiled successfully (exit 0), npm run test:unit 12/12 passing.

### Part IV — Cleanup / DRY

#### Phase 11 — helperTextStyle → .field__help
- components/link/create-link-form.tsx — inline helperTextStyle (link-expiration helper <p>) → className="field__help"; removed helperTextStyle const
- DEVIATION: plan called `.field__help` values "identical" to helperTextStyle, but the class lacked `margin: 0` (helperTextStyle had it). Applied to a `<p>` element this would gain browser-default vertical margins. Adapted: added `margin: 0` to `.field__help` in app/globals.css. Harmless to existing `<span>` usages (vertical margin does not apply to inline elements).

#### Phase 12 — TokenAmountRow label/helper → field classes
- components/shared/token-amount-row.tsx — labelStyle → className="field__label"; helperStyle → className="field__help"; removed both consts (affects /create payment row + receipt)

**Part IV checks:** npm run typecheck clean (exit 0), npm run build compiled successfully (exit 0), npm run test:unit 12/12 passing.

## Plan-17 — completed (/deal/[id] + /link/[id])

### Part I — /deal/[id]

#### Phase 1 — MeetingUrlCard idle state
- components/deal/meeting-url-card.tsx — idle state wrapped in flex column gap 12: added .copy-field with 32 bullet chars + gold "Hidden" pill (utility-lock icon); Reveal btn; helper "URL is encrypted server-side and visible only to deal participants."; imported Icon

#### Phase 2 — DealSealCard always present
- components/deal/receipt-inset.tsx renamed → components/deal/deal-seal-card.tsx; ReceiptInset → DealSealCard, prop visible → isSettled; always renders ArrabonSeal 56 (tone="auto") + "Secured by Arrabon" tiny + "Onchain escrow · Base · Deal AR-XXXX" muted; "View receipt" ghost btn (utility-external-link) only when isSettled
- app/deal/[id]/page.tsx — import + usage swapped ReceiptInset → DealSealCard

#### Phase 3 — Padding 28 + section-label
- components/deal/meeting-url-card.tsx — cardStyle padding 20→28; all 6 `<p style={labelStyle}>Meeting link</p>` → `<p className="section-label" style={{marginBottom:18}}>`; removed labelStyle const
- components/deal/deal-actions-card.tsx — ActionPanel padding 20→28; inline label → `<p className="section-label" style={{marginBottom:14}}>Action</p>`; "Actions" → "Action"

#### Phase 4 — DealDetailsCard section-label gap
- components/deal/deal-details-card.tsx — section-label marginBottom 14 added

#### Phase 5 — LifecycleTimeline enrichments
- components/deal/lifecycle-timeline.tsx — current step shows inline StatusPill (size md, tone from toneFromStatus); description now visible for all states (removed `step.state !== "idle"` gate); imported StatusPill + toneFromStatus
- DEVIATION: plan diff used `toneFromStatus(step.key as any)`; used `as DealStatus` instead (step.key is `string`; `as any` would trip ESLint no-explicit-any during `next build`). toneFromStatus has a default→"gray" branch so non-DealStatus keys like "Open" stay safe.

#### Phase 6 — Misc
- app/deal/[id]/page.tsx — back link marginBottom 16→20; countdown utility-time icon stroke 1.8 added
- Phase 6.3 — verified .deal-split__right already `gap: 20px` (no change needed)

**Part I checks:** npm run typecheck clean (exit 0), npm run build compiled successfully (exit 0), npm run test:unit 12/12 passing.

### Part II — /link/[id]

#### Phase 7 — LinkActionCard padding 28 + section-label marginBottom 18
- components/link/link-action-card.tsx — both ActionPanel padding 20→28; section-label marginBottom 18 ("Your link" seller card + "Fund this deal")

#### Phase 8 — PaymentSummary flat (no surface-2 wrapper)
- components/link/link-action-card.tsx — removed paymentSummaryStyle wrapper, fees render flat in flex column gap 12; removed "Non-refundable escrow service fee" text + feeNoteStyle const + paymentSummaryStyle const

#### Phase 9 — Inset seal padding 28
- app/link/[id]/page.tsx — insetSealCardStyle padding 20→28

#### Phase 10 — Right column gap 20
- app/globals.css — .link-split__right gap 16→20

#### Phase 11 — LinkSummary header stack-12
- components/link/link-summary.tsx — left header block wrapped in className="stack-12"; titleStyle margin "10px 0 6px" → 0

#### Phase 12 — Shield icon stroke + color
- components/link/link-summary.tsx — utility-secure-subtle icon: stroke 1.8 + style color var(--gold-deep)

#### Phase 13 — Duration format
- components/link/link-summary.tsx — Duration value: removed " · {timezone}" suffix; uses raw `${duration_minutes} minutes` (chose plan's closer-to-prototype option)
- DEVIATION: that option drops the only call site of the local `formatDuration` helper; removed the now-unused `formatDuration` function to keep ESLint clean during `next build`. `link.timezone` still used by Scheduled/Expires rows — no unused import.

#### Phase 14 — Link ID bordered
- components/link/link-summary.tsx — removed bordered={false} on Link ID DetailRow (separator now drawn above it)

**Part II checks:** npm run typecheck clean (exit 0), npm run build compiled successfully (exit 0), npm run test:unit 12/12 passing.

## Plan-18 — completed (/my-deals + /my-links)

### Phase 1 — StatusPill vertical center + proper height
- components/shared/status-pill.tsx — removed alignSelf: "flex-start"; smStyle: height 24, padding "0 10px" (was "2px 8px"); mdStyle: height 28, padding "0 12px", fontSize 14→13 (was "4px 12px")
- (affects: list rows in my-deals/my-links, LifecycleTimeline current step pill, admin disputes badges, any StatusPill consumer)

### Phase 2 — Chevron stroke 1.8
- app/my-deals/page.tsx — DealRow chevron Icon stroke 1.8
- app/my-links/page.tsx — LinkRow chevron Icon stroke 1.8

### Phase 3 — Page header marginBottom 40
- app/my-deals/page.tsx — pageHeaderStyle marginBottom 32→40
- app/my-links/page.tsx — pageHeaderStyle marginBottom 32→40

### Phase 4 — EmptyState Icon stroke 1.4
- app/my-deals/page.tsx — 3 EmptyState icons (wallet-connected, search ×2) get stroke=1.4 (WalletAuthStatePanel size-32 icon left untouched — not an EmptyState)
- app/my-links/page.tsx — 3 EmptyState icons (plus, search ×2) get stroke=1.4 (WalletAuthStatePanel size-32 icon left untouched)

### Phase 5 — isLast cleanup
- app/my-deals/page.tsx — DealRow signature: removed unused isLast
- app/my-links/page.tsx — LinkRow signature: removed unused isLast

**Plan-18 checks:** npm run typecheck clean (exit 0), npm run build compiled successfully (exit 0), npm run test:unit 12/12 passing.

## Plan-19 — completed (not-found / error / receipt / wallet pill)

### Phase 1 — not-found inner wrapper (max-width 540)
- app/globals.css — added .not-found__inner (flex column, align-items center, gap 18, max-width 540, margin 0 auto); removed gap 16px from .not-found
- app/not-found.tsx — wrapped content in <div className="not-found__inner">
- app/error.tsx — same

### Phase 2 — Receipt Refunded title + sub voice
- app/deal/[id]/receipt/page.tsx — getReceiptTitle Refunded: "Funds refunded" → "Refund issued"
- getReceiptSub: applied plan's prototype-voice copy for both Released ("Your consultation has been settled...") and Refunded ("The deal has been refunded to the buyer per admin resolution.") — chose the plan's primary diff over the keep-current alternative; formatUsdcPrice still used by Amount row + fallback sub

### Phase 3 — Receipt Status pill purple for Refunded
- app/deal/[id]/receipt/page.tsx — tone "accent" → "purple" for Refunded; "success" → "green" for Released

### Phase 4 — Settlement tx last 6 chars
- app/deal/[id]/receipt/page.tsx — anchor text: added …{tx_hash.slice(-6)} suffix

### Phase 5 — Receipt dates with timezone
- app/deal/[id]/receipt/page.tsx — Scheduled + Released formatDate(... { showTimeZoneName: true })

### Phase 6 — Wallet pill address
- components/app/wallet-status-pill.tsx — pillAddressStyle fontSize 12→12.5, removed letterSpacing -0.01em
- components/app/wallet-status-pill.tsx — getAddress(session.address) for EIP-55 checksum in pill + dropdown header; imported getAddress from viem
- components/app/wallet-status-pill.tsx — dropdownAddressStyle removed letterSpacing -0.01em

**Plan-19 checks:** npm run typecheck clean (exit 0), npm run build compiled successfully (exit 0), npm run test:unit 12/12 passing.

## Plan-20 — completed (admin pages)

### Phase 1 — StatusPill tone fix
- app/admin/disputes/page.tsx — resolved list StatusPill: tone success/accent → green/purple
- DEVIATION: app/admin/disputes/[id]/page.tsx has NO resolved-status StatusPill — the detail page only renders disputed deals with a hardcoded `<StatusPill label="Disputed" tone="danger">`. Nothing matching success/accent exists there; no change applied.

### Phase 2 — Page header marginBottom 40
- app/admin/disputes/page.tsx — headerStyle marginBottom 40 added
- app/admin/disputes/[id]/page.tsx — headerStyle marginBottom 40 added
- app/admin/denylist/page.tsx — headerStyle marginBottom 40 added

### Phase 3 — Ellipsis character
- app/admin/disputes/page.tsx — truncateTxHash uses "…" (U+2026) instead of "..."

### Phase 4 — Confirm dialog padding
- app/admin/disputes/resolve-controls.tsx — confirmStyle padding 12 → "12px 14px" (matches admin-acknowledge / compliance-check 12×14)

### Phase 5 — Denylist sweep (verification only, no changes)
- app/admin/denylist/page.tsx — verified: ActionPanel sectionStyle padding 28 ✓; section headings use `.h2` class ✓; form helper text via FormField (`.field__help`) ✓; entry cards use shared DetailRow ✓; headerStyle marginBottom 40 applied in Phase 2. No code change required.

### Phase 6 — Refresh button
- app/admin/disputes/page.tsx — Refresh button → <Btn variant="ghost" size="sm">; removed smallButtonStyle const
- NOTE: app/admin/disputes/[id]/page.tsx and app/admin/denylist/page.tsx have the same inline `smallButtonStyle` Refresh-button pattern; left untouched — Phase 6 scope is disputes/page.tsx only per the plan.

**Plan-20 checks:** npm run typecheck clean (exit 0), npm run build compiled successfully (exit 0), npm run test:unit 12/12 passing.

## Plan-21 — Final audit completed

### Step 1 — Grep audit
- Legacy tokens (--foreground / --accent / --radius / --panel / --input-bg/border): 0 results ✓
- fontWeight 800 / 700: 0 results ✓
- Inline borderRadius 8/16: 0 in scope ✓ (2 hits in app/global-error.tsx — excluded per plan, file is self-contained)
- Hex colors in code: 0 in scope ✓ (1 hit `color:"#ffffff"` in app/global-error.tsx — excluded per plan)
- `as any` casts: 0 results ✓ (confirms Plan-17 Phase 5 `as DealStatus` choice)
- wallet-session-card imports: 0 results ✓
- ISSUE FOUND: literal `...` instead of `…` (U+2026) present in ~20 user-facing loading/status strings — components/link/create-link-form.tsx (3×), components/link/funding-progress.tsx (7×), components/link/status-notice.tsx (1×), components/deal/dispute-thread.tsx (1×), app/admin/disputes/page.tsx (4×), app/admin/disputes/[id]/page.tsx (5× incl. loading notice), app/admin/denylist/page.tsx (1× loading notice). These are conventional in-progress loading ellipses (low priority); placeholders ("0x...", "https://...") intentionally excluded. → Plan-22 candidate.

### Step 2 — Mobile sweep (static verification)
- Responsive infrastructure verified via globals.css grep: media queries present at 900px / 768px / 600px / 480px breakpoints + landscape `max-height:480px and orientation:landscape`; `.list-row` mobile `grid-template-areas` restructure present (line ~1700); iOS input `font-size:16px` present in mobile media query.
- Live device/DevTools visual check NOT run autonomously (no browser session) — infrastructure present but pixel-level verification deferred.

### Step 3 — Dark mode (static verification)
- 16 `[data-theme="dark"]` rule blocks + `@media (prefers-color-scheme: dark)` present in globals.css — token-driven dark mode infrastructure intact.
- Live visual check NOT run autonomously.

### Step 4 — A11y
- No Playwright a11y test suite exists in the repo; axe/Lighthouse audit requires a live browser — NOT run autonomously. Prior plans (per PROGRESS Plan-?? a11y work) added aria-labels, live regions, focus trap, skip link, color-contrast fixes.

### Step 5 — Performance
- Build sizes: First Load JS shared 102 kB; per-route First Load 147–192 kB — all well under the 200 kB target ✓. Largest: /deal/[id] 192 kB, /admin/disputes 189 kB.
- ISSUE FOUND: `npm run build` emits warnings — `@metamask/sdk` cannot resolve optional peer `@react-native-async-storage/async-storage`. This is a third-party node_modules warning (React-Native-only optional dep, harmless for web), NOT project code. Not actionable in project source; build still exits 0.
- Lighthouse performance score NOT measured (needs live browser).

### Step 6 — Cross-browser
- Manual multi-browser check (Chrome/Safari/Firefox/Mobile Safari) NOT run autonomously — requires real browsers/devices.

### Step 7 — Cleanup applied
- 7.1 — Refresh button consistency: app/admin/disputes/[id]/page.tsx + app/admin/denylist/page.tsx — `<button style={smallButtonStyle}>` → `<Btn variant="ghost" size="sm">`; removed `smallButtonStyle` const from both files (completes the Plan-20 Phase 6 note).
- 7.2 — TODO/FIXME/XXX/HACK in components/ + app/: 0 results ✓
- 7.3 — Dead code: ISSUE FOUND — `components/shared/live-badge.tsx` (LiveBadge) and `components/shared/progress-steps.tsx` (ProgressSteps) have 0 usages across components/ + app/. Deletion candidates. → Plan-22 candidate.

### Step 8 — Docs
- audit/PROGRESS.md contains sections for all plans through Plan-21 ✓

**Plan-21 checks:** npm run typecheck clean (exit 0), npm run build compiled successfully with warnings (third-party only, exit 0), npm run test:unit 12/12 passing.

### Plan-21 — Findings summary (→ Plan-22 candidates)
1. [P2] Literal `...` → `…` in ~20 loading/status strings.
2. [P2] Delete unused components/shared/live-badge.tsx + components/shared/progress-steps.tsx.
3. Browser-dependent steps (mobile visual, dark-mode visual, a11y/Lighthouse, cross-browser) not verifiable in this headless environment — infrastructure verified statically.

## Plan-22 — Filter counts (implemented, stack-adapted)

Plan-22 is an architectural blueprint ("не diff-уровень… передавать разработчику для review + adjustments под конкретный codebase"). Implemented the stack-appropriate core that delivers the plan's stated problem fix + acceptance criterion #1.

### Stack investigation (decides what applies)
- `@tanstack/react-query@5.87.1` installed; `QueryClientProvider` wired in components/providers.tsx — but /my-deals + /my-links pages use raw `useState`/`useEffect`/`fetch`, not `useQuery`.
- No Redis / ioredis. DB layer is Supabase via `server/repositories/*`.
- KEY ARCHITECTURAL FINDING: `listMyBuyerDeals` and `listMyConsultationLinks` already load the **entire** user dataset (`getAllBuyerDealRows` / `getAllByCreatorUserId`), filter in JS, then `.slice()` for pagination. There is NO SQL-side filtering or pagination. → accurate per-filter counts cost **zero extra DB queries** — they are pure in-memory `.filter().length` over rows already fetched.

### Implemented
- server/services/my-deals.ts — added `MyDealsCounts` / `MyBuyerDealsPage` types + `computeMyDealsCounts()` (5 in-memory filter passes over already-loaded rows) + `listMyBuyerDealsWithCounts()`. Refactored `listMyBuyerDeals()` to delegate to it (single code path, unchanged signature/return — existing tests unaffected).
- server/services/consultation-links.ts — added `MyLinksCounts` / `MyConsultationLinksPage` + `computeMyLinksCounts()` (7 filters) + `listMyConsultationLinksWithCounts()`. Refactored `listMyConsultationLinks()` to delegate.
- app/api/me/deals/route.ts — `?include_counts=true` → returns `{ deals, counts }`; absent → bare `MyDeal[]` (backward-compatible, no breaking change to existing callers/tests).
- app/api/links/route.ts — same `?include_counts=true` → `{ links, counts }`.
- lib/api/deals.ts — `MyDealsCounts` / `MyDealsPage` types + `fetchMyDealsWithCounts()`.
- lib/api/links.ts — `MyLinksCounts` / `MyLinksPage` types + `fetchMyLinksWithCounts()`.
- app/my-deals/page.tsx + app/my-links/page.tsx — switched list fetch to the `*WithCounts` variant; added `counts` state; `FILTERS` now show real per-filter counts via `filterLabel()` helper (zero/undefined count → bare label, per plan §2.3). Replaces the old misleading `All · {deals.length-of-current-page}`.

### Deviations from the blueprint — and why (stack-driven)
- Phase 1.1 SQL `COUNT(*) FILTER` + Phase 3 composite indexes — N/A. The codebase does no SQL-side filtering/pagination; it loads all rows and filters in JS. A single SQL aggregation would only matter if filtering moved to SQL — that is a much larger data-layer refactor, explicitly developer-review territory. Counts here are computed for free from the already-loaded set.
- Phase 1.3/1.4 Redis server-side cache + invalidation-on-mutation — N/A. No Redis in the project; and since counts are free and recomputed on every list fetch, they are always fresh — no cache to keep consistent. The list page remounts/refetches after any mutation flow, so counts self-refresh.
- Phase 2.1/2.2 TanStack Query `useQuery` hooks for counts + `invalidateQueries` — DEFERRED. The pages are not on `useQuery` (raw fetch). Counts arrive inline with the list response, so a separate cached query would be redundant. Migrating both pages to `useQuery` is a larger refactor outside this change's risk budget.
- Phase 2.4 optimistic UI — DEFERRED (depends on the `useQuery`/`useMutation` migration above).
- Phase 4 feature flag / Phase "future" materialized views / SSE / edge cache — out of scope (plan marks them optional/future).

### Acceptance check
- ✓ Every filter tab shows the real count of the whole dataset (or hides it when 0) — replaces the misleading current-page-length count.
- ✓ One round trip per list load (list + counts inline).
- ✓ Counts refresh after mutations (list page refetches on mount/return).
- N/A or deferred: server/client cache hit ratio, optimistic `+1`, p95 cache latency — see deviations.

**Plan-22 checks:** npm run typecheck clean (exit 0); npm run build compiled successfully (third-party warnings only, exit 0); npm run test:unit 12/12; test:unit:services 34/34; my-deals-service.test.ts 10/10 — service refactor (delegation) left all existing service tests green.
