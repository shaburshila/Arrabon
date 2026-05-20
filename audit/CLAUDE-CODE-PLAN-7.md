# Claude Code — план №7 (правки и полировка: list rows, ширины, paddings, цена)

Сборка всего что было оговорено в обсуждениях планов 6-10: my-deals/my-links content polish, унификация maxWidth и card paddings, формат цены с центами. Plan-6 (bug fixes) выполнить ПЕРЕД этим планом.

**Правила:** по фазам сверху вниз, build clean, не коммить, секция `## Plan-7` в `audit/PROGRESS.md`.

---

## Phase JJ — maxWidth: единый стандарт 1180 на всех страницах

### Контекст
Прототип `.page` max-width = **1180px** (источник: `handoff/prototype/styles.css:400`). Это стандарт для всех non-receipt страниц. Receipt = 760px (`.page--narrow`).

В implementation сейчас разнобой. Цель — выровнять всё.

### Step JJ.1 — Привести все страницы к 1180

**Файлы и значения:**

- `app/create/page.tsx` → `<AppShell maxWidth={1180}>` (если 1100, заменить)
- `app/my-deals/page.tsx` (2 места — auth screen и main return) → `maxWidth={1180}`
- `app/my-links/page.tsx` (2 места) → `maxWidth={1180}`
- `app/deal/[id]/page.tsx` → `maxWidth={1180}` (оставить)
- `app/deal/[id]/receipt/page.tsx` → `maxWidth={760}` (оставить — это .page--narrow)
- `app/admin/disputes/page.tsx`, `app/admin/disputes/[id]/page.tsx`, `app/admin/denylist/page.tsx` → `maxWidth={1180}` (оставить если уже так)

---

## Phase CC — my-deals / my-links: содержимое строк

### Step CC.1 — Убрать seller из sub-meta на /my-deals

**Файл:** `app/my-deals/page.tsx`

В функции `DealRow` найди:
```tsx
<span className="list-row__title-sub">
  {deal.id.slice(0, 8).toUpperCase()} · {formatDate(deal.scheduled_at, { timeZone: deal.timezone })} · Seller {truncateAddress(deal.seller_address)}
</span>
```

Замени:
```tsx
<span className="list-row__title-sub">
  {deal.id.slice(0, 8).toUpperCase()} · {formatDate(deal.scheduled_at, { timeZone: deal.timezone })}
</span>
```

Удали unused импорт `truncateAddress` если он больше нигде в файле не используется.

### Step CC.2 — Иконки в pill крупнее

**Файл:** `components/shared/status-pill.tsx`

Найди:
```tsx
const iconSize = size === "md" ? 14 : 12;
```

Замени:
```tsx
const iconSize = size === "md" ? 16 : 14;
```

### Step CC.3 — Цена/токен — типографика

**Файл:** `app/globals.css`

Найди `.list-row__price` и `.list-row__price-token`:
```css
.list-row__price {
  font-size: 14.5px;
  ...
}
.list-row__price-token {
  font-size: 11px;
  margin-left: 4px;
}
```

Замени:
```css
.list-row__price {
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  text-align: right;
  white-space: nowrap;
}

.list-row__price-token {
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  margin-left: 6px;
  text-transform: uppercase;
}
```

---

## Phase KK — Card paddings: единый стандарт `28px`

### Контекст
Прототип: `.card--padded` = `padding: 28px` (квадратный), `.deal-hero` = `32px 36px`, `.receipt` = `56px 48px 40px`. Цель — все content cards привести к `28px` (кроме hero и receipt).

### Step KK.1 — Card paddings → 28

**Файлы и правки:**

`components/link/link-summary.tsx` — `cardStyle.padding: "24px 28px"` → `padding: 28`

`components/link/link-preview-card.tsx` — `cardStyle.padding: "24px 28px"` → `padding: 28` (или просто `padding: 28` если было 24)

`components/link/create-link-form.tsx` — `cardPaddedStyle.padding: "24px 28px"` → `padding: 28`

`app/admin/disputes/page.tsx` — `dealCardStyle.padding: "24px 28px"` (или `20`) → `padding: 28`

`app/admin/denylist/page.tsx` — все `padding: "24px 28px"` или `padding: 20` для cards → `padding: 28`

### Step KK.2 — .deal-hero НЕ трогать

В `app/globals.css` `.deal-hero { padding: 32px 36px; gap: 28px; ... }` — оставить.

---

## Phase GG — Цена с центами (формат 0.00)

### Step GG.1 — Создать helper

**Новый файл:** `lib/ui/format.ts`

```ts
/**
 * Format a USDC amount with 2 fixed decimal places and thousand separators.
 * "33" → "33.00", "2450" → "2,450.00"
 */
export function formatUsdcPrice(raw: string | number): string {
  const num = typeof raw === "string" ? parseFloat(raw) : raw;
  if (Number.isNaN(num)) return String(raw);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
```

### Step GG.2 — Применить везде, где отображается USDC

Импорт в каждый файл: `import { formatUsdcPrice } from "@/lib/ui/format";`

**`components/deal/deal-status-card.tsx`** — hero amount:
```tsx
<div className="deal-hero__amount-num">{formatUsdcPrice(deal.price_usdc)}</div>
```

**`components/deal/deal-details-card.tsx`** — Amount DetailRow:
```tsx
<DetailRow label="Amount" value={`${formatUsdcPrice(deal.price_usdc)} USDC`} accent />
```

**`components/link/link-summary.tsx`** — amount-num:
```tsx
<div className="deal-hero__amount-num">{formatUsdcPrice(link.price_usdc)}</div>
```

**`app/my-deals/page.tsx`** в DealRow:
```tsx
<span className="list-row__price">
  {formatUsdcPrice(deal.price_usdc)}
  <span className="list-row__price-token">USDC</span>
</span>
```

**`app/my-links/page.tsx`** в LinkRow — аналогично.

**`app/deal/[id]/receipt/page.tsx`** — функции `getReceiptSub` и DetailRow с Amount:
```ts
return `${formatUsdcPrice(deal.price_usdc)} USDC was released to the seller after the consultation was completed.`;
```
```tsx
<DetailRow bordered={false} label="Amount" value={`${formatUsdcPrice(deal.price_usdc)} USDC`} accent />
```

### Acceptance

- На /deal/[id] hero amount: "33.00", "2,450.00"
- В Details и Receipt — то же
- В /my-deals и /my-links — все цены с центами

---

## Phase PP — Cross-check ВСЕХ блоков против прототипа

### Контекст
Источник правды: `handoff/prototype/styles.css`. Этот шаг — систематический проход по каждому ключевому блоку с проверкой и фиксом если не совпадает.

### Step PP.1 — Пройдись по таблице

Для каждой строки: открой указанный файл, найди указанный класс/стиль, сверь с **референсным значением** и если отличается — поправить под референс. Если уже совпадает — НЕ трогать.

| Элемент | Файл | CSS-селектор / inline | Референсное значение |
|---|---|---|---|
| Top-nav inner | `components/app/top-nav.tsx` (`headerInnerStyle`) | max-width / padding | `max-width: 1280px; padding: 14px 32px` |
| Top-nav brand-mark size | `components/app/top-nav.tsx` (`brandMarkStyle` + JSX img) | width/height | `28px × 28px` (если plan-4 поставил 32 — оставь 32, это намеренно крупнее) |
| Top-nav brand word font-size | `components/app/top-nav.tsx` (`brandWordStyle`) | font-size | `22px` (plan-4 поднял до 24 — оставь) |
| Page main padding-top | `components/app/app-shell.tsx` (`mainStyle`) | padding | `128px 16px 64px` (plan-3/4 поставил — оставь) |
| Content stack gap | `components/app/app-shell.tsx` (`contentStyle`) | gap | `24px` (plan-5 X поставил — оставь) |
| .deal-hero | `app/globals.css` `.deal-hero` | padding / gap / grid-template-columns | `padding: 32px 36px; gap: 28px; grid-template-columns: auto 1fr auto` |
| .deal-hero amount-num | `app/globals.css` `.deal-hero__amount-num` | font-size | `48px` serif 500 |
| .deal-countdown | `app/globals.css` `.deal-countdown` | padding | `14px 20px`, gap 12 |
| .timeline | `app/globals.css` `.timeline` + `.timeline__row` | grid | `.timeline` flex column; `.timeline__row` grid 20px 1fr, gap 0 14px |
| .timeline__node | `app/globals.css` `.timeline__node` | size | `20x 20`, dot inside 9x9 with 1.5px ring |
| .receipt | `app/globals.css` `.receipt` | padding | `56px 48px 40px` |
| .receipt__title | `app/globals.css` `.receipt__title` | font-size | `42px` serif 500 |
| .list-row | `app/globals.css` `.list-row` | padding / grid | `padding: 18px 24px; grid-template-columns: minmax(0, 1fr) 160px 140px 160px 28px` |
| .pill | `app/globals.css` `.pill` | padding / height | `padding: 4px 10px; height: 24px; font-size: 12px` |
| .pill--lg | `app/globals.css` `.pill--lg` | | `padding: 6px 12px; height: 28px; font-size: 13px` |
| .status-icon (default) | `app/globals.css` `.status-icon` | size | `36x 36` |
| .status-icon--lg | `app/globals.css` `.status-icon--lg` | size | `44x 44` |
| .status-icon--sm | `app/globals.css` `.status-icon--sm` | size | `26x 26` |
| .iconbtn | `app/globals.css` `.iconbtn` | size | `36x 36`, border-radius var(--r-2) |
| .btn (default lg) | `components/shared/btn.tsx` `sizeStyles.lg` | min-height / padding / font-size | `min-height: 48px; padding: 0 24px; font-size: 15px` (plan-1 + плотность совпадают) |
| .btn md | `components/shared/btn.tsx` `sizeStyles.md` | | `42px / 0 20px / 14px` |
| .btn sm | `components/shared/btn.tsx` `sizeStyles.sm` | | `36px / 0 14px / 13px` |
| Input/Textarea/Select base | (если есть `.input` в globals.css) | height / padding | `height: 44px; padding: 0 14px` |
| AmountInput num | (если есть `.amount-input input`) | height / font-size | `height: 56px; font-size: 28px serif 500` |
| .detail-row | (если есть `.detail-row` в globals.css; иначе DetailRow inline) | padding | `padding: 14px 0` |
| .copy-field | `app/globals.css` `.copy-field` | padding | `padding: 4px 4px 4px 14px; gap: 10px` |
| .toast | `app/globals.css` `.toast` | padding | `padding: 12px 14px 12px 16px; gap: 12px` |
| .modal | `app/globals.css` `.modal` | padding | `padding: 28px` |
| .empty-state | (если есть в globals.css; иначе EmptyState inline) | padding / icon | `padding: 64px 32px; gap: 16px; icon container 64x 64` |
| .landing-hero | `app/globals.css` `.landing-hero` | grid / gap | `grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 80px` |
| .landing-hero__seal | `app/globals.css` `.landing-hero__seal` | size | `320x 320` |
| .landing-cta__inner | `app/globals.css` `.landing-cta__inner` | max-width | `640px` |
| .landing-cta__trust | `app/globals.css` `.landing-cta__trust` | max-width | `560px` |
| .site-footer__grid | `app/globals.css` `.site-footer__grid` | grid | `grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px` |
| .admin-subnav | `app/globals.css` `.admin-subnav` | padding-bottom / gap | `padding-bottom: 18px; gap: 16px` |
| .admin-info | `app/globals.css` `.admin-info` | padding | `padding: 12px 14px` |
| .deal-hero__amount-token (label) | `app/globals.css` `.deal-hero__amount-token` | font-size / letter-spacing | `12px; letter-spacing: 0.14em; uppercase` |
| Hero h1 (landing) | `app/globals.css` `.landing-hero h1` | font-size | `clamp(36px, 5vw, 56px)` или `64px` (если совпадает — не трогать) |

### Step PP.2 — Если найдено расхождение

1. Запиши в `audit/PROGRESS.md` под `## Plan-7 → Phase PP cross-check findings` — какой элемент, какое было значение, какое стало.
2. Поправить под референс.
3. Не делать commit — только working tree changes.

### Step PP.3 — Если значение в прототипе и реализации СОВПАДАЕТ
Пропусти этот элемент. В отчёте не упоминай.

### Acceptance
- Все таблично-перечисленные блоки имеют размеры/паддинги как в прототипе
- Документировать все отклонения которые поправили

---

## Phase OO — Финал

```bash
npm run typecheck && npm run build && npm run test:unit
```

Допиши в `audit/PROGRESS.md`:
```md
## Plan-7 — completed

### Phase JJ — maxWidth unified to 1180 (prototype standard)
- app/create/page.tsx, app/my-deals/page.tsx, app/my-links/page.tsx — maxWidth → 1180

### Phase CC — my-deals/my-links content
- app/my-deals/page.tsx — removed "· Seller {addr}" from sub-meta
- components/shared/status-pill.tsx — iconSize sm 12→14, md 14→16
- app/globals.css — .list-row__price 14.5→16 mono, .list-row__price-token mono→sans 11→10.5 CAPS 0.04em

### Phase KK — card paddings unified to 28
- LinkSummary, LinkPreviewCard, CreateLinkForm, admin cards — padding 24x28 (or 20) → 28
- .deal-hero kept at 32x 36 per prototype

### Phase GG — Price format 0.00
- lib/ui/format.ts — new formatUsdcPrice helper
- DealStatusCard, DealDetailsCard, LinkSummary, my-deals, my-links, Receipt — all USDC amounts через formatUsdcPrice
```

---

Точка входа: **Phase JJ, Step JJ.1**.
