# Decisions — Arrabon

> Version: 1.1 | Status: Актуален | Based on: ТЗ v1.2 | Date: 2026-04-28
> Изменения v1.1: добавлены §3 строки AML (risk_status, legal hold, in-place notice), §3.1 Frozen Compliance Invariants C-06…C-15.
> Составил: Arrabon Team | Проверил: — | Утвердил: —

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
- AML Step 2 models compliance independently from lifecycle state: `deals.risk_status` is a separate axis and does not create any new `deal.status`.
- AML Step 2 puts `risk_status = Blocked` deals into legal hold for all payout-path prepare endpoints.
- AML Step 2 requires frontend to render `403 COMPLIANCE_BLOCKED` as an in-place notice rather than redirecting to the global error page.
- Event sync catch-up persists progress in `deal_event_sync_cursors` (DB cursor, advanced monotonically via `advance_deal_event_sync_cursor` after each successful batch). `CHAIN_SYNC_START_BLOCK` is used only for the initial bootstrap if no cursor row exists. `runDealEventsWorkerForTx(txHash)` does not read or write the global cursor and is fully isolated from catch-up backlog.

## 3.1 Frozen Compliance Invariants

- `C-06` Provider failure for any shipped sanctions gate is fail-closed `Blocked` with `reason_code: PROVIDER_UNAVAILABLE`.
- `C-11` Every payout-path backend prepare endpoint (`confirmRelease`, `autoRelease`, `adminResolveRelease`, `adminResolveRefund`) must include a compliance gate before calldata preparation.
- `C-12` A deal with `risk_status = Blocked` is in legal hold. Backend must not prepare payout-path calldata until a manual legal override happens outside the normal MVP flow.
- `C-13` `risk_status = Blocked` is sticky during normal operation; automatic transition back to `Clear`/`Review` is not allowed.
- `C-14` `PROVIDER_UNAVAILABLE` is never address-cached. Provider protection uses the circuit breaker, not negative cache.
- `C-15` `403 COMPLIANCE_BLOCKED` is a single canonical API shape formed by one backend mapping path and consumed by frontend as a stable contract.
- `C-16` When `risk_status` transitions to `Blocked`, the deal-events indexer automatically calls `setDealPayoutBlocked(dealId, true)` onchain via a dedicated indexer wallet. This closes the compliance race window where a seller could bypass the backend gate by calling `autoRelease` directly on the contract. The indexer wallet is a separate hot wallet added to the contract `admins` list. All `admins` — including the indexer wallet — have onchain access to `adminResolveRelease` and `adminResolveRefund` in addition to `setDealPayoutBlocked`. Dispute resolution in practice is performed only by a human admin through the admin UI; the indexer wallet automation does not call `adminResolve*`.
- `C-17` `fundingAuthorizer` is rotatable via `setFundingAuthorizer(address)` callable by owner (multisig) only. Rotation immediately invalidates all signatures issued by the previous key. This function must be called immediately upon any confirmed or suspected compromise of the backend signing key.
- `C-24` `rescueToken(address token, uint256 amount)` is available to owner only for recovering accidentally sent non-USDC ERC-20 tokens. Calling it with the USDC address reverts — escrow funds are not rescuable through this path.
- `C-23` `deadline < block.timestamp` (not `<=`) in `createAndFundDeal` is intentional: a funding authorization with `deadline == block.timestamp` remains valid. This is specified in CONSULT_ESCROW_SPEC.md and must not be changed.
- `C-25` `autoRelease` is seller-only (`msg.sender == deal.seller`) with no admin fallback from `ConfirmPending` status. If seller loses their private key after calling `markCompleted`, funds remain locked in `ConfirmPending` until seller signs `autoRelease`. This is an accepted MVP trade-off: seller key management is seller's responsibility. `adminResolveRelease/Refund` intentionally require `Disputed` status and do not cover the post-deadline `ConfirmPending` case.
- `C-22` The `Disputed` event does not include a `fromFunded` flag to distinguish the source state (`Funded` vs `ConfirmPending`). Adding it would change the event signature and require updates to ABI, event parsers, and tests. The observability benefit does not justify the regression risk. Accepted as-is.
- `C-21` `duration_minutes` is capped at 1440 (24 hours) across all four layers: contract (`MAX_DURATION_MINUTES = 1440`), backend validator, DB constraint (`duration_minutes <= 1440`), and frontend input. The DB constraint does not duplicate the lower bound (`> 0`) since that is enforced by the contract and backend validator.
- `C-20` `setTreasury` does not require a forced `withdrawTreasuryFees` before execution. The `treasury` address is always controlled by the project owner; changing it transfers accumulated fees to a new address owned by the same party. There is no third-party treasury recipient in this model.
- `C-19` Two-step ownership transfer (`pendingOwner` pattern) is not required. The contract `owner` is a multisig (2-of-3): all signers review the destination address before signing, making accidental mis-transfer practically impossible. One-step `transferOwnership` is accepted as safe for this governance model.
- `C-18` Manual `wallet_denylist` additions do not execute synchronous onchain hold transactions in the admin HTTP path. Instead, the backend enqueues `blocked=true` payout-block requests for all active deals involving that wallet, and a separate indexer sweep applies `setDealPayoutBlocked(dealId, true)` asynchronously. Pending denylist hold requests are idempotent, and concurrent admin adds for the same deal may race safely: the database partial-unique constraint is authoritative and duplicate insert races are treated as benign outcomes rather than admin-facing failures.

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

---

## Лист регистрации изменений

| Версия | Дата | Изменения |
|---|---|---|
| 1.0 | 2026-03-25 | Первичный выпуск |
| 1.1 | 2026-04-28 | Добавлены §3 строки AML (risk_status, legal hold, in-place notice); добавлены Frozen Compliance Invariants C-06…C-15 |
