# Claude Code — план №11 (typography audit)

**Дата:** 2026‑05‑21
**Контекст:** ревью после plan-10. Полный typography sweep по всем компонентам (51 файл) и страницам (12 файлов). Нашёл системную проблему: **inline‑дубли type scale классов**, **legacy tokens**, **fontWeight: 800 violations** и неконсистентные eyebrow/section-label.

Все правки чисто визуальные / косметические. Логику не трогаем.

**Правила:**
- Не коммить ничего.
- После каждой фазы — `npm run typecheck && npm run build && npm run test:unit`.
- После каждой фазы — запись в `audit/PROGRESS.md` (секция `## Plan-11`).

---

# Контекст: что определяет «правильную» типографику

`app/globals.css` имеет полный type scale (CSS-классы):
- `.h-display` — 56px serif 500 (hero/landing/404 title)
- `.h1` — 40px serif 500 (page title)
- `.h2` — 28px serif 500 (section title, card title)
- `.h3` — 16px sans 600 (card subtitle)
- `.lede` — 17px sans (page subtitle)
- `.body` — 14.5px sans (paragraph)
- `.small` — 13px sans muted (caption)
- `.tiny` — 11.5px sans 600 upper 0.06em (label)
- `.mono` — 13px IBM Plex Mono (addresses, IDs)
- `.eyebrow` — 11px sans 600 upper 0.18em (label above title)
- `.section-label` — 11px sans 600 upper 0.16em **+ горизонтальная линия после текста** (section header)

**Проблема:** компоненты часто пересоздают эти стили inline с произвольными значениями вместо использования класса. Получается ~10 разных «eyebrows» с разным letter-spacing (0.08em / 0.1em / 0.16em / 0.18em) и весом (600/700/800). Визуально каждая страница имеет свой вариант одного и того же label'а.

---

# Phase A — Унификация eyebrows и section-labels

**Самая частая проблема — 12+ inline‑дубликатов одного класса.**

## A.1 — Все inline eyebrows → `className="eyebrow"`

Прототип `.eyebrow`: `font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted)`.

Файлы с inline eyebrow‑style (везде weight 700 — не 600):

### `app/not-found.tsx`
```diff
- <p style={eyebrowStyle}>Error 404</p>
+ <p className="eyebrow">Error 404</p>
```
Удалить `eyebrowStyle` const.

### `components/deal/deal-status-card.tsx`
```diff
- <p style={eyebrowStyle}>Deal · {deal.id.slice(0, 8).toUpperCase()}</p>
+ <p className="eyebrow">Deal · {deal.id.slice(0, 8).toUpperCase()}</p>
```
Удалить `eyebrowStyle` const (после plan-8 RR уже было упомянуто, проверь что не вернулось).

### `components/deal/dispute-thread.tsx`
```diff
- <p style={eyebrowStyle}>{eyebrowText}</p>
+ <p className="eyebrow">{eyebrowText}</p>
```
Удалить `eyebrowStyle` const.

### `components/shared/legal-page-layout.tsx`
```diff
- <p style={eyebrowStyle}>{eyebrow}</p>
+ <p className="eyebrow">{eyebrow}</p>
```
Удалить `eyebrowStyle` const (fontSize 12 → 11 через класс; letter-spacing 0.08em → 0.18em через класс).

### `components/link/link-preview-card.tsx`
```diff
- <p style={eyebrow}>Preview</p>
+ <p className="eyebrow">Preview</p>
```
Удалить `eyebrow` const (letter-spacing 0.16em → 0.18em через класс).

## A.2 — Все inline section-labels → `<SectionLabel>` или `className="section-label"`

Прототип `.section-label`: `font-size: 11px; font-weight: 600; letter-spacing: 0.16em; uppercase; color: var(--muted)` **+ `::after` divider line** (горизонтальная линия после текста занимает оставшееся место).

После plan-9 I.1 класс `.section-label` уже определён в globals.css, а `<SectionLabel>` компонент использует его. Но inline дубли остались — у них weight 700 и нет divider line.

### `components/deal/key-times.tsx`
```diff
- <p style={sectionLabelStyle}>Lifecycle</p>
+ <p className="section-label" style={{ margin: 0 }}>Lifecycle</p>
```
Удалить `sectionLabelStyle` const. **Внимание:** этот компонент рендерит `<p>` внутри `<div style={headRowStyle}>` (с StatusPill справа). Класс `.section-label` использует `display: flex` + `::after` для divider. Внутри row layout это создаст лишнюю линию. Решение:
- Либо использовать `<SectionLabel>` компонент с явным `style={{ flex: "0 0 auto" }}` чтобы divider line не растягивалась дальше pill
- Либо для этого конкретного случая создать вариант без divider: добавить класс `.section-label--no-rule` в globals.css и использовать его

Рекомендую второй вариант. В `app/globals.css`:
```css
.section-label--no-rule::after { display: none; }
```
И:
```tsx
<p className="section-label section-label--no-rule">Lifecycle</p>
```

### `components/link/funding-progress.tsx`
```diff
- <p style={sectionLabelStyle}>{title}</p>
+ <p className="section-label">{title}</p>
```
Удалить `sectionLabelStyle` const. Этот рендерится в полную ширину — divider line подойдёт.

### `components/link/link-action-card.tsx`
```diff
- <p style={labelStyle}>Fund this deal</p>
+ <p className="section-label">Fund this deal</p>
```
Удалить `labelStyle` const. Здесь tоже divider line подойдёт (action card в полную ширину).

### `components/deal/deal-details-card.tsx`
Сейчас:
```tsx
<p style={detailsLabelStyle}>Details</p>
```
Замени на `className="section-label"`. Удали const.

### `app/link/[id]/page.tsx` (inset seal card label)
```diff
- <p style={insetSealLabelStyle}>Secured by Arrabon</p>
+ <p className="tiny">Secured by Arrabon</p>
```
Удалить `insetSealLabelStyle` const. `.tiny` ближе по смыслу (это caption внутри inset card, не section header) — 11.5px upper 0.06em weight 600.

## A.3 — Verify SiteFooter footer head labels уже на `eyebrow`

(уже сделано в plan-5 V, должно быть OK — просто проверь что `app/page.tsx` SiteFooter `<p className="eyebrow">Product</p>` etc.)

## Phase A acceptance
- Eyebrow’ы по всему сайту визуально идентичны (один letter-spacing, один weight, один color).
- Section labels рендерят горизонтальную линию после текста (как в прототипе).
- Все `eyebrowStyle` / `sectionLabelStyle` / `labelStyle` const’ы (10+) удалены.

---

# Phase B — `fontWeight: 800` violations

Type scale не использует weight 800. Это slop из старого кода. Везде заменить.

## B.1 — `components/link/create-link-form.tsx` h1Style (success branch)

Сейчас:
```tsx
const h1Style = {
  fontSize: 24,
  fontWeight: 800,        // ← violation
  letterSpacing: "0",
  margin: "0 0 8px",
};
```

Используется в "Link created" success state. Заменить через className:
```diff
- <h2 style={panelTitleStyle}>Link created</h2>
+ <h2 className="h2">Link created</h2>
```

Удалить `h1Style` (не используется в коде) и `panelTitleStyle` (заменить на класс `.h2`).

Также `panelSubtitleStyle` → заменить на `<p className="lede">…</p>` (или .body если хочется тоньше).

## B.2 — `components/shared/progress-steps.tsx` marker fontWeight 800

```diff
- fontSize: 13,
- fontWeight: 800,
+ fontSize: 13,
+ fontWeight: 600,
```

## B.3 — `app/error.tsx` "404" code

```diff
- fontSize: 72,
- fontWeight: 800,
+ fontSize: 72,
+ fontWeight: 500,
```

Это error код типа `<h1>500</h1>` или `<h1>404</h1>`. Должен быть serif 500 (как `.h-display` / .not-found__title). Лучше переписать целиком через `.h-display`:

```diff
- <h1 style={codeStyle}>500</h1>
+ <h1 className="h-display" style={{ fontSize: 72 }}>500</h1>
```
И удалить `WebkitTextFillColor` / `backgroundClip` / `transparent` (это «gradient text» эффект — slop). Просто чёрный/gold deep:
```tsx
<h1 className="h-display" style={{ color: "var(--gold-deep)", fontSize: 72 }}>500</h1>
```

## B.4 — `components/shared/token-amount-row.tsx` — `$` icon fontWeight 800

Если после plan-10 этот icon ещё рендерится в каком-то режиме — убрать. По плану-10 он должен быть полностью удалён в Phase 2.4.

Проверь файл — если код синего circle с `$` ещё в TokenAmountRow, удали оставшийся фрагмент `tokenIconStyle`.

## B.5 — `components/deal/dispute-thread.tsx` — несколько fontWeight 700

```diff
- fontSize: 13,
- fontWeight: 700,        // submitButtonStyle, labelStyle
+ fontSize: 13,
+ fontWeight: 600,
```

700 → 600. Применить в `submitButtonStyle`, `labelStyle`, `replyButtonStyle`.

## Phase B acceptance
- Поиск `fontWeight: 800` в проекте даёт 0 результатов.
- `fontWeight: 700` остался только там, где он осмысленно (например, `.admin-badge` использует 700 — это OK, дизайн-токен).

---

# Phase C — Legacy token cleanup

Старые алиасы `--foreground` / `--accent` / `--input-bg` / `--input-border` / `--radius` всё ещё используются. Заменить на modern tokens.

## C.1 — `--foreground` → `--ink` (text color)

Файлы:
- `components/shared/text-input.tsx` — `color: "var(--foreground)"`
- `components/shared/text-area.tsx` — same
- `components/shared/token-amount-row.tsx` — 3+ места
- `components/shared/list-pagination.tsx`
- `components/shared/segmented-tabs.tsx`
- `components/shared/legal-page-layout.tsx` (titleStyle, contentStyle)
- `components/link/funding-progress.tsx` (txStyle)
- `components/deal/dispute-thread.tsx` (3+)
- `components/deal/deal-guidance-card.tsx` (messageStyle)
- `components/shared/async-action-state.tsx`
- `app/admin/disputes/[id]/page.tsx` (multiple)
- `app/admin/denylist/page.tsx`
- `app/error.tsx`
- `components/link/create-link-form.tsx` (panelTitleStyle, shareUrlStyle)

Глобальная замена в этих файлах: `var(--foreground)` → `var(--ink)`.

## C.2 — `--accent` / `--accent-hover` → `--gold` / `--gold-deep`

Файлы:
- `components/link/link-action-card.tsx` (myLinksLinkStyle)
- `components/shared/legal-page-layout.tsx` (backLinkStyle)
- `components/deal/meeting-url-card.tsx`
- `components/shared/progress-steps.tsx` (activeStyle labelColor/markerBg)
- `app/admin/disputes/[id]/page.tsx` (backLinkStyle)
- `app/deal/[id]/receipt/page.tsx` (txLinkStyle уже `--accent`)
- любые другие `var(--accent)`

Заменить `var(--accent)` → `var(--gold-deep)` (для текста — лучше контраст в light) или `var(--gold)` (для backgrounds).

Для links правильнее `--gold-deep`:
```diff
- color: "var(--accent)",
+ color: "var(--gold-deep)",
```

## C.3 — `--radius` / `--radius-sm` / `--radius-lg` → `--r-*`

Эти алиасы:
- `--radius` = `--r-4` (16)
- `--radius-sm` = `--r-3` (12)
- `--radius-lg` = `--r-5` (20)

Везде заменить на `--r-N`. Файлы:
- `components/shared/list-pagination.tsx`
- `components/shared/segmented-tabs.tsx` (уже в plan-9 I.2 заменено — verify)
- `components/link/link-action-card.tsx` (paymentSummaryStyle)
- `app/admin/disputes/[id]/page.tsx`

## C.4 — `--input-bg` / `--input-border` → удалить вместе с inline styles

Эти алиасы используются только в `text-input.tsx` / `text-area.tsx` / любых старых форм. После plan-10 Phase 2 inputs должны использовать класс `.input` / `.textarea` — inline стили с этими алиасами должны исчезнуть.

**Проверь:** `components/shared/text-input.tsx` после plan-10 должен быть:
```tsx
export function TextInput({ className, ...props }) {
  return <input {...props} className={`input${className ? ` ${className}` : ""}`} />;
}
```
**БЕЗ** const `inputStyle`. Если const ещё там — удалить.

Аналогично `text-area.tsx`.

## C.5 — `--panel` / `--panel-muted` → `--surface` / `--surface-2`

Файлы:
- `components/shared/list-pagination.tsx` (background var(--panel))
- любые inline стили использующие `--panel*`

Прямая замена:
- `--panel` → `--surface`
- `--panel-muted` → `--surface-2`
- `--panel-hover` → `--surface-3`

## Phase C acceptance
- Поиск `--foreground`, `--accent`, `--radius`, `--panel`, `--input-bg`, `--input-border` в `components/**/*.tsx` и `app/**/*.tsx` даёт 0 результатов.
- Все компоненты используют modern tokens.

> Алиасы в globals.css `:root { --foreground: var(--ink); … }` оставить — они на месте для backward-compat. Просто перестать их использовать в новом коде.

---

# Phase D — Specific component typography fixes

## D.1 — `components/link/create-link-form.tsx` success branch

Уже частично решено в Phase B.1. Доделать:

```tsx
{shareUrl && (
  <ActionPanel style={successPanelStyle}>
    <div style={successIconStyle} aria-hidden>✓</div>
    <div style={successHeaderStyle}>
      <h2 className="h2">Link created</h2>
      <p className="lede">Your consultation link is live and ready to share.</p>
    </div>
    <InnerSection style={shareSectionStyle}>
      <p className="tiny">Share link</p>      {/* был shareLabelStyle */}
      <p style={shareUrlStyle}>{shareUrl}</p>
    </InnerSection>
    …
  </ActionPanel>
)}
```

Удалить:
- `h1Style` (unused)
- `panelTitleStyle`
- `panelSubtitleStyle`
- `shareLabelStyle`

В `shareUrlStyle` — заменить `var(--foreground)` → `var(--ink)` + `var(--font-mono, monospace)` → `var(--font-mono)`.

## D.2 — `app/admin/disputes/[id]/page.tsx` typography

Сейчас имеет много inline стилей:
- `h1Style` — `fontFamily: serif, fontSize: 28, fontWeight: 500` → это `.h2`. Заменить на `<h1 className="h2">`.
- `subtitleStyle` — `fontSize: 14, color: muted, lineHeight: 1.5` → ближе к `.body` (хотя цвет muted а не ink-soft). Использовать `<p className="small">` (13/1.5/muted).
- `dealTitleStyle` — fontSize 22 (после plan-9 3.11 был h3 serif 22). OK как есть.
- `sectionTitleStyle` — fontSize 18 (between h2 и h3). Заменить на `<h3 className="h3">` (16px sans 600) или серий 22 как dealTitle для консистентности.
- `sectionDescriptionStyle` — `<p className="small">`.
- `metaStyle` — `<p className="small">`.
- `countStyle` — `<span className="small">` (с font-weight inline).
- `confirmTextStyle` — `<p className="body">` (14 vs 14.5 — близко).

Заменить inline на классы где возможно.

## D.3 — `app/error.tsx` & `app/global-error.tsx` typography

Полностью переписать с использованием type scale:
- Error code (72px gradient) → `.h-display` style fontSize 72, цвет gold-deep
- titleStyle (fontSize 20) → `.h3` (16) или h2 (28) — depends on intent
- descriptionStyle (14/1.6) → `.body` (14.5/1.55)
- button styles (15/500) — OK if matching .btn--lg

Best: переписать как not-found:
```tsx
<main className="not-found">
  <ArrabonSeal size={80} tone="auto" />
  <p className="eyebrow">Error 500</p>
  <h1 className="h-display not-found__title">
    <span className="accent">Something</span>&nbsp;broke.
  </h1>
  <p className="lede not-found__sub">…</p>
  <div style={actionsStyle}>
    <Btn size="lg" variant="ghost" onClick={reset}>
      <Icon name="utility-arrow-left" size={14} />
      Try again
    </Btn>
    <Link href="/"><Btn size="lg" variant="primary">Home</Btn></Link>
  </div>
</main>
```

## D.4 — `components/shared/legal-page-layout.tsx` typography

Сейчас:
- titleStyle: `fontSize: "clamp(30px, 5vw, 42px)"` — random, не type scale. Прототип использует `.h1` (40px) или `.h-display` (56px) для page titles.
  - Лучше: `<h1 className="h1">{title}</h1>` (40px serif).
- updatedStyle: `fontSize: 14, lineHeight: 1.5, color: muted` — `<p className="small">` (13) или `<p className="body" style={{ color: muted }}>`.

## D.5 — `app/top-nav.tsx` brand word

`brandWordStyle` — fontSize 24/500 serif. Прототип `.brand__word` — 22px. Plan-3 I bumped до 24 (Solar Lock больше) — намеренно оставить как есть, это approved deviation.

## D.6 — `components/link/link-preview-card.tsx` title

```tsx
const titleStyle = {
  ...
  fontFamily: "var(--font-serif)",
  fontSize: 22,
  fontWeight: 500,
  ...
};
```
fontSize 22 — корректно (preview card title) но можно через `<h3 className="h3">` (16 sans) — нет, это будет другой размер. Лучше оставить inline 22/500 serif (это смысловой mid-tier между h3 и h2). Окей без правок.

## D.7 — `components/deal/dispute-thread.tsx` titleStyle (compact 16 / expanded 18)

```ts
function titleStyle(compact: boolean) {
  return { fontSize: compact ? 16 : 18, lineHeight: 1.3, margin: 0 };
}
```

`compact: true` (16) — это `.h3`. Лучше: `<h3 className="h3">{title}</h3>`.
`compact: false` (18) — между h3 и h2. Оставить или поднять до 22 (serif) для консистентности с другими card titles.

## D.8 — `components/shared/token-amount-row.tsx` cleanup

После plan-10 Phase 2.4 этот компонент переписан. Проверь что:
- amountStyle (readonly mode) использует serif 28 / 500 (не 32/600)
- amountInputStyle удалён (теперь через CSS `.amount-input input`)
- tokenIconStyle (синий circle $) удалён
- tokenStyle/tokenTextStyle удалены (теперь через `.amount-input__token`)

Если что‑то осталось — удалить.

## D.9 — `components/shared/wallet-session-card.tsx`

Если этот компонент ещё используется где-то (он был частично удалён) — проверь typography. Если не используется — удалить файл.

## Phase D acceptance
- create-link-form success branch использует .h2 / .lede / .tiny
- admin disputes/[id] использует .h1 / .h2 / .h3 / .body классы
- error.tsx использует .h-display / .eyebrow / .lede
- legal-page-layout использует .h1 + .body
- TokenAmountRow чист (нет старого слоп-кода)

---

# Phase E — Lineheight / letter-spacing consistency

После Phase A‑D много inline‑правил уйдёт через классы, но осталось несколько мест с произвольными значениями:

## E.1 — `app/page.tsx` `cardDescStyle`

```diff
- fontSize: 13,
- lineHeight: 1.5,
+ // используется в StepCard/BenefitCard. Через class:
```

`.small` это `{ font-size: 13px; line-height: 1.5; color: var(--muted); }` — идентично! Заменить:
```diff
- <p style={cardDescStyle}>{desc}</p>
+ <p className="small">{desc}</p>
```
Удалить `cardDescStyle`.

## E.2 — `app/page.tsx` `footerTagStyle`

```ts
{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, margin: 0, maxWidth: "32ch" }
```

`.small` это 13/1.5/muted/margin:0. Lineheight 1.6 vs 1.5 — почти то же. Заменить через `<p className="small" style={{ maxWidth: "32ch" }}>`. Удалить `footerTagStyle`.

## E.3 — `app/page.tsx` `footerCopyStyle`

```ts
{ color: "var(--muted-2)", fontSize: 13 }
```

Близко к `.small` (но color muted-2). Можно оставить inline или сделать вариант `.small--muted2`.

## E.4 — All loading texts "Loading…" / "Loading deal…"

Inline `{ color: "var(--muted)", fontSize: 14 }` встречается на /link, /deal, receipt. Заменить на `<p className="body" style={{ color: "var(--muted)" }}>` (14.5 vs 14 — почти то же) или просто `<p className="small">` (13).

Файлы:
- `app/link/[id]/page.tsx:98`
- `app/deal/[id]/page.tsx:112`
- `app/deal/[id]/receipt/page.tsx:207` (loadingStyle const)

## Phase E acceptance
- Все «утилитарные» captions используют `.small` / `.body` / `.tiny` классы
- Inline `fontSize` остался только там, где размер действительно уникальный (не из type scale)

---

# Phase F — Финал

```bash
npm run typecheck && npm run build && npm run test:unit
```

Допиши в `audit/PROGRESS.md`:
```md
## Plan-11 — completed (typography sweep)

### Phase A — Eyebrows / section-labels unified
- app/not-found.tsx — eyebrow → className; removed eyebrowStyle
- components/deal/deal-status-card.tsx — eyebrow → className
- components/deal/dispute-thread.tsx — eyebrow → className
- components/shared/legal-page-layout.tsx — eyebrow → className
- components/link/link-preview-card.tsx — eyebrow → className
- components/deal/key-times.tsx — sectionLabelStyle → className="section-label section-label--no-rule"
- app/globals.css — added .section-label--no-rule modifier
- components/link/funding-progress.tsx — sectionLabelStyle → className="section-label"
- components/link/link-action-card.tsx — labelStyle → className="section-label"
- components/deal/deal-details-card.tsx — detailsLabelStyle → className="section-label"
- app/link/[id]/page.tsx — insetSealLabelStyle → className="tiny"

### Phase B — fontWeight: 800 violations
- components/link/create-link-form.tsx — h1Style removed; panelTitleStyle → className="h2"; panelSubtitleStyle → className="lede"
- components/shared/progress-steps.tsx — marker fontWeight 800 → 600
- app/error.tsx — code fontWeight 800 → 500 (serif); removed gradient text slop; using .h-display
- components/deal/dispute-thread.tsx — submit/label/reply fontWeight 700 → 600

### Phase C — Legacy token cleanup
- All var(--foreground) → var(--ink) [10+ files]
- All var(--accent) → var(--gold-deep) for text [5+ files]
- All var(--radius) → var(--r-4); var(--radius-sm) → var(--r-3) [3 files]
- All var(--panel*) → var(--surface*) [1 file]
- Removed var(--input-bg)/(--input-border) usage (already replaced by .input/.textarea classes in plan-10)

### Phase D — Specific page typography
- create-link-form.tsx success branch — h2/lede/tiny classes
- admin/disputes/[id]/page.tsx — h1Style → .h2; subtitle → .small; sectionTitle/sectionDescription → classes
- error.tsx — rewritten with .h-display + .eyebrow + .lede + .not-found__title pattern
- legal-page-layout.tsx — titleStyle clamp → .h1; contentStyle → .body
- dispute-thread.tsx titleStyle(compact) → .h3
- TokenAmountRow legacy slop verified removed

### Phase E — Utility text consistency
- app/page.tsx — cardDescStyle → .small className; removed const
- app/page.tsx — footerTagStyle → .small; removed const
- 3 loading texts → .small className
```

---

# Сводка

| Phase | Описание | Файлов | Приоритет |
|---|---|---|---|
| **A** | 10+ inline eyebrow/section-label → классы | 9 | P0 (визуальная неконсистентность) |
| **B** | fontWeight: 800 → 600/500 | 4 | P0 (нарушение design system) |
| **C** | Legacy tokens (--foreground/--accent/--radius) → modern | 15+ | P1 (тех. долг) |
| **D** | Specific component typography normalization | 6 | P1 (полишинг) |
| **E** | Utility text → классы (.small / .body / .tiny) | 3 | P2 (DRY) |

После всех фаз грепы `grep -r "fontWeight: 800"`, `grep -r "var(--foreground)"`, `grep -r "var(--accent)"` в `components/` и `app/` должны давать **0 результатов**.

Все правки — text/style only. Нет изменений в layout / logic / API.
