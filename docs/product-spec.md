# Product rules

Arrabon lets an expert sell one scheduled consultation through a single-use
link. A client funds the deal in USDC, and `ConsultEscrow` holds the funds
until release or refund.

The service is offline. These rules describe the completed MVP and the contract
deployed in May 2026.

## Actors

| Actor | Responsibility |
|---|---|
| Expert / seller | Creates the link, provides the session, marks completion |
| Client / buyer | Funds the deal, confirms release, or opens a dispute |
| Admin | Reviews disputes and applies or removes payout holds |
| Owner | Manages contract admins, treasury, and funding authorizer |
| Funding authorizer | Signs short-lived EIP-712 funding payloads after backend checks |
| Event worker | Synchronizes confirmed contract events into PostgreSQL |

## Consultation link

A link contains:

- title and description;
- expert wallet;
- price in USDC;
- scheduled time and display timezone;
- expiry time;
- duration in minutes;
- encrypted meeting URL;
- a unique link hash.

The link status is one of `Draft`, `Open`, `Expired`, `Cancelled`, or
`Consumed`.

Only an open, unexpired link can be funded. Cancellation is available before
funding. One link hash can create at most one onchain deal.

## Time and amount rules

The deployed contract enforces:

- price from 10 to 100,000 USDC;
- a future consultation time;
- duration from 1 to 1,440 minutes;
- link expiry later than the current block time;
- link expiry no later than the scheduled time;
- a funding authorization deadline that has not passed.

USDC uses six decimal places. Transaction values are prepared as integers
rather than floating-point display amounts.

## Funding

Funding uses a prepare-and-execute flow.

1. The buyer signs in with Ethereum.
2. The backend rechecks the link, participants, timing, and compliance state.
3. The backend issues a short-lived, one-time execution grant.
4. Exchanging the grant returns final transaction data and an EIP-712
   authorization.
5. The buyer approves USDC if required and calls `createAndFundDeal`.
6. The contract marks the link hash and authorization nonce as used, creates
   the deal, and transfers the price plus fee into escrow.
7. Confirmed events update the offchain read model.

The onchain call must come from the buyer named in the signed authorization.
Seller and buyer cannot be the same wallet.

## Fee

The contract charges 3% of the consultation price with a floor of 1.50 USDC
and a cap of 30 USDC.

```text
fee = clamp(floor(price * 300 / 10,000), 1.50 USDC, 30 USDC)
buyer transfer = price + fee
```

The seller receives the consultation price. The treasury receives the fee on
release or refund.

## Deal lifecycle

The onchain deal starts in `Funded`.

- The seller can mark it complete at or after the scheduled time.
- Completion moves it to `ConfirmPending`.
- The buyer can confirm release during the response window.
- The buyer can open a dispute from `Funded` or from `ConfirmPending` before
  the deadline.
- The seller can auto-release after the consultation duration plus the
  48-hour response window.
- An admin can resolve a disputed deal by release or refund.

`Released` and `Refunded` are terminal states.

## Meeting URL

The meeting URL is encrypted with AES-256-GCM before database storage. It is
not stored onchain.

Reveal requires:

- a valid SIWE session;
- a wallet matching the buyer or seller;
- a funded deal in a state where participant access is allowed;
- request-throttling checks.

Encryption limits database exposure but does not protect against a compromised
application server with access to both ciphertext and encryption keys.

## Disputes

The buyer can open a dispute if the seller did not provide the session or if
the delivered service is contested. Dispute messages and optional evidence
links are stored offchain and are visible to the participants and admins.

An admin prepares and executes either:

- release of the consultation price to the seller; or
- refund of the consultation price to the buyer.

In both outcomes, the protocol fee goes to the treasury.

## Compliance state

Wallet and transaction checks can return `Clear`, `Review`, or `Blocked`.
Providers include:

- a Chainalysis oracle;
- the USDC blacklist;
- a local wallet denylist.

Provider failure follows a fail-closed path for protected actions. A blocked
post-funding result can create an onchain payout hold. The hold blocks buyer
release and seller auto-release. Admin resolution is gated by the application,
but the contract still trusts an admin wallet to resolve directly. Deal status
and risk status remain separate.

The compliance layer is an application control, not a claim of legal
compliance in every jurisdiction.

## Out of scope

The MVP did not provide:

- custody of user wallet keys;
- fiat payments;
- recurring subscriptions;
- group consultations;
- file uploads for dispute evidence;
- guaranteed transaction sponsorship;
- automatic legal resolution of sanctioned or disputed funds.
