# Refund and Hold Policy — Internal

> Version: 1.0 | Status: Draft — requires legal review before production | Date: 2026-05-06
> Составил: Arrabon Team | Проверил: — | Утвердил: —

This document defines the platform's internal policy for refund eligibility, fund holds, and prohibited actions. It is the authoritative reference for admin decisions involving fund disposition and must be read alongside the [Compliance Runbook](compliance-runbook.md).

---

## 1. Definitions

**Release** — funds transferred from escrow to seller. Terminal state: `Released`.

**Refund** — funds returned from escrow to buyer. Terminal state: `Refunded`.

**Legal Hold** — condition where `deal.risk_status = Blocked` prevents any payout action. Neither release nor refund can be executed while a legal hold is active.

**Auto-Release** — system-initiated release to seller after the 48-hour dispute window expires following `markCompleted`, with no buyer dispute or confirmation. Requires no admin action.

**Platform Fee** — any fee applied by the Service within the escrow flow. Fees are governed by the Terms of Service and may be non-refundable.

---

## 2. System Outcomes — No Admin Action Required

The following outcomes are enforced automatically by the smart contract and platform logic. No admin intervention is needed or permitted to alter them once triggered.

| Scenario | Outcome | Refund? |
|---|---|---|
| Link expires before funding | No deal created | N/A — no funds in escrow |
| Link cancelled by seller before funding | No deal created | N/A — no funds in escrow |
| Buyer confirms release (`confirmRelease`) | `Released` → seller | No |
| Auto-release fires after 48h dispute window | `Released` → seller | No |
| Pre-funding compliance block (seller or buyer) | Funding rejected at `prepare` | N/A — no funds in escrow |

Once `autoRelease` or `confirmRelease` has executed on-chain, the outcome is final and irreversible. No refund is possible after this point.

---

## 3. Refund-Eligible Scenarios — Admin Decision Required

A refund (`adminResolveRefund`) is only reachable from `Disputed` state. Admin must evaluate each case on its merits. The following scenarios represent situations where a refund may be appropriate, subject to compliance clearance and the restrictions in Section 5.

### 3.1 No-Show Dispute (Buyer opens dispute from `Funded`)

Buyer funded the deal but seller did not appear or perform the consultation. Buyer opens dispute before `markCompleted`.

**Eligibility:** refund is generally appropriate if:
- Buyer can demonstrate no service was delivered (e.g., timestamped evidence of absence).
- No `markCompleted` has been submitted by seller.
- The dispute was opened within the permitted window.

**Admin action:** `adminResolveRefund` → buyer receives USDC from escrow.

### 3.2 Service Quality Dispute (Buyer opens dispute from `ConfirmPending`)

Seller marked the consultation complete, but buyer disputes the quality or delivery within the 48-hour window.

**Eligibility:** admin must weigh available evidence from both parties. Neither a refund nor a release is presumptively correct. Factors to consider:
- Evidence submitted by buyer (dispute message, links).
- Seller's position if provided.
- Nature of the service and what was agreed in the Consultation Link description.

**Admin action:** `adminResolveRefund` (buyer wins) or `adminResolveRelease` (seller wins).

### 3.3 Post-Funding Compliance Block — Non-OFAC (Local Denylist)

Funds are in escrow. Post-funding rescreening detected a `LOCAL_DENYLIST` hit. Legal hold is active.

**Eligibility for refund:**
- Reason code must be `LOCAL_DENYLIST` only. If `OFAC_SANCTIONS` or `USDC_BLACKLISTED` is present, see Section 5.
- If **seller** is blocked and **buyer** is clear: refund to buyer is generally appropriate. Admin must confirm buyer wallet passes a fresh compliance screen before executing.
- If **buyer** is blocked and **seller** is clear: refund to buyer is generally not appropriate (blocked party would receive funds). Admin must engage legal counsel before taking any action.
- If **both** are blocked: no payout. Engage legal counsel.

**Admin action:** `adminResolveRefund` if buyer is clear and conditions above are met, following the [Compliance Runbook — Manual Override](compliance-runbook.md#3-manual-override--admin-resolve-on-a-blocked-deal) procedure.

---

## 4. Platform Fees

Platform fees, where applied, are deducted within the escrow flow at the smart contract level. The following fee treatment applies to refund scenarios:

- **No-show dispute (seller fault):** platform fee refund is subject to product decision. Default: non-refundable unless product policy states otherwise.
- **Service quality dispute:** platform fee is non-refundable regardless of dispute outcome.
- **Compliance block — non-OFAC:** platform fee treatment follows the same logic as the underlying refund decision.
- **Compliance block — OFAC:** no fee movement until legal clearance obtained.

This section must be updated once fee structure is finalized.

---

## 5. Hold Conditions — When Payouts Are Prohibited

The following conditions prevent any payout action (release or refund). Attempting to execute a payout while any of these conditions is active is a policy violation.

### 5.1 Active Legal Hold (`risk_status = Blocked`)

Any deal where `risk_status = Blocked` is in legal hold. No `adminResolveRelease` or `adminResolveRefund` may be executed until the hold is resolved per the [Compliance Runbook](compliance-runbook.md).

### 5.2 OFAC Sanctions or USDC Blacklist

If `reason_code = OFAC_SANCTIONS` or `USDC_BLACKLISTED` is present in `compliance_checks` for any wallet involved in the deal:

- **Do not refund.** A refund to a sanctioned wallet is itself a prohibited transaction under OFAC regulations.
- **Do not release.** Releasing funds to a sanctioned wallet is equally prohibited.
- Funds must remain frozen in escrow until an OFAC Specific License is obtained or legal counsel confirms an alternative lawful disposition.
- Engage legal counsel within 24 hours of identifying the hit.

This restriction applies regardless of whether buyer or seller is the sanctioned party.

### 5.3 Provider Unavailable

If `reason_code = PROVIDER_UNAVAILABLE` is the sole basis for a block, hold the deal until a fresh compliance re-screen can be completed with providers online. Do not execute any payout while provider status is unresolved. See [Compliance Runbook — Provider Unavailable Protocol](compliance-runbook.md#provider-unavailable-protocol).

---

## 6. Decision Matrix

| State | risk_status | reason_code | Permitted action |
|---|---|---|---|
| `Disputed` | `Clear` | — | `adminResolveRelease` or `adminResolveRefund` per case merits |
| `Disputed` | `Blocked` | `LOCAL_DENYLIST` | `adminResolveRefund` to clear buyer only — see §3.3 |
| `Disputed` | `Blocked` | `OFAC_SANCTIONS` | No payout — engage legal counsel |
| `Disputed` | `Blocked` | `USDC_BLACKLISTED` | No payout — engage legal counsel |
| `Disputed` | `Blocked` | `PROVIDER_UNAVAILABLE` | Hold — re-screen when providers online |
| `Funded` | `Blocked` | `OFAC_SANCTIONS` | No payout — engage legal counsel |
| `Funded` | `Blocked` | `LOCAL_DENYLIST` | Hold — evaluate per §3.3 after dispute opened |
| `Released` | any | — | No action — terminal state, irreversible |
| `Refunded` | any | — | No action — terminal state, irreversible |

---

## 7. Prohibited Actions

The following actions are prohibited under this policy regardless of circumstances:

- Issuing any payout (release or refund) while `risk_status = Blocked` without following the Compliance Runbook override procedure.
- Refunding to a wallet with an active `OFAC_SANCTIONS` or `USDC_BLACKLISTED` hit.
- Releasing funds to a sanctioned wallet.
- Issuing a refund from `Released` or `Refunded` state (terminal states are irreversible).
- Issuing a refund without a corresponding `audit_log` entry.
- Executing admin resolve without dual-admin acknowledgement on any blocked deal.

---

## 8. Audit Requirements

Every refund execution must produce the following audit trail:

1. **System entry** — `adminResolveRefund` execution produces an automatic `audit_log` entry via the backend.
2. **Manual justification entry** — admin must additionally insert a manual `audit_log` entry per [Compliance Runbook — Appendix A](compliance-runbook.md#appendix-a--manual-audit-log-entry) documenting:
   - Deal ID and buyer/seller wallets.
   - Scenario type (§3.1, §3.2, or §3.3).
   - Evidence reviewed and decision rationale.
   - Compliance re-screen result at time of decision.
   - Admin(s) involved.

---

## Change Log

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-05-06 | Initial release |
