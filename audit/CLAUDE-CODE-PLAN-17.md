# Claude Code — план №17 (страницы /deal/[id] + /link/[id])

**Дата:** 2026‑05‑21
**Контекст:** После plan-16 (ActionPanel дефолты исправлены) сделан детальный аудит /deal/[id] и /link/[id] vs прототип. Нашёл системные паттерны где cards используют `padding: 20` (импл) vs `padding: 28` (прототип `.card--padded`), не используют `.section-label` class, и пара структурных пробелов.

**Правила:**
- Не коммить.
- После каждой Part — `npm run typecheck && npm run build && npm run test:unit`.
- Запись в `audit/PROGRESS.md` (секция `## Plan-17`).

---

# Part I — /deal/[id]

## Phase 1 — [P0] MeetingUrlCard idle state: `.copy-field` + Hidden pill

**Проблема:** В прототипе до клика Reveal пользователь видит **визуальный hint** скрытого контента — `.copy-field` контейнер с bullets `••••••••••••••••` + золотая `pill pill--gold` с lock иконкой "Hidden" + Reveal button + small muted text "URL is encrypted server-side and visible only to deal participants."

В импл просто кнопка "Reveal meeting link" без какого-либо индикатора скрытого URL — пользователь не понимает что именно скрыто.

**Файл:** `components/deal/meeting-url-card.tsx`, idle state JSX:

```diff
  return (
    <ActionPanel style={cardStyle}>
      <p className="section-label" style={{ marginBottom: 18 }}>Meeting link</p>

      {revealState === "idle" && (
+       <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
+         <div className="copy-field">
+           <span className="copy-field__value" style={{ color: "var(--muted-2)" }}>
+             ••••••••••••••••••••••••••••••••
+           </span>
+           <span className="pill pill--gold" style={{ alignItems: "center", gap: 4 }}>
+             <Icon name="utility-lock" size={11} stroke={2.2} />
+             Hidden
+           </span>
+         </div>
          <Btn fullWidth onClick={handleReveal} variant="secondary">
            Reveal meeting link
          </Btn>
+         <p className="small" style={{ color: "var(--muted)", margin: 0 }}>
+           URL is encrypted server-side and visible only to deal participants.
+         </p>
+       </div>
      )}
```

Импортировать `Icon` если не импортирован.

### Acceptance
- В idle state видна полоса `••••` (32 точки) + золотая "Hidden" pill с lock иконкой справа
- Под Reveal btn — small muted объяснение про шифрование
- После Reveal — старый flow (зелёный success box + URL + Copy)

---

## Phase 2 — [P0] Inset seal card всегда видна (не только settled)

**Проблема:** Прототип на правой колонке /deal/[id] **всегда** показывает `<Card inset padded>` с:
- `<ArrabonSeal size={56} tone="auto" showText={false} />`
- "Secured by Arrabon" tiny
- "Onchain escrow · Base · Deal {deal.id}" small muted
- "View receipt" ghost sm btn (iconRight arrow / external)

Импл `<ReceiptInset visible={...}>` показывает inset **только** для Released/Refunded. Большую часть жизненного цикла deal эта карточка отсутствует.

### Действие

Перепиши `ReceiptInset` в более общую `DealSealCard`:

**Файл:** `components/deal/receipt-inset.tsx` — переименовать в `deal-seal-card.tsx` (или оставить имя, изменить содержимое):

```tsx
"use client";

import Link from "next/link";

import { Icon } from "@/components/icons";
import { ArrabonSeal } from "@/components/shared/arrabon-seal";
import { Btn } from "@/components/shared/btn";

interface Props {
  dealId: string;
  isSettled: boolean;
}

export function DealSealCard({ dealId, isSettled }: Props) {
  return (
    <div style={insetStyle}>
      <ArrabonSeal size={56} tone="auto" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="tiny">Secured by Arrabon</p>
        <p style={subStyle}>
          Onchain escrow · Base · Deal {dealId.slice(0, 8).toUpperCase()}
        </p>
      </div>
      {isSettled && (
        <Link href={`/deal/${dealId}/receipt`} style={{ textDecoration: "none", marginLeft: "auto" }}>
          <Btn size="sm" variant="ghost">
            View receipt
            <Icon name="utility-external-link" size={14} />
          </Btn>
        </Link>
      )}
    </div>
  );
}

const insetStyle = {
  alignItems: "center",
  background: "var(--surface-2)",
  border: "1px solid var(--border-soft)",
  borderRadius: "var(--r-3)",
  display: "flex",
  gap: 14,
  padding: 28,
} as const;

const subStyle = {
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.5,
  margin: "4px 0 0",
};
```

**Файл:** `app/deal/[id]/page.tsx`:

```diff
- <ReceiptInset
-   dealId={dealId}
-   visible={
-     dealPage.deal.status === "Released" || dealPage.deal.status === "Refunded"
-   }
- />
+ <DealSealCard
+   dealId={dealId}
+   isSettled={
+     dealPage.deal.status === "Released" || dealPage.deal.status === "Refunded"
+   }
+ />
```

Импорт: `import { DealSealCard } from "@/components/deal/deal-seal-card";`

> Можно оставить имя файла `receipt-inset.tsx` если страшно переименовывать — главное изменить export name + content.

### Acceptance
- На любой /deal/[id] (Funded, ConfirmPending, Disputed, Released, Refunded) видна inset card на правой колонке
- Seal 56px, "Secured by Arrabon" tiny, "Onchain escrow · Base · Deal AR-XXX..." muted
- "View receipt" btn справа — только для Released/Refunded

---

## Phase 3 — [P0] MeetingUrlCard + DealActionsCard padding 20 → 28 + использовать section-label

Прототип использует `<Card padded>` (padding 28) с `.section-label` (через class, с `::after` divider). Импл использует `padding: 20` и custom inline label.

### 3.1 MeetingUrlCard

**Файл:** `components/deal/meeting-url-card.tsx`:

```diff
  const cardStyle = {
-   padding: 20,
+   padding: 28,
  } as const;

- const labelStyle = {
-   color: "var(--muted)",
-   fontSize: 11,
-   fontWeight: 600,
-   letterSpacing: "0.08em",
-   margin: "0 0 12px",
-   textTransform: "uppercase" as const,
- };
```

Заменить все `<p style={labelStyle}>Meeting link</p>` на:
```tsx
<p className="section-label" style={{ marginBottom: 18 }}>Meeting link</p>
```

### 3.2 DealActionsCard

**Файл:** `components/deal/deal-actions-card.tsx`:

```diff
  return (
-   <ActionPanel style={{ padding: 20 }}>
+   <ActionPanel style={{ padding: 28 }}>
-     <p
-       style={{
-         color: "var(--muted)",
-         fontSize: 11,
-         fontWeight: 600,
-         letterSpacing: "0.08em",
-         margin: "0 0 16px",
-         textTransform: "uppercase",
-       }}
-     >
-       Actions
-     </p>
+     <p className="section-label" style={{ marginBottom: 14 }}>Action</p>
```

(Также **"Actions" → "Action"** — singular, как в прототипе.)

### Acceptance
- Meeting / Action cards визуально такого же размера, как Lifecycle и Details (28px padding)
- Заголовки имеют divider line справа (от `.section-label::after`)
- "Action" не "Actions"

---

## Phase 4 — [P1] DealDetailsCard section-label marginBottom 14

**Файл:** `components/deal/deal-details-card.tsx`:

```diff
  return (
    <ActionPanel style={{ padding: 28 }}>
-     <p className="section-label">Details</p>
+     <p className="section-label" style={{ marginBottom: 14 }}>Details</p>
      <DetailRow label="Amount" ... />
```

Прототип `<p className="section-label" style={{marginBottom: 14}}>Details</p>`. Default `.section-label` margin 0 — первая DetailRow прижата к label.

### Acceptance
- 14px gap между "Details" label и первой DetailRow

---

## Phase 5 — [P1] LifecycleTimeline: показывать current StatusPill + desc для всех steps

**Проблема 1:** прототип показывает `<StatusPill status={step.key} size="md" />` **рядом с title** для current step (визуальный hint того где мы сейчас). Импл — нет.

**Проблема 2:** прототип всегда показывает `timeline__desc`. Импл — только `step.state !== "idle"`. Идущие steps не имеют описания.

**Файл:** `components/deal/lifecycle-timeline.tsx`:

```diff
- import { DEAL_LIFECYCLE, DISPUTE_LIFECYCLE, lifecycleStateOf } from "@/lib/ui/deal-lifecycle";
+ import { DEAL_LIFECYCLE, DISPUTE_LIFECYCLE, lifecycleStateOf } from "@/lib/ui/deal-lifecycle";
  import { formatDate } from "@/lib/ui/date";
+ import { StatusPill } from "@/components/shared/status-pill";
+ import { toneFromStatus } from "@/lib/ui/deal-status";

  ...
  
  <p className={`timeline__title${step.state === "idle" ? " timeline__title--idle" : ""}`}>
    {data?.title ?? step.key}
+   {step.state === "current" && (
+     <StatusPill
+       label={step.key}
+       size="md"
+       tone={toneFromStatus(step.key as any)}
+       style={{ marginLeft: 8 }}
+     />
+   )}
  </p>
- {data?.desc && step.state !== "idle" && (
-   <p className="timeline__desc">{data.desc}</p>
- )}
+ {data?.desc && <p className="timeline__desc">{data.desc}</p>}
  {step.state !== "idle" && date && (
    <p className="timeline__meta">{formatDate(date)}</p>
  )}
```

### Acceptance
- На current step видна цветная pill рядом с заголовком (амбер для "ConfirmPending", голубая для "Funded" и т.д.)
- Idle (будущие) steps теперь показывают описание (muted), не только текущие

---

## Phase 6 — [P2] Misc /deal refinements

### 6.1 Back link marginBottom 16 → 20

**Файл:** `app/deal/[id]/page.tsx`:
```diff
- style={{ alignSelf: "flex-start", marginBottom: 16 }}
+ style={{ alignSelf: "flex-start", marginBottom: 20 }}
```

### 6.2 Countdown clock icon stroke 1.8

**Файл:** `app/deal/[id]/page.tsx`:
```diff
- <Icon name="utility-time" size={14} />
+ <Icon name="utility-time" size={14} stroke={1.8} />
```

### 6.3 Right column gap 20 (matches prototype stack-20)

Уже сделано в plan-9 phase D.2 — `.deal-split__right { gap: 20px }` ✓. Verify still 20.

---

# Part II — /link/[id]

## Phase 7 — [P0] LinkActionCard padding 20 → 28 + section-label marginBottom 18

**Файл:** `components/link/link-action-card.tsx`:

```diff
  if (role === "seller") {
    return (
-     <ActionPanel style={{ padding: 20 }}>
+     <ActionPanel style={{ padding: 28 }}>
-       <p className="section-label">Your link</p>
+       <p className="section-label" style={{ marginBottom: 18 }}>Your link</p>
```

И для основного `<ActionPanel>` (не seller):
```diff
  return (
-   <ActionPanel style={{ padding: 20 }}>
+   <ActionPanel style={{ padding: 28 }}>
-     <p className="section-label">Fund this deal</p>
+     <p className="section-label" style={{ marginBottom: 18 }}>Fund this deal</p>
```

### Acceptance
- Fund card padding 28 (как Card padded в прототипе)
- "Fund this deal" с 18px gap до контента

---

## Phase 8 — [P0] PaymentSummary: убрать surface-2 wrapper

**Проблема:** PaymentSummary сейчас обёрнут в `surface-2` mini-panel с rounded corners — выглядит как «карточка внутри карточки». В прототипе fee-rows рендерятся **flat прямо в основном card content** без nested background.

**Файл:** `components/link/link-action-card.tsx`:

```diff
  function PaymentSummary({ priceUsdc }: { priceUsdc: string }) {
    const priceAmount = parseUsdcAmount(priceUsdc);
    const feeAmount = calculateFee(priceAmount);
    const totalAmount = calculateTotalWithFee(priceAmount);

    return (
-     <div style={paymentSummaryStyle}>
+     <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={feeRowStyle}>
          <span style={feeRowLabelStyle}>Consultation fee</span>
          ...
        </div>
        <div style={feeRowStyle}>
          <span style={feeRowLabelStyle}>Platform fee (3%)</span>
          ...
        </div>
        <hr style={ruleStyle} />
        <div style={totalRowStyle}>
          <span style={totalLabelStyle}>You pay</span>
          ...
        </div>
-       <p style={feeNoteStyle}>Non-refundable escrow service fee</p>
      </div>
    );
  }

- const paymentSummaryStyle = {
-   background: "var(--surface-2)",
-   borderRadius: "var(--r-3)",
-   padding: "4px 14px 12px",
- };
- 
- const feeNoteStyle = { ... };
```

**Также:** удалить "Non-refundable escrow service fee" — прототип не имеет этого текста.

### Acceptance
- Fees рендерятся плоско в Fund card, без nested background panel
- "Non-refundable..." note удалён

---

## Phase 9 — [P0] Inset seal card padding 20 → 28

**Файл:** `app/link/[id]/page.tsx`:

```diff
  const insetSealCardStyle = {
    alignItems: "center",
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "var(--r-3)",
    display: "flex",
    gap: 14,
-   padding: 20,
+   padding: 28,
  } as const;
```

### Acceptance
- Inset card "Secured by Arrabon" padding 28 (match `<Card inset padded>`)

---

## Phase 10 — [P1] Right column gap 16 → 20

**Файл:** `app/globals.css`:

```diff
  .link-split__right {
    display: flex;
    flex-direction: column;
-   gap: 16px;
+   gap: 20px;
    position: sticky;
    top: 88px;
  }
```

### Acceptance
- 20px между Fund card и inset seal — matches prototype stack-20

---

## Phase 11 — [P1] LinkSummary header — использовать stack-12 для spacing

**Проблема:** В header section импл использует marginTop/marginBottom на h1 + seller для spacing. Прототип использует `<div className="stack-12">` (gap 12) обёртку.

**Файл:** `components/link/link-summary.tsx`:

```diff
  <div style={headerSectionStyle}>
-   <div style={{ flex: 1, minWidth: 0 }}>
+   <div className="stack-12" style={{ flex: 1, minWidth: 0 }}>
      <StatusPill label={status.label} tone={status.tone} />
      <h1 style={titleStyle}>{link.title}</h1>
      <p style={sellerStyle}>
        Seller <span style={sellerMonoStyle}>{truncateAddress(link.seller_address)}</span>
      </p>
    </div>
    <div className="deal-hero__amount" style={{ flexShrink: 0 }}>
      ...
    </div>
  </div>
```

И в titleStyle убрать `margin: "10px 0 6px"` (теперь spacing управляется stack-12):

```diff
  const titleStyle = {
    color: "var(--ink)",
    fontFamily: "var(--font-serif)",
    fontSize: 32,
    fontWeight: 500,
    letterSpacing: "-0.005em",
    lineHeight: 1.15,
-   margin: "10px 0 6px",
+   margin: 0,
    overflowWrap: "anywhere" as const,
    textWrap: "balance" as const,
  } as const;
```

### Acceptance
- StatusPill → h1 → seller линия — каждый раздёлен 12px gap (через stack-12)
- Чище spacing model (gap вместо margins)

---

## Phase 12 — [P1] LinkSummary shield icon stroke 1.8 + color gold-deep

**Файл:** `components/link/link-summary.tsx`:

```diff
  <div style={trustSectionStyle}>
-   <Icon name="utility-secure-subtle" size={18} />
+   <Icon name="utility-secure-subtle" size={18} stroke={1.8} style={{ color: "var(--gold-deep)" }} />
```

### Acceptance
- Shield иконка чуть тоньше (1.8 stroke вместо 2)
- Явный gold-deep цвет (не inherit)

---

## Phase 13 — [P1] LinkSummary "Duration" format: убрать timezone inline

**Проблема:** Currently `Duration: 60 min · America/Los_Angeles` — таймзона в Duration row. Прототип `Duration: 60 minutes` (без timezone в этой строке).

Timezone уже показывается через `formatDate(... showTimeZoneName: true)` в "Scheduled" и "Expires" rows (как " PDT" suffix).

**Файл:** `components/link/link-summary.tsx`:

```diff
  <DetailRow
    label="Duration"
-   value={`${formatDuration(link.duration_minutes)} · ${link.timezone}`}
+   value={`${formatDuration(link.duration_minutes)}`}
  />
```

Или ещё ближе к прототипу — `${link.duration_minutes} minutes`:
```diff
- value={`${formatDuration(link.duration_minutes)}`}
+ value={`${link.duration_minutes} minutes`}
```

(`formatDuration` конвертит 60+ в "1h" — прототип всегда показывает минуты. Решай по предпочтению.)

### Acceptance
- Duration row показывает только минуты, без timezone

---

## Phase 14 — [P2] LinkSummary Link ID — убрать `bordered={false}`

**Файл:** `components/link/link-summary.tsx`:

```diff
  <DetailRow
-   bordered={false}
    label="Link ID"
    mono
    value={link.id.slice(0, 8).toUpperCase()}
  />
```

Прототип: все 5 DetailRow с default `bordered` (border-top на all but first). Импл убирает top-border на Link ID — последняя строка без separator.

### Acceptance
- Линия-разделитель между Seller и Link ID присутствует

---

# Финал

```bash
npm run typecheck && npm run build && npm run test:unit
```

Допиши в `audit/PROGRESS.md`:
```md
## Plan-17 — completed (/deal/[id] + /link/[id])

### Part I — /deal/[id]

#### Phase 1 — MeetingUrlCard idle state
- components/deal/meeting-url-card.tsx — idle state: added .copy-field with bullets ••••, gold pill with lock icon "Hidden", helper text "URL is encrypted server-side..."

#### Phase 2 — DealSealCard always present
- components/deal/receipt-inset.tsx → renamed/rewrote as DealSealCard (or kept filename, changed content)
- Always shows: ArrabonSeal 56 + "Secured by Arrabon" tiny + "Onchain escrow · Base · Deal AR-XXX..." muted
- "View receipt" btn only visible for Released/Refunded
- app/deal/[id]/page.tsx — replaced ReceiptInset with DealSealCard

#### Phase 3 — Padding 28 + section-label
- components/deal/meeting-url-card.tsx — cardStyle padding 20→28; replaced labelStyle inline with <p className="section-label" style={{marginBottom: 18}}>Meeting link</p>; removed labelStyle const
- components/deal/deal-actions-card.tsx — ActionPanel padding 20→28; replaced inline label with <p className="section-label" style={{marginBottom: 14}}>Action</p>; "Actions" → "Action"

#### Phase 4 — DetailCard section-label gap
- components/deal/deal-details-card.tsx — section-label marginBottom 14 added

#### Phase 5 — LifecycleTimeline enrichments
- components/deal/lifecycle-timeline.tsx — current step shows inline StatusPill; description visible for all states (not only non-idle)

#### Phase 6 — Misc
- app/deal/[id]/page.tsx — back link marginBottom 16→20; countdown icon stroke 1.8

### Part II — /link/[id]

#### Phase 7 — LinkActionCard padding 28 + section-label marginBottom 18
- components/link/link-action-card.tsx — both ActionPanel padding 20→28; section-label marginBottom 18 (both "Your link" + "Fund this deal")

#### Phase 8 — PaymentSummary flat (no surface-2 wrapper)
- components/link/link-action-card.tsx — removed paymentSummaryStyle wrapper, fees render flat with gap 12; removed "Non-refundable escrow service fee" text + feeNoteStyle const

#### Phase 9 — Inset seal padding 28
- app/link/[id]/page.tsx — insetSealCardStyle padding 20→28

#### Phase 10 — Right column gap 20
- app/globals.css — .link-split__right gap 16→20

#### Phase 11 — LinkSummary header stack-12
- components/link/link-summary.tsx — wrapped left block in className="stack-12"; titleStyle margin "10px 0 6px" → 0

#### Phase 12 — Shield icon stroke + color
- components/link/link-summary.tsx — utility-secure-subtle: stroke 1.8 + color var(--gold-deep)

#### Phase 13 — Duration format
- components/link/link-summary.tsx — Duration value: removed " · {timezone}" suffix; uses raw duration_minutes + "minutes"

#### Phase 14 — Link ID bordered
- components/link/link-summary.tsx — removed bordered={false} on Link ID DetailRow
```

---

# Сводка

| Phase | Часть | Что | Приоритет |
|---|---|---|---|
| 1 | Deal | MeetingUrl idle: copy-field + Hidden pill + helper | P0 |
| 2 | Deal | DealSealCard всегда видна (с view-receipt только для settled) | P0 |
| 3 | Deal | MeetingUrl + DealActions padding 28 + section-label class | P0 |
| 4 | Deal | DetailsCard section-label marginBottom 14 | P1 |
| 5 | Deal | LifecycleTimeline: current StatusPill inline + desc for idle | P1 |
| 6 | Deal | back margin / countdown stroke / right gap | P2 |
| 7 | Link | LinkActionCard padding 28 + section-label marginBottom 18 | P0 |
| 8 | Link | PaymentSummary убрать surface-2 wrapper + feeNote | P0 |
| 9 | Link | Inset seal padding 28 | P0 |
| 10 | Link | Right column gap 20 | P1 |
| 11 | Link | LinkSummary header stack-12 | P1 |
| 12 | Link | Shield icon stroke 1.8 + gold-deep color | P1 |
| 13 | Link | Duration format match прототипу | P2 |
| 14 | Link | Link ID bordered=true (как остальные) | P2 |

После Plan-17 обе страницы (`/deal/[id]` и `/link/[id]`) визуально матчат прототипу — все cards имеют consistent padding 28, заголовки используют `.section-label` с divider-линией, MeetingUrlCard в idle показывает visual hint скрытого URL, inset seal card на /deal показывается всегда.
