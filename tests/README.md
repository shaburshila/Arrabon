# Tests

The test suite is split by execution boundary:

- `tests/unit` — validators, repositories, services, Route Handlers, hooks,
  and UI state using Node's test runner;
- `tests/api` — smoke checks against a running Next.js server;
- `tests/contract` — Hardhat tests for `ConsultEscrow`.

The dedicated compliance command is:

```bash
npm run test:compliance
```

It covers blocked link creation and funding, provider-unavailable behavior,
post-funding risk state, payout holds, denylist changes, and frontend blocked
states.

Live provider behavior, wallet flows, testnet confirmation, RPC convergence,
and production performance require separate environment-level checks.

See [testing documentation](../docs/testing.md) for scope and limitations.
