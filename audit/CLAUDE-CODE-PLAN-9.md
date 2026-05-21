# Claude Code — план №9 (глубокая постраничная сверка)

**Дата:** 2026‑05‑21
**Источник истины:** прототип `Arrabon Redesign.html` + `styles.css` + `screens.jsx` + `admin-screens.jsx`
**Сверка:** `shaburshila/base-consult-link@main` (commit `400a566`)

Планы 1‑8 закрыты. Сделана **полная постраничная сверка** — пройдены все 11 страниц блок‑за‑блоком против оригинала. План разбит на **3 этапа по приоритету**:

- **Этап 1 (P0)** — 3 критичных правки. Сильно ломают визуальный образ. Делать **первыми**.
- **Этап 2 (P1)** — высоковидимые расхождения. Делать **после P0**, можно батчами по страницам.
- **Этап 3 (P2)** — полишинг. Опциональный финальный проход.

**Правила:**
- Не коммить ничего — пользователь ревьюит и коммитит сам.
- После каждого ЭТАПА — `npm run typecheck && npm run build && npm run test:unit`.
- После каждого ЭТАПА — допиши секцию в `audit/PROGRESS.md`.
- Можешь остановиться после любого этапа — у каждого этапа законченный визуальный результат.

---

# ЭТАП 1 — P0 (критично, первым делом)

Три самых заметных регрешна. Можно сделать за 30 минут — и вид страниц сильно подтянется.

## 1.1 — Landing: section h2 размер 44 (был ошибочно занижен в plan-8 XX)

**Файл:** `app/page.tsx`
**Что не так:** Phase XX плана‑8 заменил `<h2 style={{fontSize: clamp(28,4vw,44)}}>` на `<h2 className="h2">`. Это была ошибка — прототип использует `.h1` + явный `fontSize: 44` (см. `screens.jsx:182,200,219`). Сейчас section‑заголовки **в 1.6 раза меньше прототипа**.

**Действие:** в 3 секциях (StepsSection / BenefitsSection / StatsSection) заменить:

```diff
- <h2 className="h2">Three steps. One settlement.</h2>
+ <h2 className="h1" style={{ fontSize: 44 }}>Three steps. One settlement.</h2>

- <h2 className="h2">A safer workflow for paid consultations.</h2>
+ <h2 className="h1" style={{ fontSize: 44 }}>A safer workflow for paid consultations.</h2>

- <h2 className="h2">Numbers from the network.</h2>
+ <h2 className="h1" style={{ fontSize: 44 }}>Numbers from the network.</h2>
```

**Acceptance:** на десктопе section‑заголовки на landing значительно крупнее, в полтора раза больше eyebrow‑надписей над ними.

---

## 1.2 — BuyerLink: «You pay» giant 28px serif amount

**Файл:** `components/link/link-action-card.tsx`
**Что не так:** В прототипе центральный визуальный акцент Fund this deal card — это огромная цифра «You pay 2,523.50» (serif 28px) с горизонтальной линией над ней. Реализация показывает Total таким же шрифтом как остальные строки PaymentSummary — пропадает иерархия.

Прототип (см. `screens.jsx:641‑666`):
```
[ section-label: "Fund this deal" ]
[ Consultation fee · 2,450.00 USDC ]    ← muted label / mono value
[ Platform fee (3%) · 73.50 USDC ]      ← muted label / mono value
[ hr.rule ]
[ "You pay" 14/600 · 2,523.50 28px serif ]   ← КРУПНО
```

**Действия:**

1. Переименовать заголовок:
```diff
- <p style={labelStyle}>Book consultation</p>
+ <p style={labelStyle}>Fund this deal</p>
```

2. Переписать `PaymentSummary`:
```tsx
function PaymentSummary({ priceUsdc }: { priceUsdc: string }) {
  const priceAmount = parseUsdcAmount(priceUsdc);
  const feeAmount = calculateFee(priceAmount);
  const totalAmount = calculateTotalWithFee(priceAmount);

  return (
    <div style={paymentSummaryStyle}>
      <div style={feeRowStyle}>
        <span style={feeRowLabelStyle}>Consultation fee</span>
        <span style={feeRowValueStyle}>
          {formatUsdcAmount(priceAmount)}
          <span style={feeRowTokenStyle}>USDC</span>
        </span>
      </div>
      <div style={feeRowStyle}>
        <span style={feeRowLabelStyle}>Platform fee (3%)</span>
        <span style={feeRowValueStyle}>
          {formatUsdcAmount(feeAmount)}
          <span style={feeRowTokenStyle}>USDC</span>
        </span>
      </div>
      <hr style={ruleStyle} />
      <div style={totalRowStyle}>
        <span style={totalLabelStyle}>You pay</span>
        <span style={{ whiteSpace: "nowrap" }}>
          <span style={totalAmountStyle}>{formatUsdcAmount(totalAmount)}</span>
          <span style={totalTokenStyle}>USDC</span>
        </span>
      </div>
      <p style={feeNoteStyle}>Non-refundable escrow service fee</p>
    </div>
  );
}

const feeRowStyle = { alignItems: "center", display: "flex", justifyContent: "space-between" };
const feeRowLabelStyle = { color: "var(--muted)", fontSize: 13, lineHeight: 1.5 };
const feeRowValueStyle = { color: "var(--ink)", fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "-0.01em", whiteSpace: "nowrap" as const };
const feeRowTokenStyle = { color: "var(--muted)", fontSize: 11, marginLeft: 6 };
const ruleStyle = { background: "var(--rule)", border: 0, height: 1, margin: 0 };
const totalRowStyle = { alignItems: "baseline", display: "flex", justifyContent: "space-between", marginTop: 4 };
const totalLabelStyle = { color: "var(--ink)", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" as const };
const totalAmountStyle = { color: "var(--ink)", fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 500, letterSpacing: "-0.01em" };
const totalTokenStyle = { color: "var(--muted)", fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", marginLeft: 6 };
```

Импорты `formatUsdcAmount`, `calculateFee`, `calculateTotalWithFee`, `parseUsdcAmount` уже есть в файле.

**Acceptance:** В правой колонке /link/[id] чётко видна иерархия: 2 мелкие строки fee → линия → крупная цифра «You pay 2,523.50».

---

## 1.3 — NotFound: title 42px → 96px

**Файл:** `app/not-found.tsx` + `app/globals.css`
**Что не так:** Реализация использует inline `fontSize: "clamp(28px, 5vw, 42px)"` — максимум 42px на десктопе. Прототип использует `.h-display` + `.not-found__title` overrides — **96px desktop**. Сейчас 404‑title в 2+ раза меньше.

**Действия:**

1. **`app/globals.css`** — добавить в конец:
```css
.not-found__title {
  font-size: 96px;
  line-height: 0.95;
  margin: 0;
  letter-spacing: -0.02em;
  text-wrap: balance;
}
.not-found__sub {
  text-align: center;
  margin: 0;
}
@media (max-width: 768px) {
  .not-found__title { font-size: 56px; }
}
@media (max-width: 480px) {
  .not-found__title { font-size: 44px; }
}
```

2. **`app/not-found.tsx`** — заменить inline styles на классы:
```diff
- <h1 style={titleStyle}>
-   <em style={accentStyle}>Page</em> not&nbsp;found.
- </h1>
- <p style={ledeStyle}>…</p>
+ <h1 className="h-display not-found__title">
+   <span className="accent">Page</span>&nbsp;not&nbsp;found.
+ </h1>
+ <p className="lede not-found__sub">…</p>
```

Удалить unused `titleStyle`, `ledeStyle`, `accentStyle`.

**Acceptance:** Заголовок «Page not found» на 404 странице — крупный 96px serif, занимает значительную часть viewport на десктопе.

---

## ЭТАП 1 — финал

```bash
npm run typecheck && npm run build && npm run test:unit
```

Допиши в `audit/PROGRESS.md`:
```md
## Plan-9 — Stage 1 (P0) completed
- app/page.tsx — landing section h2 size restored to 44px (.h1 + style override) — fixes plan-8 XX regression
- components/link/link-action-card.tsx — PaymentSummary rewritten with mono fee rows + rule + giant 28px serif "You pay" amount; title "Book consultation" → "Fund this deal"
- app/not-found.tsx — title clamp(28,5vw,42) → .h-display .not-found__title (96px desktop); accent <em> → <span className="accent">
- app/globals.css — .not-found__title + .not-found__sub + mobile breakpoints
```

**Остановись и подожди ревью**, либо переходи к Этапу 2.

---

# ЭТАП 2 — P1 (высокая видимость, делать после P0)

22 правки, сгруппированы по страницам. Каждая группа — отдельный фрагмент работы; можно делать в любом порядке.

## Группа 2.A — Landing (`/`)

### 2.A.1 — Hero eyebrow margin-bottom 28

Прототип: `<p className="eyebrow" style={{ marginBottom: 28 }}>…</p>`
Реализация: без margin — eyebrow слипается с h1.

**Файл:** `app/page.tsx`
```diff
- <p className="eyebrow">Onchain Escrow · Base Network</p>
+ <p className="eyebrow" style={{ marginBottom: 28 }}>Onchain Escrow · Base Network</p>
```

### 2.A.2 — Hero scroll-hint icon size 16

```diff
- <Icon name="utility-chevron-down" size={14} />
+ <Icon name="utility-chevron-down" size={16} />
```

### 2.A.3 — Hero/sections max-width 1280 (не 1180)

Прототип hero и landing‑секции используют `<div className="page page--wide">` — **1280px**. Реализация — `sectionInner { maxWidth: 1180 }`.

**Файл:** `app/page.tsx`
```diff
const sectionInner = {
  margin: "0 auto",
- maxWidth: 1180,
+ maxWidth: 1280,
  paddingLeft: 16,
  paddingRight: 16,
  width: "100%",
};
```

> AppShell для остальных страниц остаётся 1180. Меняется только sectionInner на landing.

### 2.A.4 — Section paddings разнобой

Прототип:
- landing‑steps: pt **32**, pb **64**
- landing‑benefits: 64 / 64
- landing‑stats: **56 / 56**
- landing‑cta: **56 / 56**

Реализация: uniform `padding: 64px` для всех 4 секций (через `fullBleedSection`).

**Действие:** удалить уникальные paddings из `fullBleedSection`, добавить в CSS:

**Файл:** `app/page.tsx`
```diff
const fullBleedSection = {
  boxSizing: "border-box" as const,
  marginLeft: "calc(50% - 50vw)",
  marginRight: "calc(50% - 50vw)",
- padding: "64px calc(50vw - 50% + 16px)",
+ padding: "0 calc(50vw - 50% + 16px)",
  width: "auto",
};
```

**Файл:** `app/globals.css` — добавить:
```css
.landing-steps    { padding-top: 32px; padding-bottom: 64px; }
.landing-benefits { padding-top: 64px; padding-bottom: 64px; }
.landing-stats    { padding-top: 56px; padding-bottom: 56px; }
.landing-cta      { padding-top: 56px; padding-bottom: 56px; }
```

### 2.A.5 — Final CTA actions/trust margins

**Файл:** `app/globals.css`
```diff
.landing-cta__actions {
  …
- margin-top: 4px;
+ margin-top: 12px;
}

.landing-cta__trust {
  …
+ margin-top: 16px;
  padding-top: 20px;
}
```

### 2.A.6 — SiteFooter brand mark

Прототип: `<span class="brand"><span class="brand__mark"><ArrabonLogo size=28/></span><span class="brand__word">Arrabon</span></span>`
Реализация: только текст «Arrabon», нет логотипа.

**Файл:** `app/page.tsx` в `SiteFooter()`:
```diff
- <span style={brandStyle}>
-   <span style={brandWordStyle}>Arrabon</span>
- </span>
+ <span style={brandStyle}>
+   <ArrabonSeal size={28} tone="auto" />
+   <span style={brandWordStyle}>Arrabon</span>
+ </span>
```

`ArrabonSeal` уже импортирован в файле.

---

## Группа 2.B — Create (`/create`)

### 2.B.1 — Page maxWidth 1100 (не 1180)

Прототип: `<div className="page" style={{ maxWidth: 1100 }}>` — именно 1100 для create.
Реализация (после plan-7 JJ): `<AppShell maxWidth={1180}>`.

**Файл:** `app/create/page.tsx`
```diff
- <AppShell maxWidth={1180}>
+ <AppShell maxWidth={1100}>
```

> Если 1100 кажется слишком узко на десктопе — оставь 1180 и пометь как осознанное отклонение.

### 2.B.2 — Create split gap 32 → 28

**Файл:** `app/globals.css`
```diff
.create-split {
  align-items: start;
  display: grid;
- gap: 32px;
+ gap: 28px;
  grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr);
}
```

### 2.B.3 — Form section gap 18 → 20

**Файл:** `components/link/create-link-form.tsx`
```diff
const sectionStackStyle = {
  display: "flex",
  flexDirection: "column" as const,
- gap: 18,
+ gap: 20,
};
```

### 2.B.4 — Payment section: divider + Settlement DetailRow

Прототип Payment section:
```
<TokenAmountRow … />
<hr className="rule" />          ← добавить
<DetailRow label="Seller wallet" … />
<DetailRow label="Settlement" value="Base · USDC" />   ← добавить
```

**Файл:** `components/link/create-link-form.tsx`, в Payment section ActionPanel:
```diff
<ActionPanel style={cardPaddedStyle}>
  <div style={sectionStackStyle}>
    <SectionLabel>Payment</SectionLabel>
    <TokenAmountRow …  />
+   <hr style={ruleStyle} />
    <DetailRow bordered={false} label="Seller wallet" mono value={sellerAddress} />
+   <DetailRow bordered={false} label="Settlement" value="Base · USDC" />
  </div>
</ActionPanel>
```

Добавить в const styles:
```ts
const ruleStyle = { background: "var(--rule)", border: 0, height: 1, margin: 0 };
```

### 2.B.5 — Preview divider symmetric margin

**Файл:** `components/link/link-preview-card.tsx`
```diff
const divider = {
  background: "var(--rule)",
+ border: 0,
  height: 1,
- margin: "16px 0 0",
+ margin: "20px 0",
};
```

### 2.B.6 — Preview inset ArrabonSeal 36 → 56

```diff
- <ArrabonSeal size={36} tone="auto" />
+ <ArrabonSeal size={56} tone="auto" />
```

И `insetStyle.gap: 12 → 14`.

---

## Группа 2.C — BuyerLink (`/link/[id]`)

### 2.C.1 — Topbar margin-bottom 24 (не 40)

**Файл:** `app/globals.css`
```diff
.link-page__topbar {
  align-items: center;
  display: flex;
  justify-content: space-between;
- margin-bottom: 40px;
+ margin-bottom: 24px;
}
```

### 2.C.2 — Back button → `.btn .btn--quiet .btn--sm`

Прототип использует унифицированный класс с hover. Реализация — кастомный inline.

**Файл:** `app/link/[id]/page.tsx`
```diff
- <button onClick={handleBack} style={backButtonStyle} type="button">
-   <Icon name="utility-arrow-left" size={14} />
-   Back
- </button>
+ <button onClick={handleBack} className="btn btn--quiet btn--sm" type="button">
+   <Icon name="utility-arrow-left" size={14} />
+   Back
+ </button>
```

Удалить unused `backButtonStyle`.

### 2.C.3 — Right sticky top 32 → 88

**Файл:** `app/globals.css`
```diff
.link-split__right {
  …
- top: 32px;
+ top: 88px;
}
```

### 2.C.4 — Inset seal card под action card

Прототип после action card имеет отдельную `<Card inset padded>` с ArrabonSeal 48 + "Secured by Arrabon" text. Реализация — нет.

**Файл:** `app/link/[id]/page.tsx`

В `<aside className="link-split__right">` добавить ПОСЛЕ `<LinkActionCard … />`:
```tsx
<aside className="link-split__right">
  <LinkActionCard … />
  <div style={insetSealCardStyle}>
    <ArrabonSeal size={48} tone="auto" />
    <div>
      <p style={insetSealLabelStyle}>Secured by Arrabon</p>
      <p style={insetSealDescStyle}>Onchain escrow on Base. Trusted settlement.</p>
    </div>
  </div>
</aside>
```

Импортировать `ArrabonSeal`. Добавить styles:
```ts
const insetSealCardStyle = {
  alignItems: "center",
  background: "var(--surface-2)",
  border: "1px solid var(--border-soft)",
  borderRadius: "var(--r-3)",
  display: "flex",
  gap: 14,
  padding: 20,
} as const;
const insetSealLabelStyle = {
  color: "var(--muted)",
  fontSize: 11.5,
  fontWeight: 600,
  letterSpacing: "0.06em",
  margin: 0,
  textTransform: "uppercase" as const,
};
const insetSealDescStyle = {
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.5,
  margin: "4px 0 0",
};
```

### 2.C.5 — Helper text под Fund Btn

Прототип добавляет под "Pay into escrow" Btn small helper:
> «You'll be asked to sign a SIWE message and approve USDC before funding.»

**Файл:** `components/link/link-action-card.tsx` — в блоке authenticated, после CTA Btn:
```tsx
{fundingState.step === "idle" && (
  <>
    <Btn disabled={isFunding} fullWidth onClick={execute}>
      Pay into escrow · ${formatUsdcAmount(totalAmount)}
    </Btn>
    <p style={signHelperStyle}>
      You'll be asked to sign a SIWE message and approve USDC before funding.
    </p>
  </>
)}
```

Добавить:
```ts
const signHelperStyle = {
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.5,
  margin: "12px 0 0",
  textAlign: "center" as const,
};
```

---

## Группа 2.D — Deal (`/deal/[id]`)

### 2.D.1 — Back link → `.btn .btn--quiet .btn--sm` + "Back to" prefix

**Файл:** `app/deal/[id]/page.tsx`
```diff
- <Link href={backLink.href} style={backLinkStyle}>
-   <Icon name="utility-arrow-left" size={14} style={{ marginRight: 4 }} />
-   {backLink.label}
- </Link>
+ <Link
+   href={backLink.href}
+   className="btn btn--quiet btn--sm"
+   style={{ alignSelf: "flex-start", marginBottom: 16 }}
+ >
+   <Icon name="utility-arrow-left" size={14} />
+   Back to {backLink.label.toLowerCase()}
+ </Link>
```

Удалить inline `backLinkStyle`.

### 2.D.2 — Right column gap 16 → 20

**Файл:** `app/globals.css`
```diff
.deal-split__left,
.deal-split__right {
  display: flex;
  flex-direction: column;
- gap: 16px;
+ gap: 20px;
  min-width: 0;
}
```

### 2.D.3 — Hero title fallback to `deal.title`

Прототип для неизвестных статусов показывает оригинальное название consultation’а.

**Файл:** `components/deal/deal-status-card.tsx`
```diff
- const title = STATUS_TITLES[deal.status] ?? "Consultation escrow";
+ const title = STATUS_TITLES[deal.status] ?? deal.title ?? "Consultation escrow";
```

### 2.D.4 — Lifecycle card: StatusPill + padding 28

Прототип:
```jsx
<Card padded>
  <div className="row--between" style={{ marginBottom: 20 }}>
    <p className="section-label">Lifecycle</p>
    <StatusPill status={deal.status} size="md" />
  </div>
  <LifecycleTimeline />
</Card>
```

Реализация (`KeyTimes`): только section-label, без pill.

**Файл:** `components/deal/key-times.tsx`
```tsx
"use client";

import type { DealReadModel } from "@/lib/api/deals";
import { ActionPanel } from "@/components/shared/action-panel";
import { LifecycleTimeline } from "@/components/deal/lifecycle-timeline";
import { StatusPill } from "@/components/shared/status-pill";
import { getDealDisplayConfig, toneFromStatus } from "@/lib/ui/deal-status";

interface KeyTimesProps {
  deal: DealReadModel;
  isSeller: boolean;
}

export function KeyTimes({ deal }: KeyTimesProps) {
  const badge = getDealDisplayConfig({ resolution_type: deal.resolution_type, status: deal.status });
  const tone = toneFromStatus(deal.status);
  return (
    <ActionPanel as="section" style={{ padding: 28 }}>
      <div style={headRowStyle}>
        <p style={sectionLabelStyle}>Lifecycle</p>
        <StatusPill label={badge.label} size="md" tone={tone} />
      </div>
      <LifecycleTimeline deal={deal} />
    </ActionPanel>
  );
}

const headRowStyle = {
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 20,
};

const sectionLabelStyle = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.16em",
  margin: 0,
  textTransform: "uppercase" as const,
};
```

> `toneFromStatus` — это helper из `lib/ui/deal-status.ts`, не возвращает все нужные значения для всех статусов; проверь signature и подкорректируй если нужно StatusPill через bg/color props.

### 2.D.5 — DealDetailsCard: section-label «Details» + padding 28

Прототип:
```jsx
<Card padded>
  <p className="section-label" style={{ marginBottom: 14 }}>Details</p>
  <DetailRow … />
  …
</Card>
```

Реализация: только DetailRows в ActionPanel с padding "0 20px", без заголовка.

**Файл:** `components/deal/deal-details-card.tsx`
```diff
- <ActionPanel style={{ padding: "0 20px" }}>
-   <DetailRow label="Amount" … />
+ <ActionPanel style={{ padding: 28 }}>
+   <p style={detailsLabelStyle}>Details</p>
+   <DetailRow label="Amount" … />
```

В конце файла добавить:
```ts
const detailsLabelStyle = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.16em",
  margin: "0 0 14px",
  textTransform: "uppercase" as const,
};
```

---

## Группа 2.E — Receipt (`/deal/[id]/receipt`)

### 2.E.1 — Back link → `.btn .btn--quiet .btn--sm`

**Файл:** `app/deal/[id]/receipt/page.tsx`
```diff
- <Link href={`/deal/${dealId}`} style={backLinkStyle}>
-   ← Back to deal
- </Link>
+ <Link
+   href={`/deal/${dealId}`}
+   className="btn btn--quiet btn--sm"
+   style={{ alignSelf: "flex-start" }}
+ >
+   <Icon name="utility-arrow-left" size={14} />
+   Back to deal
+ </Link>
```

Импортировать Icon. Удалить inline `backLinkStyle`.

### 2.E.2 — DetailRows: reorder + добавить Status row

Прототип порядок: **Deal ID / Amount / Status / Seller / Buyer / Scheduled / Released / Settlement tx**.
Реализация: Amount / Deal / Seller / Buyer / Scheduled / Settled / Tx hash. Без Status.

**Файл:** `app/deal/[id]/receipt/page.tsx`

Перепиши блок DetailRows:
```tsx
<div className="receipt__details">
  <DetailRow label="Deal ID" mono value={deal.id.slice(0, 8).toUpperCase()} />
  <DetailRow
    label="Amount"
    value={`${formatUsdcPrice(deal.price_usdc)} USDC`}
    accent
  />
  <DetailRow
    label="Status"
    value={
      <StatusPill
        label={deal.status === "Released" ? "Released" : "Refunded"}
        tone={deal.status === "Released" ? "success" : "accent"}
      />
    }
  />
  <DetailRow label="Seller" mono value={truncateAddress(deal.seller_address)} />
  <DetailRow label="Buyer" mono value={truncateAddress(deal.buyer_address)} />
  <DetailRow label="Scheduled" value={formatDate(deal.scheduled_at)} />
  {settledAt && <DetailRow label="Released" value={formatDate(settledAt)} />}
  {deal.tx_hash && (
    <DetailRow
      bordered={false}
      label="Settlement tx"
      mono
      value={
        <a href={`https://basescan.org/tx/${deal.tx_hash}`} rel="noreferrer" style={txLinkStyle} target="_blank">
          {deal.tx_hash.slice(0, 10)}…
        </a>
      }
    />
  )}
</div>
```

Импортировать `StatusPill` из `components/shared/status-pill`.

---

## Группа 2.F — MyDeals / MyLinks

### 2.F.1 — Tab labels с counts

Прототип: `[{value:"all", label:"All · ${counts.all}"}, …]` — counts в label’ах.
Реализация: только текст без counts.

**Файл:** `app/my-deals/page.tsx`

```diff
- const FILTERS: { value: MyDealsFilter; label: string }[] = [
-   { value: "all", label: "All" },
-   { value: "upcoming", label: "Upcoming" },
-   { value: "needs_action", label: "Needs action" },
-   { value: "disputed", label: "Disputed" },
-   { value: "resolved", label: "Resolved" },
- ];
+ // Build dynamically below from current deals length
```

Внутри `MyDealsPage()`:
```tsx
const FILTERS = useMemo(() => [
  { value: "all" as const, label: `All${deals !== null ? ` · ${deals.length}` : ""}` },
  { value: "upcoming" as const, label: "Upcoming" },
  { value: "needs_action" as const, label: "Needs action" },
  { value: "disputed" as const, label: "Disputed" },
  { value: "resolved" as const, label: "Resolved" },
], [deals]);
```

> Counts на All приближённый — только текущей страницы (пока нет dedicated counts endpoint). Это всё равно ближе к прототипу. Если хочется точно — добавить отдельный fetch или endpoint.

Аналогично в `app/my-links/page.tsx`.

### 2.F.2 — List row chevron 14 → 16

**Файл:** `app/my-deals/page.tsx` (в `DealRow`):
```diff
- <Icon name="utility-chevron-right" size={14} />
+ <Icon name="utility-chevron-right" size={16} />
```

Аналогично в `app/my-links/page.tsx` `LinkRow`.

### 2.F.3 — Search input через `.search-input` class

**Файл:** `app/globals.css` — добавить в конец:
```css
.search-input {
  position: relative;
  flex: 0 1 320px;
}
.search-input input {
  width: 100%;
  height: 36px;
  padding: 0 14px 0 36px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--r-2);
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--ink);
  outline: none;
  transition: border-color .15s, background .15s, box-shadow .15s;
}
.search-input input:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px var(--gold-soft);
  background: var(--surface);
}
.search-input input::placeholder { color: var(--muted-2); }
.search-input__icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
}
@media (max-width: 768px) {
  .search-input { flex: 1 1 100%; max-width: 100%; }
}
```

**Файл:** `app/my-deals/page.tsx` и `app/my-links/page.tsx`:
```diff
- <div style={searchBoxStyle}>
-   <Icon name="utility-search" size={14} />
-   <input
-     onChange={(e) => setQuery(e.target.value)}
-     placeholder="Search by title or deal ID…"
-     style={searchInputStyle}
-     type="search"
-     value={query}
-   />
- </div>
+ <div className="search-input">
+   <span className="search-input__icon">
+     <Icon name="utility-search" size={14} />
+   </span>
+   <input
+     onChange={(e) => setQuery(e.target.value)}
+     placeholder="Search by title or deal ID…"
+     type="search"
+     value={query}
+   />
+ </div>
```

Удалить unused `searchBoxStyle`, `searchInputStyle`.

---

## Группа 2.G — Admin

### 2.G.1 — Admin subnav: tabs container

Прототип: `<div className="admin-subnav"><div className="admin-subnav__brand"><span pill>Admin console</span></div><div className="admin-subnav__tabs"><button tab is-active>Disputes</button><button tab>Denylist</button></div></div>`

Реализация: flat `<nav><span badge>Admin</span><Link>Disputes</Link><Link>Denylist</Link></nav>` — текстовые ссылки.

**Файл:** `app/globals.css` — добавить:
```css
.admin-subnav__brand {
  display: inline-flex;
  align-items: center;
}
.admin-subnav__tabs {
  display: flex;
  gap: 4px;
  margin-left: auto;
  background: var(--surface-2);
  padding: 4px;
  border-radius: var(--r-3);
  border: 1px solid var(--border);
}
.admin-subnav__tab {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  background: transparent;
  border: 0;
  border-radius: var(--r-2);
  cursor: pointer;
  transition: color .15s, background .15s;
  white-space: nowrap;
  font-family: inherit;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.admin-subnav__tab:hover { color: var(--ink); }
.admin-subnav__tab.is-active {
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-1);
}
```

**Файлы:** `app/admin/disputes/page.tsx`, `app/admin/disputes/[id]/page.tsx`, `app/admin/denylist/page.tsx` — заменить subnav на:

```tsx
import { usePathname } from "next/navigation";

// inside component
const pathname = usePathname();
const isDisputes = pathname.startsWith("/admin/disputes");
const isDenylist = pathname.startsWith("/admin/denylist");

<nav className="admin-subnav">
  <div className="admin-subnav__brand">
    <span className="admin-badge">Admin</span>
  </div>
  <div className="admin-subnav__tabs">
    <Link
      href="/admin/disputes"
      className={`admin-subnav__tab${isDisputes ? " is-active" : ""}`}
    >
      Disputes
    </Link>
    <Link
      href="/admin/denylist"
      className={`admin-subnav__tab${isDenylist ? " is-active" : ""}`}
    >
      Denylist
    </Link>
  </div>
</nav>
```

Удалить inline `adminNavLinkStyle` из всех 3 файлов.

### 2.G.2 — Tab labels с counts на admin/disputes

**Файл:** `app/admin/disputes/page.tsx`

```diff
- const VIEW_OPTIONS = [
-   { label: "Open disputes", value: "open" },
-   { label: "Resolved history", value: "resolved" },
- ] as const;
+ // build below
```

Внутри component:
```tsx
const viewOptions = useMemo(() => [
  { label: `Open${deals.length ? ` · ${deals.length}` : ""}`, value: "open" as const },
  { label: `Resolved${resolvedDeals.length ? ` · ${resolvedDeals.length}` : ""}`, value: "resolved" as const },
], [deals.length, resolvedDeals.length]);
```

И заменить `options={VIEW_OPTIONS.map(...)}` → `options={viewOptions}`.

---

## Группа 2.H — NotFound

### 2.H.1 — Btn md → lg

**Файл:** `app/not-found.tsx`
```diff
- <Btn onClick={() => router.back()} size="md" variant="ghost">
-   ← Back
- </Btn>
- <Link href="/" style={{ textDecoration: "none" }}>
-   <Btn size="md" variant="primary">Home</Btn>
- </Link>
+ <Btn onClick={() => router.back()} size="lg" variant="ghost">
+   <Icon name="utility-arrow-left" size={14} />
+   Back
+ </Btn>
+ <Link href="/" style={{ textDecoration: "none" }}>
+   <Btn size="lg" variant="primary">Home</Btn>
+ </Link>
```

Импортировать Icon.

---

## Группа 2.I — Shared components

### 2.I.1 — SectionLabel ::after divider line

Прототип: section-label рендерит горизонтальную линию справа от текста через `::after`.

**Файл:** `app/globals.css` — добавить:
```css
.section-label {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
  margin: 0;
}
.section-label::after {
  content: "";
  flex: 1 1 0%;
  min-width: 0;
  height: 1px;
  background: var(--rule);
}
@media (max-width: 768px) {
  .section-label::after { display: none; }
}
```

**Файл:** `components/shared/section-label.tsx` — переписать:
```tsx
import type { ReactNode } from "react";

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="section-label">{children}</p>;
}
```

Удалить inline `sectionLabelStyle`.

> Все вызовы `<SectionLabel>` автоматически получат правую divider‑линию.

### 2.I.2 — SegmentedTabs — match с прототипом `.tabs`

**Файл:** `components/shared/segmented-tabs.tsx`
```diff
<div
  style={{
-   background: "var(--muted-bg)",
+   background: "var(--surface-2)",
+   border: "1px solid var(--border)",
-   borderRadius: "var(--radius)",
+   borderRadius: "var(--r-3)",
    display: "flex",
-   gap: 4,
+   gap: 2,
    overflowX: "auto",
    padding: 4,
    ...style,
  }}
>
  {options.map((option) => {
    const active = option.value === value;
    return (
      <button
        …
        style={{
-         background: active ? "var(--panel)" : "transparent",
+         background: active ? "var(--surface)" : "transparent",
          border: "none",
-         borderRadius: "var(--radius-sm)",
+         borderRadius: "var(--r-2)",
-         boxShadow: active ? "0 1px 2px rgba(0, 0, 0, 0.05)" : "none",
+         boxShadow: active ? "var(--shadow-1)" : "none",
-         color: active ? "var(--foreground)" : "var(--muted)",
+         color: active ? "var(--ink)" : "var(--muted)",
          flexShrink: 0,
-         fontSize: 14,
+         fontSize: 13,
          fontWeight: 500,
-         padding: "7px 14px",
+         padding: "8px 16px",
          whiteSpace: "nowrap",
        }}
```

### 2.I.3 — AppShell padding 32/32/64 → 56/32/96

Прототип `.page padding: 56px 32px 96px` — больше top/bottom воздуха.

**Файл:** `components/app/app-shell.tsx`
```diff
const mainStyle = {
  display: "flex",
  justifyContent: "center",
  minHeight: "100vh",
- padding: "32px 32px 64px",
+ padding: "56px 32px 96px",
} as const;
```

> Для landing с `flushBottom` — bottom 0 остаётся (через override). Если нет override — добавь:

```tsx
<main style={{ ...mainStyle, paddingBottom: flushBottom ? 0 : 96 }}>
```

---

## ЭТАП 2 — финал

```bash
npm run typecheck && npm run build && npm run test:unit
```

Допиши в `audit/PROGRESS.md`:
```md
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
- components/link/link-preview-card.tsx — divider margin "16/0/0"→"20/0", inset seal 36→56, inset gap 12→14

### Group 2.C — BuyerLink
- app/globals.css — .link-page__topbar margin-bottom 40→24; .link-split__right top 32→88
- app/link/[id]/page.tsx — back button → .btn .btn--quiet .btn--sm; inset seal card added below LinkActionCard
- components/link/link-action-card.tsx — helper text below Pay btn

### Group 2.D — Deal
- app/deal/[id]/page.tsx — back link → .btn .btn--quiet .btn--sm + "Back to" prefix
- app/globals.css — .deal-split__left/right gap 16→20
- components/deal/deal-status-card.tsx — title fallback to deal.title
- components/deal/key-times.tsx — StatusPill next to "Lifecycle"; padding 20→28
- components/deal/deal-details-card.tsx — section-label "Details" added; padding "0 20"→28

### Group 2.E — Receipt
- app/deal/[id]/receipt/page.tsx — back link → .btn .btn--quiet .btn--sm
- app/deal/[id]/receipt/page.tsx — DetailRows reorder + Status row added; "Tx hash" → "Settlement tx"

### Group 2.F — MyDeals/MyLinks
- app/my-deals/page.tsx + my-links/page.tsx — tab labels with counts
- app/my-deals/page.tsx + my-links/page.tsx — chevron Icon size 14→16
- app/globals.css — .search-input* classes
- both pages — search box → className="search-input"; removed inline styles

### Group 2.G — Admin
- app/globals.css — .admin-subnav__brand, .admin-subnav__tabs, .admin-subnav__tab classes
- app/admin/{disputes,disputes/[id],denylist}/page.tsx — subnav restructured with tab segments
- app/admin/disputes/page.tsx — tab labels with counts

### Group 2.H — NotFound
- app/not-found.tsx — Btn md→lg with utility-arrow-left icon

### Group 2.I — Shared
- app/globals.css — .section-label class with ::after divider line
- components/shared/section-label.tsx — use .section-label className
- components/shared/segmented-tabs.tsx — match prototype .tabs visual (surface-2, border, gap 2, padding 8/16, fontSize 13)
- components/app/app-shell.tsx — mainStyle padding 32/32/64 → 56/32/96
```

**Остановись и подожди ревью**, либо переходи к Этапу 3.

---

# ЭТАП 3 — P2 (полишинг, опциональный)

13 микро‑правок для финального матчинга с прототипом. Можно сделать партией.

## 3.1 — Hero scroll-hint параллакс bob

**Файл:** `app/page.tsx`, в `HeroSection()` `onScroll()`:
```tsx
if (hintRef.current) {
  const hintOp = Math.max(0, 1 - y / 80);
  hintRef.current.style.opacity = String(hintOp);
  hintRef.current.style.pointerEvents = hintOp < 0.05 ? "none" : "auto";
  // ADD:
  hintRef.current.style.transform = `translateX(-50%) translateY(${Math.min(24, y * 0.4)}px)`;
}
```

## 3.2 — Stack-32 wrappers на landing sections

**Файл:** `app/page.tsx` — в 3 секциях:
```diff
- <div className="stack-12" style={{ maxWidth: 720, marginBottom: 40 }}>
+ <div className="stack-12" style={{ maxWidth: 720, marginBottom: 32 }}>
```

## 3.3 — StepCard/BenefitCard desc — 13/1.5

**Файл:** `app/page.tsx`
```diff
const cardDescStyle = {
  color: "var(--muted)",
- fontSize: 13.5,
- lineHeight: 1.65,
+ fontSize: 13,
+ lineHeight: 1.5,
  margin: 0,
};
```

## 3.4 — Final CTA trust иконки вариативные

**Файл:** `app/page.tsx`
```diff
const TRUST_ITEMS = [
- { label: "Built on Base" },
- { label: "Wallet-signed actions" },
- { label: "Neutral dispute review" },
+ { icon: "utility-secure-subtle", label: "Built on Base" },
+ { icon: "utility-wallet-connected", label: "Wallet-signed actions" },
+ { icon: "utility-secure-subtle", label: "Neutral dispute review" },
];
```

В JSX:
```diff
- <Icon name="utility-secure-subtle" size={13} />
+ <Icon name={t.icon as IconName} size={13} />
```

(Если есть лучше подходящая иконка `shield`/`lock` в наборе — использовать её.)

## 3.5 — SiteFooter copy fontSize 12 → 13

**Файл:** `app/page.tsx`
```diff
const footerCopyStyle = {
  color: "var(--muted-2)",
- fontSize: 12,
+ fontSize: 13,
};
```

## 3.6 — Create submit Btn arrow-right icon

**Файл:** `components/link/create-link-form.tsx`
```tsx
<Btn …>
  {primaryAction.label}
  {primaryAction.type === "submit" && !primaryAction.loading && (
    <Icon name="utility-arrow-right" size={16} />
  )}
</Btn>
```

Импортировать Icon если нет.

## 3.7 — Preview Price формат «mono + muted USDC»

**Файл:** `components/link/link-preview-card.tsx`
```diff
- <DetailRow label="Price" value={values.price_usdc ? `${values.price_usdc} USDC` : "—"} accent />
+ <DetailRow
+   label="Price"
+   value={
+     values.price_usdc ? (
+       <span>
+         <span style={{ fontFamily: "var(--font-mono)" }}>{values.price_usdc}</span>
+         <span style={{ color: "var(--muted)", marginLeft: 4 }}>USDC</span>
+       </span>
+     ) : "—"
+   }
+ />
```

> Или оставь accent — это improvement над прототипом. Решай по вкусу.

## 3.8 — Deal hero status icon size 20 → 22

**Файл:** `components/deal/deal-status-card.tsx`
```diff
- <Icon name={sc.icon} size={20} />
+ <Icon name={sc.icon} size={22} />
```

## 3.9 — Countdown "Live" label fontSize 12 → 13

**Файл:** `app/deal/[id]/page.tsx`
```diff
- <span style={{ color: "var(--muted)", fontSize: 12 }}>Live</span>
+ <span style={{ color: "var(--muted)", fontSize: 13 }}>Live</span>
```

## 3.10 — Receipt: Copy ID button в top-right

**Файл:** `app/deal/[id]/receipt/page.tsx`

Обернуть back link в row + добавить Copy ID:
```tsx
<div style={topRowStyle}>
  <Link href={`/deal/${dealId}`} className="btn btn--quiet btn--sm">
    <Icon name="utility-arrow-left" size={14} />
    Back to deal
  </Link>
  <Btn size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(deal?.id ?? "")}>
    <Icon name="utility-copy-address" size={14} />
    Copy ID
  </Btn>
</div>
```

`topRowStyle = { alignItems: "center", display: "flex", justifyContent: "space-between" }`.

## 3.11 — Admin dispute card title h2 → h3 serif 22 (опционально)

> Только если хочется матчинга прототипа. Текущие 28px ОК визуально.

**Файл:** `app/admin/disputes/page.tsx`
```diff
- <h2 className="h2" style={{ overflowWrap: "anywhere" as const }}>{deal.title}</h2>
+ <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.005em", margin: 0, overflowWrap: "anywhere" as const }}>{deal.title}</h3>
```

## 3.12 — DetailRow accent → gold-deep (better contrast)

**Файл:** `components/shared/detail-row.tsx`
```diff
- color: accent ? "var(--gold)" : "var(--ink)",
+ color: accent ? "var(--gold-deep)" : "var(--ink)",
```

## 3.13 — NotFound back button — текстовая стрелка → Icon

Уже сделано в Этапе 2.H.

---

## ЭТАП 3 — финал

```bash
npm run typecheck && npm run build && npm run test:unit
```

Допиши:
```md
## Plan-9 — Stage 3 (P2) completed
- app/page.tsx — scroll-hint parallax translateY; stack header marginBottom 40→32; cardDescStyle 13.5/1.65→13/1.5; trust icons variable; footer copy 13
- components/link/create-link-form.tsx — submit arrow-right icon (conditional)
- components/link/link-preview-card.tsx — Price detail row mono+muted format
- components/deal/deal-status-card.tsx — Icon size 20→22
- app/deal/[id]/page.tsx — Live label 12→13
- app/deal/[id]/receipt/page.tsx — Copy ID button added
- app/admin/disputes/page.tsx — dispute card title h2→h3 serif 22
- components/shared/detail-row.tsx — accent gold→gold-deep
```

---

# Сводка

| Этап | Кол-во | Эффект | Время (оценка) |
|---|---|---|---|
| **1 (P0)** | 3 правки | Закрывает 3 худших регрешна: landing h2, "You pay" amount, NotFound title | ~30‑45 мин |
| **2 (P1)** | ~30 правок (9 групп) | Полноценный matchine со всеми страницами прототипа | ~3‑4 часа |
| **3 (P2)** | 13 микро‑правок | Финальный полишинг + матчинг типографики | ~1 час |

После всех 3 этапов реализация должна **визуально совпадать с прототипом 1:1** на всех страницах.

Все правки чисто визуальные — логику/state/API/тесты не трогаем.
