# Arrabon

Arrabon is a mobile-first web app for selling a single scheduled consultation slot with USDC escrow on Base.

> Project documentation index: [docs/INDEX.md](docs/INDEX.md)

Current status: backend + frontend MVP implemented. See [docs/INDEX.md](docs/INDEX.md) for full documentation.

Completed:

- SIWE auth and server-side sessions
- Consultation link create/read/cancel
- Funding prepare + sync boundary
- Deal read + meeting URL reveal
- Confirmed chain event sync (Funded, Completed, Released, Disputed, Refunded)
- Completion, release, dispute, auto-release lifecycle endpoints
- Dispute messages (offchain thread)
- AML/Compliance screening (3 providers: Chainalysis oracle, USDC blacklist, local denylist)
- Admin endpoints: deal management, dispute resolution, denylist CRUD
- Frontend: 9 pages including admin UI, compliance notices

## Local Run

1. Install dependencies:

```bash
npm install
```

2. Copy env values from `.env.example` into `.env.local`.

3. Start the dev server:

```bash
npm run dev
```

4. Build for verification:

```bash
npm run build
```

## Required Environment Variables

```env
NEXT_PUBLIC_RPC_URL=
NEXT_PUBLIC_PAYMASTER_PROXY_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_TREASURY_WALLET=
NEXT_PUBLIC_BASE_CHAIN_ID=
NEXT_PUBLIC_CONSULT_ESCROW_ADDRESS=
NEXT_PUBLIC_USDC_ADDRESS=
NEXT_PUBLIC_BUILDER_CODE=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
AUTH_DOMAIN=
ADMIN_WALLETS=
MEETING_URL_ENCRYPTION_KEY=
CHAIN_SYNC_START_BLOCK=
CHAIN_SYNC_CONFIRMATIONS=
CHAIN_SYNC_MAX_RANGE=
COMPLIANCE_CHAINALYSIS_ORACLE_ADDRESS=
COMPLIANCE_CB_FAILURE_THRESHOLD=
COMPLIANCE_CB_WINDOW_MS=
COMPLIANCE_CB_RESET_MS=
COMPLIANCE_CHAINALYSIS_DEV_MOCK=
COMPLIANCE_CHAINALYSIS_DEV_MOCK_MODE=
COMPLIANCE_USDC_DEV_MOCK=
COMPLIANCE_USDC_DEV_MOCK_MODE=
```

`AUTH_DOMAIN` is the preferred host override for SIWE domain validation. If it is not set, auth falls back to the incoming request host.

`ADMIN_WALLETS` is a comma-separated wallet allowlist used to compute `is_admin` server-side.

`MEETING_URL_ENCRYPTION_KEY` must be exactly 64 hex characters and is used for server-side encryption/decryption of `meeting_url`.

`NEXT_PUBLIC_CONSULT_ESCROW_ADDRESS` points to the deployed escrow contract used by funding and post-funding lifecycle preparation.

`CHAIN_SYNC_START_BLOCK`, `CHAIN_SYNC_CONFIRMATIONS`, and `CHAIN_SYNC_MAX_RANGE` configure the background event-sync worker. `CHAIN_SYNC_MAX_RANGE` must be greater than or equal to `1`.

`NEXT_PUBLIC_BUILDER_CODE` is present in env for future attribution support, but runtime attribution is still intentionally deferred.

`COMPLIANCE_CHAINALYSIS_ORACLE_ADDRESS` points to the on-chain Chainalysis sanctions oracle contract used by AML screening.

`COMPLIANCE_CB_FAILURE_THRESHOLD`, `COMPLIANCE_CB_WINDOW_MS`, and `COMPLIANCE_CB_RESET_MS` configure the per-provider compliance circuit breaker. Positive compliance cache TTL is intentionally fixed in code at 5 minutes for the current MVP.

`COMPLIANCE_CHAINALYSIS_DEV_MOCK=true` switches only the Chainalysis provider to a dev-only mock. This is intended for non-production environments such as Base Sepolia when a live sanctions oracle is unavailable. `COMPLIANCE_CHAINALYSIS_DEV_MOCK_MODE` accepts `clear`, `blocked`, or `unavailable`; the default is `clear`.

`COMPLIANCE_USDC_DEV_MOCK=true` switches only the USDC blacklist provider to a dev-only mock. This is intended for non-production environments such as Base Sepolia when the configured USDC contract does not implement `isBlacklisted` or when deterministic compliance testing is needed. `COMPLIANCE_USDC_DEV_MOCK_MODE` accepts `clear`, `blocked`, or `unavailable`; the default is `clear`.

Even with `COMPLIANCE_CHAINALYSIS_DEV_MOCK=true`, `COMPLIANCE_CHAINALYSIS_ORACLE_ADDRESS` must still be present because the compliance config is loaded for shared circuit-breaker settings. For local dev you can use a valid placeholder such as `0x0000000000000000000000000000000000000000`.

`NEXT_PUBLIC_USDC_ADDRESS` remains the single source of truth for the USDC contract address and is reused by the compliance blacklist provider.

## Base Sepolia Compliance Dev Mode

If you want to test compliance flows on Base Sepolia without a live Chainalysis oracle, add the following to `.env.local`:

```env
COMPLIANCE_CHAINALYSIS_ORACLE_ADDRESS=0x0000000000000000000000000000000000000000
COMPLIANCE_CHAINALYSIS_DEV_MOCK=true
COMPLIANCE_CHAINALYSIS_DEV_MOCK_MODE=clear
```

Mode guide:

- `clear` — Chainalysis provider returns `NO_HIT`
- `blocked` — Chainalysis provider returns `OFAC_SANCTIONS`
- `unavailable` — Chainalysis provider returns `PROVIDER_UNAVAILABLE`

If you also need to bypass live USDC `isBlacklisted` reads on Base Sepolia, add:

```env
COMPLIANCE_USDC_DEV_MOCK=true
COMPLIANCE_USDC_DEV_MOCK_MODE=clear
```

Mode guide:

- `clear` — USDC blacklist provider returns `NO_HIT`
- `blocked` — USDC blacklist provider returns `USDC_BLACKLISTED`
- `unavailable` — USDC blacklist provider returns `PROVIDER_UNAVAILABLE`

Chainalysis and USDC dev mocks are independent and can be enabled separately or together. Local denylist continues to run normally.

## Contract Deployment

Base Sepolia deployment is wired through Hardhat.

Required deploy-only env vars:

```env
BASE_SEPOLIA_RPC_URL=
DEPLOYER_PRIVATE_KEY=
USDC_ADDRESS=
TREASURY_ADDRESS=
ADMIN_WALLETS=
```

Recommended testnet app/runtime env after deployment:

```env
NEXT_PUBLIC_BASE_CHAIN_ID=84532
NEXT_PUBLIC_RPC_URL=
NEXT_PUBLIC_CONSULT_ESCROW_ADDRESS=
NEXT_PUBLIC_TREASURY_WALLET=
CHAIN_SYNC_START_BLOCK=
CHAIN_SYNC_CONFIRMATIONS=1
CHAIN_SYNC_MAX_RANGE=500
```

If you do not have a test USDC address on Base Sepolia yet, deploy the mock token first:

```bash
npm run deploy:mock-usdc:base-sepolia
```

Then deploy the escrow contract:

```bash
npm run deploy:escrow:base-sepolia
```

The deploy script prints the contract address and deployment block. Use those values for
`NEXT_PUBLIC_CONSULT_ESCROW_ADDRESS` and `CHAIN_SYNC_START_BLOCK`.

## Implemented API Surface

- Auth
  - `POST /api/auth/siwe/nonce`
  - `POST /api/auth/siwe/verify`
  - `POST /api/auth/logout`
  - `GET /api/private/ping`
- Links
  - `POST /api/links`
  - `GET /api/links/:id`
  - `POST /api/links/:id/cancel`
  - `POST /api/links/:id/funding/prepare`
  - `POST /api/links/:id/funding/sync`
- Deals
  - `GET /api/deals/:id`
  - `GET /api/deals/:id/meeting-url`
  - `GET /api/deals/:id/dispute-messages`
  - `POST /api/deals/:id/dispute-messages`
  - `POST /api/deals/:id/complete`
  - `POST /api/deals/:id/release`
  - `POST /api/deals/:id/dispute`
  - `POST /api/deals/:id/auto-release`
- Me
  - `GET /api/me/deals`
- Admin
  - `GET /api/admin/deals`
  - `GET /api/admin/deals/:id`
  - `GET /api/admin/deals/:id/compliance`
  - `POST /api/admin/deals/:id/resolve`
  - `GET /api/admin/denylist`
  - `POST /api/admin/denylist`
  - `DELETE /api/admin/denylist/:wallet`
- Operational
  - `GET /api/health`
  - `POST /api/internal/deal-events/sync` (x-internal-sync-secret)

## Implemented Backend Capabilities

- `HttpOnly` short-lived SIWE session cookie with `SameSite=Lax`
- server-side nonce issuance, signature verification, logout, and auth guards
- encrypted `meeting_url` storage with participant-only server-side reveal
- consultation link creation, public read, cancel
- funding preparation and sync for `createAndFundDeal`
- deal read model with derived `release_deadline_at`
- confirmed chain event sync for `DealFunded`, `Completed`, `Released`, `Disputed`, and `Refunded`
- completion, release, dispute, auto-release lifecycle prepare endpoints
- offchain dispute message thread (buyer / seller / admin visible)
- AML/Compliance screening: Chainalysis sanctions oracle, USDC blacklist, local denylist; fail-closed; post-funding rescreening; legal hold on payout paths
- admin dispute resolution, deal compliance history, denylist CRUD

## Auth Smoke Test

1. Request a nonce:

```bash
curl -i -X POST http://localhost:3000/api/auth/siwe/nonce \
  -H 'content-type: application/json' \
  -d '{"wallet":"0xYourWalletAddress"}'
```

2. Build an EIP-4361 message for the returned nonce using the same domain as `AUTH_DOMAIN` or your local host, sign it with your wallet, then verify:

```bash
curl -i -X POST http://localhost:3000/api/auth/siwe/verify \
  -H 'content-type: application/json' \
  -d '{"message":"<full siwe message>","signature":"0x..."}'
```

3. Reuse the returned cookie against the protected smoke route:

```bash
curl -i http://localhost:3000/api/private/ping \
  --cookie 'bcl_session=<session token>'
```

4. Logout:

```bash
curl -i -X POST http://localhost:3000/api/auth/logout \
  --cookie 'bcl_session=<session token>'
```

Without a valid cookie, `GET /api/private/ping` returns `401`.

## Not Implemented Yet

- production scheduler/process manager for the deal-events worker
- runtime Builder Code attribution via `dataSuffix` (intentionally deferred)
