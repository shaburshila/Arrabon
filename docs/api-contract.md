# API Contract — Base Consult Link

> Version: 1.3 | Status: Актуален | Based on: ТЗ v1.2 | Date: 2026-05-05
> Изменения v1.2: удалён ошибочный блок "Compliance errors" из GET /api/links/:id (GET не запускает compliance checks).
> Изменения v1.1: GET /api/deals/:id перенесён в приватные endpoints (требует SIWE); добавлен §9 Operational & Internal Endpoints.
> Изменения v1.3: funding flow переведён на двухшаговый grant/exchange; `POST /api/links/:id/funding/prepare` больше не возвращает calldata или `link_hash`; добавлен `POST /api/links/:id/funding/execute`.
> Составил: Base Consult Link Team | Проверил: — | Утвердил: —

---

## 1. Rules

- Protocol: HTTPS + JSON
- Private endpoints require SIWE session cookie
- Chain is source of truth for deal state
- Backend is source of truth for link metadata and encrypted `meeting_url`
- Backend validates business rules but does not replace contract enforcement
- Ограничение на funding endpoints в текущей фазе ослаблено: замороженный onchain flow по-прежнему использует `createAndFundDeal`, но backend API теперь выдаёт short-lived funding grant на `prepare` и возвращает финальный calldata только на `execute`

### Canonical Compliance Error

Compliance-gated endpoints return a single canonical blocked shape:

```json
{
  "code": "COMPLIANCE_BLOCKED",
  "error": "Wallet blocked by compliance screening.",
  "reason_code": "LOCAL_DENYLIST",
  "wallet_address": "0xabc..."
}
```

Rules:

- HTTP status is always `403`
- `reason_code` may be `OFAC_SANCTIONS`, `USDC_BLACKLISTED`, `LOCAL_DENYLIST`, or `PROVIDER_UNAVAILABLE`
- `wallet_address` is normalized lowercase
- frontend handles this in-place and must not redirect to a fatal error page

---

## 2. Public Endpoints

Только два endpoint'а не требуют SIWE-сессии.

### `GET /api/links/:id`

Returns public link metadata for funding screen.

Response:

```json
{
  "id": "link_123",
  "deal_id": null,
  "title": "Consultation",
  "description": "30-minute consult",
  "price_usdc": "100.00",
  "scheduled_at": "2026-03-28T12:00:00Z",
  "timezone": "Europe/Berlin",
  "duration_minutes": 30,
  "expires_at": "2026-03-28T11:30:00Z",
  "status": "Open",
  "seller_address": "0xabc...",
  "meeting_url_revealed": false
}
```

Notes:

- `deal_id` is navigation support only.
- `deal_id = null` before the linked deal exists or before indexing has materialized it.
- `deal_id` becomes the backend deal UUID once the linked deal exists.
- This endpoint may return `status: "Consumed"` as a successful `200` response so the client can discover `deal_id` after funding/indexing.
- `meeting_url_revealed` remains `false` for this endpoint and should not be interpreted as a funding-state signal.

Errors:

- `404` link not found
- `410` link expired/cancelled

---

## 3. Auth Endpoints

### `POST /api/auth/siwe/nonce`

Response:

```json
{
  "nonce": "random_nonce",
  "issued_at": "2026-03-25T18:00:00Z"
}
```

### `POST /api/auth/siwe/verify`

Request:

```json
{
  "message": "SIWE message",
  "signature": "0x..."
}
```

Response:

```json
{
  "ok": true,
  "wallet_address": "0xabc...",
  "is_admin": false,
  "expires_at": "2026-03-25T20:00:00Z"
}
```

Side effect: sets `HttpOnly` session cookie.

### `POST /api/auth/logout`

Response:

```json
{
  "ok": true
}
```

Errors:

- `500` `LOGOUT_LOOKUP_FAILED`
- `500` `LOGOUT_REVOKE_FAILED`

Notes:

- `200 { ok: true }` means either no active server-side session existed or session revoke was confirmed.
- On lookup/revoke failure the route returns `500` and does not clear the session cookie.

---

## 4. Expert Endpoints

### `POST /api/links`

Creates a consultation link draft/open record and stores encrypted `meeting_url`.

Request:

```json
{
  "title": "Consultation",
  "description": "30-minute consult",
  "price_usdc": "100.00",
  "scheduled_at": "2026-03-28T12:00:00Z",
  "timezone": "Europe/Berlin",
  "duration_minutes": 30,
  "expires_at": "2026-03-28T11:30:00Z",
  "meeting_url": "https://meet.example/room"
}
```

Response:

```json
{
  "id": "link_123",
  "status": "Open",
  "link_hash": "0xlinkhash",
  "share_url": "/link/link_123"
}
```

Validation:

- `scheduled_at > now`
- `expires_at < scheduled_at`
- `expires_at > now`
- `10 <= price_usdc <= 1000`
- `duration_minutes > 0`

Notes:

- `expires_at` is selected by the seller and must be before `scheduled_at`.

### `GET /api/links`

Returns consultation links owned by the authenticated seller.

Behavior:

- requires SIWE session
- returns newest links first by `consultation_links.created_at desc`
- supports pagination via `limit` and `offset`
- supports `filter` query param with values:
  - `all`
  - `available`
  - `upcoming`
  - `awaiting_buyer`
  - `disputed`
  - `closed`
  - `inactive`
- if `filter` is omitted, backend defaults to `all`
- filtering is applied before pagination

Response:

```json
[
  {
    "id": "link_123",
    "deal_id": null,
    "deal_status": null,
    "deal_resolution_type": null,
    "deal_resolved_at": null,
    "deal_resolved_from_status": null,
    "title": "Consultation",
    "description": "30-minute consult",
    "price_usdc": "100.00",
    "scheduled_at": "2026-03-28T12:00:00Z",
    "timezone": "Europe/Berlin",
    "duration_minutes": 30,
    "expires_at": "2026-03-28T11:30:00Z",
    "status": "Open",
    "share_url": "/link/link_123"
  }
]
```

### `POST /api/links/:id/cancel`

Cancels a link before funding.

Response:

```json
{
  "ok": true,
  "status": "Cancelled"
}
```

Errors:

- `403` not owner
- `409` already funded / consumed

### `POST /api/links/:id/funding/prepare`

Requires SIWE session and returns a short-lived funding grant plus UI metadata for the authenticated buyer wallet. This step does not return executable calldata.

Request:

```json
{}
```

Response:

```json
{
  "consultation_link_id": "link_123",
  "grant_token": "4d6c7e...64 hex chars...",
  "expires_at": "2026-03-28T11:25:00Z",
  "approval_amount": "100000000",
  "buyer_address": "0xbuyer...",
  "contract_address": "0xcontract...",
  "seller_address": "0xseller...",
  "schedule": {
    "scheduled_at": "2026-03-28T12:00:00Z",
    "duration_minutes": 30
  }
}
```

Errors:

- `400` invalid `:id` UUID
- `401` no SIWE session
- `403` buyer wallet matches seller wallet
- `404` link not found
- `409` deal already exists for this link
- `410` link expired / cancelled / consumed
- `500` failed to issue funding authorization

Notes:

- Grant TTL is currently `300s` to cover approve-signature + approve-confirmation on mobile/Base App flows.
- `approval_amount` is safe to return early because `price_usdc` is immutable after link creation.
- `link_hash` no longer appears in the client-facing funding prepare response.

### `POST /api/links/:id/funding/execute`

Requires SIWE session and exchanges a valid funding grant for final opaque `createAndFundDeal` calldata.

Request:

```json
{
  "grant_token": "4d6c7e...64 hex chars..."
}
```

Response:

```json
{
  "consultation_link_id": "link_123",
  "contract_call": {
    "chain_id": 8453,
    "contract_address": "0xcontract...",
    "function_name": "createAndFundDeal",
    "data": "0xpreparedcall..."
  }
}
```

Errors:

- `400` invalid `:id` UUID
- `400` invalid JSON body / invalid `grant_token`
- `401` no SIWE session
- `403` buyer wallet matches seller wallet
- `403` `COMPLIANCE_BLOCKED`
- `404` link not found
- `409` funding authorization invalid, expired, already used, or issued for another wallet / link
- `409` deal already exists for this link
- `410` `LINK_EXPIRED`
- `410` `LINK_CANCELLED`
- `410` `LINK_CONSUMED`
- `500` contract config unavailable / calldata preparation failed

Notes:

- Exchange re-checks link status, existing deal, buyer/seller distinction, and fresh compliance for both wallets before consuming the grant.
- Grant consumption happens after state/compliance checks and before returning calldata.
- `contract_address` is returned on the grant step so the frontend uses the same backend-owned escrow address for USDC `approve`.
- Residual risk remains between successful exchange and wallet broadcast; under the frozen ABI the contract still cannot validate offchain cancel/expiry on its own.
- Rare failure case: if grant consumption succeeds but calldata generation returns `500`, the user must restart from `prepare`; repeating `approve` is usually unnecessary if allowance remains.

---

## 5. Deal Private Endpoints

### `GET /api/deals/:id`

Returns deal read model. Requires SIWE session. Accessible to deal participants (buyer or seller) and admins.

Terminal deals keep `status` as `Released` or `Refunded`. Resolution metadata describes how that terminal state was reached: `buyer_confirmed`, `auto_release`, `admin_release`, `admin_refund`.

Response:

```json
{
  "id": "deal_123",
  "consultation_link_id": "link_123",
  "onchain_deal_id": "17",
  "status": "Funded",
  "buyer_address": "0xbuyer...",
  "seller_address": "0xseller...",
  "price_usdc": "100.00",
  "scheduled_at": "2026-03-28T12:00:00Z",
  "completed_at": null,
  "release_deadline_at": null,
  "resolution_type": null,
  "resolved_at": null,
  "resolved_by_wallet": null,
  "resolved_from_status": null,
  "tx_hash": "0xhash"
}
```

Errors:

- `401` no SIWE session
- `403` session wallet is not buyer, seller, or admin
- `404` deal not found

### `GET /api/me/deals`

Returns deals where the authenticated wallet is the buyer. This endpoint is the buyer recovery path after a paid consultation page is closed or the `/deal/:id` URL is lost.

Behavior:

- requires SIWE session
- uses `currentUser.wallet_address` as `buyer_address`
- returns newest deals first by `deals.created_at desc`
- returns only buyer deals; seller recovery remains `/my-links`
- supports pagination via `limit` and `offset`
- supports `filter` query param with values:
  - `all`
  - `upcoming`
  - `needs_action`
  - `disputed`
  - `resolved`
- if `filter` is omitted, backend defaults to `all`
- filtering is applied before pagination

Response:

```json
[
  {
    "id": "deal_123",
    "consultation_link_id": "link_123",
    "onchain_deal_id": "17",
    "title": "Consultation",
    "description": "30-minute consult",
    "price_usdc": "100.00",
    "scheduled_at": "2026-03-28T12:00:00Z",
    "timezone": "Europe/Berlin",
    "duration_minutes": 30,
    "buyer_address": "0xbuyer...",
    "seller_address": "0xseller...",
    "status": "Funded",
    "resolution_type": null,
    "resolved_at": null,
    "resolved_from_status": null,
    "completed_at": null,
    "released_at": null,
    "tx_hash": "0xhash",
    "created_at": "2026-03-25T18:00:00Z"
  }
]
```

Errors:

- `401` no SIWE session
- `500` failed to load deals
- `500` consultation link missing for a deal

### `GET /api/deals/:id/meeting-url`

Returns decrypted meeting URL only to deal participants after funding.

Response:

```json
{
  "meeting_url": "https://meet.example/room"
}
```

Errors:

- `401` no SIWE session
- `403` session wallet is not buyer or seller
- `404` deal not found
- `409` deal not funded yet

---

## 6. Deal Completion Endpoints

Lifecycle endpoints split into two categories:

- direct prepare endpoints that immediately return opaque backend-produced `contract_call`
- two-step payout endpoints that first return a short-lived execution grant and only then exchange it for final calldata

No deal state is written by the backend during either step. Final state transitions are driven exclusively by confirmed onchain events via the indexer.

Request body: empty `{}` or omitted for all lifecycle endpoints.

Response shape for direct prepare endpoints (on success):

```json
{
  "deal_id": "deal_123",
  "contract_call": {
    "chain_id": 8453,
    "contract_address": "0xcontract...",
    "function_name": "<markCompleted|confirmRelease|openDispute|autoRelease>",
    "data": "0xpreparedcall..."
  }
}
```

### `POST /api/deals/:id/complete`

Prepares a `markCompleted` call. Callable by the seller while the deal is `Funded`.

`markCompleted` records `completed_at` onchain and starts the 48-hour buyer response window.

Errors:

- `400` invalid UUID `:id`
- `401` no SIWE session
- `403` session wallet is not the deal seller
- `409` deal not in `Funded` state
- `409` completion time not yet reached
- `500` deal timing data invalid (integrity error)
- `500` contract config unavailable

### `POST /api/deals/:id/release`

Issues a short-lived execution grant for `confirmRelease`. Callable only by the buyer while the deal is in `ConfirmPending` and the 48-hour dispute window has not yet passed.

Grant response:

```json
{
  "action": "confirmRelease",
  "deal_id": "deal_123",
  "expires_at": "2026-05-05T12:00:00.000Z",
  "grant_token": "0123abcd..."
}
```

The buyer window is inclusive at the exact deadline (`now == deadline` is allowed). Auto-release becomes valid only strictly after the deadline passes.

Notes:

- grant TTL is currently `120s`
- this grant step intentionally performs access/state checks only
- compliance gate happens on the exchange step below

### `POST /api/deals/:id/release/execute`

Exchanges a previously issued release grant for final opaque `confirmRelease` calldata.

Request:

```json
{
  "grant_token": "0123abcd..."
}
```

Response:

```json
{
  "deal_id": "deal_123",
  "contract_call": {
    "chain_id": 8453,
    "contract_address": "0xcontract...",
    "function_name": "confirmRelease",
    "data": "0xpreparedcall..."
  }
}
```

Behavior:

- requires SIWE session
- `grant_token` is one-time use
- backend requires `issued_to_wallet === currentUser.wallet_address`
- backend requires `grant.deal_id === :id`
- backend re-runs `assertDealNotBlocked(dealId)` and recipient screening before returning calldata

Errors:

- `400` invalid UUID `:id`
- `401` no SIWE session
- `403` session wallet is not the deal buyer
- `403` `COMPLIANCE_BLOCKED` when seller payout is blocked by compliance or the deal is already in legal hold
- `409` deal not in `ConfirmPending` state
- `409` payout authorization invalid, expired, already used, or issued for another wallet / deal
- `409` release deadline has passed
- `500` `completed_at` is missing (integrity error — indexer has not yet converged or data is corrupt)
- `500` contract config unavailable

### `POST /api/deals/:id/dispute`

Prepares an `openDispute` call. Callable only by the buyer.

Allowed from two states:

- `Funded` — no-show or pre-completion dispute; no time gate.
- `ConfirmPending` — post-completion dispute; allowed only while `now <= completed_at + 48h`.

Errors:

- `400` invalid UUID `:id`
- `401` no SIWE session
- `403` session wallet is not the deal buyer
- `409` deal is in a non-disputable state (`Released`, `Refunded`, `Disputed`)
- `409` dispute window has closed (only applicable from `ConfirmPending`)
- `500` contract config unavailable

### `POST /api/deals/:id/auto-release`

Prepares an `autoRelease` call. Callable after the buyer response window has closed.

The endpoint does not require the caller to be the buyer or seller because the contract function is public. It only prepares calldata; the caller still signs the transaction in their own wallet.

Allowed only when:

- deal status is `ConfirmPending`
- `now > completed_at + 48h`

Errors:

- `400` invalid UUID `:id`
- `403` `COMPLIANCE_BLOCKED` when seller payout is blocked by compliance or the deal is already in legal hold
- `409` deal not in `ConfirmPending` state
- `409` auto-release is not available yet
- `500` `completed_at` is missing (integrity error — indexer has not yet converged or data is corrupt)
- `500` contract config unavailable

### `GET /api/deals/:id/dispute-messages`

Returns the offchain dispute discussion for a deal. The thread is shared: buyer, seller, and admin all see the same messages and evidence links.

Behavior:

- requires SIWE session
- readable by deal buyer, deal seller, or admin
- readable in any deal status
- messages are sorted by `created_at` ascending
- returns `[]` when no messages exist

Response:

```json
[
  {
    "id": "message_uuid",
    "deal_id": "deal_uuid",
    "author_wallet": "0x...",
    "author_role": "buyer",
    "body": "The seller did not join the call.",
    "evidence_url": "https://...",
    "created_at": "2026-04-17T09:00:00.000Z"
  }
]
```

Errors:

- `400` invalid UUID `:id`
- `401` no SIWE session
- `403` not buyer, seller, or admin
- `404` deal not found

### `POST /api/deals/:id/dispute-messages`

Adds a message to the offchain dispute discussion. MVP supports external evidence links only; files are not uploaded to Base Consult Link.

Behavior:

- requires SIWE session
- callable by deal buyer, deal seller, or admin
- allowed only while `deal.status == Disputed`
- after `Released` or `Refunded`, the thread is read-only
- audit logging is fail-open for this action

Request:

```json
{
  "body": "The seller did not join the call.",
  "evidence_url": "https://..."
}
```

Validation:

- `body`: required, trimmed, 1-3000 chars
- `evidence_url`: optional external URL, trimmed, max 2048 chars
- empty `evidence_url` is normalized to `null`

Errors:

- `400` invalid UUID `:id`
- `400` invalid body or evidence URL
- `401` no SIWE session
- `403` not buyer, seller, or admin
- `404` deal not found
- `409` deal not in `Disputed`

---

## 7. Admin Endpoints

### `GET /api/admin/deals`

Returns disputed deals for manual review.

Behavior:

- backend validates admin allowlist
- `view=open` or omitted returns deals in `Disputed` status
- `view=resolved` returns resolved dispute history (`Released` / `Refunded`)
- each returned record includes `risk_status` and `compliance_summary`

Response example (`view=open`):

```json
[
  {
    "id": "deal_123",
    "status": "Disputed",
    "risk_status": "Blocked",
    "compliance_summary": {
      "deal_id": "deal_123",
      "risk_status": "Blocked",
      "checks_count": 2,
      "wallets": ["0xbuyer...", "0xseller..."],
      "providers": [
        {
          "provider": "chainalysis_sanctions_oracle",
          "last_checked_at": "2026-04-27T02:00:00Z",
          "latest_reason_code": "OFAC_SANCTIONS",
          "latest_result": "Blocked"
        },
        {
          "provider": "usdc_blacklist",
          "last_checked_at": null,
          "latest_reason_code": null,
          "latest_result": null
        },
        {
          "provider": "local_denylist",
          "last_checked_at": "2026-04-27T01:00:00Z",
          "latest_reason_code": "LOCAL_DENYLIST",
          "latest_result": "Blocked"
        }
      ]
    }
  }
]
```

Errors:

- `401` no SIWE session
- `403` not admin

---

### `GET /api/admin/deals/:id`

Returns dispute context for manual review.

Behavior:

- backend validates admin allowlist
- returns deal only when it is in `Disputed`
- includes `risk_status` and `compliance_summary`

Errors:

- `400` invalid UUID `:id`
- `401` no SIWE session
- `403` not admin
- `404` deal not found
- `409` deal not in `Disputed`

### `GET /api/admin/deals/:id/compliance`

Returns detailed compliance history for one deal.

Response:

```json
{
  "deal_id": "deal_123",
  "risk_status": "Blocked",
  "compliance_summary": {
    "deal_id": "deal_123",
    "risk_status": "Blocked",
    "checks_count": 2,
    "wallets": ["0xbuyer...", "0xseller..."],
    "providers": [
      {
        "provider": "chainalysis_sanctions_oracle",
        "last_checked_at": "2026-04-27T02:00:00Z",
        "latest_reason_code": "OFAC_SANCTIONS",
        "latest_result": "Blocked"
      },
      {
        "provider": "usdc_blacklist",
        "last_checked_at": null,
        "latest_reason_code": null,
        "latest_result": null
      },
      {
        "provider": "local_denylist",
        "last_checked_at": "2026-04-27T01:00:00Z",
        "latest_reason_code": "LOCAL_DENYLIST",
        "latest_result": "Blocked"
      }
    ]
  },
  "checks": [
    {
      "id": "check_1",
      "deal_id": "deal_123",
      "subject_type": "wallet",
      "subject_value": "0xbuyer...",
      "provider": "chainalysis_sanctions_oracle",
      "result": "Blocked",
      "reason_code": "OFAC_SANCTIONS",
      "raw_summary": {},
      "checked_at": "2026-04-27T02:00:00Z",
      "actor_wallet": null
    }
  ]
}
```

Errors:

- `400` invalid UUID `:id`
- `401` no SIWE session
- `403` not admin
- `404` deal not found

### `POST /api/admin/deals/:id/resolve`

Request:

```json
{
  "resolution": "release"
}
```

or

```json
{
  "resolution": "refund"
}
```

Behavior:

- backend validates admin allowlist
- backend issues a short-lived execution grant instead of immediate calldata
- admin wallet still signs tx; backend does not own admin key

Request:

```json
{
  "resolution": "release"
}
```

or

```json
{
  "resolution": "refund"
}
```

Grant response:

```json
{
  "action": "adminResolveRelease",
  "deal_id": "deal_123",
  "expires_at": "2026-05-05T12:00:00.000Z",
  "grant_token": "0123abcd...",
  "resolution": "release"
}
```

Errors:

- `400` invalid UUID `:id`
- `400` invalid `resolution`
- `401` no SIWE session
- `403` not admin
- `404` deal not found
- `409` deal not in `Disputed`

### `POST /api/admin/deals/:id/resolve/execute`

Exchanges a previously issued admin resolve grant for final opaque admin payout calldata.

Request:

```json
{
  "grant_token": "0123abcd..."
}
```

Response:

```json
{
  "deal_id": "deal_123",
  "resolution": "release",
  "contract_call": {
    "chain_id": 8453,
    "contract_address": "0xcontract...",
    "function_name": "adminResolveRelease",
    "data": "0xpreparedcall..."
  }
}
```

Behavior:

- requires SIWE admin session
- `grant_token` is one-time use
- backend requires `issued_to_wallet === currentUser.wallet_address`
- backend requires `grant.deal_id === :id`
- `resolution` is taken from the stored grant row, not from request body
- backend re-runs `assertDealNotBlocked(dealId)` and recipient screening before returning calldata
- `admin_resolution_intent` is created on this exchange step only

Errors:

- `400` invalid UUID `:id`
- `401` no SIWE session
- `403` not admin
- `403` `COMPLIANCE_BLOCKED` when payout recipient is blocked or the deal is already in legal hold
- `404` deal not found
- `409` deal not in `Disputed`
- `409` payout authorization invalid, expired, already used, or issued for another wallet / deal

### `GET /api/admin/denylist`

Returns paginated local denylist entries.

Response:

```json
[
  {
    "wallet": "0xabc...",
    "reason": "fraud",
    "notes": null,
    "added_by_wallet": "0xadmin...",
    "added_at": "2026-04-27T00:00:00Z"
  }
]
```

Errors:

- `401` no SIWE session
- `403` not admin

### `POST /api/admin/denylist`

Request:

```json
{
  "wallet": "0xabc...",
  "reason": "fraud",
  "notes": null
}
```

Errors:

- `400` invalid input
- `401` no SIWE session
- `403` not admin
- `409` denylist entry already exists

### `DELETE /api/admin/denylist/:wallet`

Request:

```json
{
  "comment": "cleared by legal"
}
```

Errors:

- `400` invalid input
- `401` no SIWE session
- `403` not admin
- `404` denylist entry not found

---

## 8. Operational & Internal Endpoints

Эти endpoints не являются частью product API и не вызываются frontend-ом напрямую.

### `GET /api/health`

Health check. Публичный, без auth.

Response:

```json
{
  "ok": true,
  "service": "base-consult-link",
  "status": "sprint-0-skeleton"
}
```

### `GET /api/private/ping`

Session probe. Требует SIWE session. Используется frontend-ом для проверки валидности сессии без побочных эффектов.

Response:

```json
{
  "ok": true,
  "wallet_address": "0xabc...",
  "is_admin": false,
  "expires_at": "2026-03-25T20:00:00Z"
}
```

Errors:

- `401` no valid session

### `POST /api/links/:id/funding/sync`

Post-funding deal indexing trigger. Требует SIWE session. Вызывается frontend-ом после отправки `createAndFundDeal` tx для ускорения индексации.

Request body (optional):

```json
{ "tx_hash": "0xhash..." }
```

или

```json
{ "from_block": "40023915" }
```

Response `200`:

```json
{ "ok": true, "status": "success", "summary": { ... } }
```

Response `202` (tx ещё не подтверждён):

```json
{ "ok": true, "status": "pending_confirmations", "summary": { ... } }
```

Errors:

- `400` invalid `tx_hash` or `from_block`
- `401` no SIWE session
- `403` `tx_hash` belongs to a different link
- `409` indexed tx produced no deal
- `503` indexer temporarily unavailable

### `POST /api/internal/deal-events/sync`

Internal deal events worker trigger. **Не SIWE.** Защищён заголовком `x-internal-sync-secret` (значение из env `INTERNAL_SYNC_SECRET`). Вызывается только планировщиком / cron-воркером.

Request: пустое тело.

Response:

```json
{ "processed": 3, "alreadyProcessed": 0, "errors": 0 }
```

Errors:

- `401` неверный или отсутствующий секрет
- `503` `INTERNAL_SYNC_SECRET` не сконфигурирован

---

## 9. Interface Freeze

До завершения MVP нельзя без согласования:

- менять endpoint names and ownership model;
- раскрывать `meeting_url` до funding;
- вводить Base Pay checkout endpoints;
- добавлять multi-use link semantics в link API.

---

## Лист регистрации изменений

| Версия | Дата | Изменения |
|---|---|---|
| 1.0 | 2026-03-25 | Первичный выпуск |
| 1.1 | 2026-04-28 | GET /api/deals/:id перенесён в приватные endpoints; добавлен §8 Operational & Internal Endpoints (/health, /private/ping, /funding/sync, /internal/deal-events/sync) |
| 1.2 | 2026-04-28 | Удалён ошибочный блок "Compliance errors" из GET /api/links/:id |
