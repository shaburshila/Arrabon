# Testing

The repository contains 71 test files across application logic, Route
Handlers, services, UI behavior, API smoke checks, and the escrow contract.

During development, the QA specification tracked 68 scenarios and 20
cross-layer invariants. The compact list below records the tested areas without
repeating every individual case.

## Test layers

### Unit and service tests

Node's test runner covers:

- validators and parsing;
- fee calculations;
- SIWE guards, nonce use, and sessions;
- consultation-link services;
- funding preparation and execution grants;
- deal reads and lifecycle preparation;
- dispute messages and admin resolution;
- compliance providers, cache rules, and error mapping;
- event processing and repository behavior;
- UI hooks and action-state handling.

### API smoke tests

Smoke tests run against a live Next.js development or production server and
exercise the HTTP boundary.

### Contract tests

Hardhat tests cover:

- constructor and role setup;
- price, schedule, duration, and expiry bounds;
- EIP-712 authorization and signature rejection;
- link-hash and nonce replay protection;
- USDC funding and fee calculation;
- completion, release, dispute, refund, and auto-release;
- payout holds;
- admin and owner controls;
- reentrancy and token rescue restrictions.

## Compliance suite

`npm run test:compliance` checks:

- blocked seller link creation;
- blocked buyer or seller funding;
- provider-unavailable fail-closed behavior;
- no negative cache for provider outages;
- post-funding blocked risk state;
- application-level blocking across buyer, seller, and admin payout paths;
- local denylist mutation;
- blocked frontend state and retry behavior;
- reason-code display rules.

The compliance suite does not prove:

- live behavior of every external provider;
- wallet behavior inside Base App;
- transaction results on a live testnet;
- indexer convergence against a live RPC;
- production performance;
- legal sufficiency of the screening policy.

## Critical invariants

The QA set checks that:

- one link hash creates at most one deal;
- funding authorizations and grants are single use;
- the meeting URL is not public before or after funding;
- only participants can reveal the URL;
- offchain state does not move escrowed funds;
- confirmed events are applied once;
- seller, buyer, admin, and owner actions remain separated;
- release and refund cannot both occur;
- the application gates participant and admin payout preparation when blocked;
- terminal deal states do not reopen;
- fee and price remain fixed after funding;
- unavailable compliance providers do not become clear results.

## Commands

```bash
npm run typecheck
npm run test:unit
npm run test:unit:services
npm run test:unit:security
npm run test:compliance
npm run test:smoke
npm run test:contract
```

Some unit suites are split into dedicated package scripts. See
`package.json` for the complete command list.
