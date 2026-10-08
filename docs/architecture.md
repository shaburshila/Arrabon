# Architecture

Arrabon combines a Next.js application, PostgreSQL read model, background event
worker, compliance providers, and a USDC escrow contract on Base.

```text
Browser and wallet
        |
        v
Next.js application
  |-- React pages and product components
  |-- Route Handlers
  |-- SIWE session and authorization guards
  `-- domain services
        |
        |-- Supabase PostgreSQL
        |-- compliance providers
        `-- Base RPC / ConsultEscrow

Background worker
  `-- confirmed contract events --> idempotent database updates
```

The application is no longer hosted. This document describes the final
repository state.

## Frontend

The frontend uses the Next.js App Router, React, TanStack Query, wagmi, and
viem. It provides separate flows for:

- public consultation links;
- link creation and management;
- buyer funding;
- deal status and lifecycle actions;
- expert and client dashboards;
- dispute messages;
- admin dispute and denylist work.

The wallet signs SIWE messages and Base transactions. Transaction execution
remains visible in the wallet.

## Route Handlers and services

Route Handlers parse requests and apply authentication before calling the
service layer. Services own product rules such as:

- consultation-link creation and cancellation;
- funding preparation and one-time grant exchange;
- deal completion and payout preparation;
- admin dispute resolution;
- compliance checks;
- event application and read-model updates.

Repositories isolate PostgreSQL access from those services. Validators keep
request parsing separate from domain decisions.

## Authentication

SIWE creates a server-side session:

1. The API issues a single-use nonce.
2. The wallet signs an EIP-4361 message.
3. The server verifies the message and stores a hash of the session token.
4. An HttpOnly cookie carries the opaque token.
5. Authorization guards load the wallet and, for admin routes, the admin
   snapshot.

No wallet private key is sent to the application.

## Onchain and offchain ownership

### Onchain

`ConsultEscrow` owns:

- USDC held for active deals;
- used link hashes and funding nonces;
- buyer, seller, price, fee, and schedule;
- deal lifecycle state;
- payout-block state;
- owner, admin, treasury, and funding-authorizer addresses.

### Offchain

PostgreSQL owns:

- user profiles and SIWE sessions;
- consultation-link content;
- encrypted meeting URLs;
- the chain-synced deal read model;
- dispute messages and evidence links;
- compliance results and local denylist entries;
- execution grants and admin-resolution intents;
- processing cursors, idempotency records, and audit entries.

Offchain status cannot move escrowed USDC. A lifecycle transition is complete
only when the contract transaction succeeds.

## Database model

Core tables:

| Table | Purpose |
|---|---|
| `users` | Wallet-bound application identity |
| `consultation_links` | Product metadata and encrypted meeting URL |
| `deals` | Chain-synced deal read model |
| `auth_nonces`, `sessions` | SIWE replay protection and sessions |
| `processed_transactions` | Event-processing idempotency |
| `deal_event_sync_cursors` | Persistent confirmed-block progress |
| `deal_dispute_messages` | Offchain discussion and evidence links |
| `compliance_checks` | Provider results and reason codes |
| `wallet_denylist` | Local admin-managed blocks |
| `funding_execution_grants` | One-time funding execution exchange |
| `payout_execution_grants` | One-time release or refund execution exchange |
| `audit_log` | Append-only application actions |

Supabase migrations under `supabase/migrations` are authoritative for the
schema.

## Funding boundary

The backend authorizer signs the exact link and deal parameters after product
and compliance checks. The contract verifies that signature, the caller, the
deadline, the nonce, the link hash, time bounds, and amount bounds.

This design prevents arbitrary wallet calls from bypassing the offchain link
model, but it makes the funding-authorizer key a trusted component. The owner
can rotate that address onchain.

## Event synchronization

The worker reads confirmed contract events and applies them through atomic
database functions. Transaction hashes and persistent cursors prevent a replay
from creating a second state transition.

The database can lag Base during RPC or worker failures. The worker can resume
from its last fully processed block. Contract state remains authoritative.

## Compliance boundary

Compliance checks run before protected actions and again after funding events.
The composite result uses the strongest provider outcome. Provider
unavailability does not produce a cached clear result.

A post-funding block can create a deferred request to set
`dealPayoutBlocked` onchain. The flag blocks buyer-confirmed release and seller
auto-release. Admin resolution is screened by the application but remains a
trusted contract action. Risk review stays separate from deal lifecycle state.

## Deployment history

The application was prepared for a Next.js runtime with a separate worker and
Supabase PostgreSQL. The escrow contract was deployed to Base Mainnet.

The public application was not carried into commercial operation. Environment
and production-readiness notes were removed from the public documentation
because they no longer described an active service.
