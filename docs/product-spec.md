# ТЗ v1.2 — Base Consult Link

> Version: 1.2 | Status: Актуален | Based on: ТЗ v1.2 | Date: 2026-04-28
> Изменения v1.2: исправлено противоречие fee_snapshot в §6.2, исправлен paymaster fallback в §14, добавлен §24 AML/Compliance Screening, добавлено описание dispute messages в §9.
> Составил: Base Consult Link Team | Проверил: — | Утвердил: —

## 1. Продукт

**Base Consult Link** — standard web app для Base App.
Назначение: продажа одного фиксированного слота консультации за USDC на Base через escrow.

Приложение:

- mobile-first, работает во встроенном браузере Base App;
- использует Base Account для wallet connection;
- использует wagmi + viem для контрактных вызовов;
- использует SIWE только для приватных backend-операций;
- регистрируется в Base Build / base.dev и использует Builder Code.

## 2. Цель MVP

Один сценарий:

- Эксперт создаёт single-use ссылку на конкретный слот.
- Клиент открывает ссылку и оплачивает USDC.
- Onchain создаётся и финансируется escrow (атомарно).
- Meeting URL раскрывается только после funding.
- После слота эксперт отмечает завершение.
- Клиент подтверждает release или открывает dispute.
- Если клиент молчит 48 часов — происходит auto-release.
- Если консультация не состоялась — клиент открывает dispute.

## 3. Scope MVP

### Входит

- scheduled consultation;
- single-use link;
- лимиты сделки: $10–$1000;
- escrow;
- seller completion + buyer confirmation;
- dispute window = 48 часов;
- permissionless auto-release;
- buyer dispute при no-show;
- hidden meeting URL;
- offchain cancel до funding;
- manual admin dispute;
- Base Account;
- Builder Code;
- sponsored transactions;
- Base metadata/manifest.

### Не входит

- чат;
- маркетплейс;
- multi-use links;
- подписки;
- milestones;
- автоматический арбитраж;
- встроенные звонки.

## 4. Модель продукта

### 4.1 Тип

Scheduled consultation

### 4.2 Поля ссылки

- title
- description
- price_usdc
- scheduled_at (UTC)
- timezone (display only)
- duration_minutes
- expires_at
- meeting_url

### 4.3 Инварианты времени

Все timestamp хранятся в UTC.

Обязательные правила:

- scheduled_at > now
- expires_at < scheduled_at
- expires_at > now
- duration_minutes > 0

`markCompleted` доступен продавцу сразу после funding:

`completed_at` фиксируется onchain в момент `markCompleted` и запускает 48-часовое окно buyer response.

## 5. Single-use модель

### Правило

Одна ссылка = одна сделка

### 5.1 Onchain enforcement

Каждая ссылка имеет:

- `link_hash`

Контракт хранит:

- `usedLinkHashes[link_hash] = true`

Правила:

- при funding `link_hash` помечается использованным;
- повторный funding с тем же `link_hash` → revert.

## 6. Funding архитектура

### 6.1 Модель

Funding = contract call через wagmi/viem + paymaster

### 6.2 Метод

`createAndFundDeal(...)`

Входные параметры:

- link_hash
- seller
- buyer
- amount
- scheduled_at
- duration
- deadline
- nonce
- signature

Примечание: `fee_snapshot` намеренно исключён из ABI в текущей фазе — fee-логика является автономной контрактной логикой. Замороженное решение: `decisions.md` F-08.

Гарантии:

- atomic execution
- один вызов = одна сделка
- нет `createDeal + fundDeal`
- funding требует short-lived onchain authorization от backend signer по EIP-712

Authorization model:

- domain:
  - `name = "ConsultEscrow"`
  - `version = "1"`
  - `chainId = block.chainid`
  - `verifyingContract = address(this)`
- struct:
  - `FundingAuthorization(address buyer,address seller,bytes32 linkHash,uint256 price,uint256 scheduledAt,uint256 durationMinutes,uint256 deadline,bytes32 nonce)`
- encoding rules:
  - `price = parseUnits(String(link.price_usdc), 6)`
  - `scheduledAt = Unix seconds`
  - `deadline = Unix seconds`
  - `nonce = bytes32`
- replay protection:
  - `usedFundingNonces[nonce] = true`
- lifetime policy:
  - funding grant TTL = 5 минут
  - onchain authorization deadline = 3 минуты

### 6.3 Base Pay

Не используется в MVP как основной payment rail.

## 7. Статусы

### Ссылка

- Draft
- Open
- Expired
- Cancelled
- Consumed

### Сделка

- Funded
- ConfirmPending
- Released
- Refunded
- Disputed

## 8. Flow сделки

### 8.1 Funding

- пользователь вызывает `createAndFundDeal`;
- calldata выдаётся только backend и уже содержит `deadline`, `nonce`, `signature`;
- средства lock в контракте;
- link → Consumed.

### 8.2 Completion

После funding seller может вызвать:

`markCompleted(dealId)`

### 8.3 Buyer window

48 часов:

- `confirmRelease`
- `openDispute`

### 8.4 Auto-release

Execution model:

`autoRelease(dealId)`

Правила:

- permissionless (любой может вызвать)
- контракт проверяет:
  - статус ConfirmPending
  - нет dispute
  - deadline истёк

Backend:

- может вызывать для UX
- не является обязательным

## 9. Dispute

Клиент может открыть dispute если:

- no-show
- проблема с услугой

Onchain методы:

- `openDispute(dealId)`
- `adminResolveRelease`
- `adminResolveRefund`

### 9.1 Dispute messages (offchain)

После перехода сделки в `Disputed` доступен offchain dispute thread:

- видим buyer, seller и admin одновременно;
- участники могут добавлять текстовые сообщения (1–3000 символов);
- поддерживаются внешние evidence links (max 2048 символов); загрузка файлов в MVP не поддерживается;
- thread становится read-only после `Released` или `Refunded`;
- endpoint: `GET/POST /api/deals/:id/dispute-messages` (SIWE обязателен).

## 10. Контракт

### Методы

- `createAndFundDeal`
- `markCompleted`
- `confirmRelease`
- `openDispute`
- `autoRelease`
- `adminResolveRelease`
- `adminResolveRefund`

### Требования

- USDC only
- state machine
- no double execution
- reentrancy guard
- event logging

## 11. Комиссия

- 2% с эксперта
- фиксируется в момент funding
- округление вниз
- отправка сразу на treasury

## 12. Auth и Session

### Public endpoints

не требуют auth

### Private endpoints

require SIWE

### Flow

- wallet connect
- nonce
- SIWE подпись
- backend validation
- session cookie

### Session

- short-lived
- привязана к wallet
- nonce одноразовый

### Admin

- whitelist wallet

## 13. Meeting URL security

- хранится encrypted
- backend-only reveal

Доступ:

- buyer
- seller

Endpoint требования:

- 401 без session
- 403 не участник
- 409 не funded
- логирование попыток

## 14. Sponsored transactions

### Спонсируются

- `createAndFundDeal`
- `markCompleted`
- `confirmRelease`
- `openDispute`
- `autoRelease`

### Не спонсируются

- admin actions

### Fallback

- user-paid fallback отсутствует в MVP
- если paymaster недоступен — UI показывает ошибку, tx не отправляется, состояние не меняется

### Paymaster

- через backend proxy
- allowlist методов

## 15. Chain sync policy

Backend обязан:

- индексировать events:
  - Funded
  - Completed
  - Released
  - Refunded
  - Disputed
- обновлять state только после confirmed tx
- поддерживать идемпотентность
- уметь replay
- сверять state периодически

## 16. Idempotency

- `tx_hash UNIQUE`
- один payment → одна сделка
- повторная обработка не меняет state

## 17. БД

### Constraints

- `consultation_links.id PK`
- `deals.consultation_link_id UNIQUE`
- `deals.onchain_deal_id UNIQUE`
- `processed_transactions.tx_hash UNIQUE`
- audit log append-only

## 18. UI/UX

- mobile-first
- 1 primary CTA
- no external auth
- avatar + username
- light/dark
- <3 screens onboarding
- touch ≥44px

## 19. Base требования

- standard web app
- Base Account
- wagmi + viem
- Builder Code
- dataSuffix для web
- metadata + manifest
- verify flow

## 20. Builder Code

- внутри Base App → auto attribution
- web → через dataSuffix

## 21. Аналитика

- links created
- funded
- released
- disputes
- avg check
- repeat users
- auto-release %
- dispute rate

## 22. Acceptance criteria (QA-ready)

- повторный funding → revert
- `markCompleted` раньше времени → revert
- `autoRelease` до дедлайна → revert
- `autoRelease` после → success
- reveal доступ только участникам
- `tx_hash` обрабатывается 1 раз
- offchain == onchain state

## 23. Этапы разработки

- Model + DB + contract design
- App shell + Base Account
- Funding + escrow
- Scheduling + time logic
- Dispute + admin
- Base polish + deploy

## 24. AML / Compliance Screening

Платформа выполняет sanctions screening на трёх уровнях. Детальный анализ: `docs/compliance-aml-analysis.md`. Замороженные инварианты: `decisions.md` §3.1.

### 24.1 Три check points

| Точка | Кто проверяется | Действие при блокировке |
|---|---|---|
| `POST /api/links` (create) | seller wallet | `403 COMPLIANCE_BLOCKED`; ссылка не создаётся |
| `POST /api/links/:id/funding/prepare` | buyer + seller | `403 COMPLIANCE_BLOCKED`; funding grant и onchain authorization не выдаются |
| Payout-path prepares (`/release`, `/auto-release`, `/admin/deals/:id/resolve`) | получатель выплаты | `403 COMPLIANCE_BLOCKED`; calldata не готовится |

### 24.2 Три MVP-провайдера

- Chainalysis Sanctions Oracle (on-chain, Base)
- USDC `isBlacklisted(address)` (on-chain)
- Local `wallet_denylist` (admin-managed DB table)

### 24.3 Поведение при сбое провайдера

Fail-closed: недоступность провайдера → `Blocked / PROVIDER_UNAVAILABLE`. Не кэшируется по адресу.

### 24.4 `risk_status` — отдельная ось

`deals.risk_status` (`Clear | Review | Blocked`) — независима от `deal.status`. Не создаёт новых lifecycle-статусов. `risk_status = Blocked` → legal hold: все payout-path endpoints блокированы до ручного юридического разрешения вне MVP.

### 24.5 Frontend

`403 COMPLIANCE_BLOCKED` отображается как in-place notice (`ComplianceBlockedNotice`) без редиректа на глобальную страницу ошибки.

### 24.6 Admin compliance UI

- `GET /admin/disputes` — `RiskBadge` на каждой карточке сделки
- `GET /admin/disputes/[id]` — compliance history, legal hold banner, acknowledge flow для `Review`
- `GET /admin/denylist` — CRUD для `wallet_denylist`

---

## Финальный итог

Это:

**single-use scheduled consultation escrow app на Base**

Не:

- marketplace
- payment gateway
- chat
- video platform

А:

👉 простой инструмент продажи одного консультационного слота через escrow.

---

## Лист регистрации изменений

| Версия | Дата | Изменения |
|---|---|---|
| 1.0 | 2026-03-25 | Первичный выпуск |
| 1.1 | 2026-04-01 | Промежуточные правки (детали не зафиксированы) |
| 1.2 | 2026-04-28 | Исправлено противоречие fee_snapshot в §6.2; исправлен paymaster fallback в §14; добавлен §24 AML/Compliance Screening; добавлен §9.1 dispute messages |
