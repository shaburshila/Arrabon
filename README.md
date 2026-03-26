# Base Consult Link

Base Consult Link is a mobile-first web app for selling a single scheduled consultation slot with USDC escrow on Base.

This repository currently contains the Sprint 0 runnable skeleton only. It prepares the Next.js app shell, Base chain wiring, wagmi and viem setup, and the minimal Base Account integration point needed to start Sprint 1 safely.

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
```

## Sprint 0 Includes

- Next.js app router shell with TypeScript
- project structure aligned to frozen docs
- Base chain configuration via wagmi and viem
- React Query provider wiring
- Base Account adapter skeleton
- placeholder health endpoint
- deploy-ready docs and env template

## Not Implemented Yet

- escrow smart contracts
- SIWE auth flow
- link and deal business APIs
- DB schema and repositories
- reveal endpoint
- disputes, funding flow, or paymaster business logic
- production-ready Base Account connect UX
