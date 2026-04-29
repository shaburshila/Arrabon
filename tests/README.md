# Tests

Тестовый набор проекта разделён на несколько слоёв:

- `tests/unit/` — детерминированные unit и route/service integration tests на `node:test`
- `tests/api/` — лёгкие smoke tests против живого `next dev` / `next start`
- `tests/contract/` — Hardhat-тесты смарт-контракта

## Automated compliance suite

Команда:

```bash
npm run test:compliance
```

Что покрывает automated часть шага 13:

- blocked seller на `POST /api/links`
- blocked buyer/seller на `POST /api/links/:id/funding/prepare`
- `PROVIDER_UNAVAILABLE` как fail-closed backend path
- отсутствие negative address cache для `PROVIDER_UNAVAILABLE`
- post-funding `Blocked -> risk_status/legal hold` на test harness уровне
- blocked payout-path для `confirmRelease`, `autoRelease`, `admin resolve`
- denylist mutation path
- frontend blocked notice / retry semantics для compliance flows
- `LOCAL_DENYLIST -> mailto` display contract

Что **не** покрывает `npm run test:compliance`:

- реальный wallet flow через Base Account
- живой прогон на Base Sepolia
- фактическое onchain подтверждение, что tx не ушёл в сеть
- реальный indexer convergence на живом RPC
- exploratory сценарий обхода через прямой вызов контракта
- production-like performance benchmarking

Эти проверки остаются manual validation частью шага 13 и должны выполняться отдельно на dev-стенде.

Для non-production dev-стендов, где live provider calls на Base Sepolia недетерминированы, manual и automated проверки могут использовать env-driven dev mocks для shipped providers:

- `COMPLIANCE_CHAINALYSIS_DEV_MOCK=true`
- `COMPLIANCE_USDC_DEV_MOCK=true`
