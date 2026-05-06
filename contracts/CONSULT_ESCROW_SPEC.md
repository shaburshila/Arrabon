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
  - initial admin allowlist
  - funding authorizer address
- optional admin management methods only if mutable allowlist is needed

## Core State

Contract must keep:

- `mapping(uint256 => Deal) deals`
- `mapping(bytes32 => bool) usedLinkHashes`
- `mapping(bytes32 => bool) usedFundingNonces`
- `mapping(address => bool) admins`
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
- `adminResolveRelease`: `admins[msg.sender] == true`
- `adminResolveRefund`: `admins[msg.sender] == true`
- `autoRelease`: permissionless

## Funding Path

`createAndFundDeal` must enforce:

- `seller != address(0)`
- `buyer != address(0)`
- `seller != buyer`
- `usedLinkHashes[link_hash] == false`
- `usedFundingNonces[nonce] == false`
- `price` in `[10 USDC, 1000 USDC]`
- `scheduled_at > block.timestamp`
- `duration_minutes > 0`
- `deadline >= block.timestamp`
- `signature` recovers to `fundingAuthorizer`

Funding authorization model:

- contract uses EIP-712 domain:
  - `name = "ConsultEscrow"`
  - `version = "1"`
  - `chainId = block.chainid`
  - `verifyingContract = address(this)`
- struct:
  - `FundingAuthorization(address buyer,address seller,bytes32 linkHash,uint256 price,uint256 scheduledAt,uint256 durationMinutes,uint256 deadline,bytes32 nonce)`
- encoding rules:
  - `price` is the 6-decimal USDC amount passed to the contract
  - `scheduledAt` is Unix seconds
  - `deadline` is Unix seconds
  - `nonce` type is `bytes32`
- replay protection:
  - `usedFundingNonces[nonce] = true` after successful authorization checks and before token transfer

Accepted v1 limitation:

- contract does not validate expired/cancelled link status

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
- treasury paid only on release paths

Formula:

- `feeAmount = floor(price * 200 / 10000)`

Usage:

- stored once during funding
- never recomputed

Release paths:

- seller gets `price - feeAmount`
- treasury gets `feeAmount`

Refund path:

- buyer gets full `price`
- treasury gets `0`

## Time Logic

`markCompleted` gate:

- seller may call any time while the deal is `Funded`
- this records `completedAt = block.timestamp` and starts the buyer response window

Post-completion window:

- `deadline = completedAt + 48 hours`

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

For all token-moving terminal paths:

- `confirmRelease`
- `autoRelease`
- `adminResolveRelease`
- `adminResolveRefund`

Must hold:

- function is `nonReentrant`
- status becomes terminal before any token transfer
- after terminal status, no further payout is possible
- payout can happen only once per deal

## Token Handling

Must use:

- `SafeERC20`

Must not use:

- raw ERC20 `transfer`
- raw ERC20 `transferFrom`

Token flows:

- funding: contract pulls full `price` from buyer
- release: contract pays seller net and treasury fee
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

## Verification Checklist For Solidity Dev

Before considering contract done, verify:

- duplicate `linkHash` funding fails
- buyer-only funding enforced
- seller cannot fund own link
- `markCompleted` succeeds immediately after funding when called by seller
- `markCompleted` records `completedAt`
- `confirmRelease` succeeds at exact deadline
- `autoRelease` fails at exact deadline and succeeds after
- `openDispute` works from `Funded`
- `openDispute` works from `ConfirmPending` within deadline
- `openDispute` fails after release
- admin-only resolution enforced
- refund returns full `price`
- release pays net to seller and fee to treasury
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
  - treasury payout only on release paths
  - accepted offchain funding-validity limitation
