# Compliance Operations Runbook

> Version: 1.0 | Status: Draft | Date: 2026-05-06
> Составил: Base Consult Link Team | Проверил: — | Утвердил: —

This runbook covers operational procedures for three compliance scenarios:

1. [Blocked deal — post-funding alert](#1-blocked-deal--post-funding-alert)
2. [Denylist management — add / remove](#2-denylist-management)
3. [Manual override — admin resolve on a blocked deal](#3-manual-override--admin-resolve-on-a-blocked-deal)

Every action taken under this runbook **must be recorded in `audit_log`** before closing the case. Where a system action does not produce an automatic audit entry, the operator must create a manual record using the procedure in [Appendix A](#appendix-a--manual-audit-log-entry).

---

## Background

### Risk status axis

`deals.risk_status` is independent of `deals.status`. A deal can be `Funded` (deal status) and `Blocked` (risk status) simultaneously. Legal hold applies whenever `risk_status = Blocked`, regardless of deal status.

### Blocking reasons (`reason_code`)

| Code | Source | Meaning |
|---|---|---|
| `OFAC_SANCTIONS` | Chainalysis Sanctions Oracle | Wallet matched OFAC SDN or equivalent sanctions list |
| `USDC_BLACKLISTED` | Circle USDC `isBlacklisted()` | Wallet is blacklisted at the USDC contract level |
| `LOCAL_DENYLIST` | Admin-managed DB table | Wallet manually added to platform denylist |
| `PROVIDER_UNAVAILABLE` | System | Compliance provider unreachable; fail-closed applied |

### Payout block

When `deal.risk_status = Blocked`, all payout paths are blocked at the backend layer:
- `confirmRelease`
- `autoRelease`
- `adminResolveRelease`
- `adminResolveRefund`

No calldata is generated. The deal remains in legal hold until explicitly resolved by an authorized admin with documented justification.

---

## 1. Blocked Deal — Post-Funding Alert

### Trigger

Alert fires when `audit_log.action = 'compliance.blocked_post_funding'` receives a new row. This means a deal was funded on-chain but post-funding rescreening detected a blocked wallet. The funds are now in escrow under legal hold.

### Triage query

```sql
select
  created_at,
  entity_id        as deal_id,
  actor_address,
  metadata->>'tx_hash'                as tx_hash,
  metadata->>'consultation_link_id'   as link_id,
  metadata->>'buyer_address'          as buyer_address,
  metadata->>'seller_address'         as seller_address
from public.audit_log
where action = 'compliance.blocked_post_funding'
order by created_at desc
limit 20;
```

### Step-by-step

**Step 1 — Confirm the block is real**

Pull the deal from `audit_log` and verify:
- `entity_id` resolves to a real deal in `deals` table.
- `tx_hash` is confirmed on-chain (Base explorer).
- `deal.risk_status = Blocked` in the database.
- This is not a test fixture or seeded dev record.

If any of the above fails → close as false positive, log reason.

**Step 2 — Identify the blocking reason**

```sql
select
  subject_value   as wallet,
  provider,
  result,
  reason_code,
  raw_summary,
  checked_at
from public.compliance_checks
where deal_id = '<deal_id>'
order by checked_at desc;
```

Determine:
- Which wallet is blocked: buyer, seller, or both.
- Which provider triggered the block: `OFAC_SANCTIONS`, `USDC_BLACKLISTED`, `LOCAL_DENYLIST`, or `PROVIDER_UNAVAILABLE`.

**Step 3 — Apply the correct protocol based on reason_code**

| reason_code | Protocol |
|---|---|
| `OFAC_SANCTIONS` | → **[OFAC Protocol](#ofac-protocol)** — do not release or refund without legal clearance |
| `USDC_BLACKLISTED` | → **[OFAC Protocol](#ofac-protocol)** — Circle blacklist indicates regulatory action; treat same as OFAC |
| `LOCAL_DENYLIST` | → **[Non-OFAC Protocol](#non-ofac-protocol)** — platform-level block, admin can resolve |
| `PROVIDER_UNAVAILABLE` | → **[Provider Unavailable Protocol](#provider-unavailable-protocol)** — system failure, not a sanctions hit |

---

### OFAC Protocol

**Do not release or refund funds.** Under OFAC regulations, any transaction involving an SDN-designated party — including a refund — is prohibited without an OFAC license. Releasing funds is equally prohibited.

1. Freeze: confirm `deal.risk_status = Blocked` and no payout action is pending.
2. Do not use `adminResolveRelease` or `adminResolveRefund`.
3. Document the case immediately: deal ID, tx hash, wallet addresses, reason code, timestamp. → [Appendix A](#appendix-a--manual-audit-log-entry)
4. Engage legal counsel before taking any further action.
5. If instructed by counsel: apply for an OFAC Specific License at ofac.treas.gov before any fund movement.
6. Do not communicate the block reason to the affected wallet owner without legal guidance.

**Escalation:** any `OFAC_SANCTIONS` or `USDC_BLACKLISTED` case must be escalated to a decision-maker within 24 hours of alert receipt.

---

### Non-OFAC Protocol

Applies when `reason_code = LOCAL_DENYLIST` and no OFAC/USDC sanctions are involved.

1. Review the denylist entry: who added this wallet, when, and why.

```sql
select wallet_address, reason, added_by, added_at
from public.wallet_denylist
where wallet_address = '<wallet>';
```

2. Evaluate whether the denylist entry is valid:
   - Was it added due to confirmed fraud or abuse?
   - Is there a support ticket, report, or internal record supporting it?

3. Decision paths:

   **A — Block is valid (confirmed fraud/abuse):**
   - Maintain legal hold.
   - If buyer is blocked: consider refund to buyer depending on contract state and platform policy. Document decision.
   - If seller is blocked: do not release funds to seller. Consider refund to buyer if buyer is clear.
   - Use `adminResolveRefund` or `adminResolveRelease` only after documenting justification.
   - Log every action. → [Appendix A](#appendix-a--manual-audit-log-entry)

   **B — Block is invalid (false positive or entry error):**
   - Remove wallet from denylist. → [Section 2 — Denylist Management](#2-denylist-management)
   - After removal, initiate a fresh compliance re-screen for the affected wallets.
   - If re-screen returns `Clear`: update `deal.risk_status` to `Clear` via admin tooling.
   - Proceed with normal deal flow.
   - Log removal reason and re-screen result. → [Appendix A](#appendix-a--manual-audit-log-entry)

---

### Provider Unavailable Protocol

Applies when `reason_code = PROVIDER_UNAVAILABLE`. This is a system-level failure, not a confirmed sanctions hit.

1. Check provider status: Chainalysis Oracle (on-chain) and USDC contract availability (Base RPC).
2. If provider is back online: trigger a fresh compliance re-screen for the deal.
3. If fresh screen returns `Clear`: update `deal.risk_status = Clear` and resume normal flow.
4. If fresh screen returns `Blocked`: apply the protocol matching the new `reason_code`.
5. Do not release funds while `PROVIDER_UNAVAILABLE` is the only reason on record.
6. Log all actions and re-screen results. → [Appendix A](#appendix-a--manual-audit-log-entry)

---

## 2. Denylist Management

The local denylist is managed via the admin UI (Denylist page) or directly via database. All changes must be logged.

### Add a wallet to the denylist

**When to add:**
- Confirmed fraud or abuse reported by another user or internal review.
- Wallet linked to known scam activity via external report.
- Admin decision based on documented justification.

**Required before adding:**
- Written justification: reason for the block, source of the report, internal reference (support ticket, incident ID, etc.).
- Approval from a second authorized admin where possible.

**Via admin UI:**
1. Open admin Denylist page.
2. Enter wallet address.
3. Enter reason (required field — do not leave blank).
4. Submit.
5. Verify the wallet appears in the denylist table with correct `added_by` and `added_at`.

**Audit log entry required:** → [Appendix A](#appendix-a--manual-audit-log-entry)

```
action: compliance.denylist_add
entity_id: <wallet_address>
metadata: { reason, source, reference_id, added_by }
```

**Effect:** all future compliance checks for this wallet will return `Blocked / LOCAL_DENYLIST`. Existing in-progress deals involving this wallet will be re-screened on next lifecycle action and may enter legal hold.

---

### Remove a wallet from the denylist

**When to remove:**
- False positive confirmed.
- Entry added in error.
- Underlying reason resolved and documented.

**Required before removing:**
- Written justification: why the entry is being removed.
- Confirmation that no active OFAC or USDC blacklist hit exists for this wallet (run a fresh manual check before removing).
- Approval from a second authorized admin where possible.

**Verify no active sanctions before removing:**

```sql
select result, reason_code, checked_at
from public.compliance_checks
where subject_value = '<wallet>'
  and result = 'Blocked'
  and reason_code != 'LOCAL_DENYLIST'
order by checked_at desc
limit 5;
```

If any non-denylist `Blocked` result exists → do not remove from denylist. Apply OFAC Protocol instead.

**Via admin UI:**
1. Open admin Denylist page.
2. Locate the wallet entry.
3. Remove entry.
4. Verify entry is no longer present.

**Audit log entry required:** → [Appendix A](#appendix-a--manual-audit-log-entry)

```
action: compliance.denylist_remove
entity_id: <wallet_address>
metadata: { reason, removed_by, prior_reason }
```

---

## 3. Manual Override — Admin Resolve on a Blocked Deal

Admin resolve (`adminResolveRelease` or `adminResolveRefund`) on a deal where `risk_status = Blocked` is a high-risk action. It must never be performed without documented justification and audit trail.

### Prerequisites before any admin resolve on a blocked deal

All of the following must be true before proceeding:

- [ ] `reason_code` is **not** `OFAC_SANCTIONS` or `USDC_BLACKLISTED`. (If it is → OFAC Protocol applies; stop here.)
- [ ] Written justification exists explaining why the override is authorized.
- [ ] A second authorized admin has reviewed and acknowledged the justification.
- [ ] The compliance re-screen has been re-run and results are documented.
- [ ] The audit log entry is prepared and will be submitted immediately after the action.

### Step-by-step

**Step 1 — Re-run compliance check**

Before any override, run a fresh compliance check on both buyer and seller wallets. Document results.

**Step 2 — Prepare justification record**

Document in writing:
- Deal ID, tx hash, wallet addresses.
- Original block reason and reason_code.
- Basis for override (e.g., confirmed false positive, denylist entry removed, legal counsel clearance).
- Which admin is authorizing and which is executing.
- Timestamp.

**Step 3 — Execute admin resolve**

1. Open admin deal detail page.
2. Confirm `risk_status` and `deal.status` displayed.
3. Acknowledge the compliance warning banner (required UI step).
4. Select resolution: Release (to seller) or Refund (to buyer).
5. Confirm the action.

**Step 4 — Log immediately after execution**

→ [Appendix A](#appendix-a--manual-audit-log-entry)

```
action: compliance.admin_override_resolve
entity_id: <deal_id>
metadata: {
  resolution: "release" | "refund",
  original_reason_code: "<code>",
  justification: "<text>",
  authorized_by: "<admin_wallet>",
  executed_by: "<admin_wallet>",
  rescreen_result: "<Clear | Blocked>",
  rescreen_timestamp: "<iso8601>"
}
```

**Step 5 — Verify on-chain**

Confirm the release or refund transaction was confirmed on-chain. Record tx hash in the audit log entry.

---

## Appendix A — Manual Audit Log Entry

When a system action does not automatically produce an audit log row, the operator must insert a manual record.

```sql
insert into public.audit_log (
  action,
  entity_type,
  entity_id,
  actor_address,
  metadata,
  created_at
) values (
  '<action>',
  '<entity_type>',
  '<entity_id>',
  '<admin_wallet_address>',
  '<jsonb metadata>',
  now()
);
```

All manual audit entries must include:
- `action`: a descriptive string in `compliance.<verb>` format.
- `entity_id`: deal ID or wallet address depending on context.
- `actor_address`: the admin wallet performing the action.
- `metadata`: structured JSON with justification, reference IDs, and any supporting data.
- `created_at`: current timestamp (use `now()`).

Manual entries must never be deleted or modified after insertion. If a correction is needed, insert a new entry with `action: compliance.correction` referencing the original entry.

---

## Appendix B — Escalation Contacts

| Situation | Escalate to |
|---|---|
| `OFAC_SANCTIONS` hit on any deal | Legal counsel — within 24h |
| `USDC_BLACKLISTED` hit on any deal | Legal counsel — within 24h |
| Admin resolve requested without dual approval | Decline until second admin reviews |
| Provider unavailable for > 2 hours | Engineering on-call |

---

## Change Log

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-05-06 | Initial release |
