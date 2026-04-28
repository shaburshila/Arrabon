# State Machine — Base Consult Link

> Version: 1.2 | Status: Актуален | Based on: ТЗ v1.2 | Date: 2026-04-28
> Изменения v1.2: добавлено примечание к §9.1 и §9.4 — Review недостижим в текущем MVP через shipped провайдеры.
> Изменения v1.1: добавлен §9 Risk Status State Machine (deals.risk_status как отдельная ось).
> Составил: Base Consult Link Team | Проверил: — | Утвердил: —

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
| Funded | ConfirmPending | `markCompleted` | Seller | deal is Funded |
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
- `expires_at > now`
- `duration_minutes > 0`

### Deal windows

- `markCompleted` доступен продавцу сразу после funding
- `completed_at` выставляется onchain в момент `markCompleted`
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

---

## 9. Risk Status State Machine

`deals.risk_status` — отдельная ось, независимая от `deal.status`. Управляется Compliance Service. Не создаёт новых lifecycle-статусов сделки.

### 9.1 States

- `Clear` — все проверки пройдены; payout-path доступен
- `Review` — минимум один provider вернул suspicious result; payout-path доступен с acknowledgement. **Примечание:** три shipped MVP-провайдера (Chainalysis oracle, USDC blacklist, local denylist) возвращают только `Clear` или `Blocked`; `Review` в текущем MVP не достигается в нормальном flow. Состояние зарезервировано в типах для будущих провайдеров (например, Chainabuse).
- `Blocked` — минимум одна активная sanctions hit; legal hold на все payout-path endpoints

Значение по умолчанию: `Clear` (при создании записи о сделке).

### 9.2 Transitions

```
           [deal создаётся]
                 │
            [Clear] ◄────── умолчание при insert
                 │
     post-funding rescreening
                 │
        ┌────────┼────────────────────┐
        │        │                    │
      [Clear] [Review]           [Blocked]
                 │                    │
        rescreen / new check   sticky: автоматический
                 │             возврат запрещён
              [Clear]          (только manual override
                               вне MVP)
```

| From | To | Trigger | Owner |
|---|---|---|---|
| — | Clear | deal insert | Compliance Service (default) |
| Clear | Clear | rescreening → все Clear | Compliance Service |
| Clear | Review | rescreening → минимум один Review | Compliance Service |
| Clear | Blocked | rescreening → минимум один Blocked | Compliance Service |
| Review | Clear | повторная проверка → все Clear | Compliance Service |
| Review | Blocked | повторная проверка → минимум один Blocked | Compliance Service |
| Blocked | Clear / Review | **запрещено автоматически**; только ручное DB-override вне MVP | — |

### 9.3 Invariants

- `risk_status` изменяется только Compliance Service через `recomputeDealRiskStatus`;
- `risk_status = Blocked` — sticky; `resolveRiskStatusFromChecks` выбирает worst-case из всех исторических `compliance_checks` записей для сделки;
- `risk_status` не влияет на переходы `deal.status`; `deal.status` не влияет на `risk_status`;
- все payout-path prepare endpoints вызывают `assertDealNotBlocked(dealId)` до генерации calldata;
- `assertDealNotBlocked` читает `compliance_checks` напрямую, не полагается на кешированное поле `risk_status`.

### 9.4 Отношение к deal.status

| deal.status | risk_status | Интерпретация |
|---|---|---|
| Funded | Clear | Нормальный путь; payout-path доступен после transition |
| Funded | Review | Подозрительный адрес; admin должен рассмотреть перед resolve. В текущем MVP не достигается shipped провайдерами. |
| Funded | Blocked | Legal hold; payout заморожен до ручного override |
| ConfirmPending | Blocked | Legal hold сохраняется; `confirmRelease` / `autoRelease` → 403 |
| Disputed | Blocked | Legal hold сохраняется; `adminResolveRelease` / `adminResolveRefund` → 403 |
| Released / Refunded | Blocked | Payout уже совершён; `risk_status` сохраняет последнее значение для audit trail |

Любая комбинация `deal.status × risk_status` технически возможна. Таблица выше описывает практически значимые случаи.

---

## Лист регистрации изменений

| Версия | Дата | Изменения |
|---|---|---|
| 1.0 | 2026-03-25 | Первичный выпуск |
| 1.1 | 2026-04-28 | Добавлен §9 Risk Status State Machine (states, transitions, invariants, матрица deal.status × risk_status) |
| 1.2 | 2026-04-28 | §9.1 и §9.4: Review помечен как недостижимый в MVP через shipped провайдеры |
