# User flows

## Create a consultation link

1. The expert connects a wallet and signs in.
2. The expert enters the title, description, USDC price, date, time, duration,
   timezone, expiry, and meeting URL.
3. The server validates the schedule, amount, wallet, and compliance result.
4. The meeting URL is encrypted before storage.
5. The server creates an open link with a unique public ID and link hash.

The expert can list and cancel open links. A funded link becomes consumed and
cannot be reused.

## Fund a link

1. The client opens the public link.
2. The UI rejects links that are cancelled, expired, consumed, or no longer
   fundable.
3. The client connects a wallet and signs in.
4. The prepare route reruns participant, timing, and compliance checks.
5. The server issues a short-lived one-time funding grant.
6. The execute route exchanges that grant for final calldata and an EIP-712
   funding authorization.
7. The client approves the required USDC amount if needed.
8. The wallet calls `createAndFundDeal`.
9. The contract stores the deal and transfers price plus fee into escrow.
10. The event worker marks the link consumed and creates the deal read model.

If the wallet transaction is rejected or fails, no onchain deal is created.
The backend does not mark funding complete before a confirmed event.

## Reveal the meeting URL

1. A funded participant opens the deal page.
2. The server checks the SIWE session and request-throttling state.
3. The wallet must match the deal's buyer or seller.
4. The server reads and decrypts the meeting URL.
5. The plaintext URL is returned only for that request.

Anonymous users and unrelated wallets receive no meeting URL. The plaintext is
not stored onchain.

## Complete and release

1. At or after the scheduled time, the seller prepares a
   `markCompleted` transaction.
2. A confirmed transaction moves the deal from `Funded` to
   `ConfirmPending`.
3. The buyer prepares a release and receives a one-time payout execution grant.
4. The execute route rechecks participant and compliance state.
5. The buyer submits `confirmRelease`.
6. The contract sends the price to the seller and the fee to the treasury.

The buyer confirmation must occur before the contract deadline and while no
payout hold is active.

## Auto-release

If the buyer does not respond, the seller can prepare `autoRelease` after:

```text
scheduled time + consultation duration + 48 hours
```

The contract rejects early calls and calls made while payout is blocked.

## Open a dispute

The buyer can open a dispute:

- while the deal is `Funded`, including a seller no-show case; or
- while it is `ConfirmPending` and the response deadline has not passed.

The deal moves to `Disputed`. Buyer, seller, and admins can use the offchain
message thread. Evidence is stored as a link rather than an uploaded file.

## Resolve a dispute

1. An admin reviews the deal, participant messages, and compliance state.
2. The admin prepares either release or refund.
3. The backend records a short-lived resolution intent and issues an execution
   grant.
4. The execute route consumes the grant and returns transaction data.
5. The admin wallet calls the matching contract function.

Release pays the consultation price to the seller. Refund returns it to the
buyer. The fee goes to the treasury in either case.

## Compliance block

Protected actions check the local denylist, USDC blacklist, and Chainalysis
result.

- A blocked pre-funding result stops the action.
- Provider unavailability follows a fail-closed response.
- A blocked result after funding updates offchain risk state and requests an
  onchain payout hold.
- Release and refund remain unavailable while that hold is active.

Risk review does not silently rewrite the deal state.

## Recovery and replay

The worker applies only confirmed events. Reprocessing a known transaction is
idempotent. Persistent cursors allow the worker to continue after an RPC or
process interruption.

If the database is stale, the UI may show an older state until synchronization
finishes. The contract balance and lifecycle state remain authoritative.
