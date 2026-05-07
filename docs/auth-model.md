# Auth Model — Base Consult Link

> Version: 1.2 | Status: Актуален | Based on: ТЗ v1.2 | Date: 2026-04-28
> Изменения v1.2: исправлена формулировка A-04 — убрано ошибочное "и сделок"; GET /api/deals/:id явно указан как требующий SIWE.
> Составил: Base Consult Link Team | Проверил: — | Утвердил: —

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
| A-04 | SIWE нужна только для приватных backend endpoints; публичное чтение ссылок (`GET /api/links/:id`) не требует login; чтение данных сделок (`GET /api/deals/:id`) требует SIWE |
| A-05 | Reveal `meeting_url` разрешён только участнику сделки: buyer или seller |
| A-06 | Auth model не управляет funds custody: право на release/dispute/admin определяется контрактом |
| A-07 | Одна wallet session = один actor context; backend не поддерживает role switching внутри одной сессии |

Изменение любого решения выше требует явного согласования с Lead Architect Agent.

---

## 3. Auth Surface

### Public endpoints

SIWE не требуется:

- `GET /api/links/:id`
- `GET /api/health`

### Private endpoints

SIWE обязательна (cookie сессии + wallet binding):

**Auth:**
- `POST /api/auth/siwe/nonce`
- `POST /api/auth/siwe/verify`
- `POST /api/auth/logout`
- `GET /api/private/ping`

**Links:**
- `POST /api/links`
- `POST /api/links/:id/cancel`
- `POST /api/links/:id/funding/prepare`
- `POST /api/links/:id/funding/sync`

Funding sync scope:

- `POST /api/links/:id/funding/sync` accepts only `tx_hash` for the current link.
- Broad chain rescans are not exposed through this SIWE route and remain internal-only.

**Deals:**
- `GET /api/deals/:id`
- `GET /api/deals/:id/meeting-url`
- `GET /api/me/deals`
- `GET /api/deals/:id/dispute-messages`
- `POST /api/deals/:id/dispute-messages`

Rate limiting:

- `POST /api/auth/siwe/verify` has its own persistent per-wallet throttling, independent from nonce issuance.
- `GET /api/deals/:id/meeting-url` has its own persistent throttling keyed by `(wallet_address, deal_id)`.

**Lifecycle:**
- `POST /api/deals/:id/complete`
- `POST /api/deals/:id/release`
- `POST /api/deals/:id/dispute`
- `POST /api/deals/:id/auto-release`

**Admin (дополнительно требует `is_admin = true`):**
- `GET /api/admin/deals`
- `GET /api/admin/deals/:id`
- `GET /api/admin/deals/:id/compliance`
- `POST /api/admin/deals/:id/resolve`
- `GET /api/admin/denylist`
- `POST /api/admin/denylist`
- `DELETE /api/admin/denylist/:wallet`

### Internal endpoints (не SIWE)

- `POST /api/internal/deal-events/sync` — защищён `x-internal-sync-secret` header; вызывается только планировщиком/воркером, не браузером.

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
- session invalidates on logout only when server-side lookup succeeds and revoke is confirmed; lookup/revoke failure returns `500` and leaves the cookie intact

### Session fields

Поля хранимой сессии (`sessions` table):

- `id` — session UUID
- `wallet` — wallet address (lowercase)
- `is_admin` — флаг admin allowlist; используется во всех admin-route guards
- `session_token_hash` — bcrypt hash токена; plaintext токен не хранится
- `expires_at` — TTL сессии
- `created_at`
- `revoked_at` — null для активных сессий; устанавливается при logout

Session context, доступный в route handlers (`CurrentUserContext`):

- `wallet_address`
- `is_admin`
- `expires_at`
- `id` (user UUID)
- `username`, `avatar_url` (из таблицы `users`)

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

Следующие интерфейсы заморожены:

- `POST /api/auth/siwe/nonce` → returns nonce payload
- `POST /api/auth/siwe/verify` → validates signature, sets session cookie, may return `429` when verify throttling is exceeded
- `POST /api/auth/logout` → clears session only after successful lookup/revoke or when no active session exists; returns `500` on lookup/revoke failure
- `GET /api/private/ping` → session probe: returns `{ ok, wallet_address, is_admin, expires_at }`
- `GET /api/deals/:id/meeting-url` → participant-only reveal, may return `429` when reveal throttling is exceeded
- session context shape (доступен в route handlers):
  - `wallet_address: string`
  - `is_admin: boolean`
  - `expires_at: string`

Любое изменение этих интерфейсов требует согласования.

---

## Лист регистрации изменений

| Версия | Дата | Изменения |
|---|---|---|
| 1.0 | 2026-03-25 | Первичный выпуск |
| 1.1 | 2026-04-28 | Добавлен is_admin в session fields; исправлена классификация GET /api/deals/:id (приватный); расширен список приватных endpoints; добавлена секция Internal endpoints |
| 1.2 | 2026-04-28 | Исправлена формулировка A-04: убрано ошибочное "и сделок"; GET /api/deals/:id явно указан как требующий SIWE |
