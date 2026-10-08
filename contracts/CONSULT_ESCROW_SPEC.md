# ConsultEscrow contract reference

`ConsultEscrow.sol` holds USDC for one scheduled consultation and enforces the
deal lifecycle on Base.

This document describes the final contract. The Solidity source and tests are
authoritative.

## Stored state

Each deal stores:

- single-use link hash;
- seller and buyer;
- consultation price and fee snapshot;
- scheduled time and duration;
- completion time;
- lifecycle status.

Contract-level state also stores:

- used link hashes;
- used funding nonces;
- per-deal payout-block flags;
- owner, treasury, funding authorizer, and admin set;
- the next deal ID.

The contract does not store the meeting URL, product description, offchain link
status, dispute messages, or compliance-provider results.

## Deal status

```solidity
enum Status {
    None,
    Funded,
    ConfirmPending,
    Released,
    Refunded,
    Disputed
}
```

`None` represents an absent deal rather than a product state.

Allowed transitions:

- absent to `Funded`;
- `Funded` to `ConfirmPending` or `Disputed`;
- `ConfirmPending` to `Released` or `Disputed`;
- `Disputed` to `Released` or `Refunded`.

`Released` and `Refunded` are terminal.

## Funding authorization

Funding uses this EIP-712 domain:

```text
name:              ConsultEscrow
version:           1
chainId:           deployment chain ID
verifyingContract: contract address
```

Signed type:

```text
FundingAuthorization(
  bytes32 consultationLinkIdHash,
  address buyer,
  address seller,
  bytes32 linkHash,
  uint256 price,
  uint256 scheduledAt,
  uint256 durationMinutes,
  uint256 linkExpiresAt,
  uint256 deadline,
  bytes32 nonce
)
```

The signer must equal `fundingAuthorizer`. The owner can rotate that address.
Rotation invalidates authorizations signed by the previous key.

## createAndFundDeal

The call must come from the signed buyer. The contract rejects:

- zero or identical participant addresses;
- a used link hash or funding nonce;
- a price outside 10–100,000 USDC;
- a schedule that is not in the future;
- zero duration or duration above 1,440 minutes;
- an expired link;
- link expiry later than the scheduled time;
- an expired funding authorization;
- a signature not produced by the current authorizer.

After validation, the contract:

1. calculates the fee;
2. allocates a deal ID;
3. consumes the nonce and link hash;
4. stores the funded deal;
5. transfers price plus fee from the buyer;
6. emits `DealFunded`.

A failed token transfer reverts the state writes.

## Fee

```text
raw fee = floor(price * 300 / 10,000)
fee     = clamp(raw fee, 1.50 USDC, 30 USDC)
```

The fee is fixed at funding. On release, the seller receives the price and the
treasury receives the fee. On refund, the buyer receives the price and the
treasury still receives the fee.

## Lifecycle functions

### markCompleted

- caller must be the seller;
- status must be `Funded`;
- current time must be at or after `scheduledAt`.

The function records `completedAt` and moves the deal to
`ConfirmPending`.

### confirmRelease

- caller must be the buyer;
- status must be `ConfirmPending`;
- current time must be at or before the deadline;
- payout must not be blocked.

### openDispute

The buyer can dispute from:

- `Funded`, without a separate deadline check; or
- `ConfirmPending`, at or before the deadline.

### autoRelease

- caller must be the seller;
- status must be `ConfirmPending`;
- current time must be after the deadline;
- payout must not be blocked.

The deadline is:

```text
scheduledAt + durationMinutes * 60 + 48 hours
```

### Admin resolution

An admin can release or refund only a `Disputed` deal.

The onchain `dealPayoutBlocked` flag does not block admin resolution. The
application applies compliance checks before preparing those calls, but an
admin wallet remains trusted at the contract boundary.

## Roles

The owner can:

- add and remove admins;
- transfer ownership;
- change the treasury;
- rotate the funding authorizer;
- rescue tokens other than the escrow USDC.

At least one admin must remain. Admins can:

- resolve disputed deals;
- set or clear a participant payout hold.

Ownership transfer is a single-step assignment in this contract.

## Token handling

USDC transfers use OpenZeppelin `SafeERC20`. Funding, release, refund, and
token rescue use `ReentrancyGuard` where tokens move.

The owner cannot rescue the configured USDC token because it may include
escrowed user funds. Other tokens sent to the contract can be rescued to the
owner.

## Events

- `DealFunded`;
- `Completed`;
- `Released`;
- `Disputed`;
- `Refunded`;
- `DealPayoutBlockUpdated`;
- `AdminAdded` and `AdminRemoved`;
- `OwnershipTransferred`;
- `TreasuryUpdated`;
- `FundingAuthorizerUpdated`;
- `TokenRescued`.

## Deployment

The final mainnet address is
[`0x2EB0e35AbF9035f7A3B1807B857dc33518D1C5aD`](https://basescan.org/address/0x2EB0e35AbF9035f7A3B1807B857dc33518D1C5aD).

See [deployment records](../docs/deployments.md) and
[security notes](../docs/security.md).
