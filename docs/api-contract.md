# API Contract — Base Consult Link

> Version: 1.0 | Based on: ТЗ v1.2 | Date: 2026-03-25

---

## 1. Rules

- Protocol: HTTPS + JSON
- Private endpoints require SIWE session cookie
- Chain is source of truth for deal state
- Backend is source of truth for link metadata and encrypted `meeting_url`
- Backend validates business rules but does not replace contract enforcement
- Ограничение на funding endpoints в текущей фазе ослаблено: помимо замороженного funding flow через `createAndFundDeal`, backend API явно допускает `POST /api/links/:id/funding/prepare` как подготовительный endpoint без изменения самого onchain flow

---

## 2. Public Endpoints

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
  "grace_period_minutes": 10,
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

### `GET /api/deals/:id`

Returns read model for deal status screen.

Response:

```json
{
  "id": "deal_123",
  "consultation_link_id": "link_123",
  "onchain_deal_id": "17",
  "status": "Funded",
  "buyer_address": "0xbuyer...",
  "seller_address": "0xseller...",
  "scheduled_at": "2026-03-28T12:00:00Z",
  "completed_at": null,
  "release_deadline_at": null,
  "tx_hash": "0xhash"
}
```

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
- `grace_period_minutes` is server-controlled for MVP and defaults to `10`.

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

Requires SIWE session and returns structured `createAndFundDeal` call arguments for the authenticated buyer wallet.

Request:

```json
{}
```

Response:

```json
{
  "consultation_link_id": "link_123",
  "link_hash": "0xlinkhash",
  "buyer_address": "0xbuyer...",
  "seller_address": "0xseller...",
  "schedule": {
    "scheduled_at": "2026-03-28T12:00:00Z",
    "duration_minutes": 30,
    "grace_period_minutes": 10
  },
  "contract_call": {
    "chain_id": 8453,
    "contract_address": "0xcontract...",
    "function_name": "createAndFundDeal",
    "args": {
      "link_hash": "0xlinkhash",
      "seller": "0xseller...",
      "buyer": "0xbuyer...",
      "price": "100000000",
      "scheduled_at": "1774699200",
      "duration_minutes": "30",
      "grace_period_minutes": "10"
    }
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
- `500` contract config unavailable

Notes:

- Response contains structured args only; encoded calldata is not returned.
- The prepare response is a snapshot. By tx submission time, offchain state may already have changed.
- Source-of-truth boundary: funding must be unavailable once `now >= expires_at`.
- Current implementation is temporarily inconsistent at the exact boundary: when `expires_at == now`, the service still treats the link as `Open` because expiry checks use strict `<` comparison.

---

## 5. Deal Private Endpoints

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

All three endpoints are **prepare-only**: they return structured contract call arguments for the caller's wallet to sign and submit. No deal state is written by the backend. Final state transitions are driven exclusively by confirmed onchain events via the indexer.

Request body: empty `{}` or omitted for all three endpoints.

Response shape for all three (on success):

```json
{
  "deal_id": "deal_123",
  "contract_call": {
    "chain_id": 8453,
    "contract_address": "0xcontract...",
    "function_name": "<markCompleted|confirmRelease|openDispute>",
    "args": {
      "deal_id": "17"
    }
  }
}
```

### `POST /api/deals/:id/complete`

Prepares a `markCompleted` call. Callable only by the seller after the consultation window has elapsed.

Time condition (backend pre-check): `now >= scheduled_at + duration_minutes + grace_period_minutes`

The backend check is advisory. The contract enforces the same gate and will revert if the condition is not met at tx execution time.

Errors:

- `400` invalid UUID `:id`
- `401` no SIWE session
- `403` session wallet is not the deal seller
- `409` deal not in `Funded` state
- `409` completion time not yet reached
- `500` deal timing data invalid (integrity error)
- `500` contract config unavailable

### `POST /api/deals/:id/release`

Prepares a `confirmRelease` call. Callable only by the buyer while the deal is in `ConfirmPending` and the 48-hour dispute window has not yet passed.

The buyer window is inclusive at the exact deadline (`now == deadline` is allowed). Auto-release becomes valid only strictly after the deadline passes.

Errors:

- `400` invalid UUID `:id`
- `401` no SIWE session
- `403` session wallet is not the deal buyer
- `409` deal not in `ConfirmPending` state
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

---

## 7. Admin Endpoints

### `GET /api/admin/deals/:id`

Returns dispute context for manual review.

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
- backend prepares corresponding contract action
- admin wallet still signs tx; backend does not own admin key

Errors:

- `401` no SIWE session
- `403` not admin
- `409` deal not in `Disputed`

---

## 7. Interface Freeze

До завершения MVP нельзя без согласования:

- менять endpoint names and ownership model;
- раскрывать `meeting_url` до funding;
- вводить Base Pay checkout endpoints;
- добавлять multi-use link semantics в link API.
