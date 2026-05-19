# Architecture — Arrabon

> Version: 1.1 | Status: Актуален | Based on: ТЗ v1.2 | Date: 2026-04-28
> Изменения v1.1: исправлен технологический стек backend (Next.js App Router вместо Hono), расширена схема БД до 10 таблиц, обновлены модули frontend/backend, добавлены внешние сервисы compliance.
> Составил: Arrabon Team | Проверил: — | Утвердил: —

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BASE APP (mobile)                         │
│                   Built-in browser / web app                     │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              NEXT.JS APPLICATION (App Router, single process)        │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  FRONTEND  (React, wagmi + viem)                              │  │
│  │  /link/[id]  /deal/[id]  /my-links  /my-deals                 │  │
│  │  /create  /admin/disputes  /admin/denylist                    │  │
│  │  ────────────────────────────────────────────────────────     │  │
│  │  Base Account connect · contract calls · paymaster proxy      │  │
│  └─────────────────────────────┬─────────────────────────────────┘  │
│                                │                                     │
│  ┌─────────────────────────────▼─────────────────────────────────┐  │
│  │  BACKEND  (Next.js Route Handlers — app/api/**)               │  │
│  │                                                               │  │
│  │  auth/siwe    links      deals       admin                    │  │
│  │  reveal       indexer    paymaster   compliance               │  │
│  └─────────────────────────────┬─────────────────────────────────┘  │
└───────────────────────────────┬┘                                     │
                                │                    └─────────────────┘
          DB               Compliance                   Chain / RPC
          │                providers                        │
          ▼                    │                            ▼
┌──────────────┐  ┌────────────▼──────────┐   ┌───────────────────────┐
│  Supabase    │  │  Chainalysis Oracle   │   │   BASE CHAIN (L2)     │
│  PostgreSQL  │  │  USDC isBlacklisted() │   │   ConsultEscrow.sol   │
│  (Supabase   │  │  local wallet_denylist│   │   USDC (ERC-20)       │
│   hosted)    │  └───────────────────────┘   └───────────────────────┘
└──────────────┘
                 EXTERNAL SERVICES
                 · Coinbase Paymaster (sponsored tx)
                 · Base RPC — Alchemy (primary) / public (fallback)
                 · Base Build / base.dev (Builder Code)
```

**Рисунок 1 — Общая архитектура системы.**

Ключевой архитектурный факт: frontend и backend являются частями одного Next.js процесса. Backend API реализован через Next.js App Router Route Handlers (`app/api/**`), а не как отдельный сервер. Supabase предоставляет PostgreSQL как managed service.

---

## 2. Module Boundaries

### 2.1 Frontend Modules

| Module | Responsibility | Auth |
|---|---|---|
| `app/page.tsx` | Home + create link entry surface | Public / SIWE |
| `app/create` | Создание consultation link | SIWE session |
| `app/link/[id]` | Public link page — слот, compliance notice, CTA funding | Public |
| `app/deal/[id]` | Deal lifecycle — confirm/dispute, meeting URL reveal | SIWE session |
| `app/my-links` | Expert view — список своих ссылок | SIWE session |
| `app/my-deals` | Buyer recovery — список своих сделок | SIWE session |
| `app/admin/disputes` | Admin list — disputed deals, risk badges | SIWE + is_admin |
| `app/admin/disputes/[id]` | Admin detail — compliance history, resolve | SIWE + is_admin |
| `app/admin/denylist` | Admin — denylist CRUD | SIWE + is_admin |
| `lib/base` | wagmi config, Base Account connector, ABI, chain setup | — |
| `lib/contract` | execute-prepared-call, USDC approve | — |
| `lib/wallet` | SIWE sign/verify utils, session management | — |
| `components/shared` | Переиспользуемые UI-компоненты (mobile-first, 44px touch) | — |

### 2.2 Backend Modules

Backend реализован как Next.js Route Handlers (`app/api/**`) с вспомогательными модулями в `lib/`.

| Module | Location | Responsibility |
|---|---|---|
| Auth / SIWE | `app/api/auth/**`, `lib/auth/` | Nonce generation, SIWE validation, session cookie |
| Links | `app/api/links/**`, `lib/validators/consultation-links.ts` | CRUD consultation_links, валидация инвариантов времени |
| Deals | `app/api/deals/**`, `lib/validators/deals*.ts` | Чтение статуса сделок, lifecycle prepare endpoints |
| Meeting URL Reveal | `app/api/deals/[id]/meeting-url/` | Decrypt + access control |
| Deal Sync (Indexer) | `app/api/internal/deal-events/sync/` | Event processing, обновление DB после confirmed tx |
| Admin | `app/api/admin/**`, `lib/validators/deals-admin.ts` | Allowlist-only endpoints — dispute resolution, compliance |
| Compliance | `lib/compliance/` | Wallet screening через 3 провайдера, audit logging, cache, circuit breaker |
| Funding Sync | `app/api/links/[id]/funding/sync/` | Post-funding link state sync |
| Paymaster Proxy | `lib/base/` | Proxy к Coinbase Paymaster, allowlist методов |

Примечание: модуль Analytics не реализован в MVP.

### 2.3 Smart Contract Module

| Contract | Responsibility |
|---|---|
| `ConsultEscrow.sol` | Полная state machine сделки, хранение средств, fee логика |

### 2.4 Database Schema (ключевые таблицы)

Полная схема в `supabase/migrations/`. TypeScript-типы в `lib/db/types.ts`.

```
consultation_links                deals
──────────────────────────────    ──────────────────────────────────────
id PK                             id PK
creator_user_id FK → users        consultation_link_id UNIQUE FK
expert_address                    onchain_deal_id UNIQUE
title                             buyer_address
description                       seller_address
price_usdc                        status (Funded|ConfirmPending|
scheduled_at (UTC)                        Released|Refunded|Disputed)
expires_at (UTC)                  risk_status (Clear|Review|Blocked)
timezone                          funded_at
duration_minutes                  completed_at
meeting_url_encrypted             released_at
link_hash UNIQUE                  resolution_type
status (Draft|Open|Expired|       resolved_at
        Cancelled|Consumed)       resolved_by_wallet
created_at                        resolved_from_status
                                  tx_hash
                                  created_at

processed_transactions            deal_risk_recompute_requests
──────────────────────────────    ──────────────────────────────────────
tx_hash UNIQUE                    id PK
event_type                        deal_id FK → deals
deal_id FK → deals                source
hold_applied                      status (pending|applied)
compliance_screened_at            applied_at
processed_at                      last_error_code / message
                                  created_at

users                             sessions
─────────────────────             ─────────────────────────────
id PK                             id PK
wallet UNIQUE                     wallet
username                          is_admin
avatar_url                        session_token_hash UNIQUE
created_at                        expires_at
                                  created_at
                                  revoked_at

auth_nonces                       processed_transactions
───────────────────               ──────────────────────────
id PK                             tx_hash PK
wallet                            event_type
nonce                             deal_id FK
expires_at                        processed_at
used_at
created_at

compliance_checks (append-only)   wallet_denylist
──────────────────────────────    ─────────────────────────────
id PK                             wallet PK (lowercase)
subject_type (wallet)             reason (fraud|abuse|sanctions|other)
subject_value (lowercase)         added_by_wallet
provider                          added_at
result (Clear|Review|Blocked)     notes
reason_code
raw_summary JSONB
checked_at
deal_id FK nullable
actor_wallet nullable

admin_resolution_intents          deal_dispute_messages
────────────────────────────      ──────────────────────────────
id PK                             id PK
deal_id FK                        deal_id FK
onchain_deal_id                   author_wallet
resolution (release|refund)       author_role (buyer|seller|admin)
admin_wallet                      body (1–3000 chars)
created_at                        evidence_url nullable
consumed_at nullable              created_at

audit_log (append-only)
─────────────────────────
id PK
entity_type
entity_id
action
actor_address nullable
metadata JSONB
created_at

deal_event_sync_cursors           deal_payout_block_requests
──────────────────────────────    ──────────────────────────────────────
name PK (text)                    id PK
last_indexed_block bigint         deal_id FK → deals
updated_at                        onchain_deal_id
                                  blocked
                                  source (denylist_add)
                                  status (pending|applied|non_actionable)
                                  applied_at nullable
                                  last_error_code / message nullable
                                  created_at

security_request_attempts (append-only)
────────────────────────────────────────
id PK
scope (siwe_verify|meeting_url_reveal)
wallet_address
deal_id FK → deals nullable
created_at
```

**Рисунок 2 — Схема базы данных.**

---

## 3. Onchain / Offchain Split

### Onchain (Base L2 — ConsultEscrow.sol)

| What | Why onchain |
|---|---|
| USDC custody | Trustless escrow, funds never touch backend |
| `link_hash` uniqueness (`usedLinkHashes`) | Onchain enforcement single-use, revert on replay |
| Deal state machine (Funded → ConfirmPending → Released/Refunded/Disputed) | Tamper-proof state transitions |
| `createAndFundDeal` — atomic creation + funding | No split tx race conditions |
| `markCompleted` seller assertion | Seller can mark a funded deal completed starting from `scheduled_at`; buyer controls release/dispute response |
| `autoRelease` — seller-only | Only seller can call after the fixed deadline; backend is not the settlement authority |
| Fee calculation + treasury transfer | On-chain at funding time, autonomous contract logic; backend does not prepare fee params in the current ABI |
| Event log (Funded, Completed, Released, Refunded, Disputed) | Source of truth для indexer |

### Offchain (Backend + DB)

| What | Why offchain |
|---|---|
| Consultation link metadata (title, description, timezone display) | Не нужно onchain, меняется до funding |
| `meeting_url` encrypted storage | Privacy, reveal только участникам через SIWE |
| Link status (Draft/Open/Expired/Cancelled) | Pre-funding lifecycle, не существует на chain |
| SIWE auth sessions | Short-lived, wallet-bound cookies |
| Offchain cancel до funding | Нет смысла писать в chain |
| Analytics aggregation | Read-only, производные данные |
| Paymaster proxy | Backend проверяет allowlist перед отправкой к Coinbase |
| Auto-release prepare/helper | Backend может помогать seller с prepare-flow и UI countdown, но не заменяет seller wallet |
| Admin whitelist | Env var / DB, не onchain в MVP |

### Sync Boundary

```
Chain events (confirmed)
        │
        ▼
   server/indexer
        │
        ├── reads last_indexed_block from deal_event_sync_cursors (DB cursor)
        ├── updates deals.status
        ├── inserts processed_transactions (tx_hash UNIQUE,
        │    plus funded screening progress marker)
        ├── advances deal_event_sync_cursors after each successful batch
        │    (monotonic SQL path — parallel runs cannot roll cursor back)
        └── appends audit_log

runDealEventsWorker()        — global catch-up; reads and writes DB cursor
runDealEventsWorkerForTx()   — user fast-path (tx_hash-scoped); does NOT
                               read or write global cursor; fully isolated

Backend NEVER writes chain state without a confirmed tx.
Chain is source of truth for deal state.
Backend is source of truth for link metadata and meeting_url.
```

---

## 4. Integration Points

### 4.1 Base Account (Wallet Connection)

- **What:** Coinbase Smart Wallet через Base Account connector
- **How:** wagmi `useConnect` + Base Account connector из `@coinbase/wallet-sdk`
- **Where:** `lib/wagmi/config.ts`
- **Scope:** wallet connect, chain switching, UserOp signing

### 4.2 Coinbase Paymaster (Sponsored Transactions)

- **What:** Gas sponsorship для `createAndFundDeal`, `markCompleted`, `confirmRelease`, `openDispute`, `autoRelease`
- **How:** UserOp → `server/paymaster` → Coinbase Paymaster API
- **Allowlist:** только перечисленные методы; admin actions — не спонсируются
- **Fallback:** если paymaster недоступен → error (не user-paid по умолчанию)
- **Where:** `server/paymaster/proxy.ts`

### 4.3 USDC (ERC-20, Base Mainnet)

- **What:** Единственный платёжный токен
- **How:** `approve` + `createAndFundDeal` (контракт тянет USDC через transferFrom)
- **Address:** официальный USDC на Base mainnet (frozen)
- **Scope:** только transfer в escrow и из escrow

### 4.4 Base Build / base.dev (Builder Code)

- **What:** Attribution через Builder Code
- **How (in-app):** автоматически при открытии через Base App
- **How (web):** `dataSuffix` добавляется к каждому contract call через wagmi
- **Registration:** приложение зарегистрировано в base.dev
- **Where:** `lib/wagmi/builderCode.ts`

### 4.5 Base RPC

- **What:** Чтение chain state, отправка UserOps
- **Provider:** Alchemy (primary) / Base public RPC (fallback)
- **Where:** `lib/wagmi/config.ts`, `server/indexer/client.ts`

### 4.6 Frontend ↔ Backend API

- **Protocol:** REST / HTTPS, JSON
- **Auth:** SIWE session cookie для приватных endpoints
- **Public endpoints:** GET link metadata, GET deal status (read-only, no SIWE)
- **Private endpoints:** POST create link, GET meeting_url, POST cancel link
- **Contract:** `docs/api-contract.md`

---

## 5. Frozen Decisions

Следующие решения считаются **архитектурно замороженными** для MVP. Изменение любого из них требует пересмотра scope через новую версию ТЗ.

| # | Решение | Обоснование |
|---|---|---|
| F-01 | **Один контракт `ConsultEscrow.sol`** — нет factory, нет per-deal контрактов | Простота, один адрес, единый state |
| F-02 | **`createAndFundDeal` — атомарный вызов**, нет `createDeal + fundDeal` | Исключает race conditions и незафиндированные сделки |
| F-03 | **USDC only** (Base mainnet official address) | Упрощает расчёт fee, предсказуемый стейблкоин |
| F-04 | **`link_hash` uniqueness enforced onchain** через `usedLinkHashes` mapping | Backend не может быть обойдён; single-use — контрактная гарантия |
| F-05 | **SIWE** как единственный auth механизм для приватных операций | Нет email/OAuth; wallet-native auth |
| F-06 | **`meeting_url` хранится encrypted на backend**, не onchain | Privacy; reveal только через SIWE-аутентифицированный endpoint |
| F-07 | **Fee = 2%, фиксируется при funding**, выплачивается treasury только на release paths | Нет post-hoc fee; snapshot в момент создания сделки |
| F-08 | **Fee waiver отсутствует в v1** | Fee всегда рассчитывается как фиксированные 2%; backend не передаёт fee-параметры |
| F-09 | **`autoRelease` seller-only** — вызвать может только seller | Снижает actor-surface; backend остаётся prepare/helper слоем, а не settlement authority |
| F-10 | **Dispute window = 48 часов** | Фиксировано в ТЗ; не конфигурируется per-deal в MVP |
| F-11 | **Paymaster через backend proxy** с allowlist методов | Безопасность: нельзя спонсировать произвольные вызовы |
| F-12 | **Admin = whitelist wallet**, без onchain role contract | MVP-simple; достаточно для manual dispute resolution |
| F-13 | **Offchain cancel до funding** — нет onchain cancel | Зафиндированная сделка отменяется только через dispute |
| F-14 | **Base Pay не используется** в MVP как payment rail | ТЗ явно исключает |
| F-15 | **`deals.consultation_link_id UNIQUE`** — одна ссылка = одна сделка в DB | Дублирует onchain `link_hash`; двойная защита |
| F-16 | **`processed_transactions.tx_hash UNIQUE`** — идемпотентный indexer | Повторная обработка события не меняет state; для `Funded` дополнительно хранится `compliance_screened_at`, чтобы post-funding screening можно было возобновить после сбоя |
| F-17 | **Все timestamps в UTC** | Единственный формат хранения; timezone — display only |
| F-18 | **`markCompleted` доступен продавцу с `scheduled_at`** | Buyer window стартует не раньше начала слота; fixed deadline считается от `scheduled_at + duration` |
| F-19 | **Лимиты сделки $10–$1000 USDC** | Enforced в контракте при `createAndFundDeal` |
| F-20 | **mobile-first, Base App built-in browser** — primary target | Все UI решения принимаются с этим ограничением |
| F-21 | **`deals.risk_status` — отдельная ось** от `deal.status` | Compliance не создаёт новых lifecycle-статусов; `risk_status = Blocked` влечёт legal hold без изменения `deal.status`. Подробнее: `decisions.md` §3.1 |

---

## 6. Data Flow: Happy Path

```
Expert                    Frontend              Backend               Chain
  │                          │                    │                     │
  ├─ create link ────────────►│                    │                     │
  │                          ├─ POST /links ──────►│                     │
  │                          │                    ├─ store encrypted     │
  │                          │                    │   meeting_url        │
  │                          │◄─ link_id, hash ───┤                     │
  │                          │                    │                     │
  │◄─ shareable URL ─────────┤                    │                     │
  │                          │                    │                     │
Buyer                        │                    │                     │
  ├─ open link ──────────────►│                    │                     │
  │                          ├─ GET /links/:id ───►│                     │
  │                          │◄─ metadata ─────────┤                     │
  │                          │                    │                     │
  ├─ approve USDC ───────────►│                    │                     │
  ├─ createAndFundDeal() ─────────────────────────────────────────────►│
  │                          │          (via paymaster proxy)          ├─ lock USDC
  │                          │                    │                    ├─ mark link_hash used
  │                          │                    │◄── event: Funded ──┤
  │                          │                    ├─ update deal status │
  │                          │                    │   → Funded          │
  │                          │                    │                     │
  ├─ GET meeting_url ─────────►│                    │                     │
  │  (SIWE session)          ├─ GET /deals/:id/url►│                     │
  │                          │                    ├─ decrypt + verify   │
  │                          │◄─ meeting_url ──────┤                     │
  │                          │                    │                     │
 [consultation happens]      │                    │                     │
  │                          │                    │                     │
Expert                        │                    │                     │
  ├─ markCompleted() ─────────────────────────────────────────────────►│
  │                          │                    │◄── event: Completed─┤
  │                          │                    ├─ status → ConfirmPending
  │                          │                    │                     │
Buyer                        │                    │                     │
  ├─ confirmRelease() ────────────────────────────────────────────────►│
  │                          │                    │◄── event: Released ─┤
  │                          │                    ├─ status → Released  │
  │                          │                    │   (USDC → expert)   │
```

---

## 7. Security Boundary Summary

| Boundary | Mechanism |
|---|---|
| Single-use link | `usedLinkHashes` onchain, `UNIQUE` constraint offchain |
| Funds custody | Smart contract only, backend has no key to funds |
| Meeting URL privacy | AES encryption at rest, SIWE + participant check at reveal |
| Replay attack (tx) | `processed_transactions.tx_hash UNIQUE` |
| Admin actions | Whitelist wallet check, not sponsored by paymaster |
| Reentrancy | `ReentrancyGuard` on all state-changing methods |
| Time manipulation | All time checks in contract use `block.timestamp` |
| Paymaster abuse | Backend proxy enforces method allowlist before forwarding |

---

## Лист регистрации изменений

| Версия | Дата | Изменения |
|---|---|---|
| 1.0 | 2026-03-25 | Первичный выпуск |
| 1.1 | 2026-04-28 | Исправлена системная диаграмма (Next.js App Router вместо Hono); обновлены модули frontend/backend; расширена DB schema до 10 таблиц; добавлен F-21 (risk_status как отдельная ось) |
