# Frontend MVP Architecture — Base Consult Link

> Version: 2.0 | Status: Implemented | Date: 2026-04-28
> Replaces: v1.0 (pre-implementation architecture draft)
> Составил: Base Consult Link Team | Проверил: — | Утвердил: —

---

## 1. Purpose

Этот документ фиксирует реализованную архитектуру MVP фронтенда Base Consult Link.

Документ описывает:

- реализованную route-структуру;
- архитектуру страниц и компонентов;
- frontend layering;
- модель состояния и данных;
- compliance UI integration;
- обработку ролей пользователя;
- архитектуру action flows;
- error / loading UX;
- реальную структуру папок.

Документ не является ТЗ и не задаёт новые требования. Он отражает принятые решения в реализованном коде.

---

## 2. Frozen Principles

- Frontend остаётся thin client.
- Backend является source of truth для prepare/state gating и metadata/reveal.
- Contract является source of truth для onchain execution и lifecycle transitions.
- Frontend не строит escrow calldata самостоятельно.
- Frontend использует backend prepare endpoints как единственный разрешённый способ подготовки contract calls.
- Frontend не делает optimistic business-state mutations.
- MVP остаётся mobile-first.
- Адреса кошельков сравниваются только через `getAddress(...)` из viem; raw string equality запрещён.

---

## 3. Реализованная Route Structure

### 3.1 Публичные routes

| Route | Файл | Назначение |
|---|---|---|
| `/` | `app/page.tsx` | Главная страница + форма создания ссылки |
| `/link/[id]` | `app/link/[id]/page.tsx` | Публичная страница ссылки — просмотр слота и funding |
| `/deal/[id]` | `app/deal/[id]/page.tsx` | Страница сделки — lifecycle actions, meeting URL reveal |

### 3.2 Приватные routes (SIWE session required)

| Route | Файл | Назначение |
|---|---|---|
| `/create` | `app/create/page.tsx` | Отдельная страница создания consultation link |
| `/my-links` | `app/my-links/page.tsx` | Список ссылок эксперта |
| `/my-deals` | `app/my-deals/page.tsx` | Список сделок покупателя |

### 3.3 Admin routes (SIWE session + `is_admin = true`)

| Route | Файл | Назначение |
|---|---|---|
| `/admin/disputes` | `app/admin/disputes/page.tsx` | Список disputed сделок с compliance badges |
| `/admin/disputes/[id]` | `app/admin/disputes/[id]/page.tsx` | Детальный просмотр спора + compliance history + resolve |
| `/admin/denylist` | `app/admin/denylist/page.tsx` | Управление compliance denylist |

---

## 4. Архитектура страниц

### 4.1 `/` — Home / Create Link

Entry point для эксперта. Включает:

- wallet connect + SIWE session bootstrap;
- форму создания consultation link (`CreateLinkForm`);
- compliance-blocked notice при `403 COMPLIANCE_BLOCKED` на `POST /api/links`.

Compliance note: `POST /api/links` является SIWE-приватным endpoint'ом и выполняет seller screening.

### 4.2 `/link/[id]` — Link Page

Основная точка входа в buyer flow. Single-column mobile-first layout.

Секции:

- **`LinkSummary`** — title, description, price, scheduled_at, timezone, duration, expires_at, seller address, link status;
- **`WalletSessionCard`** — wallet connection status, chain validation, SIWE session state;
- **`LinkActionCard`** — единая CTA-зона: connect → sign → approve → fund. При `step = "compliance_blocked"` показывает `ComplianceBlockedNotice` вместо `FundingProgress`;
- **`StatusNotice`** — отдельно обрабатывает: expired, cancelled, consumed, unavailable, not found.

### 4.3 `/deal/[id]` — Deal Page

Post-funding lifecycle. Single-column mobile-first layout.

Секции:

- **`DealStatusCard`** — текущий статус, buyer/seller addresses, scheduled time, completed time, release deadline;
- **`MeetingUrlCard`** — reveal UX через `GET /api/deals/:id/meeting-url`; недоступен без SIWE, для не-участников, в `Refunded`;
- **`DealActionsCard`** — lifecycle actions (complete/release/dispute); при `step = "compliance_blocked"` показывает `ComplianceBlockedNotice` вместо кнопок;
- **`DisputeThread`** — dispute messages для buyer/seller/admin;
- **`KeyTimes`** — scheduled time, completion eligibility, completed_at, dispute/release deadline.

### 4.4 `/my-links` — Expert Dashboard

Список consultation links эксперта. Включает:

- `WalletSessionCard` для auth-gating;
- список карточек ссылок с `ListPagination`;
- навигацию к `/create` для создания новой ссылки.

### 4.5 `/my-deals` — Buyer Deal History

Список сделок покупателя. Recovery path после закрытия страницы сделки.

### 4.6 `/admin/disputes` — Admin Dispute List

Требует `is_admin = true`. Включает:

- вкладку Open / Resolved через `view=` query parameter;
- `RiskBadge` на каждой карточке (`Clear/Review/Blocked`);
- checkbox "Show only flagged deals" для фильтрации по `risk_status !== "Clear"`;
- ссылку "Open compliance denylist →".

### 4.7 `/admin/disputes/[id]` — Admin Dispute Detail

Требует `is_admin = true`. Включает:

- `DealStatusCard` + полная compliance history (`AdminComplianceCheck` items);
- Legal hold banner при `risk_status = Blocked` (красный, блокирует resolve);
- Review warning + acknowledge checkbox при `risk_status = Review`;
- Resolve flow: `getAdminResolveAvailability(riskStatus, acknowledgedReviewRisk)` — 4 состояния;
- Resolve confirm: кнопка disabled при `risk_status = Blocked` даже в confirm-state.

### 4.8 `/admin/denylist` — Compliance Denylist

Требует `is_admin = true`. Включает:

- форму добавления записи (wallet, reason select, notes);
- список текущих записей с `ListPagination`;
- inline remove flow: mandatory TextArea комментарий + confirm (без `window.prompt`);
- guard `canSubmitDenylistRemoval(comment)` перед API-вызовом.

---

## 5. Frontend Layer Architecture

### 5.1 Page layer (`app/`)

Route-level composition.

Обязанности:
- загрузка начальных данных страницы;
- сборка секций;
- подключение route params к hooks;
- handling route-level loading / not-found.

Не содержит business logic по lifecycle transitions.

### 5.2 Component layer (`components/`)

| Директория | Назначение |
|---|---|
| `components/app/` | AppShell, TopNav, WalletStatusPill |
| `components/link/` | CreateLinkForm, LinkActionCard, LinkSummary, FundingProgress, StatusNotice |
| `components/deal/` | DealActionsCard, DealGuidanceCard, DealStatusCard, DisputeThread, KeyTimes, MeetingUrlCard |
| `components/admin/` | RiskBadge |
| `components/shared/` | ActionPanel, AsyncActionState, Btn, ComplianceBlockedNotice, CopyBtn, DetailRow, EmptyState, FormField, InnerSection, ListPagination, LiveBadge, Notice, ProgressSteps, SectionLabel, SegmentedTabs, StatusPill, TextArea, TextInput, ThemeToggle, TokenAmountRow, WalletAuthStatePanel, WalletSessionCard |

### 5.3 Hooks layer (`hooks/`)

Главный coordination layer.

| Hook | Обязанности |
|---|---|
| `use-wallet-session.ts` | wallet connect, chain validation, SIWE session state |
| `use-link-page.ts` | link data loading, polling for deal_id after funding |
| `use-deal-page.ts` | deal data loading, participant role detection |
| `use-funding-flow.ts` | funding flow orchestration: prepare → sign → submit → sync |
| `use-deal-action.ts` | lifecycle action orchestration: complete / release / dispute |

### 5.4 API integration layer (`lib/api/`)

Типизированные wrappers вокруг backend REST endpoints.

| Файл | Endpoints |
|---|---|
| `auth.ts` | SIWE nonce, verify, logout |
| `links.ts` | GET link, POST link, cancel, funding prepare |
| `deals.ts` | GET deal, GET me/deals, meeting-url reveal, lifecycle prepares |
| `dispute-messages.ts` | GET/POST dispute messages |
| `admin-deals.ts` | GET admin deals, GET admin deal, POST admin resolve |
| `admin.ts` | GET/POST/DELETE admin denylist, GET admin compliance detail |

### 5.5 Contract interaction layer (`lib/contract/`)

| Файл | Обязанности |
|---|---|
| `execute-prepared-call.ts` | Исполняет `contract_call` от backend через wagmi; не генерирует calldata |
| `usdc.ts` | USDC `approve` перед funding |

---

## 6. Compliance UI Integration

### 6.1 Компоненты

**`ComplianceBlockedNotice`** (`components/shared/compliance-blocked-notice.tsx`)
- Props: `reasonCode: ComplianceReasonCode | null`, `walletAddress: Address | null`
- Рендерит null если `reasonCode === "PROVIDER_UNAVAILABLE"` (не блокирует UI при outage)
- Wallet row условный: отображается только если `walletAddress !== null`

**`RiskBadge`** (`components/admin/risk-badge.tsx`)
- Props: `riskStatus: DealRiskStatus`
- Маппинг: `Clear → success`, `Review → warning`, `Blocked → danger`
- Тонкая обёртка над `StatusPill`

### 6.2 Три точки блокировки

| UI-точка | Условие | Компонент |
|---|---|---|
| Funding (`/link/[id]`) | `fundingState.step === "compliance_blocked"` | `ComplianceBlockedNotice` вместо `FundingProgress` |
| Lifecycle actions (`/deal/[id]`) | `state.step === "compliance_blocked"` | `ComplianceBlockedNotice`; кнопки скрыты |
| Link creation (`/` или `/create`) | `compliance.isBlocked === true` | `ComplianceBlockedNotice` вместо `Notice` |

### 6.3 `PROVIDER_UNAVAILABLE` — отдельный путь

`PROVIDER_UNAVAILABLE` — fail-closed на backend: возвращает `403 COMPLIANCE_BLOCKED` с `reason_code = "PROVIDER_UNAVAILABLE"`. Frontend обрабатывает это через стандартный error flow (не notice), чтобы пользователь мог попробовать снова при восстановлении провайдера.

---

## 7. User Role Handling

Frontend различает три UI-role состояния:

| Роль | Определение |
|---|---|
| `seller` | `getAddress(session.wallet) === getAddress(deal.seller_address)` |
| `buyer` | `getAddress(session.wallet) === getAddress(deal.buyer_address)` |
| `viewer` | любой, кто не seller и не buyer |
| `admin` | `session.is_admin === true` (отдельный admin route guard) |

**Security boundary:** role-based UI gating — только convenience layer. Авторизация определяется backend SIWE checks и contract permissions.

---

## 8. Action-Flow Architecture

### 8.1 Funding

1. `/link/[id]` loads link data
2. wallet connect → SIWE session
3. `POST /api/links/:id/funding/prepare` → compliance gate
4. execute `createAndFundDeal` contract call
5. tx pending state
6. polling `GET /api/links/:id` до появления `deal_id`
7. navigate to `/deal/[deal_id]`

Compliance: шаг 3 может вернуть `403 COMPLIANCE_BLOCKED` → `step: "compliance_blocked"`.

### 8.2 Link Creation

1. form submit → `POST /api/links`
2. compliance gate seller wallet
3. success → show shareable URL
4. `403 COMPLIANCE_BLOCKED` → `compliance.isBlocked = true` → `ComplianceBlockedNotice`

### 8.3 Lifecycle Actions (complete / release / dispute)

1. call prepare endpoint (`/complete`, `/release`, `/dispute`, `/auto-release`)
2. execute returned contract call
3. refetch deal state

Release / auto-release: шаг 1 может вернуть `403 COMPLIANCE_BLOCKED` → `step: "compliance_blocked"`.

### 8.4 Admin Resolve

1. `getAdminResolveAvailability(riskStatus, acknowledgedReviewRisk)` определяет disabled-состояние
2. confirm dialog (disabled при `risk_status = Blocked`)
3. `POST /api/admin/deals/:id/resolve`
4. execute returned contract call
5. reload deal

### 8.5 Reveal Meeting URL

1. ensure SIWE session
2. `GET /api/deals/:id/meeting-url`
3. render URL только после успешного ответа

Refunded — reveal недоступен. Это intentional product decision.

---

## 9. Error / Loading UX

### Loading states

- route loading;
- action preparing;
- tx pending;
- reveal loading;
- backend sync waiting.

### Transaction state steps

Funding flow (`FundingStep` in `use-funding-flow.ts`):

```
idle → preparing → approve_signature → approve_pending
     → fund_signature → fund_pending
     → tx_confirmed   (tx landed onchain, backend sync not yet started)
     → indexing       (backend syncing deal status)
     → succeeded
     ↘ indexing_failed
     ↘ failed
     ↘ compliance_blocked
```

Lifecycle actions (`ActionStep` in `use-deal-action.ts`):

```
idle → preparing → signature → pending_chain
     → syncing_backend → succeeded
     ↘ sync_failed
     ↘ failed
     ↘ compliance_blocked
```

### Error display rules

- Backend errors отображаются inline в соответствующей action area.
- `compliance_blocked` рендерит `ComplianceBlockedNotice`, не `Notice`.
- `PROVIDER_UNAVAILABLE` рендерит стандартный error с возможностью retry.
- Frontend не подменяет backend gating своими бизнес-правилами.
- Duplicate clicks игнорируются пока текущее action не завершится.

### No optimistic business-state mutations

Business state меняется только после backend refetch.

---

## 10. State Management Strategy

- React hooks;
- route-local state;
- minimal shared provider/context только для wallet plumbing (`providers.tsx`).

Global state manager для business state не используется:
- мало routes;
- state mostly route-scoped;
- backend already acts as source of truth.

---

## 11. Реализованная структура папок

```
app/
  page.tsx                           — home + create link entry
  create/page.tsx                    — dedicated create link page
  link/[id]/page.tsx                 — public link + funding
  deal/[id]/page.tsx                 — deal lifecycle
  my-links/page.tsx                  — expert link list
  my-deals/page.tsx                  — buyer deal history
  admin/
    disputes/page.tsx                — admin dispute list
    disputes/[id]/page.tsx           — admin dispute detail + compliance
    denylist/page.tsx                — compliance denylist management
  api/...                            — Next.js Route Handlers (см. api-contract.md)

components/
  app/
    app-shell.tsx
    top-nav.tsx
    wallet-status-pill.tsx
  link/
    create-link-form.tsx
    funding-progress.tsx
    link-action-card.tsx
    link-summary.tsx
    status-notice.tsx
  deal/
    deal-actions-card.tsx
    deal-guidance-card.tsx
    deal-status-card.tsx
    dispute-thread.tsx
    key-times.tsx
    meeting-url-card.tsx
  admin/
    risk-badge.tsx
  shared/
    action-panel.tsx        async-action-state.tsx  btn.tsx
    compliance-blocked-notice.tsx   copy-btn.tsx    detail-row.tsx
    empty-state.tsx         form-field.tsx          inner-section.tsx
    list-pagination.tsx     live-badge.tsx          notice.tsx
    progress-steps.tsx      section-label.tsx       segmented-tabs.tsx
    status-pill.tsx         text-area.tsx           text-input.tsx
    theme-toggle.tsx        token-amount-row.tsx    wallet-auth-state-panel.tsx
    wallet-session-card.tsx
  providers.tsx

hooks/
  use-deal-action.ts
  use-deal-page.ts
  use-funding-flow.ts
  use-link-page.ts
  use-wallet-session.ts

lib/
  api/
    admin-deals.ts   admin.ts   auth.ts
    deals.ts         dispute-messages.ts   links.ts
  base/
    chains.ts   config.ts   consult-escrow-abi.ts
    consult-escrow.ts   wagmi.ts
  compliance/
    cache.ts   circuit-breaker.ts   composite.ts   config.ts
    display.ts   error-mapping.ts   public-client.ts   types.ts
    providers/
      chainalysis-oracle.ts   local-denylist.ts   usdc-blacklist.ts
  contract/
    execute-prepared-call.ts   usdc.ts
  crypto/
    link-hash.ts   meeting-url.ts   timing-safe-secret.ts
  db/
    client.ts   server.ts   types.ts
  ui/
    address.ts   async.ts   date.ts   deal-status.ts
  validators/
    admin-denylist.ts   consultation-links.ts   deals-admin.ts
    deals-completion.ts   deals.ts   dispute-messages.ts
    funding.ts   pagination.ts
  wallet/
    siwe.ts
  auth/
    config.ts   cookies.ts   guards.ts   session.ts   siwe.ts
  constants/
    consultation-links.ts   deals.ts
```

---

## Лист регистрации изменений

| Версия | Дата | Изменения |
|---|---|---|
| 1.0 | 2026-03-25 | Pre-implementation draft; описывал планируемое состояние |
| 2.0 | 2026-04-28 | Полная переработка; документирует реализованное состояние: 9 routes, директории компонентов, хуки, Compliance UI (ComplianceBlockedNotice, RiskBadge) |
