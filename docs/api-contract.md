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

Terminal deals keep `status` as `Released` or `Refunded`. Resolution metadata
describes how that terminal state was reached:

- `buyer_confirmed`
- `auto_release`
- `admin_release`
- `admin_refund`

For admin-resolved disputes, UI should display this as released/refunded after
dispute without introducing separate terminal statuses.

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
    "duration_minutes": 30
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
      "duration_minutes": "30"
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

---

## 5. Deal Private Endpoints

### `GET /api/me/deals`

Returns deals where the authenticated wallet is the buyer. This endpoint is the buyer recovery path after a paid consultation page is closed or the `/deal/:id` URL is lost.

Behavior:

- requires SIWE session
- uses `currentUser.wallet_address` as `buyer_address`
- returns newest deals first by `deals.created_at desc`
- returns only buyer deals; seller recovery remains `/my-links`

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

Lifecycle endpoints are **prepare-only**: they return structured contract call arguments for the caller's wallet to sign and submit. No deal state is written by the backend. Final state transitions are driven exclusively by confirmed onchain events via the indexer.

Request body: empty `{}` or omitted for all lifecycle endpoints.

Response shape for all three (on success):

```json
{
  "deal_id": "deal_123",
  "contract_call": {
    "chain_id": 8453,
    "contract_address": "0xcontract...",
    "function_name": "<markCompleted|confirmRelease|openDispute|autoRelease>",
    "args": {
      "deal_id": "17"
    }
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

### `POST /api/deals/:id/auto-release`

Prepares an `autoRelease` call. Callable after the buyer response window has closed.

The endpoint does not require the caller to be the buyer or seller because the contract function is public. It only prepares calldata; the caller still signs the transaction in their own wallet.

Allowed only when:

- deal status is `ConfirmPending`
- `now > completed_at + 48h`

Errors:

- `400` invalid UUID `:id`
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
- returns deals in `Disputed` status

Errors:

- `401` no SIWE session
- `403` not admin

---

### `GET /api/admin/deals/:id`

Returns dispute context for manual review.

Behavior:

- backend validates admin allowlist
- returns deal only when it is in `Disputed`

Errors:

- `400` invalid UUID `:id`
- `401` no SIWE session
- `403` not admin
- `404` deal not found
- `409` deal not in `Disputed`

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

- `400` invalid UUID `:id`
- `400` invalid `resolution`
- `401` no SIWE session
- `403` not admin
- `404` deal not found
- `409` deal not in `Disputed`

---

## 8. Interface Freeze

До завершения MVP нельзя без согласования:

- менять endpoint names and ownership model;
- раскрывать `meeting_url` до funding;
- вводить Base Pay checkout endpoints;
- добавлять multi-use link semantics в link API.
