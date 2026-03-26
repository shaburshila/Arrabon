# ТЗ v1.2 — Base Consult Link

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
- grace_period_minutes
- expires_at
- meeting_url

### 4.3 Инварианты времени

Все timestamp хранятся в UTC.

Обязательные правила:

- scheduled_at > now
- expires_at < scheduled_at
- scheduled_at - expires_at ≥ 15 минут
- duration_minutes > 0
- grace_period_minutes ≥ 0

`markCompleted` доступен только после:

`scheduled_at + duration + grace_period`

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
- grace_period
- fee params snapshot

Гарантии:

- atomic execution
- один вызов = одна сделка
- нет `createDeal + fundDeal`

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
- средства lock в контракте;
- link → Consumed.

### 8.2 Completion

После:

`scheduled_at + duration + grace`

seller может вызвать:

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

Методы:

- `openDispute(dealId)`
- `adminResolveRelease`
- `adminResolveRefund`

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
- fee waiver: 14 дней
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

- user-paid optional
- иначе error

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

