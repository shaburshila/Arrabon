# Threat Model — Base Consult Link

> Version: 1.0 | Based on: ТЗ v1.2 | Date: 2026-03-25

---

## 1. Security Goals

MVP должен гарантировать:

- funds custody только в контракте;
- single-use ссылку нельзя переиспользовать;
- `meeting_url` не раскрывается до funding и не раскрывается посторонним;
- backend replay-safe при обработке chain events;
- paymaster нельзя использовать для произвольных вызовов;
- auth model не подменяет contract permissions.

---

## 2. Assets

Критичные активы:

- USDC в escrow
- `meeting_url`
- SIWE sessions
- admin allowlist
- `link_hash`
- chain event processing state

---

## 3. Trust Boundaries

| Boundary | Threat |
|---|---|
| Client ↔ Backend | spoofed session, unauthorized reads |
| Frontend ↔ Contract | wrong calldata, wrong chain, replay assumptions |
| Backend ↔ Paymaster | sponsorship abuse |
| Backend ↔ Database | unauthorized reveal or broken idempotency |
| Chain ↔ Indexer | duplicate event processing, reorg handling |

---

## 4. Main Threats

### T-01 Reuse of single-use link

- Attack: повторный funding того же `link_hash`
- Impact: одна ссылка создаёт несколько сделок
- Mitigation:
  - `usedLinkHashes[link_hash]` onchain
  - DB uniqueness on `consultation_link_id`

### T-02 Unauthorized reveal of `meeting_url`

- Attack: любой авторизованный пользователь запрашивает URL чужой сделки
- Impact: компрометация приватной встречи
- Mitigation:
  - SIWE session required
  - participant check: only buyer or seller
  - reveal only after funded deal exists
  - audit log for each reveal attempt

### T-03 Replay of backend chain processing

- Attack: один и тот же tx/event обрабатывается многократно
- Impact: дублированные side effects и неконсистентный state
- Mitigation:
  - `processed_transactions.tx_hash UNIQUE`
  - replay-safe handlers
  - append-only audit log

### T-04 Paymaster abuse

- Attack: прокси спонсирует произвольные contract calls
- Impact: утечка sponsored budget, опасные вызовы
- Mitigation:
  - strict allowlist methods only
  - admin methods not sponsored
  - reject unsupported calldata

### T-05 SIWE replay / session abuse

- Attack: повторное использование nonce или украденной сессии
- Impact: несанкционированный доступ к приватным endpoints
- Mitigation:
  - single-use nonce
  - short session TTL
  - `HttpOnly` + `Secure` cookie

### T-06 Scope drift into unsafe payment model

- Attack class: агенты смешивают Base Pay и contract-native escrow
- Impact: две conflicting money flows и потеря инвариантов
- Mitigation:
  - frozen decision: only contract-native escrow funding
  - forbidden-changes rules for all implementation agents

### T-07 Incorrect admin access

- Attack: обычный user вызывает admin endpoints или admin contract methods
- Impact: несанкционированный release/refund
- Mitigation:
  - backend allowlist on every admin route
  - contract allowlist on admin methods
  - admin tx not sponsored

---

## 5. Must-Fix Before Coding

- Зафиксировать auth model и private endpoint rules
- Зафиксировать API contract для reveal, create link, cancel link, admin actions
- Явно задокументировать разрешённые paymaster methods
- Запретить любые product changes без архитектурного согласования

---

## 6. Must-Fix Before Mainnet

- Провести review solidity contract на reentrancy, authorization, fee accounting, timestamp gates
- Проверить шифрование `meeting_url` и rotation strategy для secret material
- Проверить reorg strategy indexer-а
- Добавить rate limiting для auth and reveal routes
- Добавить structured security logging and alerting

---

## 7. Residual Risks Accepted in MVP

| Risk | Why accepted |
|---|---|
| Manual admin dispute resolution | MVP deliberately avoids full arbitration system |
| Backend stores encrypted meeting URL | Privacy acceptable for MVP with encryption at rest |
| Backend helper can call autoRelease for UX | Not trusted for correctness; chain remains source of truth |

---

## 8. Interfaces Security Depends On

Security assumptions опираются на неизменность следующих интерфейсов:

- `createAndFundDeal(link_hash, seller, buyer, amount, scheduled_at, duration_minutes, grace_period_minutes)`
- `markCompleted(dealId)`
- `confirmRelease(dealId)`
- `openDispute(dealId)`
- `autoRelease(dealId)`
- `adminResolveRelease(dealId)`
- `adminResolveRefund(dealId)`
- `GET /api/deals/:id/meeting-url`
- `POST /api/auth/siwe/verify`

Если эти интерфейсы меняются, threat model должен быть пересмотрен.
