# Base Consult Link

Base Consult Link is a mobile-first web app for selling a single scheduled consultation slot with USDC escrow on Base.

Current backend status:

- Sprint 0: runnable project skeleton
- Sprint 1: SIWE auth and server-side sessions
- Sprint 2 Phase 1: consultation link create/read
- Sprint 2 Phase 2: funding prepare boundary
- Sprint 2 Phase 3: deals read + meeting URL reveal
- Sprint 2 Phase 4: confirmed funding event sync/indexer
- Sprint 2 Phase 5: completion flow prepare endpoints plus confirmed lifecycle event sync for `Completed`, `Released`, `Disputed`

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
NEXT_PUBLIC_BUILDER_CODE=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
AUTH_DOMAIN=
ADMIN_WALLETS=
MEETING_URL_ENCRYPTION_KEY=
CHAIN_SYNC_START_BLOCK=
CHAIN_SYNC_CONFIRMATIONS=
CHAIN_SYNC_MAX_RANGE=
```

`AUTH_DOMAIN` is the preferred host override for SIWE domain validation. If it is not set, auth falls back to the incoming request host.

`ADMIN_WALLETS` is a comma-separated wallet allowlist used to compute `is_admin` server-side.

`MEETING_URL_ENCRYPTION_KEY` must be exactly 64 hex characters and is used for server-side encryption/decryption of `meeting_url`.

`NEXT_PUBLIC_CONSULT_ESCROW_ADDRESS` points to the deployed escrow contract used by funding and post-funding lifecycle preparation.

`CHAIN_SYNC_START_BLOCK`, `CHAIN_SYNC_CONFIRMATIONS`, and `CHAIN_SYNC_MAX_RANGE` configure the background event-sync worker. `CHAIN_SYNC_MAX_RANGE` must be greater than or equal to `1`.

`NEXT_PUBLIC_BUILDER_CODE` is present in env for future attribution support, but runtime attribution is still intentionally deferred.

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
- `POST /api/links/:id/funding/prepare`
- Deals
- `GET /api/deals/:id`
- `GET /api/deals/:id/meeting-url`
- `POST /api/deals/:id/complete`
- `POST /api/deals/:id/release`
- `POST /api/deals/:id/dispute`

## Implemented Backend Capabilities

- `HttpOnly` short-lived SIWE session cookie with `SameSite=Lax`
- server-side nonce issuance, signature verification, logout, and auth guards
- encrypted `meeting_url` storage with participant-only server-side reveal
- consultation link creation and public read model
- funding preparation for `createAndFundDeal`
- deal read model with derived `release_deadline_at`
- confirmed chain event sync for `DealFunded`, `Completed`, `Released`, `Disputed`, and `Refunded`
- completion flow prepare endpoints for seller/buyer lifecycle actions

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

- admin dispute resolution endpoints and workflows
- backend-submitted auto-release helper worker
- production scheduler/process management for workers
- full frontend product UI
- runtime Builder Code attribution via `dataSuffix`
