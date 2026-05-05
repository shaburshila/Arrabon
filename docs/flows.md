# Flows — Base Consult Link (ТЗ v1.2)

> Version: 1.2 | Status: Актуален | Based on: ТЗ v1.2 | Date: 2026-05-05
> Изменения v1.1: добавлен §8 Compliance Flows (6 subsections); обновлён §1 (добавлен Compliance Service).
> Изменения v1.2: funding flow переведён на prepare-grant + execute exchange; добавлены stale funding и post-approve compliance notes.
> Составил: Base Consult Link Team | Проверил: — | Утвердил: —

## 1. Акторы

| Актор | Роль |
|---|---|
| Expert | Создаёт ссылку, проводит консультацию, вызывает `markCompleted` |
| Client | Открывает ссылку, оплачивает, подтверждает или открывает dispute |
| Admin | Разрешает dispute через `adminResolveRelease` / `adminResolveRefund`; управляет denylist |
| Anyone | Permissionless вызов `autoRelease` (любой адрес) |
| Backend | Индексирует events, вызывает `autoRelease` для UX (не обязательно) |
| Compliance Service | Проверяет wallet адреса через трёх провайдеров; управляет `risk_status` на уровне сделки |

---

## 2. State Machines

### 2.1 Link

```
         [Expert создаёт]
               │
           ┌───▼───┐
           │ Draft │
           └───┬───┘
               │ Expert публикует
           ┌───▼───┐
           │ Open  │◄──── клиент открывает, wallet connect
           └───┬───┘
      ┌────────┼────────┐
      │        │        │
  expires_at  funding  Expert cancels
  прошёл      ссылки   (offchain)
      │        │        │
  ┌───▼──┐ ┌──▼──────┐ ┌▼─────────┐
  │Expir-│ │Consumed │ │Cancelled │
  │ ed   │ │         │ │          │
  └──────┘ └─────────┘ └──────────┘
```

**Правила:**
- `Draft → Cancelled` — offchain, до публикации
- `Open → Cancelled` — offchain, до funding
- `Open → Expired` — когда `now ≥ expires_at` и deal не создана
- `Open → Consumed` — атомарно при `createAndFundDeal`; onchain `usedLinkHashes[link_hash] = true`
- После `Consumed` / `Expired` / `Cancelled` — ссылка не может перейти в другой статус

### 2.2 Deal

```
  [createAndFundDeal]
          │
      ┌───▼───┐
      │Funded │
      └───┬───┘
     ┌────┴──────────────┐
     │                   │
  markCompleted        openDispute
  (seller, after        (buyer,
  scheduled_at +        no-show)
  duration + grace)     │
     │              ┌───▼────┐
  ┌──▼──────────┐   │Disputed│
  │ConfirmPend- │   └───┬────┘
  │    ing      │  adminResolveRelease │ adminResolveRefund
  └──┬──────────┘       │                    │
     │               ┌──▼──────┐      ┌──────▼──┐
  ┌──┴──────────────►│Released │      │Refunded │
  │                  └─────────┘      └─────────┘
  ├── confirmRelease (buyer, ≤48h)
  ├── autoRelease (anyone, >48h)
  └── openDispute (buyer, ≤48h)
           │
       ┌───▼────┐
       │Disputed│ → adminResolveRelease → Released
       └────────┘ → adminResolveRefund  → Refunded
```

**Правила переходов:**

| От | К | Кто | Условие |
|---|---|---|---|
| — | Funded | Buyer (`createAndFundDeal`) | `link_hash` не использован, `now < expires_at`, сумма в диапазоне $10–$1000 |
| Funded | ConfirmPending | Seller (`markCompleted`) | Deal status is Funded |
| Funded | Disputed | Buyer (`openDispute`) | Консультация не состоялась (no-show) |
| ConfirmPending | Released | Buyer (`confirmRelease`) | Статус ConfirmPending, dispute не открыт |
| ConfirmPending | Released | Anyone (`autoRelease`) | Статус ConfirmPending, нет dispute, `now > completed_at + 48h` |
| ConfirmPending | Disputed | Buyer (`openDispute`) | Статус ConfirmPending, в пределах 48h окна |
| Disputed | Released | Admin (`adminResolveRelease`) | Статус Disputed |
| Disputed | Refunded | Admin (`adminResolveRefund`) | Статус Disputed |

**Терминальные статусы:** Released, Refunded, Cancelled, Expired, Consumed (link)

---

## 3. Happy Path

### 3.1 Полный цикл с подтверждением покупателя

```
Expert                     Client                   Contract / Backend
  │                           │                           │
  │─── создаёт ссылку ────────►│                           │
  │    (title, price, time,    │                           │
  │     meeting_url, expires)  │                           │
  │    link → Open             │                           │
  │                            │                           │
  │◄── получает ссылку ────────│ открывает URL             │
  │                            │ видит: title, price,      │
  │                            │ scheduled_at, duration    │
  │                            │ meeting_url — скрыт       │
  │                            │                           │
  │                            │─── wallet connect ───────►│
  │                            │    Base Account           │
  │                            │                           │
  │                            │─── createAndFundDeal ────►│
  │                            │    (sponsored tx)         │
  │                            │◄── Funded event ──────────│
  │                            │    link → Consumed        │
  │                            │    deal → Funded          │
  │                            │                           │
  │                            │─── GET /meeting-url ─────►│
  │                            │    (SIWE session)         │
  │                            │◄── meeting_url revealed ──│
  │                            │                           │
  │  [консультация проходит]   │                           │
  │                            │                           │
  │─── markCompleted ─────────────────────────────────────►│
  │    (after scheduled_at +   │                           │
  │     duration + grace)      │                           │
  │◄── ConfirmPending event ───────────────────────────────│
  │                            │    deal → ConfirmPending  │
  │                            │                           │
  │                            │─── confirmRelease ───────►│
  │                            │    (≤48h)                 │
  │◄───────────────────────────────── Released event ──────│
  │    funds arrive            │    deal → Released        │
  │    (price - 2% fee)        │                           │
  │                            │    2% → treasury          │
```

**Fee логика:**
- fee_amount = floor(amount × 0.02)
- Fee waiver в v1 отсутствует → fee всегда 2%
- fee snapshot фиксируется в момент `createAndFundDeal`
- treasury получает fee в момент `confirmRelease` / `autoRelease` / `adminResolveRelease`

---

### 3.2 Happy Path — Auto-release (клиент молчит)

```
  ... [после markCompleted → ConfirmPending] ...

  Client молчит 48 часов
        │
  Anyone (или backend) вызывает autoRelease(dealId)
        │
  Contract проверяет:
    ✓ статус == ConfirmPending
    ✓ dispute == false
    ✓ now > ConfirmPending_timestamp + 48h
        │
  deal → Released
  funds → seller (price - fee)
  fee → treasury
```

---

## 4. Unhappy Paths

### 4.1 Ссылка истекла до funding

```
Состояние: link → Open, now ≥ expires_at

Client открывает ссылку:
  → UI показывает: "Ссылка истекла"
  → CTA недоступна
  → link → Expired (offchain обновление)

Client пытается вызвать createAndFundDeal:
  → Contract: revert (expires_at проверяется onchain через scheduled_at, или offchain)
```

**Инвариант:** `expires_at > now`, `expires_at < scheduled_at`

---

### 4.2 Expert отменяет ссылку до funding

```
Состояние: link → Open, deal не создана

Expert вызывает cancel (offchain):
  → link → Cancelled
  → Client открывает ссылку → UI: "Ссылка отменена"
  → createAndFundDeal недоступен (expired/cancelled check на backend)
```

**Ограничение:** отмена только до funding. После `Consumed` отмена невозможна.

---

### 4.3 Попытка повторного funding (same link)

```
Состояние: link → Consumed

Кто угодно пытается createAndFundDeal с тем же link_hash:
  → Contract: usedLinkHashes[link_hash] == true → revert
  → Onchain enforcement, не зависит от backend
```

---

### 4.4 markCompleted сразу после funding

```
Состояние: deal → Funded

Seller вызывает markCompleted:
  → Contract: status = ConfirmPending
  → completed_at = block.timestamp
  → стартует 48h buyer response window
```

---

### 4.5 autoRelease до истечения 48h

```
Состояние: deal → ConfirmPending
Условие: now ≤ markCompleted_timestamp + 48h

Anyone вызывает autoRelease:
  → Contract: revert ("deadline not reached")
  → Deal остаётся ConfirmPending
```

---

### 4.6 autoRelease при открытом dispute

```
Состояние: deal → Disputed

Anyone вызывает autoRelease:
  → Contract: revert ("deal in dispute")
  → Только admin может разрешить
```

---

### 4.7 Доступ к meeting URL — неавторизованные случаи

| Случай | HTTP код | Описание |
|---|---|---|
| Нет SIWE сессии | 401 | Unauthorized |
| Сессия есть, но не участник | 403 | Forbidden |
| Сессия есть, участник, но deal не Funded | 409 | Conflict — deal not funded |
| Сессия есть, участник, deal.status == Refunded | 409 | Intentional — deal was refunded; meeting URL is no longer accessible |

Все попытки логируются на backend.

---

### 4.8 Paymaster недоступен

```
Sponsored tx: createAndFundDeal / markCompleted / confirmRelease / openDispute / autoRelease

Если paymaster недоступен:
  → UI показывает error state
  → Funding / action не продолжается через альтернативный rail в MVP
  → Tx не отправляется
  → Состояние не меняется
```

---

### 4.9 Сумма вне диапазона $10–$1000

```
Expert создаёт ссылку с price < $10 или price > $1000:
  → Валидация на frontend: форма блокирует
  → Если обход: backend rejects при создании ссылки
  → Contract может дополнительно проверять amount
```

---

### 4.10 Транзакция обработана повторно (replay)

```
Backend получает одно и то же событие дважды (tx_hash одинаковый):
  → processed_transactions.tx_hash UNIQUE constraint
  → Второй insert → conflict → ignored
  → State не меняется (идемпотентность)
```

---

## 5. No-show Scenarios

### 5.1 Expert не явился — seller не вызывает markCompleted

```
Состояние: deal → Funded, scheduled_at прошёл

Expert не вызывает markCompleted.
Deal остаётся Funded.

Client ждёт, консультация не произошла.
Client вызывает openDispute(dealId):
  → deal → Disputed
  → Admin получает уведомление (offchain)

Admin рассматривает:
  → adminResolveRefund → deal → Refunded → funds → buyer
  → adminResolveRelease → deal → Released → funds → seller
```

**Примечание:** Deal в статусе Funded может перейти в Disputed (no-show), минуя ConfirmPending.

---

### 5.2 Expert не явился — клиент не открывает dispute

```
Deal остаётся в Funded навсегда (нет авто-эскалации из Funded).
Только ручное действие клиента (openDispute) или admin инициирует разрешение.
```

---

### 5.3 Client не явился на консультацию

```
Expert провёл консультацию, client не появился.
Expert вызывает markCompleted.
deal → ConfirmPending.

Далее:
  a) Client подтверждает → Released (деньги эксперту)
  b) Client открывает dispute → Disputed → Admin решает
  c) Client молчит 48h → autoRelease → Released (деньги эксперту)
```

---

## 6. Dispute Scenarios

### 6.1 Dispute после markCompleted (проблема с услугой)

```
Состояние: deal → ConfirmPending
Срок: в пределах 48h от markCompleted

Client вызывает openDispute(dealId):
  → deal → Disputed
  → autoRelease больше невозможен
  → confirmRelease заблокирован

Admin рассматривает спор.

Сценарий A — в пользу эксперта:
  Admin → adminResolveRelease(dealId)
  → deal → Released
  → funds → seller (price - fee)
  → fee → treasury

Сценарий B — в пользу клиента:
  Admin → adminResolveRefund(dealId)
  → deal → Refunded
  → funds → buyer (полная сумма)
  → fee → treasury = 0
```

---

### 6.2 Попытка открыть dispute после 48h (ConfirmPending истёк)

```
Состояние: deal → Released (autoRelease уже выполнен)

Client пытается openDispute:
  → Contract: revert (статус не ConfirmPending/Funded)
  → Dispute невозможен
```

---

### 6.3 Двойной dispute (повторный вызов openDispute)

```
Состояние: deal → Disputed

Client повторно вызывает openDispute:
  → Contract: revert (статус уже Disputed, не ConfirmPending/Funded)
```

---

### 6.4 Expert пытается вызвать admin-методы

```
Admin whitelist wallet проверяется контрактом.

Expert/Client вызывают adminResolveRelease или adminResolveRefund:
  → Contract: revert (caller not admin)
```

---

## 7. Edge Cases

### 7.1 Нет grace period

```
grace_period_minutes отсутствует в контракте, API payload, backend model и DB schema.
Seller может вызвать markCompleted в любой момент после funding.
```

### 7.2 Граница expires_at

```
Продавец задаёт expires_at вручную.
expires_at должен быть позже now и раньше scheduled_at.
Минимальный разрыв до scheduled_at не применяется.
```

### 7.3 Fee waiver в v1 отсутствует

```
fee_amount = floor(amount × 0.02) (снапшот в момент funding).
Даже для новых experts скидочного периода нет.
Уже funded сделки: fee зафиксирован на момент funding, не меняется.
```

### 7.4 Сумма на границе лимитов

```
price = $10.00 (USDC) → допустимо
price = $9.99 → reject
price = $1000.00 → допустимо
price = $1000.01 → reject
```

### 7.5 Backend недоступен при onchain событии

```
Транзакция confirmed onchain, backend упал.
При восстановлении: replay events с последнего обработанного блока.
processed_transactions.tx_hash UNIQUE → повторная обработка безопасна.
offchain state синхронизируется с onchain.
```

### 7.6 Пользователь открывает ссылку в обычном браузере (не Base App)

```
Приложение работает как standard web app.
Builder Code передаётся через dataSuffix (не auto attribution).
SIWE и wallet connect работают через wagmi.
```

---

## 8. Compliance Flows

Три точки проверки соответствуют трём gate-точкам из ТЗ §24.1. Провайдеры: Chainalysis Sanctions Oracle (on-chain), USDC `isBlacklisted(address)` (on-chain), local `wallet_denylist` (DB). Fail-closed: недоступность любого провайдера → `Blocked / PROVIDER_UNAVAILABLE`.

### 8.1 Блокировка при создании ссылки

**Точка:** `POST /api/links`

```
Expert                       Backend
  │                            │
  │─── POST /api/links ───────►│
  │    (title, price,          │
  │     scheduled_at, ...)     │
  │                            │ screenWallet(seller_wallet)
  │                            │   → Chainalysis oracle
  │                            │   → USDC isBlacklisted
  │                            │   → local wallet_denylist
  │                            │
  │                            ├── [result: Blocked]
  │◄─── 403 COMPLIANCE_BLOCKED ┤
  │     reason_code:           │
  │     OFAC_SANCTIONS /       │
  │     USDC_BLACKLISTED /     │
  │     LOCAL_DENYLIST         │
  │                            │
  │                            ├── [result: Clear]
  │◄─── 201 Created ───────────┤
  │     link created, Open     │
```

**Инвариант:** ссылка не создаётся, если seller wallet заблокирован. `compliance_checks` запись не сохраняется при блокировке на этой точке (сделки ещё нет).

---

### 8.2 Двухшаговый funding grant и блокировка на exchange

**Точки:**
- `POST /api/links/:id/funding/prepare`
- `POST /api/links/:id/funding/execute`

```
Client (buyer)               Backend
  │                            │
  │─── POST /funding/prepare ─►│
  │                            │ link exists?
  │                            │ effective status == Open?
  │                            │ buyer != seller?
  │                            │ no existing deal?
  │                            │
  │◄─── 200 grant_token ───────┤
  │     + approval_amount      │   no calldata yet
  │                            │
  │─── approve USDC onchain ──►│
  │                            │
  │─── POST /funding/execute ─►│
  │    { grant_token }         │ link still Open?
  │                            │ no existing deal?
  │                            │ grant valid for
  │                            │ session wallet + link?
  │                            │
  │                            │ screenWalletsBatch([buyer, seller])
  │                            │   → fresh compliance gate
  │                            │
  │                            ├── [Blocked]
  │◄─── 403 COMPLIANCE_BLOCKED ┤
  │                            │ allowance remains
  │                            │
  │                            ├── [Expired / Cancelled / Consumed]
  │◄─── 410 stale-link error ──┤
  │                            │ grant not consumed early
  │                            │
  │                            ├── [all Clear]
  │                            │ consume grant
  │◄─── 200 calldata ──────────┤
  │     createAndFundDeal      │
```

**Инварианты:**
- `prepare` не возвращает `link_hash` или исполнимый calldata;
- `execute` повторно проверяет link status, existing deal и fresh compliance для buyer/seller;
- grant потребляется только после всех state/compliance checks;
- множественные outstanding funding grants допустимы, но успешно профинансировать ссылку сможет только один buyer path;
- если compliance fail происходит уже после `approve`, allowance остаётся; automatic revoke flow в MVP не вводится.

**Residual risk:** после успешного `funding/execute` и до фактического wallet broadcast остаётся узкое окно stale-state риска; under frozen ABI контракт не умеет валидировать offchain `Cancelled` / `Expired` сам.

---

### 8.3 Post-funding rescreening и legal hold

После подтверждения `Funded` event на блокчейне backend автоматически выполняет повторную проверку:

```
Indexer worker               Backend / Compliance Service
  │                            │
  │  confirmed Funded event    │
  ├───────────────────────────►│
  │                            │ processConfirmedFundedEventOnce()
  │                            │   → insert deal (risk_status = 'Clear' по умолчанию)
  │                            │   → appendFundingSyncAuditLog()
  │                            │
  │                            │ screenWalletsBatch(
  │                            │   [buyerAddress, sellerAddress],
  │                            │   { action: "post_funding_sync", dealId }
  │                            │ )
  │                            │   → persistProviderResults()
  │                            │     (compliance_checks rows)
  │                            │   → recomputeDealRiskStatus(dealId)
  │                            │     (resolves worst-case из всех checks)
  │                            │     → updateRiskStatusById(dealId, newStatus)
  │                            │
  │                            ├── [newStatus: Blocked]
  │                            │   appendBlockedPostFundingAuditLog()
  │                            │   deal.status = Funded (не меняется)
  │                            │   deal.risk_status = Blocked → legal hold
  │                            │
  │                            ├── [newStatus: Clear / Review]
  │                            │   deal.risk_status обновлён
  │                            │   lifecycle продолжается нормально
```

**Инварианты:**
- `deal.status` остаётся `Funded` независимо от результата rescreening;
- `deal.risk_status = Blocked` → legal hold: все payout-path endpoints (`confirmRelease`, `autoRelease`, `adminResolveRelease`, `adminResolveRefund`) возвращают `403 COMPLIANCE_BLOCKED`;
- `risk_status = Blocked` — sticky; автоматический переход обратно в `Clear` запрещён (C-13).

---

### 8.4 Payout blocked (legal hold)

**Точки:**
- `POST /api/deals/:id/release` -> выдача grant
- `POST /api/deals/:id/release/execute` -> exchange grant в calldata
- `POST /api/admin/deals/:id/resolve` -> выдача admin grant
- `POST /api/admin/deals/:id/resolve/execute` -> exchange grant в calldata
- `POST /api/deals/:id/auto-release` -> direct prepare path, без grant

```
User / Admin                  Backend
  │                            │
  │─── POST /release ─────────►│
  │    (или admin resolve)     │
  │                            │ access/state gate only
  │                            │ grant row created (TTL 120s)
  │◄─── 200 grant_token ───────┤
  │                            │
  │─── POST /.../execute ─────►│
  │    { grant_token }         │ issued_to_wallet == session wallet?
  │                            │ grant.deal_id == :id ?
  │                            │ grant used/expired?
  │                            │
  │                            │ assertDealNotBlocked(dealId)
  │                            │   → reads compliance_checks
  │                            │   → any check with result=Blocked?
  │                            │
  │                            ├── [yes: deal.risk_status = Blocked]
  │◄─── 403 COMPLIANCE_BLOCKED ┤   calldata не генерируется
  │                            │
  │                            ├── [no: all Clear / Review]
  │                            │   screenWallet(recipient)
  │                            │   → свежая проверка получателя
  │                            │
  │                            ├── [recipient Blocked]
  │◄─── 403 COMPLIANCE_BLOCKED ┤
  │                            │
  │                            ├── [recipient Clear]
  │◄─── 200 calldata ──────────┤
  │
  │─── POST /auto-release ────►│
  │                            │ direct prepare path
  │                            │ same legal-hold checks
  │◄─── 200 calldata / 403 ────┤
```

**Инварианты:**
- для `confirmRelease` и admin resolve выдача исполнимого calldata перенесена на exchange шаг;
- два уровня gate: (1) `assertDealNotBlocked` проверяет исторические checks сделки; (2) свежая проверка recipient wallet;
- `autoRelease` остаётся direct-prepare path без grant и потому сохраняет отдельный residual risk между prepare и broadcast.

**Residual risk:** grant-flow сужает stale-window для access-controlled payout path до окна между успешным exchange и фактическим wallet broadcast. Для `autoRelease` такого сужения в v1 нет: permissionless liveness важнее полного устранения stale-window.

---

### 8.5 Admin compliance review flow

```
Admin                         Backend                   Frontend
  │                            │                           │
  │  GET /admin/disputes       │                           │
  ├───────────────────────────►│                           │
  │◄── список сделок ──────────┤                           │
  │    с RiskBadge (risk_status│                           │
  │    Clear/Review/Blocked)   │                           │
  │                            │                           │
  │  GET /admin/disputes/[id]  │                           │
  ├───────────────────────────►│                           │
  │◄── deal detail ────────────┤                           │
  │    compliance_checks list  │                           │
  │    legal hold banner       │                           │
  │    (если Blocked)          │                           │
  │                            │                           │
  │  [Blocked → снятие hold]   │                           │
  │  Выполняется вне MVP вручную через backend DB          │
  │  (автоматический путь снятия Blocked отсутствует)      │
  │                            │                           │
  │  [Review → acknowledge]    │                           │
  │  Admin проверяет и         │                           │
  │  подтверждает осведомлённость                         │
  │  → adminResolveRelease /   │                           │
  │    adminResolveRefund      │                           │
  │  (при условии risk_status  │                           │
  │   ≠ Blocked)               │                           │
```

---

### 8.6 Denylist management

**Точки:** `GET /api/admin/denylist`, `POST /api/admin/denylist`, `DELETE /api/admin/denylist/:wallet`

```
Admin                         Backend
  │                            │
  │─── POST /admin/denylist ──►│
  │    { wallet: "0x..." }     │ runtime lowercase normalization
  │                            │ → insert into wallet_denylist
  │◄─── 201 Created ───────────┤
  │                            │
  │─── DELETE /admin/denylist/ │
  │         :wallet ──────────►│
  │                            │ → delete from wallet_denylist
  │◄─── 200 OK ────────────────┤
```

**Инварианты:**
- все wallet адреса нормализуются в lowercase при записи и при сравнении;
- удаление из denylist не влияет на уже существующие `compliance_checks` записи;
- удаление из denylist не меняет автоматически `risk_status` сделок в Blocked — требует ручного действия;
- `wallet_denylist` является server-side source of truth; онchain аналога нет.

---

## Лист регистрации изменений

| Версия | Дата | Изменения |
|---|---|---|
| 1.0 | 2026-03-25 | Первичный выпуск |
| 1.1 | 2026-04-28 | Добавлен §8 Compliance Flows (6 subsections); расширена таблица акторов (Compliance Service) |
