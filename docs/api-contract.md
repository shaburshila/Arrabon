# API reference

Arrabon uses Next.js Route Handlers under `app/api`. The repository contains
28 route files.

This is a route-level reference. Validators and service code remain
authoritative for request fields, response bodies, and error details.

## Conventions

- JSON is used for application requests and responses.
- Wallet addresses are normalized before authorization or storage.
- Private routes resolve the wallet from the SIWE session.
- Admin routes require both a valid session and admin authorization.
- Funding and payout use one-time execution grants between prepare and execute
  calls.
- Compliance failures use a consistent blocked response.
- The event-sync route is internal and does not use a browser session.

## Public and session routes

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Application health |
| `POST` | `/api/auth/siwe/nonce` | Issue a single-use SIWE nonce |
| `POST` | `/api/auth/siwe/verify` | Verify SIWE and create a session |
| `POST` | `/api/auth/logout` | Revoke the session and clear its cookie |
| `GET` | `/api/private/ping` | Authenticated session smoke route |

## Consultation links

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/links/{id}` | Return a public link view |
| `GET` | `/api/links` | List links owned by the signed-in expert |
| `POST` | `/api/links` | Create a consultation link |
| `POST` | `/api/links/{id}/cancel` | Cancel an unfunded link |
| `POST` | `/api/links/{id}/funding/prepare` | Validate funding and issue a one-time grant |
| `POST` | `/api/links/{id}/funding/execute` | Exchange the grant for final transaction data |
| `POST` | `/api/links/{id}/funding/sync` | Reconcile a funding transaction |

The public link response excludes the plaintext meeting URL. Funding prepare
and execute routes recheck link, participant, time, and compliance state.

## Deal routes

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/deals/{id}` | Return a participant's deal view |
| `GET` | `/api/me/deals` | List deals for the signed-in wallet |
| `GET` | `/api/deals/{id}/meeting-url` | Reveal the decrypted URL to a participant |
| `POST` | `/api/deals/{id}/complete` | Prepare a seller completion transaction |
| `POST` | `/api/deals/{id}/release` | Prepare buyer-confirmed release |
| `POST` | `/api/deals/{id}/release/execute` | Exchange a release execution grant |
| `POST` | `/api/deals/{id}/auto-release` | Prepare seller auto-release |
| `POST` | `/api/deals/{id}/dispute` | Prepare a buyer dispute transaction |
| `GET` | `/api/deals/{id}/dispute-messages` | List participant and admin messages |
| `POST` | `/api/deals/{id}/dispute-messages` | Add a dispute message or evidence link |

Prepare routes do not report an onchain transition as complete. The event
worker updates the read model after transaction confirmation.

## Admin routes

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/deals` | List deals for dispute review |
| `GET` | `/api/admin/deals/{id}` | Return an admin deal view |
| `GET` | `/api/admin/deals/{id}/compliance` | Return deal screening history |
| `POST` | `/api/admin/deals/{id}/resolve` | Prepare release or refund |
| `POST` | `/api/admin/deals/{id}/resolve/execute` | Exchange an admin execution grant |
| `GET` | `/api/admin/denylist` | List local denylist entries |
| `POST` | `/api/admin/denylist` | Add a wallet to the denylist |
| `DELETE` | `/api/admin/denylist/{wallet}` | Remove a wallet from the denylist |

Admin resolution still requires an admin wallet transaction. The API cannot
move escrowed USDC by changing a database row.

## Internal synchronization

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/internal/deal-events/sync` | Apply confirmed contract events |

The worker authenticates separately from SIWE. Processing is idempotent by
transaction and event state, and persistent cursors track the last complete
block range.

## Error boundary

The API distinguishes:

- malformed input;
- missing or expired sessions;
- forbidden participant or admin access;
- missing resources;
- invalid product or contract state;
- compliance blocks and provider unavailability;
- stale or already-used execution grants;
- internal persistence or RPC failures.

Client-facing errors do not include meeting URLs, session tokens, authorizer
keys, or raw provider payloads.
