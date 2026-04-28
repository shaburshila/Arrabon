# Glossary — Base Consult Link

> Version: 1.1 | Status: Актуален | Date: 2026-04-28
> Изменения v1.1: исправлены ComplianceBlockedError (canonical shape с полем code), ComplianceProviderId (chainalysis_sanctions_oracle), DealReadModel (приватный endpoint).
> Составил: Base Consult Link Team | Проверил: — | Утвердил: —

Глоссарий терминов, используемых в документации и кодовой базе MVP. Термины упорядочены по алфавиту.

---

## A

**Admin** — wallet-адрес, включённый в allowlist (`sessions.is_admin = true`). Уполномочен вызывать `adminResolveRelease` и `adminResolveRefund`, управлять denylist. Admin actions не спонсируются paymaster.

**assertDealNotBlocked** — backend guard-функция, вызываемая на всех payout-path prepare endpoints. Читает `compliance_checks` для сделки; если найдена хоть одна запись с `result = Blocked` — выбрасывает `ComplianceBlockedError` до генерации calldata.

**autoRelease** — permissionless onchain метод. Может вызвать любой адрес при условии: `deal.status == ConfirmPending`, нет открытого dispute, `now > completed_at + 48h`. Backend вызывает его для UX, но это не обязательно.

---

## B

**Base Account** — кошелёк пользователя в экосистеме Base / Coinbase. Используется для wallet connect и SIWE.

**Builder Code** — attribution-механизм Base. Внутри Base App применяется автоматически; в web-браузере передаётся через `dataSuffix` в calldata.

**Buyer** — участник сделки, оплачивающий консультацию (клиент). В коде обозначается как `buyer_address`. Синоним: Client.

---

## C

**Chainalysis Sanctions Oracle** — onchain провайдер sanctions screening, развёрнутый на Base. Первый из трёх MVP compliance провайдеров. Проверяет wallet address против OFAC sanctions list.

**compliance_checks** — append-only таблица в DB. Каждая строка — результат одной проверки одного провайдера для одного wallet в контексте одной сделки. Source of truth для `assertDealNotBlocked` и `recomputeDealRiskStatus`.

**ComplianceBlockedError** — backend исключение, выбрасываемое при блокировке compliance gate. Маппируется в HTTP 403 с каноническим телом: `{"code": "COMPLIANCE_BLOCKED", "error": "...", "reason_code": "OFAC_SANCTIONS | USDC_BLACKLISTED | LOCAL_DENYLIST | PROVIDER_UNAVAILABLE", "wallet_address": "0x..."}`.

**ComplianceProviderId** — TypeScript union type, перечисляющий идентификаторы провайдеров: `chainalysis_sanctions_oracle`, `usdc_blacklist`, `local_denylist`. Также содержит зарезервированные stubs `ofac_sdn` и `chainabuse` для будущей реализации. Канонический источник: `lib/db/types.ts`.

**confirmRelease** — onchain метод, вызываемый buyer в течение 48h после `markCompleted`. Переводит deal в `Released`; средства перечисляются seller за вычетом fee.

**ConsultEscrow.sol** — единственный смарт-контракт MVP. Управляет created deals, funding, completion, release, dispute, refund.

**consultation_link** — offchain запись ссылки на консультацию (таблица DB). Содержит метаданные слота: title, price_usdc, scheduled_at, duration_minutes, expires_at, meeting_url (encrypted).

**createAndFundDeal** — единственный onchain funding метод. Атомарно создаёт и финансирует escrow. Параметры: link_hash, seller, buyer, amount, scheduled_at, duration.

**CurrentUserContext** — объект сессии, доступный в route handlers после `requireUser()`. Поля: wallet_address, is_admin, expires_at, id, username, avatar_url.

---

## D

**dataSuffix** — способ передачи Builder Code в web-браузере: attribution data добавляется в calldata wagmi-транзакции.

**Deal** — onchain + offchain запись о конкретной консультационной сделке. Привязана к одной ссылке. Статусы: Funded → ConfirmPending → Released / Refunded; или Funded / ConfirmPending → Disputed → Released / Refunded.

**DealReadModel** — TypeScript тип ответа для `GET /api/deals/:id` (приватный endpoint, требует SIWE). Не включает `risk_status` — это внутренняя ось Compliance Service, не раскрываемая через deal read API.

**dispute window** — 48-часовое окно после `markCompleted`, в течение которого buyer может вызвать `confirmRelease` или `openDispute`.

---

## E

**escrow** — механизм хранения средств в смарт-контракте до выполнения условий. В Base Consult Link: USDC locked в `ConsultEscrow.sol` до `confirmRelease`, `autoRelease` или `adminResolveRefund`.

**Expert** — создатель ссылки и продавец консультации. В коде обозначается как `seller_address` / `expert_address`. Синоним: Seller.

**expires_at** — timestamp ссылки, до которого она действительна для funding. Инвариант: `now < expires_at < scheduled_at`.

---

## F

**fee** — 2% от суммы сделки, взимаемые с seller в момент финансирования. `fee_amount = floor(amount × 0.02)`. Направляется на treasury при release.

---

## L

**legal hold** — состояние сделки при `risk_status = Blocked`. Все payout-path prepare endpoints возвращают 403; calldata не генерируется до ручного снятия hold вне MVP.

**link_hash** — уникальный хеш ссылки. Хранится onchain в `usedLinkHashes[link_hash]`; при funding помечается `true`. Предотвращает повторное использование ссылки.

**local_denylist** — admin-управляемая DB таблица `wallet_denylist`. Третий из трёх MVP compliance провайдеров. Все wallet адреса хранятся в lowercase.

---

## M

**markCompleted** — onchain метод, вызываемый seller после проведения консультации. Переводит deal в `ConfirmPending`; фиксирует `completed_at = block.timestamp`; запускает 48h buyer window.

**meeting_url** — URL видеоконференции. Хранится в DB в зашифрованном виде (AES). Раскрывается только buyer или seller с активной SIWE-сессией при `deal.status ∈ {Funded, ConfirmPending, Released, Disputed}`. При `Refunded` — недоступен.

---

## O

**OFAC** — Office of Foreign Assets Control (США). Публикует SDN (Specially Designated Nationals) список. В MVP проверяется через Chainalysis Sanctions Oracle.

**openDispute** — onchain метод, вызываемый buyer при no-show или проблеме с услугой. Переводит deal в `Disputed`; блокирует `autoRelease`.

---

## P

**paymaster** — Coinbase Paymaster для спонсирования газа. Используется через backend proxy с allowlist методов. При недоступности — UI показывает ошибку; tx не отправляется; user-paid fallback в MVP отсутствует.

**processed_transactions** — DB таблица с `tx_hash UNIQUE`. Обеспечивает идемпотентность: повторная обработка одного события не меняет state.

---

## R

**recomputeDealRiskStatus** — backend функция Compliance Service. Читает все `compliance_checks` для сделки, вычисляет worst-case через `resolveRiskStatusFromChecks`, вызывает `updateRiskStatusById` если статус изменился.

**risk_status** — отдельная ось состояния сделки (`deals.risk_status`), независимая от `deal.status`. Значения: `Clear`, `Review`, `Blocked`. Управляется только Compliance Service. `Blocked` — sticky (автоматический возврат запрещён).

---

## S

**scheduled_at** — UTC timestamp запланированного начала консультации. Инвариант: `scheduled_at > expires_at > now`.

**screenWalletsBatch** — backend функция, вызывающая всех трёх compliance провайдеров для списка wallet адресов. Fail-closed: недоступность любого провайдера → `Blocked / PROVIDER_UNAVAILABLE`.

**Seller** — см. Expert.

**SIWE (Sign-In With Ethereum)** — единственный auth-механизм для приватных backend endpoints. Flow: nonce → подпись wallet → верификация backend → session cookie (HttpOnly).

**single-use link** — ссылка, которая может быть использована для funding ровно один раз. Обеспечивается onchain через `usedLinkHashes` и offchain через `deals.consultation_link_id UNIQUE`.

---

## T

**treasury** — кошелёк-получатель platform fee. Адрес задаётся в конструкторе `ConsultEscrow.sol`.

---

## U

**USDC** — USD Coin, единственный токен платежей в MVP. На Base Sepolia используется testnet-адрес USDC.

**USDC blacklist** — USDC `isBlacklisted(address)` onchain метод. Второй из трёх MVP compliance провайдеров. Проверяет, заблокирован ли адрес Circle.

---

## W

**wallet_denylist** — см. local_denylist.

---

## Лист регистрации изменений

| Версия | Дата | Изменения |
|---|---|---|
| 1.0 | 2026-04-28 | Первичный выпуск |
| 1.1 | 2026-04-28 | Исправлены: ComplianceBlockedError (canonical shape), ComplianceProviderId (chainalysis_sanctions_oracle), DealReadModel (приватный endpoint, не public) |
