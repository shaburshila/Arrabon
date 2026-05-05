# Production Readiness Checklist

> Version: 1.1 | Status: Актуален | Date: 2026-05-05
> Составил: Base Consult Link Team | Проверил: — | Утвердил: —

This document tracks work and configuration that must be completed before a production launch.

It is intentionally separate from testnet validation notes. Testnet/dev may allow temporary settings that must not accidentally ship to production.

## Auth / SIWE

- [ ] Set `AUTH_DOMAIN` to the canonical production host only.
  - Example: `AUTH_DOMAIN=app.baseconsultlink.com`
  - Do not use `localhost`, `127.0.0.1`, LAN IPs, tunnel hosts, or preview hosts in production.

- [ ] Keep `AUTH_ALLOWED_DOMAINS` empty in production unless there is a deliberate, reviewed multi-domain production setup.
  - Dev/testnet may use values such as `127.0.0.1:3000` or a tunnel domain.
  - Production must not inherit dev allowlist values.

- [ ] If `NEXT_PUBLIC_AUTH_DOMAIN` is used in production, set it to the same canonical production host as `AUTH_DOMAIN`.
  - This value is public and not a secret.
  - It only controls which domain the client places in the SIWE message.

- [ ] Verify SIWE sign-in from the exact production URL.
  - The signed SIWE domain must match one of the server-allowed domains.
  - A mismatch must continue to fail closed with `401`.

## Environment

- [ ] Review all `NEXT_PUBLIC_*` values for production correctness.
  - `NEXT_PUBLIC_BASE_CHAIN_ID`
  - `NEXT_PUBLIC_RPC_URL`
  - `NEXT_PUBLIC_CONSULT_ESCROW_ADDRESS`
  - `NEXT_PUBLIC_USDC_ADDRESS`
  - `NEXT_PUBLIC_TREASURY_WALLET`

- [ ] Confirm all server-only secrets are present only in server runtime config.
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `MEETING_URL_ENCRYPTION_KEY`
  - deployer/private keys, if any, must not be present in app runtime.

## Chain / Indexing

- [ ] Set `CHAIN_SYNC_START_BLOCK` to the deployed escrow contract block.
- [ ] Set production-safe `CHAIN_SYNC_CONFIRMATIONS`.
- [ ] Set production-safe `CHAIN_SYNC_MAX_RANGE`.
- [ ] Confirm the internal worker route is protected by `INTERNAL_SYNC_SECRET`.
- [ ] Configure a production scheduler/worker process for event syncing.

## Contracts

- [ ] Confirm production escrow contract address.
- [ ] Confirm production USDC address.
- [ ] Confirm treasury/admin wallets.
- [ ] Archive deployment transaction hashes and block numbers.

## Data / Security

- [ ] Reset the Supabase database password before any public testnet or production deployment.
  - The current test database password was exposed during local setup discussion and must be treated as compromised.
  - After reset, update any local `SUPABASE_DB_URL` / database connection strings that depend on the password.
  - Do not share the replacement password in chat, commits, issue comments, logs, or screenshots.

- [ ] Confirm Supabase RLS and service-role usage boundaries.
- [ ] Confirm meeting URL encryption key is generated securely and backed up.
- [ ] Confirm session cookie settings are production-safe.
- [ ] Review admin dispute-resolution access before enabling admin workflows.

## UX / Operations

- [ ] Verify production error messages do not expose secrets or internal stack traces.
- [ ] Verify funding, indexing, lifecycle actions, and meeting URL reveal manually on production-like infrastructure.
- [ ] Confirm monitoring/logging exists for failed sync runs and auth failures.
- [ ] Confirm an alert is configured for `audit_log.action = 'compliance.blocked_post_funding'` and tested against a real or seeded event.

### Alert spec: compliance.blocked_post_funding

Source of truth:
- `audit_log.action = 'compliance.blocked_post_funding'`
- This is a system-generated backend event appended during post-funding compliance blocking.
- `actor_address` is expected to be `null` for this signal.

Suggested query pattern:

```sql
select
  created_at,
  entity_id,
  actor_address,
  metadata->>'tx_hash' as tx_hash,
  metadata->>'consultation_link_id' as consultation_link_id,
  metadata->>'buyer_address' as buyer_address,
  metadata->>'seller_address' as seller_address
from public.audit_log
where action = 'compliance.blocked_post_funding'
order by created_at desc;
```

Minimum alert condition:
- Trigger when at least one new `compliance.blocked_post_funding` row appears.

Suggested alert payload fields:
- `entity_id`
- `created_at`
- `metadata.tx_hash`
- `metadata.consultation_link_id`
- `metadata.buyer_address`
- `metadata.seller_address`

Triage steps:
- Load the deal using `entity_id`.
- Verify the linked `tx_hash` and participating wallets.
- Confirm the row corresponds to a real post-funding compliance block, not a test fixture.
- Escalate to manual review / support handling for the blocked deal.

---

## Лист регистрации изменений

| Версия | Дата | Изменения |
|---|---|---|
| 1.1 | 2026-05-05 | Добавлена спецификация alert на `compliance.blocked_post_funding` в `audit_log` |
| 1.0 | 2026-04-28 | Первичный выпуск |
