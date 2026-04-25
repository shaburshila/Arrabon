# Decisions — Base Consult Link

> Version: 1.0 | Based on: ТЗ v1.2 | Date: 2026-03-25

---

## 1. Purpose

Этот документ фиксирует решения, которые считаются замороженными для MVP и не могут быть изменены implementation-агентами без отдельного согласования.

---

## 2. Frozen Product Decisions

- Product scope: одна scheduled consultation по single-use ссылке
- Payment rail: USDC escrow на Base через smart contract
- Funding model: только `createAndFundDeal`, без split flows
- Link model: одна ссылка = одна сделка
- Reveal model: `meeting_url` раскрывается только после funding
- Dispute model: manual admin resolution
- Primary environment: mobile-first web app inside Base App

---

## 3. Frozen Architecture Decisions

- Один escrow контракт `ConsultEscrow.sol`
- Chain is source of truth for deal state
- Backend is source of truth for metadata и encrypted `meeting_url`
- SIWE является единственной backend auth model
- Coinbase Paymaster используется только через backend proxy allowlist
- Base Pay не используется как основной payment rail
- Все timestamps хранятся в UTC
- Identity invariant for `consultation_links`: `users.wallet` must match `consultation_links.expert_address` for the owning creator record
- Approved Sprint 2 Phase 2 funding ABI excludes `fee_snapshot`; backend prepares no fee-provider input, and fee behavior is treated as autonomous contract logic for the current integration boundary
- Meeting URL reveal uses fail-closed audit logging. If audit-log write fails, the reveal endpoint must not return `meeting_url`. This intentionally couples reveal availability to audit-log availability and is accepted as an MVP operational trade-off.
- If a confirmed `Funded` event arrives after the offchain link has already become effectively terminal (`Cancelled` or time-expired `Open`), backend still persists the confirmed deal because chain remains source of truth for deal state. In that convergence path backend does not force the link record into `Consumed`; this is an intentional MVP deviation from the simpler `funded => Consumed` summary rule.
- Meeting URL reveal remains unavailable for `Refunded` deals even to participants. This behavior is frozen by `auth-model.md` and `flows.md`; any broader wording elsewhere must not be interpreted as allowing reveal after refund.
- AML Step 2 uses exactly three MVP screening providers: Chainalysis sanctions oracle, USDC `isBlacklisted(address)`, and local `wallet_denylist`.
- AML Step 2 treats provider/network failures as fail-closed `Blocked` with `PROVIDER_UNAVAILABLE`; sanctions providers do not return `Review`.
- AML Step 2 uses positive-only cache with a fixed 5-minute TTL for `Clear` and real hit results; `PROVIDER_UNAVAILABLE` is never cached.
- AML Step 2 resolves multiple real hits with deterministic priority `OFAC_SANCTIONS > USDC_BLACKLISTED > LOCAL_DENYLIST`.
- AML Step 2 introduces `wallet_denylist` as a Step 2 server-side source of truth; runtime lowercase normalization is required at provider boundaries until `deals.*_address` gets DB-level enforcement in a later step.

---

## 4. Agent Workflow Rule

Каждый агент перед любым кодом обязан выдать:

1. `Plan`
2. `Interfaces`
3. `Risks`

Только после явного согласования этих трёх блоков агент может переходить к коду.

Минимальный формат:

### Plan

- что именно агент делает в своей зоне ответственности;
- какие файлы/модули затрагивает;
- что считается done.

### Interfaces

- какие входы агент принимает;
- какие выходы публикует;
- какие контракты с соседними модулями использует;
- какие структуры/endpoint'ы/ABI считаются замороженными.

### Risks

- архитектурные расхождения;
- неоднозначности ТЗ;
- риски безопасности;
- риски scope creep.

---

## 5. What Agents Must Not Do

Агентам запрещено:

- менять scope продукта;
- добавлять “полезные” фичи вне ТЗ;
- менять state machine без согласования;
- менять auth model;
- менять funding model;
- смешивать Base Pay и contract-native escrow;
- превращать single-use link в multi-use;
- добавлять новые роли и actor types;
- менять dispute window;
- придумывать новые onchain/offchain переходы статусов.

---

## 6. Stage Gate

Этап 1 считается завершённым только если готовы и согласованы:

- `architecture.md`
- `decisions.md`
- `auth-model.md`
- `state-machine.md`
- `threat-model.md`
- `api-contract.md`
- `flows.md`
- `qa-scenarios.md`

Пока любой из этих документов отсутствует или пустой, implementation agents не должны писать код.
