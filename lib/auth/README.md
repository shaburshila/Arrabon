# Auth Layer

Sprint 1 implements the backend auth layer for SIWE-backed private endpoints.

- `POST /api/auth/siwe/nonce` issues short-lived single-use nonces.
- `POST /api/auth/siwe/verify` verifies an EIP-4361 message and sets an `HttpOnly` session cookie.
- `POST /api/auth/logout` revokes the current session and clears the cookie; lookup/revoke failures return `500` and keep the cookie intact.
- `GET /api/private/ping` is a technical protected smoke route.
- Session tokens are hashed before DB storage and auth relies on the existing `users`, `auth_nonces`, and `sessions` tables.
