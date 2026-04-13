# State Machine — Base Consult Link

> Version: 1.0 | Based on: ТЗ v1.2 | Date: 2026-03-25

---

## 1. Scope

Документ фиксирует единственную допустимую state machine MVP для:

- `consultation_link`
- `deal`

Это замороженный контракт между Product, Contract, Backend, Frontend и QA.

---

## 2. Link State Machine

### States

- `Draft`
- `Open`
- `Expired`
- `Cancelled`
- `Consumed`

### Transitions

| From | To | Trigger | Owner | Enforcement |
|---|---|---|---|---|
| — | Draft | expert creates draft link | Backend | Offchain |
| Draft | Open | expert publishes link | Backend | Offchain |
| Draft | Cancelled | expert cancels before publish | Backend | Offchain |
| Open | Cancelled | expert cancels before funding | Backend | Offchain |
| Open | Expired | `now >= expires_at`, no funding happened | Backend/UI sync | Offchain |
| Open | Consumed | successful `createAndFundDeal` | Contract + indexer | Onchain source of truth |

### Terminal states

- `Expired`
- `Cancelled`
- `Consumed`

### Invariants

- одна ссылка может быть профинансирована только один раз;
- после `Consumed` ссылка больше не меняет статус;
- после `Expired` или `Cancelled` funding недоступен;
- `Open -> Consumed` происходит только через успешный onchain funding.

---

## 3. Deal State Machine

### States

- `Funded`
- `ConfirmPending`
- `Released`
- `Refunded`
- `Disputed`

### Transitions

| From | To | Trigger | Caller | Gate |
|---|---|---|---|---|
| — | Funded | `createAndFundDeal` | Buyer | valid link, valid amount, link unused |
| Funded | ConfirmPending | `markCompleted` | Seller | `now >= scheduled_at + duration + grace` |
| Funded | Disputed | `openDispute` | Buyer | no-show or service issue before completion |
| ConfirmPending | Released | `confirmRelease` | Buyer | within dispute window |
| ConfirmPending | Released | `autoRelease` | Anyone | `now > completed_at + 48h`, no dispute |
| ConfirmPending | Disputed | `openDispute` | Buyer | `now <= completed_at + 48h` |
| Disputed | Released | `adminResolveRelease` | Admin | admin allowlist |
| Disputed | Refunded | `adminResolveRefund` | Admin | admin allowlist |

### Terminal states

- `Released`
- `Refunded`

### Invariants

- `Released` и `Refunded` взаимоисключающие терминальные исходы;
- `Disputed` невозможен после `Released` или `Refunded`;
- `autoRelease` невозможен из `Funded`;
- `markCompleted` невозможен из любого статуса кроме `Funded`;
- `confirmRelease` невозможен из любого статуса кроме `ConfirmPending`.

---

## 4. Time Model

Все временные проверки используют UTC и `block.timestamp` на контрактной стороне.

### Link invariants

- `scheduled_at > now`
- `expires_at < scheduled_at`
- `scheduled_at - expires_at >= 5 minutes`
- `duration_minutes > 0`
- `grace_period_minutes >= 0`

### Deal windows

- `markCompleted` доступен после:
  - `scheduled_at + duration + grace_period`
- dispute/confirm окно после completion:
  - `48 hours`
- `autoRelease` доступен только после завершения dispute window

---

## 5. Funding Model Constraints

С state machine совместим только один funding path:

- `approve USDC`
- `createAndFundDeal(...)`

Запрещено в MVP:

- `createDeal + fundDeal`
- split funding steps
- Base Pay как замена escrow funding rail
- partial funding
- top-ups

---

## 6. Offchain / Onchain Ownership

| Concern | Source of truth |
|---|---|
| `link_hash` single-use | Contract |
| funds custody | Contract |
| deal status | Contract events, indexed offchain |
| link metadata | Backend DB |
| pre-funding link lifecycle | Backend DB |

Backend не имеет права придумывать новые deal transitions, которых нет в контракте.

---

## 7. Forbidden Changes

Без отдельного согласования нельзя:

- добавлять новые deal statuses;
- добавлять новые link statuses;
- менять dispute window;
- разрешать auto-release из `Funded`;
- разрешать multi-use links;
- менять funding на Base Pay;
- переносить reveal `meeting_url` до funding.

---

## 8. Risks

| Risk | Description | Mitigation |
|---|---|---|
| Drift between docs and contract | Backend/UI реализуют переходы, которых нет onchain | This document is freeze source for all agents |
| Time-window ambiguity | Разные трактовки `48h` и момента completion | Completion timestamp fixed by contract event |
| Link/deal desync | Offchain status обновлён без подтверждённого tx | Indexer writes after confirmed event only |
| Scope creep | Появляются новые промежуточные статусы | Forbidden changes list blocks expansion |
