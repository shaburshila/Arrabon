# State machine

Arrabon keeps link, deal, and risk state separate. Each state has a different
owner:

- link state is an offchain product model;
- deal state is controlled by `ConsultEscrow`;
- risk state is produced by the compliance layer;
- payout-block state is stored onchain.

## Consultation link

```text
Draft --> Open --> Consumed
           |  \
           |   --> Cancelled
           ------> Expired
```

| Transition | Condition |
|---|---|
| `Draft -> Open` | Link passes validation and is published |
| `Open -> Consumed` | A confirmed `DealFunded` event uses its link hash |
| `Open -> Cancelled` | Expert cancels before funding |
| `Open -> Expired` | Expiry passes before funding |

`Consumed`, `Cancelled`, and `Expired` are terminal for funding.

## Deal

```text
Funded --> ConfirmPending --> Released
   |             |
   |             --> Disputed --> Released
   |                         --> Refunded
   -----------------> Disputed
```

| Transition | Authorized actor and condition |
|---|---|
| `None -> Funded` | Buyer calls `createAndFundDeal` with a valid authorization |
| `Funded -> ConfirmPending` | Seller calls `markCompleted` at or after schedule |
| `Funded -> Disputed` | Buyer opens a no-show dispute |
| `ConfirmPending -> Released` | Buyer confirms before deadline |
| `ConfirmPending -> Released` | Seller auto-releases after deadline |
| `ConfirmPending -> Disputed` | Buyer disputes before deadline |
| `Disputed -> Released` | Admin resolves in favor of release |
| `Disputed -> Refunded` | Admin resolves in favor of refund |

`Released` and `Refunded` are terminal.

## Deadline

The contract calculates:

```text
deadline = scheduledAt + durationMinutes * 60 + 48 hours
```

The seller may call `markCompleted` after the scheduled start even if the
response deadline has already passed. In that case the buyer cannot use the
expired confirmation window, while the seller may be immediately eligible for
auto-release. This is contract behavior and should not be inferred from UI
timers alone.

## Risk state

The offchain risk result is one of:

- `Clear`;
- `Review`;
- `Blocked`.

Provider results are combined by severity. A provider outage does not become a
clear result.

Risk state does not replace deal state. A funded or disputed deal can also be
blocked.

## Payout hold

`dealPayoutBlocked[dealId]` is a separate onchain boolean controlled by
contract admins.

When true, it blocks:

- buyer-confirmed release;
- seller auto-release.

It does not erase funds or change the deal status. Removing the hold restores
the normal participant transition rules. Admin release and refund are checked
by the application but are not blocked by this contract flag. Contract admins
remain a trusted role.

## Invariants

- A link hash funds at most one deal.
- A funding nonce is consumed at most once.
- Buyer and seller are different non-zero wallets.
- Only the seller marks completion.
- Only the buyer confirms release or opens a dispute.
- Only an admin resolves a dispute or changes a payout hold.
- The last contract admin cannot be removed.
- The escrow USDC token cannot be rescued by the owner.
- Price and fee are fixed in the deal at funding.
- Released and refunded deals cannot transition again.
