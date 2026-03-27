# Base Consult Link

Base Consult Link is a mobile-first web app for selling a single scheduled consultation slot with USDC escrow on Base.

This repository now includes the Sprint 0 runnable skeleton plus Sprint 1 auth foundations: SIWE nonce issuance, backend signature verification, short-lived cookie sessions, logout, and a protected smoke route.

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
NEXT_PUBLIC_BUILDER_CODE=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
AUTH_DOMAIN=
ADMIN_WALLETS=
```

`AUTH_DOMAIN` is the preferred host override for SIWE domain validation. If it is not set, auth falls back to the incoming request host.

`ADMIN_WALLETS` is a comma-separated wallet allowlist used to compute `is_admin` server-side.

`NEXT_PUBLIC_BUILDER_CODE` is present in env for future attribution support, but runtime attribution is still intentionally deferred.

## Sprint 1 Auth Includes

- `POST /api/auth/siwe/nonce`
- `POST /api/auth/siwe/verify`
- `POST /api/auth/logout`
- `GET /api/private/ping`
- `HttpOnly` short-lived session cookie with `SameSite=Lax`
- session token hashing before DB persistence
- single-use nonce enforcement through the existing repository layer
- internal auth guards for server-side user/session access

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

- escrow smart contracts
- link and deal business APIs
- reveal endpoint
- disputes, funding flow, or paymaster business logic
- product auth UI beyond backend smoke flow
- runtime Builder Code attribution via `dataSuffix`
