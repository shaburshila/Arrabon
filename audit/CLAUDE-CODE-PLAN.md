# Claude Code — план дописывания Arrabon redesign

**Назначение этого файла.** Полная самостоятельная инструкция для Claude Code в репо `shaburshila/base-consult-link`. Иди строго по шагам сверху вниз — не переходи на следующий, пока **acceptance criteria** текущего не выполнены. Не задавай вопросы по ходу — сам принимай минимальные технические решения если что-то не указано. По окончании каждой ФАЗЫ запускай `npm run build` и `npm run typecheck`, фикси ошибки, потом переходи дальше. После последней фазы (Phase 7) — остановись и жди ревью от пользователя.

**Контекст.** Аудит реального состояния порта лежит в `audit/COMPARISON.md` (если файла нет — он на машине у пользователя; работай только по этому плану). Хендофф‑документы в `handoff/*.md`, прототип в `handoff/prototype/`. Основное состояние — хорошее (≈85% сделано). Этот план закрывает оставшиеся 15% — в основном **структурные правки на `/deal/[id]` и `/link/[id]`**, sticky split-layouts на `/create`, list-row redesign на `/my-*`, и подключение `<SiweSignModal>`.

**Правила.**
- Не коммить ничего. Все изменения — оставь в working tree. Пользователь будет ревьюить и коммитить вручную.
- Не трогай ничего из `lib/api/*`, `hooks/*`, `contexts/*`, `server/*` (логика и backend).
- Не запускай `npm install` — все нужные пакеты уже стоят.
- Если в файле есть конструкция, которую план просит удалить, но она используется где-то ещё — оставь компонент, но убери его рендер с целевой страницы. Не удаляй сам файл.
- В конце каждой фазы напиши короткое summary в `audit/PROGRESS.md` (создай если нет): фаза N — список изменённых файлов и одной строки описания каждого.

---

## Phase 0 — Foundation (не‑визуальные правки, разблокируют остальное)

### Step 0.1 — Доп. статусы в `lib/ui/deal-status.ts`

**Файл:** `lib/ui/deal-status.ts`

Сейчас `DEAL_STATUS_CONFIG` содержит только 5 статусов: `ConfirmPending`, `Disputed`, `Funded`, `Refunded`, `Released`. Этого недостаточно — `DealStatus` тип может принимать также `Open`, `PaymentPending`, `Expired`, `Cancelled` (проверь в `lib/api/deals.ts` — типы должны включать эти варианты; если нет, добавь только те, что есть).

**Действие.** Расширь `DEAL_STATUS_CONFIG`:

```ts
export const DEAL_STATUS_CONFIG: Record<DealStatus, DealStatusConfig> = {
  Open: {
    bg: "var(--blue-bg)",
    color: "var(--blue)",
    icon: "status-open",
    label: "Open",
  },
  PaymentPending: {
    bg: "var(--amber-bg)",
    color: "var(--amber)",
    icon: "status-payment-pending",
    label: "Payment pending",
  },
  Funded: {
    bg: "var(--blue-bg)",
    color: "var(--blue)",
    icon: "status-funded-escrow-held",
    label: "Funded",
  },
  ConfirmPending: {
    bg: "var(--amber-bg)",
    color: "var(--amber)",
    icon: "status-confirm-pending",
    label: "Awaiting confirmation",
  },
  Released: {
    bg: "var(--green-bg)",
    color: "var(--green)",
    icon: "status-released",
    label: "Released",
  },
  Disputed: {
    bg: "var(--red-bg)",
    color: "var(--red)",
    icon: "status-disputed",
    label: "Disputed",
  },
  Refunded: {
    bg: "var(--purple-bg)",
    color: "var(--purple)",
    icon: "status-refunded",
    label: "Refunded",
  },
  Expired: {
    bg: "var(--gray-bg)",
    color: "var(--muted)",
    icon: "status-expired",
    label: "Expired",
  },
  Cancelled: {
    bg: "var(--gray-bg)",
    color: "var(--muted)",
    icon: "utility-close",
    label: "Cancelled",
  },
};
```

Включай только те ключи, которые присутствуют в `DealStatus` union. Если `DealStatus` уже исчерпывающий union — компилятор поможет.

**Action item.** Добавь в этот же файл helper:

```ts
export type StatusTone = "blue" | "amber" | "green" | "red" | "purple" | "gray";

export function toneFromStatus(status: DealStatus): StatusTone {
  switch (status) {
    case "Open":
    case "Funded":
      return "blue";
    case "PaymentPending":
    case "ConfirmPending":
      return "amber";
    case "Released":
      return "green";
    case "Disputed":
      return "red";
    case "Refunded":
      return "purple";
    case "Expired":
    case "Cancelled":
      return "gray";
    default:
      return "gray";
  }
}
```

**Acceptance:**
- `npm run typecheck` проходит
- В файле есть `toneFromStatus` экспортированная функция

---

### Step 0.2 — Кнопка `<Btn>` должна работать с CSS hover

**Файл:** `components/shared/btn.tsx`

**Проблема.** Сейчас `Btn` рендерит inline `style`, без `className`. CSS `.btn:hover`, `.btn--primary:hover` и т.д. из `globals.css` НЕ срабатывают. Нужно добавить классы — inline стили оставить как fallback на случай если CSS не загрузился.

**Действие.** В JSX `<button>`:

```tsx
<button
  className={`btn btn--${variant} btn--${size}${fullWidth ? " btn--block" : ""}`}
  disabled={isDisabled}
  onClick={onClick}
  style={{
    ...baseStyle,
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...(fullWidth ? { width: "100%" } : {}),
    ...(isDisabled ? { cursor: "not-allowed", opacity: 0.5 } : {}),
  }}
  type={type}
>
```

Если в `globals.css` нет `.btn--block` (`width: 100%`) — добавь в конец файла:

```css
.btn--block { width: 100%; }
```

Также проверь что в `globals.css` есть базовые `.btn`, `.btn--primary`, `.btn--secondary`, `.btn--ghost`, `.btn--danger`, `.btn--ink`, `.btn--quiet`, `.btn--sm`, `.btn--md`, `.btn--lg` правила. Если нет — скопируй из `handoff/prototype/styles.css` блок «----- Button -----» (строки ~250-330).

**Acceptance:**
- Кнопки получают двойной набор: inline стили + классы
- `npm run typecheck` проходит
- Открыв в браузере (если можешь) primary кнопку, hover меняет background на `--gold-deep`

---

### Step 0.3 — Скрыть desktop nav на мобиле

**Файл:** `components/app/top-nav.tsx` + `app/globals.css`

**Проблема.** На `<768px` viewport одновременно показываются центральные ссылки (Create / My links / My deals) в `<TopNav>` и `<BottomTabBar>`. Они overlap.

**Действие.** В `components/app/top-nav.tsx`, на `<nav aria-label="Primary navigation">` добавь `className="topnav-desktop-nav"`:

```tsx
<nav aria-label="Primary navigation" className="topnav-desktop-nav" style={navStyle}>
```

В `app/globals.css` найди блок `@media (max-width: 768px)` (есть уже для `.bottom-tabs`) и добавь правило:

```css
@media (max-width: 768px) {
  .topnav-desktop-nav { display: none; }
}
```

**Acceptance:**
- При уменьшении окна до <768px центральная nav в top-nav пропадает
- BottomTabBar появляется (он уже работает)
- На десктопе всё как было

---

### Step 0.4 — Финал фазы 0

Запусти:
```bash
npm run typecheck
npm run build
```

Если ошибки — фикси. Когда clean — обнови `audit/PROGRESS.md`:
```md
## Phase 0 — completed
- lib/ui/deal-status.ts — added 4 status configs + toneFromStatus helper
- components/shared/btn.tsx — added className alongside inline style
- components/app/top-nav.tsx — added topnav-desktop-nav className
- app/globals.css — added .btn--block + mobile-hide rule for topnav-desktop-nav
```

**Переходи к Phase 1 только когда build clean.**

---

## Phase 1 — Декомпозиция компонентов deal-страницы

Цель — разделить ответственности `DealStatusCard` и `DealGuidanceCard` так, чтобы их можно было разложить по двум колонкам split-layout’а в Phase 2.

### Step 1.1 — `DealStatusCard`: оставить только hero

**Файл:** `components/deal/deal-status-card.tsx`

**Текущая структура** — компонент рендерит `<div className="deal-hero">` + `<ActionPanel>` с DetailRows. Нужно:
1. Убрать ActionPanel + DetailRows целиком из этого файла.
2. Убрать role-pill из hero (`getRoleLabel` / `getRoleTone` функции — удалить).
3. Заменить filled status-icon (`statusIconStyle` функция) на outline через CSS-класс.
4. Добавить guidance-subtitle вместо role-pill.

**Импортируй helper из guidance-card:**

```tsx
import { getGuidanceMessageAt } from "@/components/deal/deal-guidance-card";
import { toneFromStatus } from "@/lib/ui/deal-status";
```

**Расширь props:**

```tsx
interface DealStatusCardProps {
  deal: DealReadModel;
  isAdmin?: boolean;
  isBuyer: boolean;
  isSeller: boolean;
  isParticipant: boolean;
}
```

**Перепиши JSX (только hero, без ActionPanel):**

```tsx
export function DealStatusCard({ deal, isAdmin = false, isBuyer, isSeller, isParticipant }: DealStatusCardProps) {
  const sc = getDealDisplayConfig({ resolution_type: deal.resolution_type, status: deal.status });
  const title = STATUS_TITLES[deal.status] ?? "Consultation escrow";
  const tone = toneFromStatus(deal.status);

  const guidanceSubtitle = getGuidanceMessageAt(
    {
      dealStatus: deal.status,
      isBuyer,
      isSeller,
      isViewer: !isParticipant,
      priceUsdc: deal.price_usdc,
      riskStatus: deal.risk_status,
      releaseDeadlineAt: deal.release_deadline_at,
      scheduledAt: deal.scheduled_at,
    },
    Date.now(),
  );

  return (
    <div className="deal-hero">
      <span className={`status-icon status-icon--lg status-icon--${tone}`}>
        <Icon name={sc.icon} size={20} />
      </span>
      <div style={heroBodyStyle}>
        <p style={eyebrowStyle}>Deal · {deal.id.slice(0, 8).toUpperCase()}</p>
        <h1 style={heroTitleStyle}>{title}</h1>
        <p style={heroSubtitleStyle}>{guidanceSubtitle}</p>
      </div>
      <div className="deal-hero__amount">
        <div className="deal-hero__amount-num">{deal.price_usdc}</div>
        <div className="deal-hero__amount-token">USDC · {sc.label}</div>
      </div>
    </div>
  );
}

const heroBodyStyle = { display: "flex", flexDirection: "column" as const, gap: 8, minWidth: 0 };

const eyebrowStyle = {
  color: "var(--muted)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
  margin: 0, textTransform: "uppercase" as const,
};

const heroTitleStyle = {
  color: "var(--ink)", fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 500,
  letterSpacing: "-0.01em", lineHeight: 1.1, margin: 0,
};

const heroSubtitleStyle = {
  color: "var(--muted)", fontSize: 14, lineHeight: 1.5, margin: 0, maxWidth: "52ch",
};
```

Удали из файла: `getRoleLabel`, `getRoleTone`, `statusIconStyle`, `formatPartyAddress`, `monoValueStyle`, `ActionPanel` импорт, `DetailRow` импорт, `truncateAddress` импорт, `formatDate` импорт.

**Acceptance:**
- `DealStatusCard` теперь чисто hero без detail rows
- `npm run typecheck` проходит
- В исходном файле нет ни `<ActionPanel>` ни `<DetailRow>`

---

### Step 1.2 — Новый компонент `DealDetailsCard` для правой колонки

**Новый файл:** `components/deal/deal-details-card.tsx`

```tsx
"use client";

import type { DealReadModel } from "@/lib/api/deals";
import { truncateAddress } from "@/lib/ui/address";
import { formatDate } from "@/lib/ui/date";
import { ActionPanel } from "@/components/shared/action-panel";
import { DetailRow } from "@/components/shared/detail-row";

interface Props {
  deal: DealReadModel;
  role: "buyer" | "seller" | "viewer";
}

export function DealDetailsCard({ deal, role }: Props) {
  return (
    <ActionPanel style={{ padding: "0 20px" }}>
      <DetailRow label="Amount" value={`${deal.price_usdc} USDC`} accent />
      <DetailRow label="Deal ID" mono value={deal.id.slice(0, 8).toUpperCase()} />
      <DetailRow
        label="Seller"
        mono
        value={formatPartyAddress(deal.seller_address, role === "seller")}
      />
      <DetailRow
        label="Buyer"
        mono
        value={formatPartyAddress(deal.buyer_address, role === "buyer")}
      />
      <DetailRow
        label="Scheduled"
        value={formatDate(deal.scheduled_at, { fallback: "—", showTimeZoneName: true })}
      />
      {deal.duration_minutes && (
        <DetailRow label="Duration" value={`${deal.duration_minutes} min`} />
      )}
      {deal.release_deadline_at && (
        <DetailRow
          label={role === "seller" ? "Auto-release after" : "Release deadline"}
          value={formatDate(deal.release_deadline_at, { fallback: "—", showTimeZoneName: true })}
        />
      )}
      {deal.completed_at && (
        <DetailRow
          label="Completed"
          value={formatDate(deal.completed_at, { fallback: "—", showTimeZoneName: true })}
        />
      )}
      {deal.resolved_at && (
        <DetailRow
          label="Resolved"
          value={formatDate(deal.resolved_at, { fallback: "—", showTimeZoneName: true })}
        />
      )}
      {deal.tx_hash && (
        <DetailRow
          bordered={false}
          label="Funding tx"
          mono
          value={`${deal.tx_hash.slice(0, 10)}…${deal.tx_hash.slice(-6)}`}
        />
      )}
    </ActionPanel>
  );
}

function formatPartyAddress(address: string, isCurrentUser: boolean): string {
  return isCurrentUser ? `${truncateAddress(address)} (you)` : truncateAddress(address);
}
```

**Acceptance:**
- Файл создан и компилируется
- Использует все нужные DetailRow с правильными props

---

### Step 1.3 — Новый компонент `ReceiptInset`

**Новый файл:** `components/deal/receipt-inset.tsx`

```tsx
"use client";

import Link from "next/link";

import { ArrabonSeal } from "@/components/shared/arrabon-seal";
import { Btn } from "@/components/shared/btn";

interface Props {
  dealId: string;
  visible: boolean;
}

export function ReceiptInset({ dealId, visible }: Props) {
  if (!visible) return null;

  return (
    <div style={insetStyle}>
      <ArrabonSeal size={36} tone="gold-line" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={titleStyle}>Settlement confirmed</p>
        <p style={subStyle}>View full receipt and settlement details.</p>
      </div>
      <Link href={`/deal/${dealId}/receipt`} style={{ textDecoration: "none" }}>
        <Btn size="sm" variant="ghost">View receipt</Btn>
      </Link>
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
  padding: "16px 18px",
} as const;

const titleStyle = { color: "var(--ink)", fontSize: 13, fontWeight: 600, margin: 0 };
const subStyle = { color: "var(--muted)", fontSize: 12, lineHeight: 1.4, margin: "2px 0 0" };
```

**Acceptance:**
- Файл создан
- Возвращает `null` если `visible=false`

---

### Step 1.4 — Финал фазы 1

```bash
npm run typecheck && npm run build
```

Допиши в `audit/PROGRESS.md`:
```md
## Phase 1 — completed
- components/deal/deal-status-card.tsx — decomposed to hero only (no DetailRows, no role pill)
- components/deal/deal-details-card.tsx — new component for right column
- components/deal/receipt-inset.tsx — new component for settlement CTA
```

---

## Phase 2 — Split-layout для `/deal/[id]`

### Step 2.1 — CSS `.deal-split` в globals.css

**Файл:** `app/globals.css`

В конец файла добавь:

```css
/* ─── Deal split layout ─────────────────────────────────────────── */

.deal-split {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: 28px;
  align-items: start;
}

.deal-split__left,
.deal-split__right {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

@media (max-width: 900px) {
  .deal-split {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
```

**Acceptance:** Класс присутствует в `app/globals.css`.

---

### Step 2.2 — Переписать `app/deal/[id]/page.tsx`

**Файл:** `app/deal/[id]/page.tsx`

Полностью замени JSX в `<AppShell>` на:

```tsx
return (
  <AppShell maxWidth={1180}>
    <Link href={backLink.href} style={backLinkStyle}>
      <Icon name="utility-arrow-left" size={14} style={{ marginRight: 4 }} />
      {backLink.label}
    </Link>

    {/* Loading / error / not_found / access_denied / auth_required states — оставить как было */}
    {dealPage.status === "loading" && (
      <div style={centerStyle}>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading deal…</p>
      </div>
    )}
    {dealPage.status === "not_found" && <Notice message="Deal not found." tone="muted" />}
    {dealPage.status === "auth_required" && (
      <Notice
        message="Connect your wallet and sign in with Ethereum to view this deal."
        title="Sign in required"
        tone="muted"
      />
    )}
    {dealPage.status === "access_denied" && (
      <Notice
        message="Access denied. This deal is only visible to its participants."
        tone="muted"
      />
    )}
    {dealPage.status === "error" && (
      <Notice message={dealPage.error ?? "Failed to load deal."} tone="danger" />
    )}

    {dealPage.status === "ready" && dealPage.deal && (
      <>
        {dealPage.isStale && (
          <Notice
            message="Deal status may be outdated right now. We're having trouble refreshing it."
            title="Refresh delayed"
            tone="warning"
          />
        )}
        {riskStatusNotice && (
          <Notice
            message={riskStatusNotice.message}
            title={riskStatusNotice.title}
            tone={dealPage.deal.risk_status === "Blocked" ? "danger" : "warning"}
          />
        )}

        <DealStatusCard
          deal={dealPage.deal}
          isAdmin={session.session?.is_admin === true}
          isBuyer={dealPage.isBuyer}
          isSeller={dealPage.isSeller}
          isParticipant={dealPage.isParticipant}
        />

        {(dealPage.deal.status === "Funded" || dealPage.deal.status === "ConfirmPending") && (
          <div className="deal-countdown">
            <span className="deal-countdown__icon">
              <Icon name="utility-time" size={14} />
            </span>
            {dealPage.deal.status === "Funded" && (
              <>
                <span className="deal-countdown__label">Consultation starts</span>
                <span className="deal-countdown__value">
                  <Countdown to={dealPage.deal.scheduled_at} prefix="in" expiredLabel="now — join the meeting" />
                </span>
              </>
            )}
            {dealPage.deal.status === "ConfirmPending" && (
              <>
                <span className="deal-countdown__label">
                  {dealPage.isBuyer ? "Confirm or dispute" : "Auto-release"}
                </span>
                <span className="deal-countdown__value">
                  <Countdown to={dealPage.deal.release_deadline_at ?? ""} prefix="in" expiredLabel="deadline passed" />
                </span>
              </>
            )}
            <span className="live-dot" style={{ marginLeft: "auto" }} />
            <span style={{ color: "var(--muted)", fontSize: 12 }}>Live</span>
          </div>
        )}

        <div className="deal-split">
          <div className="deal-split__left">
            <KeyTimes deal={dealPage.deal} isSeller={dealPage.isSeller} />
            <MeetingUrlCard
              dealId={dealId}
              dealStatus={dealPage.deal.status}
              isParticipant={dealPage.isParticipant}
              session={session}
            />
            {shouldShowDisputeThread(
              dealPage.deal.status,
              dealPage.deal.resolved_from_status,
            ) && (
              <DisputeThread
                canPost={
                  dealPage.deal.status === "Disputed" &&
                  session.siweStatus === "authenticated" &&
                  (dealPage.isParticipant || session.session?.is_admin === true)
                }
                canView={
                  session.siweStatus === "authenticated" &&
                  (dealPage.isParticipant || session.session?.is_admin === true)
                }
                currentWallet={session.address}
                dealId={dealId}
                dealStatus={dealPage.deal.status}
              />
            )}
          </div>

          <aside className="deal-split__right">
            <DealDetailsCard deal={dealPage.deal} role={dealPage.role} />
            <DealActionsCard
              autoRelease={actions.autoRelease}
              autoReleaseAvailable={isSellerAutoReleaseAvailable({
                durationMinutes: dealPage.deal.duration_minutes,
                isSeller: dealPage.isSeller,
                scheduledAt: dealPage.deal.scheduled_at,
                status: dealPage.deal.status,
              })}
              buyerDisputable={isBuyerDisputable({
                durationMinutes: dealPage.deal.duration_minutes,
                scheduledAt: dealPage.deal.scheduled_at,
                status: dealPage.deal.status,
              })}
              buyerReleasable={isBuyerReleasable({
                durationMinutes: dealPage.deal.duration_minutes,
                scheduledAt: dealPage.deal.scheduled_at,
                status: dealPage.deal.status,
              })}
              complete={actions.complete}
              dealStatus={dealPage.deal.status}
              dispute={actions.dispute}
              isAnyActionInFlight={actions.isAnyActionInFlight}
              isBuyer={dealPage.isBuyer}
              isSeller={dealPage.isSeller}
              onRefreshStatus={dealPage.refetch}
              release={actions.release}
              scheduledAt={dealPage.deal.scheduled_at}
              session={session}
            />
            <ReceiptInset
              dealId={dealId}
              visible={
                dealPage.deal.status === "Released" || dealPage.deal.status === "Refunded"
              }
            />
          </aside>
        </div>
      </>
    )}
  </AppShell>
);
```

**Не забудь импорты добавить наверху файла:**
```tsx
import { Icon } from "@/components/icons";
import { DealDetailsCard } from "@/components/deal/deal-details-card";
import { ReceiptInset } from "@/components/deal/receipt-inset";
```

**Удали из файла:** импорт `DealGuidanceCard` и его рендер (он больше не используется, guidance переехал в hero subtitle).

**Обнови `backLinkStyle`:**
```tsx
const backLinkStyle = {
  alignItems: "center",
  alignSelf: "flex-start",
  color: "var(--muted)",
  display: "inline-flex",
  fontSize: 13,
  fontWeight: 500,
  textDecoration: "none",
  gap: 4,
} as const;
```

**Acceptance:**
- `app/deal/[id]/page.tsx` использует `<div className="deal-split">` с двумя колонками
- `DealStatusCard` принимает `isBuyer/isSeller/isParticipant` props
- `<DealGuidanceCard>` не импортируется и не рендерится
- `<DealDetailsCard>` и `<ReceiptInset>` импортируются
- На странице на десктопе видна правая колонка с Details + Actions + Receipt
- `npm run typecheck` проходит
- `npm run build` проходит

---

### Step 2.3 — Финал фазы 2

```bash
npm run typecheck && npm run build
```

Допиши в `audit/PROGRESS.md`:
```md
## Phase 2 — completed
- app/globals.css — added .deal-split CSS
- app/deal/[id]/page.tsx — split layout 1.6fr/1fr, removed DealGuidanceCard render, added ReceiptInset
```

---

## Phase 3 — Реструктуризация `/link/[id]`

### Step 3.1 — Переписать `<LinkSummary>`

**Файл:** `components/link/link-summary.tsx`

Сейчас это kitchen-sink card с 5 секциями (header, description, details, payment deadline strip, escrow strip). Переписываем в чистую info-card в стиле deal-hero.

Полностью замени содержимое файла на:

```tsx
"use client";

import type { PublicLink } from "@/lib/api/links";
import { truncateAddress } from "@/lib/ui/address";
import { formatDate } from "@/lib/ui/date";
import { Icon } from "@/components/icons";
import { DetailRow } from "@/components/shared/detail-row";
import { StatusPill } from "@/components/shared/status-pill";

interface LinkSummaryProps {
  link: PublicLink;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getStatusPill(status: string): {
  label: string;
  tone: "accent" | "gold" | "muted" | "green";
} {
  if (status === "Open") return { label: "Open", tone: "green" };
  if (status === "Consumed") return { label: "Funded", tone: "gold" };
  return { label: status, tone: "muted" };
}

export function LinkSummary({ link }: LinkSummaryProps) {
  const status = getStatusPill(link.status);

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <StatusPill label={status.label} tone={status.tone} />
          <h1 style={titleStyle}>{link.title}</h1>
          <p style={sellerStyle}>Seller {truncateAddress(link.seller_address)}</p>
        </div>
        <div className="deal-hero__amount">
          <div className="deal-hero__amount-num">{link.price_usdc}</div>
          <div className="deal-hero__amount-token">USDC</div>
        </div>
      </div>

      {link.description && (
        <p style={descriptionStyle}>{link.description}</p>
      )}

      <div style={detailsStyle}>
        <DetailRow
          label="Scheduled"
          value={formatDate(link.scheduled_at, {
            showTimeZoneName: true,
            timeZone: link.timezone,
          })}
        />
        <DetailRow
          label="Duration"
          value={`${formatDuration(link.duration_minutes)} · ${link.timezone}`}
        />
        <DetailRow
          label="Expires"
          value={formatDate(link.expires_at, {
            showTimeZoneName: true,
            timeZone: link.timezone,
          })}
        />
        <DetailRow
          label="Seller"
          mono
          value={truncateAddress(link.seller_address)}
        />
        <DetailRow
          bordered={false}
          label="Link ID"
          mono
          value={link.id.slice(0, 8).toUpperCase()}
        />
      </div>

      <div style={trustStyle}>
        <Icon name="utility-secure-subtle" size={14} />
        Funds are held in escrow on Base until the consultation is confirmed or disputed.
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
  gap: 24,
  overflow: "hidden",
  padding: "28px 32px",
} as const;

const headerStyle = {
  alignItems: "flex-start",
  display: "flex",
  gap: 20,
  justifyContent: "space-between",
} as const;

const titleStyle = {
  color: "var(--ink)",
  fontFamily: "var(--font-serif)",
  fontSize: 28,
  fontWeight: 500,
  letterSpacing: "-0.005em",
  lineHeight: 1.15,
  margin: "10px 0 6px",
  overflowWrap: "anywhere" as const,
  textWrap: "balance" as const,
} as const;

const sellerStyle = {
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 12.5,
  letterSpacing: "-0.005em",
  margin: 0,
} as const;

const descriptionStyle = {
  color: "var(--ink-soft)",
  fontSize: 14.5,
  lineHeight: 1.55,
  margin: 0,
} as const;

const detailsStyle = {
  display: "flex",
  flexDirection: "column" as const,
} as const;

const trustStyle = {
  alignItems: "center",
  background: "var(--gold-soft)",
  border: "1px solid color-mix(in srgb, var(--gold) 18%, transparent)",
  borderRadius: "var(--r-2)",
  color: "var(--gold-deep)",
  display: "flex",
  fontSize: 13,
  gap: 10,
  lineHeight: 1.5,
  padding: "12px 16px",
} as const;
```

**Acceptance:**
- Файл компилируется
- Нет старых `paymentDeadlineStyle`, `escrowLineStyle`, `pricePillStyle`
- Использует `--ink`, `--ink-soft`, `--gold-soft`, `--gold-deep`, `--r-2`, `--r-4`
- `.deal-hero__amount*` классы используются (они уже в globals.css)

---

### Step 3.2 — CSS `.link-page` и `.link-split`

**Файл:** `app/globals.css`

В конец добавь:

```css
/* ─── Link page layout ─────────────────────────────────────────── */

.link-page {
  background: var(--bg);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.link-page__inner {
  margin: 0 auto;
  max-width: 1040px;
  padding: 32px 32px 96px;
  width: 100%;
  box-sizing: border-box;
}

.link-page__topbar {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 40px;
}

.link-split {
  align-items: start;
  display: grid;
  gap: 28px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 380px);
}

.link-split__right {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 32px;
}

@media (max-width: 900px) {
  .link-split { grid-template-columns: 1fr; }
  .link-split__right { position: static; }
  .link-page__inner { padding: 20px 16px 96px; }
}
```

**Acceptance:** все 5 классов в globals.css.

---

### Step 3.3 — Переписать `app/link/[id]/page.tsx`

**Файл:** `app/link/[id]/page.tsx`

Замени основной return на:

```tsx
return (
  <main className="link-page">
    <div className="link-page__inner">
      <div className="link-page__topbar">
        <Link href="/" style={brandStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Arrabon" height={28} src="/alpha-lock-full-gold.svg" width={28} />
          <span style={brandWordStyle}>Arrabon</span>
        </Link>
        <button onClick={handleBack} style={backButtonStyle} type="button">
          <Icon name="utility-arrow-left" size={14} />
          Back
        </button>
      </div>

      {linkPage.status === "loading" && (
        <div style={centerStyle}>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
        </div>
      )}

      {linkPage.status === "not_found" && <StatusNotice type="not_found" />}
      {linkPage.status === "error" && (
        <StatusNotice type="error" message={linkPage.error ?? undefined} />
      )}
      {linkPage.status === "unavailable" && (
        <StatusNotice
          type={linkPage.unavailableReason === "Expired" ? "expired" : "cancelled"}
        />
      )}

      {linkPage.status === "ready" &&
        linkPage.link?.status === "Consumed" &&
        !linkPage.link.deal_id &&
        funding.state.txHash !== null && (
          <>
            <StatusNotice type="consumed_indexing" />
            <div style={indexingRetryCardStyle}>
              <Notice
                message="We are checking automatically. You can retry the check manually if it takes too long."
                tone="info"
              />
              <button
                onClick={handleRetryPolling}
                style={indexingRetryButtonStyle}
                type="button"
              >
                Retry check
              </button>
            </div>
          </>
        )}

      {linkPage.status === "ready" &&
        shouldShowConsumedLinkPrivateNotice({
          dealId: linkPage.link?.deal_id ?? null,
          status: linkPage.link?.status,
          txHash: funding.state.txHash,
        }) && <StatusNotice type="consumed_private" />}

      {linkPage.status === "ready" && linkPage.link && linkPage.link.status === "Open" && (
        <div className="link-split">
          <LinkSummary link={linkPage.link} />
          <aside className="link-split__right">
            <LinkActionCard
              dealIdPollingTimedOut={linkPage.dealIdPollingTimedOut}
              link={linkPage.link}
              onRetryPolling={handleRetryPolling}
              role={linkPage.role}
              session={session}
              funding={funding}
            />
          </aside>
        </div>
      )}
    </div>
  </main>
);
```

Добавь импорты:
```tsx
import { Icon } from "@/components/icons";
```

Замени `mainStyle` / `pageStyle` / `brandStyle` / `backLinkStyle` / `backButtonStyle` на:

```tsx
const brandStyle = {
  alignItems: "center",
  color: "var(--ink)",
  display: "inline-flex",
  gap: 10,
  textDecoration: "none",
} as const;

const brandWordStyle = {
  fontFamily: "var(--font-serif)",
  fontSize: 22,
  fontWeight: 500,
  letterSpacing: "0.005em",
} as const;

const backButtonStyle = {
  alignItems: "center",
  background: "transparent",
  border: "none",
  color: "var(--muted)",
  cursor: "pointer",
  display: "inline-flex",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 500,
  gap: 6,
  padding: "8px 6px",
} as const;

const centerStyle = {
  alignItems: "center",
  display: "flex",
  justifyContent: "center",
  minHeight: 200,
} as const;
```

Удали `mainStyle` и `pageStyle` (они заменены классами).

**Acceptance:**
- `app/link/[id]/page.tsx` использует `<main className="link-page">` и `<div className="link-split">`
- Brand link отображает реальный `/alpha-lock-full-gold.svg`
- Back-button с `utility-arrow-left` icon
- `npm run typecheck` проходит
- `npm run build` проходит

---

### Step 3.4 — Подключить `<SiweSignModal>` в funding flow

**Файл:** `components/link/link-action-card.tsx`

В начале файла добавь импорт:

```tsx
import { useState } from "react";
import { SiweSignModal } from "@/components/shared/siwe-sign-modal";
```

Внутри `LinkActionCard` добавь state и handler:

```tsx
const [showSiwe, setShowSiwe] = useState(false);

async function handleSignInClick() {
  setShowSiwe(true);
}

async function handleSiweApprove() {
  setShowSiwe(false);
  try {
    await signIn();
  } catch {
    // signInError state уже выставится из hook
  }
}
```

В блоке `{isConnected && isCorrectChain && siweStatus === "unauthenticated" && (` замени кнопку Sign in:

```tsx
<Btn fullWidth onClick={handleSignInClick} variant="secondary" loading={session.isSigningIn}>
  Sign in with Ethereum
</Btn>
```

И в конце return перед закрывающим `</ActionPanel>` добавь:

```tsx
<SiweSignModal
  open={showSiwe}
  onApprove={handleSiweApprove}
  onReject={() => setShowSiwe(false)}
/>
```

**Acceptance:**
- Когда пользователь нажимает «Sign in with Ethereum» — открывается `<SiweSignModal>`
- При клике «Sign message» — вызывается `signIn()` и модалка закрывается
- При клике «Reject» / Escape / outside — модалка закрывается без вызова `signIn`

---

### Step 3.5 — Финал фазы 3

```bash
npm run typecheck && npm run build
```

Допиши в `audit/PROGRESS.md`:
```md
## Phase 3 — completed
- components/link/link-summary.tsx — restructured into clean info card (no kitchen-sink strips)
- app/globals.css — added .link-page, .link-page__inner, .link-page__topbar, .link-split, .link-split__right
- app/link/[id]/page.tsx — split layout 1fr/380px, real Alpha Lock SVG brand, sticky right column
- components/link/link-action-card.tsx — SiweSignModal wired into Sign in button
```

---

## Phase 4 — Реструктуризация `/create` со sticky preview

### Step 4.1 — Новый компонент `LinkPreviewCard`

**Новый файл:** `components/link/link-preview-card.tsx`

```tsx
"use client";

import { ArrabonSeal } from "@/components/shared/arrabon-seal";
import { DetailRow } from "@/components/shared/detail-row";

export interface LinkPreviewValues {
  title: string;
  description: string;
  price_usdc: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: string;
  expires_date: string;
  expires_time: string;
  seller_address: string;
}

interface Props {
  values: LinkPreviewValues;
}

export function LinkPreviewCard({ values }: Props) {
  const scheduled =
    values.scheduled_date && values.scheduled_time
      ? `${values.scheduled_date} · ${values.scheduled_time}`
      : "Not set";
  const expires =
    values.expires_date && values.expires_time
      ? `${values.expires_date} · ${values.expires_time}`
      : "Not set";

  return (
    <div style={stack}>
      <div style={cardStyle}>
        <p style={eyebrow}>Preview</p>
        <h3 style={titleStyle}>{values.title || "Consultation title"}</h3>
        {values.description && <p style={descStyle}>{values.description}</p>}
        <div style={divider} />
        <DetailRow label="Price" value={values.price_usdc ? `${values.price_usdc} USDC` : "—"} accent />
        <DetailRow label="Scheduled" value={scheduled} />
        <DetailRow label="Duration" value={values.duration_minutes ? `${values.duration_minutes} min` : "—"} />
        <DetailRow label="Seller" mono value={values.seller_address ? truncate(values.seller_address) : "—"} />
        <DetailRow bordered={false} label="Expires" value={expires} />
      </div>

      <div style={insetStyle}>
        <ArrabonSeal size={36} tone="auto" />
        <div>
          <p style={insetTitleStyle}>Secured by Arrabon</p>
          <p style={insetSubStyle}>Onchain escrow · Trusted settlement</p>
        </div>
      </div>
    </div>
  );
}

function truncate(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

const stack = { display: "flex", flexDirection: "column" as const, gap: 16 };

const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-3)",
  display: "flex",
  flexDirection: "column" as const,
  padding: 24,
};

const eyebrow = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.16em",
  margin: "0 0 14px",
  textTransform: "uppercase" as const,
};

const titleStyle = {
  color: "var(--ink)",
  fontFamily: "var(--font-serif)",
  fontSize: 22,
  fontWeight: 500,
  letterSpacing: "-0.005em",
  lineHeight: 1.2,
  margin: 0,
  textWrap: "balance" as const,
} as const;

const descStyle = {
  color: "var(--muted)",
  fontSize: 13.5,
  lineHeight: 1.55,
  margin: "8px 0 0",
};

const divider = {
  background: "var(--rule)",
  height: 1,
  margin: "16px 0 0",
};

const insetStyle = {
  alignItems: "center",
  background: "var(--surface-2)",
  border: "1px solid var(--border-soft)",
  borderRadius: "var(--r-3)",
  display: "flex",
  gap: 12,
  padding: "14px 16px",
};

const insetTitleStyle = {
  color: "var(--ink)",
  fontSize: 13,
  fontWeight: 600,
  margin: 0,
};

const insetSubStyle = {
  color: "var(--muted)",
  fontSize: 12,
  margin: "2px 0 0",
};
```

**Acceptance:** файл создан и компилируется.

---

### Step 4.2 — Добавить `.create-split` в globals.css

**Файл:** `app/globals.css`. В конец:

```css
/* ─── Create page layout ───────────────────────────────────────── */

.create-split {
  align-items: start;
  display: grid;
  gap: 32px;
  grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr);
}

.create-split__preview {
  position: sticky;
  top: 88px;
}

@media (max-width: 900px) {
  .create-split { grid-template-columns: 1fr; gap: 20px; }
  .create-split__preview { position: static; }
}
```

---

### Step 4.3 — Рефактор `CreateLinkForm` чтобы экспортировать values для preview

**Файл:** `components/link/create-link-form.tsx`

Это большой файл (666 строк). Не переписывай его полностью — добавь только **опциональный callback** для синхронизации preview:

В props интерфейс:
```tsx
interface Props {
  session: WalletSessionState;
  onValuesChange?: (values: FormState) => void;  // ← добавить
}
```

В компоненте, после `useState<FormState>`:
```tsx
const [form, setForm] = useState<FormState>(emptyForm);

useEffect(() => {
  props.onValuesChange?.(form);
}, [form, props.onValuesChange]);
```

(Добавь `useEffect` импорт если нет.)

**Acceptance:**
- Опциональный prop `onValuesChange` принимается
- При каждом изменении формы вызывается callback с актуальным form state
- Существующие вызовы `<CreateLinkForm session={session} />` без callback не ломаются

---

### Step 4.4 — Переписать `app/create/page.tsx`

**Файл:** `app/create/page.tsx`

Полностью замени на:

```tsx
"use client";

import { useState } from "react";

import { useWalletSessionContext } from "@/contexts/wallet-session-context";
import { AppShell } from "@/components/app/app-shell";
import { CreateLinkForm } from "@/components/link/create-link-form";
import { LinkPreviewCard, type LinkPreviewValues } from "@/components/link/link-preview-card";

const emptyPreview: LinkPreviewValues = {
  description: "",
  duration_minutes: "",
  expires_date: "",
  expires_time: "",
  price_usdc: "",
  scheduled_date: "",
  scheduled_time: "",
  seller_address: "",
  title: "",
};

export default function CreatePage() {
  const session = useWalletSessionContext();
  const [preview, setPreview] = useState<LinkPreviewValues>(emptyPreview);

  return (
    <AppShell maxWidth={1100}>
      <div className="create-split">
        <div>
          <CreateLinkForm
            session={session}
            onValuesChange={(values) =>
              setPreview({
                description: values.description,
                duration_minutes: values.duration_minutes,
                expires_date: values.expires_date,
                expires_time: values.expires_time,
                price_usdc: values.price_usdc,
                scheduled_date: values.scheduled_date,
                scheduled_time: values.scheduled_time,
                seller_address: session.address ?? "",
                title: values.title,
              })
            }
          />
        </div>
        <aside className="create-split__preview">
          <LinkPreviewCard values={preview} />
        </aside>
      </div>
    </AppShell>
  );
}
```

**Acceptance:**
- На `/create` появляется правый sticky preview
- При вводе текста в форму preview обновляется в реальном времени
- На <900px preview уходит вниз под форму
- `npm run build` проходит

---

### Step 4.5 — Финал фазы 4

```bash
npm run typecheck && npm run build
```

Допиши в `audit/PROGRESS.md`.

---

## Phase 5 — List rows на `/my-deals` и `/my-links`

### Step 5.1 — Добавить `.list-row*` CSS в globals.css

**Файл:** `app/globals.css`

Проверь — возможно уже есть. Если нет, в конец:

```css
/* ─── List rows (my-deals / my-links) ──────────────────────────── */

.list-row {
  align-items: center;
  border-top: 1px solid var(--border-soft);
  cursor: pointer;
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr) 130px 110px 150px 28px;
  padding: 18px 24px;
  text-decoration: none;
  transition: background 0.12s;
}

.list-row:first-child { border-top: 0; }
.list-row:hover { background: var(--surface-2); }

.list-row__title { display: flex; flex-direction: column; gap: 3px; min-width: 0; }

.list-row__title-name {
  color: var(--ink);
  font-size: 14.5px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-row__title-sub {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: -0.005em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-row__price {
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 500;
  text-align: right;
  white-space: nowrap;
}

.list-row__price-token {
  color: var(--muted);
  font-size: 11px;
  margin-left: 4px;
}

.list-row__trailing {
  color: var(--muted);
  font-size: 13px;
  text-align: right;
  white-space: nowrap;
}

.list-row__chevron {
  color: var(--muted);
  display: inline-grid;
  place-items: center;
}

@media (max-width: 768px) {
  .list-row {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "title price"
      "title pill"
      "trailing chevron";
    row-gap: 6px;
    column-gap: 16px;
  }
  .list-row__title { grid-area: title; }
  .list-row__price { grid-area: price; }
  .list-row__trailing { grid-area: trailing; text-align: left; }
  .list-row__chevron { grid-area: chevron; }
}
```

---

### Step 5.2 — Helper для trailing-label по статусу

**Новый файл:** `lib/ui/deal-trailing-label.ts`

```ts
import type { DealStatus } from "@/lib/api/deals";

export function dealTrailingLabel(status: DealStatus): string {
  switch (status) {
    case "Open":           return "Awaiting buyer";
    case "PaymentPending": return "Payment pending";
    case "Funded":         return "Awaiting consultation";
    case "ConfirmPending": return "Awaiting buyer confirm";
    case "Released":       return "Settled";
    case "Disputed":       return "In review";
    case "Refunded":       return "Refunded";
    case "Expired":        return "Expired";
    case "Cancelled":      return "Cancelled";
    default:               return "";
  }
}
```

---

### Step 5.3 — Переписать `DealRow` в `/my-deals`

**Файл:** `app/my-deals/page.tsx`

Найди функцию `DealRow` и замени её на:

```tsx
function DealRow({ deal }: { deal: MyDeal; isLast?: boolean }) {
  const badge = getDealDisplayConfig({
    resolution_type: deal.resolution_type,
    status: deal.status,
  });

  return (
    <Link href={`/deal/${deal.id}`} className="list-row">
      <div className="list-row__title">
        <span className="list-row__title-name">{deal.title}</span>
        <span className="list-row__title-sub">
          {deal.id.slice(0, 8).toUpperCase()} · {formatDate(deal.scheduled_at, { timeZone: deal.timezone })} · Seller {truncateAddress(deal.seller_address)}
        </span>
      </div>
      <span className="list-row__price">
        {deal.price_usdc}
        <span className="list-row__price-token">USDC</span>
      </span>
      <StatusPill bg={badge.bg} color={badge.color} label={badge.label} />
      <span className="list-row__trailing">{dealTrailingLabel(deal.status)}</span>
      <span className="list-row__chevron">
        <Icon name="utility-chevron-right" size={14} />
      </span>
    </Link>
  );
}
```

Добавь импорт `dealTrailingLabel` из `@/lib/ui/deal-trailing-label`.

Также **подними maxWidth** в обоих `<AppShell maxWidth={...}>` (auth screen и main return) **с 960 на 1180**.

Удали неиспользуемые стили: `rowStyle`, `rowInfoStyle`, `rowTitleStyle`, `rowMetaStyle`, `monoMetaStyle`, `priceStyle`, `actionsStyle`, `iconBtnStyle`.

**Acceptance:**
- Каждая строка списка — единый `<Link className="list-row">` без вложенных state-управляемых hover’ов
- 5-колоночный grid: title+sub / price / pill / trailing / chevron
- На мобиле перестраивается через media-query
- На странице maxWidth=1180

---

### Step 5.4 — Переписать `LinkRow` в `/my-links`

**Файл:** `app/my-links/page.tsx`

Та же логика. Найди `LinkRow` и замени на:

```tsx
function LinkRow({ link }: { link: MyLink; isLast?: boolean }) {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const badge = getMyLinkBadge(link);
  const trailing = link.deal_status
    ? dealTrailingLabel(link.deal_status)
    : link.status === "Open"
      ? "Awaiting buyer"
      : link.status === "Expired"
        ? "Expired"
        : link.status === "Cancelled"
          ? "Cancelled"
          : link.status === "Consumed"
            ? "Funded"
            : "";

  const href = link.deal_id
    ? `/deal/${link.deal_id}`
    : origin && link.share_url
      ? link.share_url
      : "#";

  return (
    <Link href={href} className="list-row">
      <div className="list-row__title">
        <span className="list-row__title-name">{link.title}</span>
        <span className="list-row__title-sub">
          {link.id.slice(0, 8).toUpperCase()} · {formatDate(link.scheduled_at, { timeZone: link.timezone })}
        </span>
      </div>
      <span className="list-row__price">
        {link.price_usdc}
        <span className="list-row__price-token">USDC</span>
      </span>
      <StatusPill bg={badge.bg} color={badge.color} label={badge.label} />
      <span className="list-row__trailing">{trailing}</span>
      <span className="list-row__chevron">
        <Icon name="utility-chevron-right" size={14} />
      </span>
    </Link>
  );
}
```

Импортируй `dealTrailingLabel` и `useEffect`/`useState` если ещё нет.

Также удали `CopyIconButton` отдельной кнопкой — она дублирует функционал. Если нужна функциональность копирования ссылки — пользователь может это сделать через wallet-pill «Copy address» или зайдя на саму страницу линка.

**Подними maxWidth с 960 на 1180** в обоих `<AppShell>`.

Удали неиспользуемые стили из файла.

**Acceptance:**
- Список линков — единые `<Link className="list-row">` строки
- Trailing label соответствует статусу (Awaiting buyer / Funded / In review / Settled / etc)
- На странице maxWidth=1180

---

### Step 5.5 — Финал фазы 5

```bash
npm run typecheck && npm run build
```

---

## Phase 6 — Admin pages polish

### Step 6.1 — `app/admin/disputes/page.tsx`

1. **maxWidth**: подними с 860 на 1180 во всех `<AppShell maxWidth={…}>`.
2. **Удали `<WalletSessionCard session={session} />`** — топ-пилюля уже показывает кошелёк.
3. (опционально) замени ad-hoc `<Info>` chips на `<div className="admin-info"><span className="admin-info__label">…</span><span className="admin-info__value">…</span></div>`. Сам компонент `Info` тогда удаляется. Если делаешь — убедись что `.admin-info*` правила есть в globals.css; если нет, добавь:

```css
.admin-info {
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-2);
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
}
.admin-info__label {
  color: var(--muted);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.admin-info__value {
  color: var(--ink);
  font-size: 13px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.admin-info__value--mono {
  font-family: var(--font-mono);
  font-size: 12.5px;
  letter-spacing: -0.005em;
}
```

### Step 6.2 — `app/admin/disputes/[id]/page.tsx` и `app/admin/denylist/page.tsx`

Просто подними `maxWidth` до 1180 во всех `<AppShell>` и удали `<WalletSessionCard>` если рендерится.

### Step 6.3 — Финал

```bash
npm run typecheck && npm run build
```

---

## Phase 7 — Финальная полировка

### Step 7.1 — Receipt page seal sizes

**Файл:** `app/deal/[id]/receipt/page.tsx`

Текущие размеры seal: 64px сверху, 18px снизу. По прототипу: 96px сверху (auto), 36px снизу (gold-line). Подправь:

```tsx
<div className="receipt__seal">
  <ArrabonSeal size={96} tone="auto" />
</div>
...
<div className="receipt__foot">
  <ArrabonSeal size={36} tone="gold-line" />
  ...
</div>
```

### Step 7.2 — Notice icon slot (optional, P3)

**Файл:** `components/shared/notice.tsx`

Добавь опциональный prop `icon?: IconName` и рендери иконку слева от title/message:

```tsx
<div style={{ display: "flex", gap: 12, ... }}>
  {icon && <span style={iconWrapStyle}><Icon name={icon} size={16} /></span>}
  <div style={{ flex: 1, minWidth: 0 }}>
    {title && <p style={titleStyle}>{title}</p>}
    <div style={messageStyle}>{message}</div>
  </div>
</div>
```

Где `iconWrapStyle` — `{ flex: "0 0 18px", marginTop: 1, color: "inherit" }`. По тону иконка наследует цвет.

(Если делать сложно — пропусти, это P3.)

### Step 7.3 — Финал

```bash
npm run typecheck && npm run build
```

---

## После всех фаз — отчёт

Создай (или обнови) `audit/PROGRESS.md` с финальным summary всех изменённых файлов по фазам. Не коммить — оставь всё в working tree. Пользователь сам проверит diff и закоммитит.

Если в процессе встретил неоднозначность или баг в плане — задокументируй в `audit/PROGRESS.md` отдельным разделом «Notes / deviations» что и почему изменил, чтобы пользователь видел.

**Не запрашивай confirmation между шагами — иди до конца. Останавливайся только если `npm run build` падает с ошибкой, которую сам не можешь починить.**

---

## Sanity checks по ходу

Внутри каждой фазы убедись:

- [ ] Все импорты на месте (typecheck это поймает)
- [ ] Удалённые компоненты не оставлены в импорт-списке
- [ ] Новые компоненты экспортированы из своих файлов
- [ ] CSS классы в JSX строго соответствуют именам в globals.css
- [ ] Никаких `console.log` / `// TODO` без причины
- [ ] Файлы стилей в `style={...}` написаны single-quoted property keys где нужно (typecheck это поймает)
- [ ] Существующие тесты в `tests/unit/*` не сломаны — если на них упадёт что-то связанное с компонентами, фикси сразу

## Если что-то не получается

Если шаг падает по logic-error в backend или hook (например, `useDealPage` не отдаёт нужное поле), пометь шаг как `BLOCKED` в `audit/PROGRESS.md`, опиши почему, **переходи к следующему шагу**, и в конце вернёшься к заблокированным когда пользователь даст обратную связь.

Если шаг падает по visual-error (выглядит криво в браузере) — это нормально, пользователь увидит в ревью. Не пытайся it pixel-perfect на каждом — двигайся вперёд.

---

Точка входа: **Phase 0, Step 0.1**. Начинай.
