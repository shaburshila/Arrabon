# Claude Code — план №8 (свежий аудит после планов 1‑7)

**Дата:** 2026‑05‑21
**Источник истины:** прототип `Arrabon Redesign.html` + `styles.css` + `screens.jsx`
**Сверка:** `shaburshila/base-consult-link@main` (commit `0007bf2`)

Планы 1‑7 закрыты. После сравнения CSS-токенов, компонентов и страниц‑скринов нашлись остаточные расхождения по **размерам типографики и раскладке**. Это не архитектурные дыры (split‑layouts, статусы, цена с центами уже на месте), а **mismatched values**, из‑за которых десктопный «образ» страниц отличается от прототипа на ~10‑15%.

Действуй по фазам. После каждой фазы — `npm run typecheck && npm run build`. Не коммить. Допиши `## Plan-8` в `audit/PROGRESS.md`.

---

## Phase QQ — Landing hero: вернуть прототиповый h1 и sub

**Файл:** `app/globals.css` (блок `.landing-hero h1` и `.landing-hero__sub`)

Сейчас:
```css
.landing-hero h1 {
  font-size: clamp(36px, 5vw, 56px);   /* clamps to 56px max */
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin: 0 0 20px;
}
.landing-hero__sub {
  font-size: 16px;
  line-height: 1.65;
  max-width: 52ch;
}
```

Прототип:
```css
.landing-hero h1 {
  font-size: 64px;          /* фиксировано 64 на десктопе */
  line-height: 1.12;
  letter-spacing: -0.012em;
  margin: 0 0 40px;         /* в 2 раза больше воздуха под заголовком */
}
.landing-hero__sub {
  font-size: 19px;          /* lede‑масштаб, заметно крупнее */
  line-height: 1.5;
  max-width: 50ch;
}
```

### Действие
Заменить оба блока на прототиповые значения. Mobile breakpoint оставить как есть (`@media (max-width: 600px) { .landing-hero h1 { font-size: 32px; } }` уже стоит).

### Acceptance
- На 1920×1080 hero‑заголовок становится крупнее (64 вместо 56), space под ним удваивается, sub визуально жирнее (19 vs 16).
- На 600px и ниже мобильная переменная не ломается.

---

## Phase RR — Deal hero: h1 36, eyebrow и sub под прототип

**Файл:** `components/deal/deal-status-card.tsx`

Прототип (`screens.jsx:902‑921`):
```jsx
<div className="deal-hero">
  <StatusIcon status={deal.status} size="lg" />
  <div className="stack-8">
    <span className="eyebrow">Deal · {deal.id}</span>
    <h1 className="h1" style={{ fontSize: 36, lineHeight: 1.1 }}>{title}</h1>
    <p className="body" style={{ color: "var(--muted)", maxWidth: "60ch" }}>{guidance}</p>
  </div>
  <div className="deal-hero__amount">…</div>
</div>
```

Сейчас:
```tsx
heroTitleStyle = { fontSize: 28, ... lineHeight: 1.1 }   // ❌ должно 36
eyebrowStyle   = { letterSpacing: "0.1em", fontWeight: 700, ... }  // ❌ 0.18em / 600
heroSubtitleStyle = { fontSize: 14, lineHeight: 1.5, maxWidth: "52ch", ... }  // ❌ 14.5/60ch
```

### Действие
1. `heroTitleStyle.fontSize: 28` → `36`.
2. Удалить inline `eyebrowStyle` и `heroSubtitleStyle`. Использовать классы прототипа:
   ```tsx
   <p className="eyebrow">Deal · {deal.id.slice(0, 8).toUpperCase()}</p>
   <h1 style={heroTitleStyle}>{title}</h1>
   <p className="body" style={{ color: "var(--muted)", maxWidth: "60ch", margin: 0 }}>
     {guidanceSubtitle}
   </p>
   ```
3. `heroBodyStyle.gap: 8` оставить (matches `.stack-8`).

### Acceptance
- В hero deal‑page заголовок крупнее (36 вместо 28). Подзаголовок шире (60ch).
- Eyebrow визуально матчится с eyebrow‑классом, использованным в landing/admin/my‑*.

---

## Phase SS — LinkSummary: вернуть 4‑секционную карточку с full‑bleed border‑bottom

**Файл:** `components/link/link-summary.tsx`

Сейчас LinkSummary — это монолитный `<div>` с `padding: 28`, `gap: 24`. Trust‑footer — chip с rounded corners.

Прототип (`screens.jsx:597‑629`) рендерит `<Card>` БЕЗ padding с **4 встроенными секциями**, разделёнными `border-bottom: 1px solid var(--border)` от края до края карточки. Padding задаётся пер‑секционно: `28px 32px` / `20px 32px` / `8px 32px 20px` / `16px 32px`. Gold trust‑полоса — **full‑bleed внизу карточки** (border‑top + gold‑soft background, без rounded corners собственных).

Кроме того:
- h1 в шапке — **`fontSize: 32, lineHeight: 1.15`** (а не 28).
- amount‑num — **`fontSize: 36`** (а не дефолтный 48).
- Description — `<p className="body">` (14.5px ink‑soft) **с цветом `var(--muted)`** (override через inline style).
- Detail‑контейнер БЕЗ flex‑gap — DetailRow сам делает `padding: 14 0` + `border-top`.

### Действие
Перепиши JSX:

```tsx
export function LinkSummary({ link }: LinkSummaryProps) {
  const status = getStatusPill(link.status);

  return (
    <div style={cardStyle}>
      <div style={headerSectionStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <StatusPill label={status.label} tone={status.tone} />
          <h1 style={titleStyle}>{link.title}</h1>
          <p style={sellerStyle}>
            Seller <span style={sellerMonoStyle}>{truncateAddress(link.seller_address)}</span>
          </p>
        </div>
        <div className="deal-hero__amount" style={{ flexShrink: 0 }}>
          <div className="deal-hero__amount-num" style={{ fontSize: 36 }}>
            {formatUsdcPrice(link.price_usdc)}
          </div>
          <div className="deal-hero__amount-token">USDC</div>
        </div>
      </div>

      {link.description && (
        <div style={descriptionSectionStyle}>
          <p style={descriptionStyle}>{link.description}</p>
        </div>
      )}

      <div style={detailsSectionStyle}>
        <DetailRow label="Scheduled" value={...} />
        <DetailRow label="Duration" value={...} />
        <DetailRow label="Expires" value={...} />
        <DetailRow label="Seller" mono value={...} />
        <DetailRow bordered={false} label="Link ID" mono value={...} />
      </div>

      <div style={trustSectionStyle}>
        <Icon name="utility-secure-subtle" size={18} />
        <p style={trustTextStyle}>
          Funds held in escrow on Base. Meeting URL revealed only after funding.
        </p>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-4)",
  display: "flex",
  flexDirection: "column" as const,
  overflow: "hidden",
} as const;

const headerSectionStyle = {
  alignItems: "flex-start",
  borderBottom: "1px solid var(--border)",
  display: "flex",
  gap: 20,
  justifyContent: "space-between",
  padding: "28px 32px",
} as const;

const titleStyle = {
  color: "var(--ink)",
  fontFamily: "var(--font-serif)",
  fontSize: 32,                       // 28 → 32
  fontWeight: 500,
  letterSpacing: "-0.005em",
  lineHeight: 1.15,
  margin: "10px 0 6px",
  overflowWrap: "anywhere" as const,
  textWrap: "balance" as const,
} as const;

const sellerStyle = {
  color: "var(--muted)",
  fontSize: 13,
  margin: 0,
} as const;
const sellerMonoStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12.5,
  letterSpacing: "-0.005em",
};

const descriptionSectionStyle = {
  borderBottom: "1px solid var(--border)",
  padding: "20px 32px",
} as const;

const descriptionStyle = {
  color: "var(--muted)",
  fontSize: 14.5,
  lineHeight: 1.55,
  margin: 0,
} as const;

const detailsSectionStyle = {
  padding: "8px 32px 20px",
} as const;

const trustSectionStyle = {
  alignItems: "center",
  background: "var(--gold-soft)",
  borderTop: "1px solid var(--border)",
  display: "flex",
  gap: 12,
  padding: "16px 32px",
} as const;

const trustTextStyle = {
  color: "var(--ink-soft)",
  fontSize: 13,
  fontWeight: 500,
  lineHeight: 1.5,
  margin: 0,
} as const;
```

Иконка shield — `utility-secure-subtle` 18px (увеличить с 14 до 18).

### Acceptance
- Карточка визуально делится на 4 full‑bleed секции горизонтальными hairline‑линиями.
- Gold trust‑полоса доходит до краёв карточки (а не отступает с padding).
- h1 заметно крупнее (32 vs 28). Цена 36 (а не 48).

---

## Phase TT — Receipt: матчинг с прототипом

**Файл:** `app/globals.css` (блок `.receipt*`) + `app/deal/[id]/receipt/page.tsx`

### Что отличается

| Селектор | Сейчас | Прототип |
|---|---|---|
| `.receipt__seal` | `margin-bottom: 8px` | `margin-bottom: 28px` |
| `.receipt__sub` | `max-width: 48ch; margin: 0 auto 24px` | `max-width: 44ch; margin: 0 auto 32px` |
| `.receipt__details` | `padding: 0 20px` + `border: 1px solid var(--border-soft)` | `padding: 22px 24px` (без border) + `margin-bottom: 24px` |
| `.receipt__foot` | `gap: 10; margin-top: 8; padding-top: 24` + `flex-wrap` инлайновый текст по центру | `gap: 12; padding-top: 24` + **2‑колонный** seal слева / текст слева (без wrap) |
| `.receipt__foot-text` | `display: flex; flex-wrap: wrap; justify-content: center` | `text-align: left; line-height: 1.45` |
| `.receipt__foot-text strong` | inline в потоке | `display: block; font-size: 13px; margin-bottom: 2px` |
| `.receipt__seal-sm` | не определён | `width: 36px; height: 36px;` (опц.) |

### Действия

1. **`app/globals.css`** — заменить блоки:

```css
.receipt__seal {
  display: flex;
  justify-content: center;
  margin: 0 auto 28px;             /* 8 → 28 */
}

.receipt__sub {
  font-size: 15px;
  line-height: 1.5;                /* 1.6 → 1.5 */
  color: var(--muted);
  max-width: 44ch;                 /* 48 → 44 */
  margin: 0 auto 32px;             /* 24 → 32 */
  text-align: center;
}

.receipt__details {
  background: var(--surface-2);
  border-radius: var(--r-3);
  padding: 22px 24px;              /* 0 20 → 22 24 */
  margin-bottom: 24px;             /* добавить */
  width: 100%;
  text-align: left;
  /* border убрать */
}

.receipt__foot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;                       /* 10 → 12 */
  padding-top: 24px;
  border-top: 1px solid var(--border-soft);
  /* убрать margin-top: 8; убрать width: 100% */
}

.receipt__foot-text {
  text-align: left;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.45;
  /* убрать display:flex flex-wrap justify-content */
}

.receipt__foot-text strong {
  display: block;
  font-size: 13px;
  color: var(--ink);
  font-weight: 600;
  margin-bottom: 2px;
  letter-spacing: 0.005em;
}
```

2. **`app/deal/[id]/receipt/page.tsx`** — перепиши `.receipt__foot` под прототиповый pattern «seal слева, мульти‑строчный текст с `<strong>Secured by Arrabon</strong>` отдельной первой строкой»:

```tsx
<div className="receipt__foot">
  <ArrabonSeal size={36} tone="gold-line" />
  <div className="receipt__foot-text">
    <strong>Secured by Arrabon</strong>
    Onchain escrow on Base · Trusted settlement
  </div>
</div>
```

Текст с smart‑contract address оставить отдельной заметкой ниже receipt’а как `<p className="small">` под `.receipt`, либо удалить (он есть в site footer). Решай сам по контексту.

### Acceptance
- Sub‑текст матчится в ширину и нижний отступ.
- Detail‑контейнер визуально становится «inset card‑in‑card» (как было в прототипе) — с реальным padding 22/24px, без двойного border.
- Footer — `Secured by Arrabon` отдельной строкой над описанием.

---

## Phase UU — Deal countdown value: sans вместо mono

**Файл:** `app/globals.css`

Сейчас:
```css
.deal-countdown__value {
  font-family: var(--font-mono);     /* ❌ */
  font-size: 14px;
  font-weight: 500;
  color: var(--ink);
  white-space: nowrap;
}
```

Прототип:
```css
.deal-countdown__value {
  font-size: 14.5px;
  font-weight: 500;
  color: var(--ink);
  white-space: nowrap;
}
```

### Действие
Убрать `font-family: var(--font-mono)`, поставить `font-size: 14.5px`.

### Acceptance
- В countdown banner «in 14:30:22 / 2d 14h 30m» рендерится sans (а не mono).

---

## Phase VV — AppShell side padding 16 → 32

**Файл:** `components/app/app-shell.tsx`

Сейчас:
```tsx
const mainStyle = { padding: "128px 16px 64px" };
```

Прототип `.page padding: 56px 32px 96px;` — боковой 32px (с фолбэком на 24/16 на разных breakpoint’ах).

На десктопе 16px бок прижимает контент слишком близко к краям; на 1180 max‑width разница не критична, но визуально содержимое прижимается без поля.

### Действие
```tsx
const mainStyle = {
  display: "flex",
  justifyContent: "center",
  minHeight: "100vh",
  padding: "128px 32px 64px",       /* 16 → 32 */
} as const;
```

Добавить mobile rule в `globals.css` (если нет ещё для main):
```css
@media (max-width: 768px) {
  main { padding-left: 16px !important; padding-right: 16px !important; }
}
```

### Acceptance
- На десктопе содержимое отстоит от краёв на 32px.
- На мобиле — 16px.

---

## Phase WW — Top‑nav: sticky вместо fixed

**Файл:** `components/app/top-nav.tsx` + `components/app/app-shell.tsx`

Прототип использует `position: sticky; top: 0` для `.topnav` — нав скроллится С документом, фокус‑скроллы корректны, нет проблем с overlap.

Сейчас implementation использует `position: fixed` и компенсирует через `padding-top: 128px` на `main`. Это работает, но:
- `scroll-margin-top: 64px` на landing‑секциях рассчитан под sticky (когда nav физически занимает место). При fixed нав нужно ставить `scroll-margin-top: 88px` или больше.
- `position: fixed` хуже с print‑стилем (receipt page).

### Действие
1. В `top-nav.tsx`:
   ```tsx
   const headerStyle = {
     ...
     position: "sticky" as const,         /* fixed → sticky */
     top: 0,
     /* убрать left: 0; right: 0; width: 100% */
   };
   ```
2. В `app-shell.tsx` уменьшить `padding-top`:
   ```tsx
   const mainStyle = { padding: "32px 32px 64px" };   /* 128 → 32 */
   ```
3. В `globals.css` обновить `scroll-margin-top` на landing‑секциях если нужно (sticky nav занимает реальную высоту, поэтому 64 OK).

### Acceptance
- Top‑nav скроллится sticky.
- На landing‑скролл якоря (`scrollTo .landing-steps`) попадают точно под край nav.
- Print receipt не показывает top‑nav поверх контента.

> **Optional:** если этот рефакторинг рисковый, оставить fixed, но проверить что padding‑top правильный для всех страниц.

---

## Phase XX — Landing section H2: убрать clamp

**Файл:** `app/page.tsx`

Сейчас:
```tsx
const sectionH2Style = {
  fontSize: "clamp(28px, 4vw, 44px)",   // на десктопе 44px — крупнее прототипа
  fontWeight: 500,
  letterSpacing: "-0.015em",
  lineHeight: 1.1,
};
```

Прототип использует `.h2` (28px serif, lh 1.18) для секций. На больших экранах implementation растёт до 44px — это сильнее прототипа.

### Действие (если хочется матчинг прототипа)
Заменить inline‑style на класс:
```tsx
<h2 className="h2">Three steps. One settlement.</h2>
```
Удалить `sectionH2Style`.

**Если хочется наоборот сохранить более крупный масштаб для landing'а** — оставить, это разумное усиление. Спросить пользователя.

---

## Phase YY — Card paddings на landing (опционально)

Сейчас в `app/page.tsx`:
```tsx
const cardStyle = { padding: "28px 24px" };
```

Прототип `.card--padded { padding: 28px; }` — квадрат. У step‑cards и benefit‑cards разница незаметна (24 vs 28 по бокам), но для консистентности:

```tsx
const cardStyle = { padding: 28 };
```

---

## Phase ZZ — Финал

```bash
npm run typecheck && npm run build && npm run test:unit
```

Допиши в `audit/PROGRESS.md`:
```md
## Plan-8 — completed

### Phase QQ — Landing hero
- app/globals.css — .landing-hero h1 (clamp→64px, lh 1.12, ls -0.012, margin-bottom 40)
- app/globals.css — .landing-hero__sub (16→19px, lh 1.65→1.5, 52→50ch)

### Phase RR — Deal hero
- components/deal/deal-status-card.tsx — heroTitleStyle 28→36, replaced inline eyebrow/sub with .eyebrow/.body classes, sub maxWidth 52→60ch

### Phase SS — LinkSummary 4-section card
- components/link/link-summary.tsx — restructured into 4 full-bleed sections (header 28x32, description 20x32 muted, details 8x32 20x, gold trust footer 16x32 full-bleed)
- h1 fontSize 28→32 lineHeight 1.15
- amount-num fontSize 36 (inline override)
- shield icon 14→18

### Phase TT — Receipt
- app/globals.css — .receipt__seal margin 8→28, .receipt__sub 48→44ch margin 24→32, .receipt__details padding 0/20→22/24 with margin-bottom 24 (removed border), .receipt__foot gap 10→12 removed margin-top, .receipt__foot-text text-align:left, strong display:block
- app/deal/[id]/receipt/page.tsx — restructured foot to seal-left + 2-line text pattern

### Phase UU — Deal countdown
- app/globals.css — .deal-countdown__value removed font-family:mono, fontSize 14→14.5

### Phase VV — AppShell padding
- components/app/app-shell.tsx — mainStyle padding 128/16/64 → 128/32/64

### Phase WW — Top-nav sticky [if applied]
- components/app/top-nav.tsx — position fixed→sticky
- components/app/app-shell.tsx — padding-top 128→32

### Phase XX/YY — landing polish [optional]
- app/page.tsx — sectionH2Style → .h2 className OR kept clamp (user choice)
- app/page.tsx — cardStyle padding "28px 24px" → 28
```

---

## Summary — что находки делают видимо

| Phase | Видимый эффект |
|---|---|
| QQ | Landing hero h1 +8px шире, +20px воздуха под ним, sub-текст +3px крупнее |
| RR | Deal hero title +8px крупнее, sub шире (60ch), eyebrow матчится с другими страницами |
| SS | Buyer link card визуально делится на 4 полосы — header, description, details, gold trust (как в прототипе) |
| TT | Receipt sub‑текст уже, detail‑контейнер видимая inset‑карта, footer 2‑строчная подпись с печатью |
| UU | Countdown текст рендерится sans (как другие label’ы), не mono |
| VV | Контент отстоит от боков на 32px (не прижат к 16) |
| WW | Nav скроллится sticky, фокус‑скроллы точнее (опц.) |

Все правки чисто визуальные, не трогают логику/state/API/контракты.
