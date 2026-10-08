# Security and compliance

Arrabon handled wallet signatures, private meeting URLs, and USDC escrow. The
main risks were unauthorized reveal, replayed funding, invalid lifecycle
transitions, compromised backend credentials, stale chain data, and blocked
fund disposition.

The project did not receive an external audit. This document records controls
present in the repository and known limits.

## Assets

- USDC held by `ConsultEscrow`;
- wallet transaction and EIP-712 signatures;
- encrypted meeting URLs and their encryption key;
- SIWE sessions;
- funding-authorizer and internal worker credentials;
- dispute messages and evidence links;
- compliance results and denylist data;
- contract owner and admin authority.

## Trust boundaries

### User wallet

Wallet private keys remain outside the application. Users inspect and sign
transactions in the wallet.

### Application server

The server verifies SIWE, stores sessions, encrypts meeting URLs, runs
compliance checks, issues execution grants, and signs funding authorizations.
A server compromise can affect those controls even though it does not reveal a
wallet private key.

### Smart contract

The contract is authoritative for escrow balances, used hashes and nonces,
roles, lifecycle state, and payout holds.

### External services

The system depends on Base RPC, Supabase, the USDC contract, and compliance
providers. Availability or incorrect responses can block product actions or
delay the read model.

## Funding controls

`createAndFundDeal` checks:

- caller equals the signed buyer;
- buyer and seller are different non-zero addresses;
- link hash has not been used;
- price, schedule, duration, and link expiry bounds;
- authorization deadline;
- funding nonce has not been used;
- recovered EIP-712 signer equals the current funding authorizer.

The contract consumes the nonce and link hash before the USDC transfer. A
failed transfer reverts the entire transaction.

The owner can rotate the funding authorizer. Compromise of the current
authorizer remains a material risk until rotation.

## Escrow and payout controls

- USDC transfers use OpenZeppelin `SafeERC20`.
- Release and refund paths use `ReentrancyGuard`.
- Only the seller can mark completion or auto-release.
- Only the buyer can confirm release or open a dispute.
- Only admins can resolve a dispute or change a payout hold.
- The last admin cannot be removed.
- The owner cannot rescue the escrow USDC token.
- Terminal deals cannot transition again.

The owner can change treasury, contract admins, and funding authorizer. These
are trusted governance powers.

## Meeting URL controls

- The URL is encrypted with AES-256-GCM before storage.
- Reveal requires an authenticated buyer or seller.
- Reveal is limited to eligible deal states.
- Request attempts are recorded for throttling.
- The public link response excludes ciphertext and plaintext.

Encryption at rest does not protect the URL from a server that has both
database access and the encryption key.

## Session controls

- SIWE nonces are short-lived and single use.
- Session tokens are stored as hashes.
- Cookies are HttpOnly and carry opaque tokens.
- Authorization checks use the wallet loaded from the session.
- Logout revokes the server-side record.

Deployment cookie flags and domains must still match the serving environment.
The original environment is no longer active.

## Compliance controls

The composite screening layer uses:

- Chainalysis oracle results;
- the USDC blacklist;
- a local admin-managed denylist.

Results are normalized to `Clear`, `Review`, or `Blocked`. Protected
actions fail closed when a required provider is unavailable. Provider failures
are not cached as clear results.

Post-funding screening can update risk state and request an onchain payout
hold. That flag blocks buyer-confirmed release and seller auto-release.
Application services also screen admin resolution, but a contract admin can
still call an admin resolution function directly. Admin keys therefore remain
a trust boundary.

These controls implement the product's risk policy. They do not establish that
the product meets every legal or regulatory requirement.

## Indexing controls

Confirmed events are applied idempotently. Processed transaction records and
persistent block cursors prevent duplicate state changes and support recovery
after interruption.

The database can lag the chain. User funds and lifecycle state must be checked
against the contract when the read model is uncertain.

## Residual risks

- Backend-authorizer compromise can produce otherwise valid funding signatures.
- Contract owner or admin compromise can alter governance or dispute outcomes.
- Compliance providers can be unavailable or return an incorrect result.
- Direct contract use bypasses frontend messaging and some offchain UX checks,
  though contract invariants still apply.
- A post-funding block can leave funds held until review and hold removal.
- Evidence URLs point to external content that Arrabon does not preserve.
- The repository is no longer maintained, so dependencies and provider
  integrations may have changed.

## Reuse warning

Do not use this code with real funds without a new contract and application
review, current dependency checks, fresh environment secrets, provider
validation, deployment rehearsal, and end-to-end testing.
