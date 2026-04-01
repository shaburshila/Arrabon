# Architecture — Base Consult Link

> Version: 1.0 | Based on: ТЗ v1.2 | Date: 2026-03-25

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BASE APP (mobile)                         │
│                   Built-in browser / web app                     │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                        │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │  Link Page  │  │  Deal Page   │  │  Expert Dashboard      │  │
│  │  (public)   │  │  (buyer UX)  │  │  (private, SIWE)       │  │
│  └──────┬──────┘  └──────┬───────┘  └────────────┬───────────┘  │
│         │                │                        │              │
│  ┌──────▼────────────────▼────────────────────────▼───────────┐  │
│  │              wagmi + viem layer                             │  │
│  │   Base Account connect · contract calls · paymaster proxy   │  │
│  └─────────────────────────────┬───────────────────────────────┘  │
└────────────────────────────────┼────────────────────────────────┘
                                 │ RPC / UserOp
          HTTPS API              │
┌─────────────────┐              │
│   BACKEND API   │◄─────────────┘ (paymaster proxy, SIWE, reveal)
│   (Node/Hono)   │
│                 │
│ ┌─────────────┐ │    ┌──────────────────────────────────────┐
│ │  Auth/SIWE  │ │    │          BASE CHAIN (L2)              │
│ │  Service    │ │    │                                       │
│ ├─────────────┤ │    │  ┌─────────────────────────────────┐ │
│ │  Link CRUD  │ │    │  │   ConsultEscrow.sol              │ │
│ │  Service    │◄├────┼──┤   createAndFundDeal()            │ │
│ ├─────────────┤ │    │  │   markCompleted()                │ │
│ │  Deal Sync  │◄├────┼──┤   confirmRelease()               │ │
│ │  (indexer)  │ │    │  │   openDispute()                  │ │
│ ├─────────────┤ │    │  │   autoRelease()                  │ │
│ │  Paymaster  │ │    │  │   adminResolveRelease/Refund()   │ │
│ │  Proxy      ├─┼────┼─►│                                 │ │
│ ├─────────────┤ │    │  └─────────────────────────────────┘ │
│ │  Meeting    │ │    │                                       │
│ │  URL Reveal │ │    │  USDC (ERC-20, Base mainnet)         │
│ ├─────────────┤ │    └──────────────────────────────────────┘
│ │  Analytics  │ │
│ │  Service    │ │    ┌──────────────────────────────────────┐
│ └─────────────┘ │    │  EXTERNAL SERVICES                   │
│                 │    │  · Coinbase Paymaster (sponsored tx)  │
│ ┌─────────────┐ │    │  · Base RPC (Alchemy / public)       │
│ │  PostgreSQL │ │    │  · Base Build / base.dev (Builder)   │
│ └─────────────┘ │    └──────────────────────────────────────┘
└─────────────────┘
```

---

## 2. Module Boundaries

### 2.1 Frontend Modules

| Module | Responsibility | Auth |
|---|---|---|
| `app/link/[id]` | Public link page — отображение слота, CTA оплаты | Public |
| `app/deal/[id]` | Buyer deal view — статус, confirm/dispute | SIWE session |
| `app/dashboard` | Expert view — создание ссылок, список сделок | SIWE session |
| `lib/wagmi` | wagmi config, Base Account connector, chain setup | — |
| `lib/contracts` | Типизированные ABI-обёртки, адреса контрактов | — |
| `lib/paymaster` | UserOp построение, отправка через backend proxy | — |
| `lib/siwe` | SIWE sign/verify utils, session management | — |
| `components/ui` | Переиспользуемые UI-компоненты (mobile-first, 44px touch) | — |

### 2.2 Backend Modules

| Module | Responsibility |
|---|---|
| `server/auth` | Nonce generation, SIWE validation, session cookie |
| `server/links` | CRUD consultation_links, валидация инвариантов времени |
| `server/deals` | Чтение статуса сделок, синхронизация с chain |
| `server/reveal` | Encrypted meeting_url decrypt + access control |
| `server/paymaster` | Proxy к Coinbase Paymaster, allowlist методов |
| `server/indexer` | Event listener, обновление DB после confirmed tx |
| `server/admin` | Whitelist-only endpoints для dispute resolution |
| `server/analytics` | Агрегация метрик из DB |

### 2.3 Smart Contract Module

| Contract | Responsibility |
|---|---|
| `ConsultEscrow.sol` | Полная state machine сделки, хранение средств, fee логика |

### 2.4 Database Schema (ключевые таблицы)

```
consultation_links       deals
──────────────────       ──────────────────────────
id PK                    id PK
expert_address           consultation_link_id UNIQUE FK
title                    onchain_deal_id UNIQUE
description              buyer_address
price_usdc               status (Funded|ConfirmPending|Released|Refunded|Disputed)
scheduled_at (UTC)       funded_at
expires_at (UTC)         completed_at
duration_minutes         released_at
grace_period_minutes     tx_hash
meeting_url_encrypted    created_at
link_hash UNIQUE
status (Draft|Open|Expired|Cancelled|Consumed)
created_at

processed_transactions   audit_log
──────────────────────   ─────────────────
tx_hash UNIQUE PK        id PK (append-only)
event_type               entity_type
deal_id FK               entity_id
processed_at             action
                         actor_address
                         metadata JSONB
                         created_at
```

---

## 3. Onchain / Offchain Split

### Onchain (Base L2 — ConsultEscrow.sol)

| What | Why onchain |
|---|---|
| USDC custody | Trustless escrow, funds never touch backend |
| `link_hash` uniqueness (`usedLinkHashes`) | Onchain enforcement single-use, revert on replay |
| Deal state machine (Funded → ConfirmPending → Released/Refunded/Disputed) | Tamper-proof state transitions |
| `createAndFundDeal` — atomic creation + funding | No split tx race conditions |
| `markCompleted` with time gate | `scheduled_at + duration + grace` enforced in contract |
| `autoRelease` — permissionless | Any caller, contract checks deadline; backend не обязателен |
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
| Auto-release trigger (UX helper) | Permissionless на chain; backend вызывает для UX, не обязателен |
| Admin whitelist | Env var / DB, не onchain в MVP |

### Sync Boundary

```
Chain events (confirmed)
        │
        ▼
   server/indexer
        │
        ├── updates deals.status
        ├── inserts processed_transactions (tx_hash UNIQUE)
        └── appends audit_log

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
| F-07 | **Fee = 2%, фиксируется при funding**, отправляется сразу на treasury | Нет post-hoc fee; snapshot в момент создания сделки |
| F-08 | **Fee waiver = 14 дней** — логика в контракте | Onchain, не конфигурируется через backend |
| F-09 | **`autoRelease` permissionless** — любой может вызвать | Decentralized UX fallback; backend вызывает как helper, не owner |
| F-10 | **Dispute window = 48 часов** | Фиксировано в ТЗ; не конфигурируется per-deal в MVP |
| F-11 | **Paymaster через backend proxy** с allowlist методов | Безопасность: нельзя спонсировать произвольные вызовы |
| F-12 | **Admin = whitelist wallet**, без onchain role contract | MVP-simple; достаточно для manual dispute resolution |
| F-13 | **Offchain cancel до funding** — нет onchain cancel | Зафиндированная сделка отменяется только через dispute |
| F-14 | **Base Pay не используется** в MVP как payment rail | ТЗ явно исключает |
| F-15 | **`deals.consultation_link_id UNIQUE`** — одна ссылка = одна сделка в DB | Дублирует onchain `link_hash`; двойная защита |
| F-16 | **`processed_transactions.tx_hash UNIQUE`** — идемпотентный indexer | Повторная обработка события не меняет state |
| F-17 | **Все timestamps в UTC** | Единственный формат хранения; timezone — display only |
| F-18 | **`markCompleted` доступен только после `scheduled_at + duration + grace_period`** | Time gate enforced onchain |
| F-19 | **Лимиты сделки $10–$1000 USDC** | Enforced в контракте при `createAndFundDeal` |
| F-20 | **mobile-first, Base App built-in browser** — primary target | Все UI решения принимаются с этим ограничением |

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
