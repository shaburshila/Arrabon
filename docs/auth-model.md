# Auth Model — Base Consult Link

> Version: 1.0 | Based on: ТЗ v1.2 | Date: 2026-03-25

---

## 1. Goal

В MVP аутентификация нужна только для приватных backend-операций и не используется как механизм владения средствами.

Принцип:

- wallet ownership и contract permissions подтверждаются onchain;
- приватный доступ к backend подтверждается через SIWE session;
- backend не подменяет контрактную авторизацию и не расширяет её.

---

## 2. Frozen Decisions

| ID | Decision |
|---|---|
| A-01 | Единственный auth-механизм для приватных HTTP endpoint'ов: `Sign-In With Ethereum (SIWE)` |
| A-02 | Login выполняется wallet-адресом пользователя, без email, password, OAuth, magic links |
| A-03 | Session хранится в `HttpOnly` cookie, привязанной к wallet address |
| A-04 | SIWE нужна только для backend endpoints; публичное чтение ссылок и сделок не требует login |
| A-05 | Reveal `meeting_url` разрешён только участнику сделки: buyer или seller |
| A-06 | Auth model не управляет funds custody: право на release/dispute/admin определяется контрактом |
| A-07 | Одна wallet session = один actor context; backend не поддерживает role switching внутри одной сессии |

Изменение любого решения выше требует явного согласования с Lead Architect Agent.

---

## 3. Auth Surface

### Public endpoints

SIWE не требуется:

- `GET /api/links/:id`
- `GET /api/deals/:id`
- read-only статусные endpoints для UI

### Private endpoints

SIWE обязательна:

- `POST /api/auth/siwe/nonce`
- `POST /api/auth/siwe/verify`
- `POST /api/auth/logout`
- `POST /api/links`
- `POST /api/links/:id/cancel`
- `GET /api/deals/:id/meeting-url`
- admin read/write endpoints

---

## 4. SIWE Flow

```
Client wallet                Frontend                  Backend
     │                          │                         │
     │  request nonce           │                         │
     ├─────────────────────────►│ POST /auth/siwe/nonce   │
     │                          ├────────────────────────►│
     │                          │◄────────────────────────┤ nonce
     │◄─────────────────────────┤                         │
     │                          │                         │
     │ sign SIWE message        │                         │
     ├─────────────────────────►│ POST /auth/siwe/verify  │
     │ signature + message      ├────────────────────────►│
     │                          │                         │ verify signature
     │                          │                         │ verify nonce
     │                          │                         │ verify chain == Base
     │                          │                         │ create session
     │                          │◄────────────────────────┤ Set-Cookie
     │◄─────────────────────────┤                         │
```

После успешной верификации backend возвращает session cookie.

---

## 5. Session Model

### Cookie requirements

- `HttpOnly`
- `Secure`
- `SameSite=Lax` для MVP
- короткий TTL
- session invalidates on logout

### Session fields

- `session_id`
- `wallet_address`
- `issued_at`
- `expires_at`
- `nonce_id` or replay marker

### Session invariants

- session всегда соответствует одному wallet address;
- backend не принимает address из body/query как источник identity, если он не совпадает с session;
- session без валидной подписи или с просроченным TTL отклоняется.

---

## 6. Authorization Rules

| Endpoint / action | Who can access | Source of truth |
|---|---|---|
| Create link | Expert wallet with valid SIWE session | Backend session |
| Cancel link before funding | Creator of link with valid SIWE session | Backend session + DB owner check |
| Reveal meeting URL | `buyer_address` or `seller_address`; deal.status ∈ {Funded, ConfirmPending, Released, Disputed}; Refunded intentionally excluded | Backend session + DB deal binding |
| Admin endpoints | Wallet from admin allowlist | Backend allowlist in env/DB |
| `confirmRelease`, `openDispute`, `markCompleted` | Not authorized by backend | Smart contract only |

---

## 7. Non-Goals

Следующее не входит в auth model MVP:

- email login
- social login
- OAuth
- delegated operator accounts
- multiple sessions with distinct roles in one browser context
- backend authority to release/refund funds

---

## 8. Risks

| Risk | Description | Mitigation |
|---|---|---|
| Replay of SIWE message | Повторная отправка старой подписи | Nonce single-use + short TTL |
| Session theft | Кража cookie из браузера | `HttpOnly`, `Secure`, short TTL |
| Unauthorized reveal | Пользователь с валидной сессией, но не участник сделки | Participant check against deal record |
| Address mismatch | UI отправляет один address, а сессия принадлежит другому | Ignore body address; trust session only |
| Admin overreach | Обычный user получает доступ к admin route | Separate allowlist check on each admin endpoint |

---

## 9. Stage-1 Interfaces

Перед началом кода auth-related агент обязан считать замороженными следующие интерфейсы:

- `POST /api/auth/siwe/nonce` → returns nonce payload
- `POST /api/auth/siwe/verify` → validates signature, sets session cookie
- `POST /api/auth/logout` → clears session
- session context shape:
  - `wallet_address`
  - `is_admin`
  - `expires_at`

Любое изменение этих интерфейсов после старта этапа 2 требует согласования.
