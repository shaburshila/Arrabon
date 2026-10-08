<p align="center">
  <img src="public/arrabon-seal-gold-on-graphite.svg" alt="Arrabon" width="180" />
</p>

# Arrabon

Arrabon is a mobile-first consultation platform with non-custodial USDC escrow
on Base.

An expert creates a single-use link for a scheduled session. The client funds
the deal in USDC, and the smart contract holds the funds until release or
refund. The meeting URL is encrypted offchain and revealed only to the deal
participants after funding.

The MVP was completed and tested. A commercial launch did not follow after the
team stopped the marketing direction behind the product. The public service is
offline, and this repository is kept as a product and engineering case study.

## Project facts

| | |
|---|---|
| **Role** | Solo product and engineering work |
| **Development period** | March 26–May 21, 2026 — 57 calendar days |
| **Result** | End-to-end MVP and a Base Mainnet contract |
| **Development history** | 225 commits by one author during active development |
| **Product surface** | 13 pages and 28 API route files |
| **Quality checks** | 71 test files and 68 documented QA scenarios |

The work covered product rules, user flows, UX, frontend, backend, database
design, the smart contract, testing, security review, and deployment
preparation. AI was used during development, while code, tests, contract
behavior, and full user flows were used to verify the result.

## User flow

```text
Expert creates a single-use consultation link
                    |
Client connects a wallet and funds the deal in USDC
                    |
ConsultEscrow holds the price and protocol fee on Base
                    |
The encrypted meeting URL becomes available to both participants
                    |
Expert marks the consultation complete
                    |
Client confirms release or opens a dispute
                    |
Seller can use auto-release after the 48-hour response window
```

## Implemented product surface

- creation, listing, cancellation, and public viewing of consultation links;
- atomic deal creation and USDC funding;
- wallet connection and SIWE authentication with server-side sessions;
- AES-256-GCM encryption for meeting URLs;
- deal funding, completion, release, dispute, refund, and auto-release;
- EIP-712 funding authorization with nonce and link-hash replay protection;
- expert and client dashboards;
- private meeting-link reveal for funded deal participants;
- offchain dispute messages and evidence links;
- admin dispute resolution and wallet denylist controls;
- Chainalysis oracle, USDC blacklist, and local denylist checks;
- post-funding risk state and onchain payout holds;
- confirmed-event synchronization into PostgreSQL;
- dedicated mobile flows for wallet-based browsers.

## Architecture

```text
Mobile browser / wallet
          |
          v
Next.js application
  |-- React UI, wagmi, and viem
  |-- Route Handlers and server-side sessions
  `-- background event-sync worker
          |
          |-- Supabase PostgreSQL
          |-- compliance providers
          `-- Base L2 / ConsultEscrow
```

The smart contract owns escrow balances and lifecycle transitions. PostgreSQL
stores private product data, sessions, encrypted meeting URLs, compliance
results, dispute messages, and a chain-synced read model. The worker processes
confirmed events idempotently.

Users sign funding and lifecycle transactions with their wallets. The
application does not store wallet private keys.

## Smart contract

`ConsultEscrow.sol` is deployed on Base Mainnet:

- **Contract:**
  [`0x2EB0e35AbF9035f7A3B1807B857dc33518D1C5aD`](https://basescan.org/address/0x2EB0e35AbF9035f7A3B1807B857dc33518D1C5aD)
- **Deployment transaction:**
  [`0x4d0ed8…68fa`](https://basescan.org/tx/0x4d0ed801e47f7dcde43139da2e9a11eb4c53b63ef27e32db1a9998a6d4ed68fa)
- **Network:** Base Mainnet, chain ID 8453
- **Block:** 46201204

The contract enforces single-use link hashes, EIP-712 funding authorization,
deal state transitions, a 48-hour response window, dispute resolution, payout
holds, and USDC settlement.

Current contract constants:

- price range: 10–100,000 USDC;
- fee: 3%, clamped to 1.50–30 USDC;
- maximum consultation duration: 1,440 minutes;
- dispute and response window: 48 hours.

## Stack

**Application:** TypeScript, Next.js App Router, React, TanStack Query

**Wallet and chain:** wagmi, viem, SIWE, Solidity 0.8.26, Hardhat,
OpenZeppelin, Base, USDC

**Data:** Supabase PostgreSQL, hashed server-side sessions, background event
sync

**Security and compliance:** AES-256-GCM, EIP-712, Chainalysis oracle, USDC
blacklist, local denylist, append-only audit records

## Verification

The repository contains 71 test files across unit, route, service, API smoke,
and contract tests. The documented QA set contains 68 scenarios and 20
cross-layer invariants.

Coverage includes:

- SIWE nonce and session behavior;
- role and participant authorization;
- consultation-link timing and single use;
- meeting URL encryption and reveal rules;
- escrow funding and lifecycle transitions;
- fee calculation and EIP-712 authorization;
- event-indexing idempotency;
- compliance fail-closed paths and payout holds;
- admin dispute and denylist operations.

The security work was internal. The repository does not claim an external
audit.

## Repository structure

```text
app/           pages and Next.js Route Handlers
components/    product UI
hooks/         wallet and deal flows
lib/           auth, database, contract, compliance, and validation code
contracts/     ConsultEscrow and contract tests
supabase/      PostgreSQL migrations
server/        repositories, services, and event-sync worker
tests/         unit, API smoke, and contract tests
docs/          curated product and engineering documentation
design-assets/ source and exported brand assets
```

## Documentation

| Document | Contents |
|---|---|
| [Product rules](docs/product-spec.md) | Scope, actors, pricing, and lifecycle rules |
| [Architecture](docs/architecture.md) | Component boundaries and onchain/offchain split |
| [User flows](docs/flows.md) | Funding, completion, release, dispute, and failure paths |
| [State machine](docs/state-machine.md) | Link, deal, and compliance transitions |
| [API reference](docs/api-contract.md) | Implemented Route Handler surface |
| [Authentication](docs/auth-model.md) | SIWE sessions and authorization rules |
| [Security and compliance](docs/security.md) | Assets, controls, providers, and residual risks |
| [Testing](docs/testing.md) | Automated coverage, QA scenarios, and limits |
| [Development process](docs/development-process.md) | Scope, AI-assisted workflow, and verification |
| [Deployments](docs/deployments.md) | Mainnet and current testnet contract records |

## Status

The MVP is complete. The contract was deployed to Base Mainnet, but the
product did not proceed to a full commercial launch after its marketing
direction ended. The application is no longer hosted or maintained.

## License

The source is published for review. No open-source license is granted; all
rights are reserved.
