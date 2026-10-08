# Authentication and authorization

Arrabon uses Sign-In with Ethereum for browser sessions. Wallet connection
alone does not authorize private API access.

## SIWE flow

1. The browser requests a nonce from `POST /api/auth/siwe/nonce`.
2. The wallet signs an EIP-4361 message.
3. `POST /api/auth/siwe/verify` checks the nonce, message fields, domain,
   chain, time bounds, and signature.
4. The server marks the nonce used and creates an opaque session.
5. The response sets an HttpOnly cookie.

The database stores a hash of the session token, not the plaintext token.
Nonces are short-lived and single use.

## Session behavior

A session is bound to one normalized wallet address and has an expiry and
revocation state. Logout revokes the server record and clears the cookie.

Private routes reject:

- a missing cookie;
- an unknown token hash;
- an expired or revoked session;
- a wallet that does not satisfy the route's role rules.

## Authorization

| Resource or action | Required wallet |
|---|---|
| Create and manage a link | Link owner / expert |
| View a private deal | Buyer or seller |
| Reveal meeting URL | Buyer or seller after funding |
| Mark complete | Seller |
| Confirm release | Buyer |
| Open dispute | Buyer |
| Read or write dispute messages | Buyer, seller, or admin |
| Review and resolve disputes | Admin |
| Manage local denylist | Admin |

The contract repeats onchain role checks for state-changing calls. A valid
server session cannot make the contract accept an unauthorized wallet.

## Admin state

Admin access is checked for protected routes and is also enforced by the
contract for dispute resolution and payout holds. Offchain admin records do not
replace `admins[address]` onchain.

## Internal authentication

The event-sync route is called by the background worker and uses an internal
secret rather than a SIWE browser session. It accepts confirmed-event work, not
arbitrary user lifecycle changes.

## Sensitive data

The auth layer does not store:

- wallet private keys;
- SIWE signatures as reusable login credentials;
- plaintext session tokens;
- plaintext meeting URLs.

A compromised application server could still access session validation,
encryption keys, and backend authorizer operations. Those remain trusted
infrastructure boundaries.
