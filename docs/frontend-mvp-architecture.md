# Frontend MVP Architecture — Base Consult Link

> Status: Approved and locked
> Scope: Frontend MVP architecture only
> Implementation status: Blocked pending backend navigation dependency

---

## 1. Purpose

Этот документ фиксирует утверждённую архитектуру MVP фронтенда для Base Consult Link.

Документ описывает только:

- route architecture;
- screen/layout architecture;
- frontend layering;
- frontend state model;
- action flows;
- wallet / role handling;
- loading / error UX;
- folder structure;
- out-of-scope boundaries;
- текущий blocker перед стартом реализации.

Документ не является реализацией и не меняет:

- backend endpoints;
- contract flow;
- state machine;
- security boundaries;
- product scope.

---

## 2. Frozen Principles

- Frontend остаётся thin client.
- Backend является source of truth для prepare/state gating и metadata/reveal.
- Contract является source of truth для onchain execution и lifecycle transitions.
- Frontend не строит escrow calldata самостоятельно.
- Frontend использует backend prepare endpoints как единственный разрешённый способ подготовки contract calls.
- Frontend не делает optimistic business-state mutations.
- MVP должен оставаться mobile-first.
- MVP должен оставаться small and practical, без лишних route-ов и глобальной сложности.

---

## 3. MVP Route Structure

### Required routes

- `/`
- `/link/[id]`
- `/deal/[id]`

### Route responsibilities

#### `/`

Минимальная seller entry surface для:

- создания consultation link;
- получения share URL;
- копирования / шаринга ссылки.

Важно:

- seller entry surface обязан включать тот же wallet connection + SIWE session flow, что и buyer-side action surfaces;
- это обязательно, потому что `POST /api/links` является private SIWE endpoint.

#### `/link/[id]`

Главная user-flow surface MVP.

Этот route отвечает за:

- публичное отображение consultation link;
- wallet connect;
- SIWE session bootstrap для приватных действий;
- funding start;
- pre-funding и funding-pending UX;
- post-funding ожидание индексации сделки.

Именно `/link/[id]` остаётся основной точкой входа в buyer flow.

#### `/deal/[id]`

Нужен для post-funding lifecycle.

Этот route отвечает за:

- отображение статуса сделки;
- reveal meeting URL;
- seller complete action;
- buyer release action;
- buyer dispute action.

### Route minimization decision

В MVP не нужны дополнительные product pages:

- без dashboard;
- без admin UI;
- без отдельной analytics surface;
- без дополнительных промежуточных flow pages.

---

## 4. Main Page Architecture

### 4.1 `/link/[id]`

Mobile-first layout: одна вертикальная колонка карточек.

#### Section: `LinkSummary`

Показывает:

- title;
- description;
- price;
- scheduled time;
- timezone;
- duration;
- expiry;
- seller address;
- public link status.

#### Section: `ConnectionState`

Показывает:

- wallet connection status;
- current wallet address;
- correct chain / wrong chain state;
- SIWE session state;
- role hint на основе normalized wallet comparison.

#### Section: `PrimaryActionCard`

Единая CTA-зона для главного действия.

Состояния:

- connect wallet;
- sign in with SIWE;
- approve token if needed;
- fund consultation;
- disabled / unavailable state.

#### Section: `FundingProgress`

Показывает:

- prepare in progress;
- signature requested;
- tx submitted;
- tx hash;
- waiting for chain confirmation;
- waiting for backend indexing.

#### Section: `StatusNotice`

Отдельно обрабатывает:

- expired;
- cancelled;
- consumed;
- unavailable;
- not found.

### 4.2 `/deal/[id]`

Тоже mobile-first single-column layout.

#### Section: `DealStatusHeader`

Показывает:

- current deal status;
- seller / buyer addresses;
- scheduled time;
- completed time;
- release deadline if available.

#### Section: `MeetingUrlCard`

Отвечает только за reveal UX.

Должен явно учитывать:

- reveal доступен только через backend endpoint;
- reveal не доступен без SIWE;
- reveal не доступен не-участникам;
- reveal не доступен в `Refunded`;
- reveal не должен предполагаться доступным для всех terminal states.

#### Section: `ActionCard`

Показывает только доступные lifecycle actions:

- seller: complete;
- buyer: release;
- buyer: dispute.

#### Section: `Timeline / KeyTimes`

Показывает:

- scheduled time;
- completion eligibility;
- completed at;
- dispute/release deadline.

---

## 5. Frontend Layer Architecture

### 5.1 Page layer

Route-level composition only.

Responsibilities:

- load initial page data;
- assemble sections;
- connect route params to hooks;
- handle route-level loading / not-found presentation.

Page layer не должен содержать business logic по lifecycle transitions.

### 5.2 Feature / component layer

Состоит из small reusable sections:

- link summary components;
- wallet/session components;
- funding card;
- deal status card;
- meeting URL card;
- lifecycle action card;
- async action feedback UI.

Components отвечают за rendering и local UI composition, а не за orchestration flow.

### 5.3 Hooks / orchestration layer

Главный coordination layer MVP.

Responsibilities:

- link page data orchestration;
- deal page data orchestration;
- wallet + SIWE coordination;
- funding flow orchestration;
- deal action orchestration;
- loading / retry / refetch sequencing.

Именно этот слой управляет последовательностью:

- prepare endpoint;
- wallet tx execution;
- waiting states;
- backend refetch after tx.

### 5.4 API integration layer

Тонкие typed wrappers around backend REST endpoints.

Responsibilities:

- request/response typing;
- basic error normalization;
- no duplicated business rules.

### 5.5 Wallet / contract interaction layer

Responsibilities:

- wallet connection;
- chain validation;
- token approval checks if needed;
- execution of backend-prepared contract calls.

Boundary:

- frontend не генерирует escrow calldata самостоятельно;
- frontend исполняет `contract_call`, полученный от backend;
- frontend не придумывает новые action shapes.

---

## 6. Data / State Architecture

### 6.1 Public link state

Нужные поля:

- `id`
- `title`
- `description`
- `price_usdc`
- `scheduled_at`
- `timezone`
- `duration_minutes`
- `grace_period_minutes` (server-controlled; read-only for frontend)
- `expires_at`
- `status`
- `seller_address`
- `deal_id` when backend dependency is implemented

### 6.2 Deal state

Нужные поля:

- `id`
- `consultation_link_id`
- `onchain_deal_id`
- `status`
- `buyer_address`
- `seller_address`
- `scheduled_at`
- `completed_at`
- `release_deadline_at`
- `tx_hash`

### 6.3 Role-awareness state

Нужные derived values:

- `isSeller`
- `isBuyer`
- `isViewer`
- `isParticipant`

Frozen rule:

- frontend должен сравнивать адреса только в нормализованной форме через `getAddress(...)`;
- raw string equality запрещён.

### 6.4 Wallet / auth state

Нужные поля:

- `isConnected`
- `walletAddress`
- `chainId`
- `isCorrectChain`
- `siweSessionStatus`
- `sessionWalletAddress` if available

### 6.5 Transaction state

Для каждого действия нужен отдельный minimal async state:

- `idle`
- `preparing`
- `awaiting_signature`
- `submitting`
- `pending_chain`
- `waiting_backend_sync`
- `succeeded`
- `failed`

Additional fields:

- `txHash`
- `error`
- `lastAction`

### 6.6 UI state

Нужны:

- route loading state;
- action loading state;
- backend error message;
- disabled reason;
- reveal loading state.

---

## 7. User Role Handling

Frontend различает только три UI-role состояния:

- seller;
- buyer;
- viewer.

### Seller

Определяется как wallet/session address, совпадающий с `seller_address` после нормализации через `getAddress(...)`.

### Buyer

Определяется как wallet/session address, совпадающий с `buyer_address` после нормализации через `getAddress(...)`.

### Viewer

Любой пользователь, который:

- не подключил wallet;
- не имеет SIWE session;
- либо не совпадает ни с buyer, ни с seller.

### Security boundary

Role-based UI gating является только convenience layer.

Она не является security boundary.

Настоящее разрешение действий определяется:

- backend SIWE checks;
- contract permissions.

---

## 8. Action-Flow Architecture

### 8.1 Funding

Flow:

1. load `/link/[id]`
2. connect wallet
3. establish SIWE session
4. call `POST /api/links/:id/funding/prepare`
5. execute returned `createAndFundDeal` contract call
6. show tx pending state
7. refetch backend read model until indexed deal becomes available
8. navigate to `/deal/[deal_id]` once available

Frozen rule:

- `POST /api/links/:id/funding/prepare` must be explicitly treated as a private SIWE endpoint.

Additional rule:

- frontend must not build funding calldata independently.

### 8.2 Reveal

Flow:

1. load `/deal/[id]`
2. ensure SIWE session
3. call `GET /api/deals/:id/meeting-url`
4. render URL only after successful backend response

Frozen rule:

- `Refunded` must be modelled explicitly as reveal-unavailable state, including for participants.

### 8.3 Complete

Flow:

1. seller opens `/deal/[id]`
2. frontend shows CTA only when seller UI gating passes
3. call `POST /api/deals/:id/complete`
4. execute returned `markCompleted` call
5. refetch deal state from backend

### 8.4 Release

Flow:

1. buyer opens `/deal/[id]`
2. call `POST /api/deals/:id/release`
3. execute returned `confirmRelease` call
4. refetch deal state from backend

### 8.5 Dispute

Flow:

1. buyer opens `/deal/[id]`
2. call `POST /api/deals/:id/dispute`
3. execute returned `openDispute` call
4. refetch deal state from backend

### 8.6 Auto-release

Не включается в MVP frontend action surface.

Причина:

- prepare endpoint for frontend auto-release action currently does not exist;
- frontend architecture must not invent direct calldata construction for it.

---

## 9. Error / Loading UX Architecture

### Loading states

Нужны минимальные loading states:

- route loading;
- action preparing;
- tx pending;
- reveal loading;
- backend sync waiting.

### Disabled states

Каждая CTA должна иметь:

- boolean disabled state;
- one explicit disabled reason visible to user.

### Tx pending states

После submit:

- action button lock;
- repeated taps blocked;
- tx hash shown if available;
- state switches to waiting-for-chain and then waiting-for-backend-sync.

### Backend errors

Backend errors должны отображаться inline в соответствующей action area.

Frontend не должен:

- silently swallow errors;
- подменять backend gating собственными бизнес-правилами.

### Duplicate-click prevention

Для каждой action card:

- один in-flight action at a time;
- duplicate clicks ignored until current action resolves or fails.

### No optimistic business-state mutations

Frontend не переводит link/deal status локально после tx.

Изменение business state происходит только после backend refetch.

---

## 10. State Management Strategy

### Recommendation

Для MVP использовать:

- React hooks;
- route-local state;
- minimal shared provider/context only for wallet plumbing.

### Explicit decision

Не использовать global state manager для business state MVP.

Причины:

- мало route-ов;
- state mostly route-scoped;
- backend already acts as source of truth;
- extra global complexity is not justified.

---

## 11. Recommended Folder Structure

```text
app/
  page.tsx
  link/[id]/page.tsx
  deal/[id]/page.tsx

components/
  link/
    link-summary.tsx
    link-action-card.tsx
  deal/
    deal-status-card.tsx
    deal-actions-card.tsx
    meeting-url-card.tsx
  shared/
    wallet-session-card.tsx
    async-action-state.tsx

hooks/
  use-link-page.ts
  use-deal-page.ts
  use-wallet-session.ts
  use-funding-flow.ts
  use-deal-action.ts

lib/
  api/
    links.ts
    deals.ts
    auth.ts
  contract/
    execute-prepared-call.ts
    usdc.ts
  wallet/
    connect.ts
    siwe.ts
```

Структура должна оставаться small and practical.

Никакого design-system overengineering в MVP не требуется.

---

## 12. Out-of-Scope

В frontend MVP architecture не входят:

- dashboards;
- admin UI;
- analytics UI;
- notifications;
- advanced polling infrastructure;
- realtime subscriptions;
- speculative pages;
- multi-link management;
- chat;
- marketplace surfaces;
- design-system overengineering;
- любые дополнительные product features вне утверждённого core flow.

---

## 13. Blocker / Dependency

Перед началом frontend MVP implementation остаётся один blocker:

- backend navigation dependency after funding.

### Required backend change

Нужно добавить:

- `deal_id: string | null`

в ответ:

- `GET /api/links/:id`

### Required behavior

- до создания / индексации сделки endpoint возвращает `deal_id: null`
- после появления сделки endpoint возвращает реальный backend UUID сделки

### Why this is required

После funding frontend знает `link.id`, но post-funding routes и private deal endpoints завязаны на backend `deal.id`.

Без этого фронтенд не может надёжно перейти с `/link/[id]` на `/deal/[id]` после индексации.

### Intended frontend usage after backend fix

`/link/[id]`:

- выполняет funding;
- показывает pending / waiting-for-indexing state;
- polling-ом запрашивает `GET /api/links/:id`;
- при появлении `deal_id` редиректит на `/deal/[deal_id]`.

Пока это backend-изменение не реализовано и не проверено, frontend MVP implementation не должен начинаться.

---

## 14. Final Status

Статус документа:

- architecture approved;
- clarifications locked;
- implementation blocked by backend dependency only.
