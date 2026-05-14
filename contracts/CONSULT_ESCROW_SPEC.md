# ConsultEscrow Implementation-Ready Spec

## Scope

Implement exactly one contract:

- `ConsultEscrow.sol`

Do not add:

- factory
- per-deal contracts
- alternative funding paths
- extra lifecycle states
- fee-waiver logic

## External Functions

Required public/external methods:

- `createAndFundDeal(link_hash, seller, buyer, price, scheduled_at, duration_minutes, deadline, nonce, signature)`
  - canonical v2 funding ABI:
    - `createAndFundDeal(consultation_link_id_hash, link_hash, seller, buyer, price, scheduled_at, duration_minutes, link_expires_at, deadline, nonce, signature)`
- `markCompleted(dealId)`
- `confirmRelease(dealId)`
- `openDispute(dealId)`
- `autoRelease(dealId)`
- `adminResolveRelease(dealId)`
- `adminResolveRefund(dealId)`

Recommended admin/config methods needed for deployability:

- constructor/init for:
  - USDC address
  - treasury address
  - owner address (production: `2-of-3` multisig)
  - initial admin allowlist
  - funding authorizer address
- required admin management methods:
  - `addAdmin(address)`
  - `removeAdmin(address)`
  - `transferOwnership(address)`

## Core State

Contract must keep:

- `address owner`
- `mapping(uint256 => Deal) deals`
- `mapping(uint256 => bool) dealPayoutBlocked`
- `mapping(bytes32 => bool) usedLinkHashes`
- `mapping(bytes32 => bool) usedFundingNonces`
- `mapping(address => bool) admins`
- `uint256 adminCount`
- `uint256 nextDealId`

Deal must store:

- `linkHash`
- `seller`
- `buyer`
- `price`
- `feeAmount`
- `scheduledAt`
- `durationMinutes`
- `completedAt`
- `status`

Do not store:

- fee waiver metadata
- link expiry/cancel metadata
- backend-only link status

## Lifecycle / State Machine

Valid lifecycle states:

- `Funded`
- `ConfirmPending`
- `Released`
- `Refunded`
- `Disputed`

Important:

- `None` must not be treated as a business lifecycle state
- "deal absent" is just missing storage / zero-initialized record

Allowed transitions:

- absent -> `Funded`
- `Funded -> ConfirmPending`
- `Funded -> Disputed`
- `ConfirmPending -> Released`
- `ConfirmPending -> Disputed`
- `Disputed -> Released`
- `Disputed -> Refunded`

Forbidden transitions:

- anything out of `Released`
- anything out of `Refunded`
- direct `Funded -> Released`
- direct `Funded -> Refunded`
- direct `ConfirmPending -> Refunded`

## Access Control

Must enforce:

- `createAndFundDeal`: `msg.sender == buyer`
- `markCompleted`: `msg.sender == deal.seller`
- `confirmRelease`: `msg.sender == deal.buyer`
- `openDispute`: `msg.sender == deal.buyer`
- `addAdmin`: `msg.sender == owner`
- `removeAdmin`: `msg.sender == owner`
- `transferOwnership`: `msg.sender == owner`
- `adminResolveRelease`: `admins[msg.sender] == true`
- `adminResolveRefund`: `admins[msg.sender] == true`
- `setDealPayoutBlocked`: `admins[msg.sender] == true`
- `autoRelease`: `msg.sender == deal.seller`

Admin rotation model:

- `owner` is governance authority and should be a `2-of-3` multisig in production
- `admins` are operational resolvers for disputes / legal hold operations
- one address may be both a multisig participant and an `admin`
- `initialAdmins.length > 0` is required
- duplicate addresses in `initialAdmins` must revert
- `removeAdmin` must revert when `adminCount == 1`

## Funding Path

`createAndFundDeal` must enforce:

- `consultation_link_id_hash` is part of the signed payload
- `seller != address(0)`
- `buyer != address(0)`
- `seller != buyer`
- `usedLinkHashes[link_hash] == false`
- `usedFundingNonces[nonce] == false`
- `price` in `[10 USDC, 1000 USDC]`
- `scheduled_at > block.timestamp`
- `duration_minutes > 0`
- `link_expires_at > block.timestamp`
- `deadline >= block.timestamp`
- `signature` recovers to `fundingAuthorizer`

Funding authorization model:

- contract uses EIP-712 domain:
  - `name = "ConsultEscrow"`
  - `version = "1"`
  - `chainId = block.chainid`
  - `verifyingContract = address(this)`
- struct:
  - `FundingAuthorization(bytes32 consultationLinkIdHash,address buyer,address seller,bytes32 linkHash,uint256 price,uint256 scheduledAt,uint256 durationMinutes,uint256 linkExpiresAt,uint256 deadline,bytes32 nonce)`
- encoding rules:
  - `consultationLinkIdHash = keccak256(stringToBytes(link.id))` on the TypeScript/backend side
  - contract receives `consultationLinkIdHash` as `bytes32` input and verifies it only through the signed EIP-712 payload
  - `price` is the 6-decimal USDC amount passed to the contract
  - `scheduledAt` is Unix seconds
  - `linkExpiresAt` is Unix seconds
  - `deadline` is Unix seconds
  - `nonce` type is `bytes32`
- replay protection:
  - `usedFundingNonces[nonce] = true` after successful authorization checks and before token transfer

Accepted v1 limitation:

- contract does not know live backend link status after authorization issuance
- cancellation or expiry that happens after authorization issuance is bounded by short-lived `deadline` and `linkExpiresAt`, not by live onchain sync

Boundary behavior:

- `link_expires_at == block.timestamp` is treated as expired and must revert with `LinkExpired`
- `deadline == block.timestamp` remains valid for the funding authorization deadline check

Required ordering:

1. validate inputs
2. validate funding authorization signature, deadline and nonce freshness
3. compute `feeAmount`
4. allocate new `dealId`
5. set `usedFundingNonces[nonce] = true`
6. set `usedLinkHashes[link_hash] = true`
7. write deal storage
8. transfer `price` from buyer into contract
9. emit `DealFunded`

## Fee Logic

Locked fee model:

- fixed 2%
- no waiver
- snapshot at funding
- treasury fees accrue only on release paths

Formula:

- `feeAmount = floor(price * 200 / 10000)`

Usage:

- stored once during funding
- never recomputed

Release paths:

- seller receives `price - feeAmount` immediately
- treasury receives `feeAmount` immediately

Refund path:

- buyer gets full `price`
- treasury gets `0`

## Time Logic

`markCompleted` gate:

- seller may call only when:
  - deal is `Funded`
  - `block.timestamp >= deal.scheduledAt`
- this records `completedAt = block.timestamp` and starts the buyer response window

Post-completion window:

- `deadline = deal.scheduledAt + (deal.durationMinutes * 60) + DISPUTE_WINDOW`
- deadline is fixed and does not depend on when `markCompleted` was called

Rules:

- `confirmRelease`: allowed if `block.timestamp <= deadline`
- `openDispute` from `ConfirmPending`: allowed if `block.timestamp <= deadline`
- `autoRelease`: allowed if `block.timestamp > deadline`
- `openDispute` from `Funded`: always allowed

Boundary behavior:

- exact deadline is valid for buyer release/dispute
- auto-release only after deadline, not at equality

Implementation invariant:

- minute-to-second arithmetic must be done safely
- no silent wrapping assumptions

## Payout Invariants

For all token-moving paths:

- `confirmRelease`
- `autoRelease`
- `adminResolveRelease`
- `adminResolveRefund`

Must hold:

- function is `nonReentrant`
- status becomes terminal before any token transfer
- after terminal status, no further payout is possible
- payout can happen only once per deal

## Legal Hold

Onchain legal hold is separate from `deal.status`.

- `dealPayoutBlocked[dealId] = true` blocks:
  - `confirmRelease`
  - `autoRelease`
- `dealPayoutBlocked[dealId]` does not block:
  - `adminResolveRelease`
  - `adminResolveRefund`

`setDealPayoutBlocked(dealId, blocked)` rules:

- missing deal → revert `DealNotFound`
- terminal deal (`Released` / `Refunded`) → revert `InvalidStateTransition`
- repeated same value → no-op
- changed value → update mapping and emit `DealPayoutBlockUpdated`

## Token Handling

Must use:

- `SafeERC20`

Must not use:

- raw ERC20 `transfer`
- raw ERC20 `transferFrom`

Token flows:

- funding: contract pulls full `price` from buyer
- release: contract pays seller net and treasury fee immediately
- refund: contract pays buyer full price

## Event Contract

Implement exactly these events:

- `DealFunded`
  - `dealId` indexed
  - `link_hash` indexed
  - `seller`
  - `buyer`

- `Completed`
  - `dealId` indexed
  - `completedAt`

- `Released`
  - `dealId` indexed
  - `releasedAt`

- `Disputed`
  - `dealId` indexed

- `Refunded`
  - `dealId` indexed

- `TreasuryUpdated`
  - `previousTreasury` indexed
  - `newTreasury` indexed

Event invariants:

- `DealFunded` is the canonical onchain funding event name
- offchain lifecycle label `Funded` is just mapping from `DealFunded`
- `Completed.completedAt` must equal exact stored `completedAt`
- `Released.releasedAt` must equal exact `block.timestamp` of terminal tx

## Recommended Custom Error Coverage

Implementation should have explicit revert paths for:

- deal does not exist
- unauthorized caller
- link hash already used
- invalid price
- invalid schedule
- invalid duration
- invalid state transition
- completion too early
- confirm/dispute window expired
- auto-release too early
- caller not admin
- caller not owner
- empty initial admin list
- admin already exists
- admin not found
- last admin removal forbidden
- link expired
- no pending payout
- no pending treasury fees
- caller not treasury

## Verification Checklist For Solidity Dev

Before considering contract done, verify:

- duplicate `linkHash` funding fails
- buyer-only funding enforced
- seller cannot fund own link
- `markCompleted` fails before the start of the consultation slot
- `markCompleted` succeeds at `scheduledAt`
- `markCompleted` records `completedAt`
- `confirmRelease` succeeds at exact deadline
- `autoRelease` fails at exact deadline and succeeds after
- `openDispute` works from `Funded`
- `openDispute` works from `ConfirmPending` within deadline
- `openDispute` fails after release
- admin-only resolution enforced
- refund returns full `price`
- release accrues net to seller and fee to treasury
- seller can withdraw accrued payout exactly once per balance
- treasury can withdraw accrued fees exactly once per balance
- terminal states cannot be reopened
- timestamps in `Completed` and `Released` events are exact
- no second payout is possible after terminal transition

## Required Follow-Up Outside Solidity

Once contract is implemented, repo must be aligned in:

- ABI bindings in `/home/shaburshila/Documents/Projects/BaseConsultLink/base-consult-link/lib/base/consult-escrow.ts`
- event worker timestamp handling in `/home/shaburshila/Documents/Projects/BaseConsultLink/base-consult-link/server/workers/deal-events.ts`
- QA/docs wording for:
  - `DealFunded` naming
  - no fee waiver in v1
  - treasury fees are paid only on release paths
  - accepted offchain funding-validity limitation
