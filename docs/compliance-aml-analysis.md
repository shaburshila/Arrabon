# Compliance / AML — Анализ и архитектура для MVP

> Version: 1.1 | Status: Актуален | Based on: ТЗ v1.2 | Date: 2026-04-28
> Изменения v1.1: добавлено примечание о type stubs (ofac_sdn, chainabuse) в "Что отложено после MVP".
> Составил: Arrabon Team | Проверил: — | Утвердил: —

Документ содержит полный анализ минимального compliance-слоя для Arrabon: архитектурные решения, ответы на policy questions, рекомендованную последовательность реализации.

---

## Общая оценка ситуации

Arrabon — это crypto escrow на публичном блокчейне (Base), где деньги проходят путь: buyer wallet → USDC approve → smart contract → seller wallet / refund. Это ровно та схема, которую регуляторы и FATF называют "virtual asset service provider" (VASP). При этом admin wallet имеет возможность направлять средства — это дополнительный фактор риска с точки зрения money transmitter.

**Главный вывод:** полноценный KYC/AML перед public pilot скорее всего избыточен и нереализуем малой командой, но sanctions screening — необходим и реализуем бесплатно. Без него платформа несёт прямой legal риск с первой транзакции.

---

## Policy Questions — Ответы

### 1. Fail-closed или fail-open при недоступности провайдера?

Реализованное решение для MVP: **fail-closed для всех трёх shipped screening providers.**

- Если Chainalysis sanctions oracle, USDC blacklist check или local denylist provider недоступен — действие блокируется как `Blocked / PROVIDER_UNAVAILABLE`.
- `PROVIDER_UNAVAILABLE` не кэшируется по адресу и не превращается в `Review`.
- Fraud-only review providers вроде Chainabuse не входят в реализованный MVP scope.

### 2. Достаточно ли sanctions-only MVP перед public pilot?

Да, с оговорками:
- Sanctions-only достаточно для ограниченного closed beta (< 50-100 users, приглашённые).
- Для открытого public pilot без identity verification нужно как минимум Terms of Service с явным запретом для US persons и sanctioned jurisdictions, и IP-блокировка sanctioned countries.
- Полный AML/KYC (transaction monitoring, velocity checks) нужен при серьёзном объёме или при попытке работать с банками/fiat on-ramps.

### 3. Какие бесплатные источники реально надёжны для wallet screening?

| Источник | Надёжность | Применение |
|---|---|---|
| OFAC SDN List (local sync) | Высокая (официальный) | Sanctions — entity names + addresses |
| Chainalysis Sanctions Oracle (on-chain) | Высокая | On-chain sanctions check, Base-совместим |
| USDC `isBlacklisted()` | Высокая | Прямой blacklist от Circle |
| Local admin denylist | Средняя (зависит от процесса) | Fraud, abuse reports |
| Chainabuse API | Средняя | Community-reported scam signal |

Chainalysis Free Sanctions Screening API (off-chain REST) — доступен только через заявку, не публичный. **Chainalysis Oracle — это on-chain смарт-контракт**, реально бесплатный и уже задеплоен на Ethereum/Base. Это самый практичный выбор для MVP.

### 4. Проверять только direct hit или indirect exposure?

Для MVP: **только direct hit.** Indirect exposure (транзакции через mixers, hop-счета) требует полноценного KYT-провайдера. Indirect checking без платного API будет давать слишком много false positives или потребует собственной on-chain graph analysis — нереально для MVP.

### 5. Что делать с sanctioned/risky funds: refund запрещён? hold? manual legal review?

Это одна из самых сложных точек OFAC compliance:
- OFAC запрещает любые транзакции с SDN-лицами — включая возврат средств. Возврат также является "transaction."
- Практический подход для MVP: **если funds уже in escrow от sanctioned wallet — freeze и обратиться к юристу.** Нельзя ни release, ни refund без OFAC license.
- До funding: заблокировать createAndFundDeal — это самый безопасный путь.

### 6. Когда появляется риск money transmitter / MSB?

Ключевые факторы:
- Admin wallet, который может unilaterally направлять средства (dispute resolution) — это сильный индикатор money transmitter.
- USDC как payment instrument, не native crypto — Circle уже является регулируемым эмитентом, но это не снимает ответственности с платформы.
- FinCEN считает decentralized escrow gray zone, но admin-controlled escrow ближе к regulated.
- **Практический порог риска:** объём транзакций > $1k/day или работа с US users делает консультацию с US-лицензированным адвокатом обязательной до launch.

### 7. Какие Terms of Service нужны до запуска?

Минимальный набор:
- Явный запрет использования для US persons без регистрации (или явно разрешить с юридическим обоснованием).
- Запрет для OFAC SDN лиц и sanctioned jurisdictions (Iran, North Korea, Russia, Cuba, Syria).
- Refund policy с оговоркой "if legally permitted."
- Reservation of right to freeze funds при sanctions investigation.
- Disclaimer: "not a licensed money transmitter."
- Acknowledgement пользователем KYC-less nature платформы и связанных рисков.

### 8. Можно ли брать platform fee до полноценного compliance?

Технически — да, юридически — это усиливает аргумент, что вы являетесь VASP/money transmitter. Малый fee (< 1%) с disclosure в ToS — приемлемый риск для beta, но для scaling нужна юридическая позиция.

### 9. Лучшие провайдеры для production KYT

| Провайдер | Strengths | Для вашего случая |
|---|---|---|
| **Chainalysis KYT** | Наиболее широко используется, хорош для compliance с банками | Хорош если нужен enterprise compliance |
| **TRM Labs** | Сильная Base/L2 поддержка, API-first | Лучший выбор для DeFi/L2 проектов |
| **Elliptic** | Сильная EU и UK compliance покрытие | Если UK/EU регуляция приоритетна |
| **Sardine** | Fraud + crypto, ID verification в одном | Если добавляете KYC |
| **Scorechain** | Дешевле, EU-ориентированный | Для ограниченного бюджета |

Для стека (Base, USDC, небольшой объём) — **TRM Labs** имеет лучшую L2 поддержку.

### 10. Зависимость от юрисдикции

- Юрисдикция компании: если регистрируетесь в US — FinCEN, OFAC, возможно state money transmitter licenses. Если BVI/Cayman — существенно проще, но US users создают риск.
- Юрисдикция пользователей: IP-блокировка sanctioned countries снижает риск даже без KYC.
- Рынок: если target audience — global crypto-native users — FATF Travel Rule начинает применяться при transfers > $1k (зависит от юрисдикции).

---

## Архитектура

### Принципы

- Compliance — это **gate**, не опция. Seller screening на создании ссылки, funding prepare и все payout-path prepare endpoints идут через compliance check.
- Все checks логируются с полным raw response — для audit trail.
- Provider interface изолирован, чтобы менять провайдеров без изменений бизнес-логики.
- MVP использует только sync/pre-check модель (проверить до действия), не stream monitoring.

### Provider Interface

```typescript
interface ComplianceProvider {
  screenWallet(address: string): Promise<ScreeningResult>;
}
```

MVP — composite provider из:
- `ChainalysisSanctionsOracleProvider` — on-chain call
- `UsdcBlacklistProvider` — on-chain call
- `LocalDenylistProvider` — admin-managed DB table

Transaction-level screening в shipped MVP не используется. Источник истины для deal-level compliance — wallet-screening history в `compliance_checks` и derived поле `deals.risk_status`.

### Результаты проверки

- `Clear` — hits нет
- `Review` — зарезервировано для несанкционных/manual review сигналов и не используется текущим MVP trio providers
- `Blocked` — sanctions hit, USDC blacklist hit, local denylist hit, либо `PROVIDER_UNAVAILABLE`

### Таблица `compliance_checks`

| Поле | Тип | Описание |
|---|---|---|
| `id` | uuid | PK |
| `subject_type` | `wallet` | Тип субъекта проверки в shipped MVP |
| `subject_value` | string | Wallet address |
| `provider` | string | Идентификатор провайдера |
| `result` | `Clear` \| `Review` \| `Blocked` | Итог проверки |
| `reason_code` | string | Код причины: `OFAC_SANCTIONS`, `USDC_BLACKLISTED`, `LOCAL_DENYLIST`, `PROVIDER_UNAVAILABLE` и т.д. |
| `raw_summary` | JSON | Оригинальный ответ провайдера |
| `checked_at` | timestamp | Время проверки |
| `deal_id` | uuid nullable | FK к сделке |
| `actor_wallet` | string nullable | Кто инициировал действие |

### Deal-level risk state

У сделки есть поле `risk_status`: `Clear` | `Review` | `Blocked`

Это **derived/denormalized копия** worst-case результата всех compliance_checks связанных со сделкой. Обновляется при каждой проверке. Хранить отдельно от `deal_status` — это разные оси состояния.

### Provider приоритеты для MVP

**Уровень 1 — Обязательные (результат Blocked):**
- Chainalysis Sanctions Oracle — on-chain call, бесплатный
- USDC `isBlacklisted(address)` — on-chain, мгновенный
- Local admin denylist — таблица в БД

**Отложено после MVP:**
- OFAC SDN list local sync — XML sync как дополнительный fallback, не часть shipped trio
- Chainabuse API — external fraud signal, не реализован в MVP

### Check Points

**Before funding prepare** (`POST /api/links/:id/funding/prepare`):
- Проверить buyer wallet через все L1 и L2 провайдеры
- Проверить seller wallet через все L1 провайдеры
- Если buyer или seller = `Blocked` — вернуть 403, не готовить calldata

**After funding sync** (когда backend обнаруживает on-chain funding):
- Проверить buyer wallet
- Проверить seller wallet
- Установить `deal.risk_status`
- Если `Blocked` обнаружен post-factum — сделка уходит в legal hold через `risk_status = Blocked`, без изменения `deal.status`

**Before payout/lifecycle** (`confirmRelease`, `autoRelease`, `adminResolveRelease`, `adminResolveRefund`):
- Проверить получателя выплаты (seller для release, buyer для refund)
- Если `Blocked` — fail-closed, не генерировать calldata
- Если сама сделка уже имеет `risk_status = Blocked` — legal hold блокирует любой payout-path независимо от свежего recipient-screening

### Admin UI — что показывать

В dispute view и deal detail:
- `Risk Status` badge (Clear / Review / Blocked) на уровне сделки
- Список всех compliance_checks связанных со сделкой: provider, result, reason_code, timestamp
- Legal hold banner при `Blocked`
- Warning banner и acknowledge перед admin resolve при `Review`
- Отдельная admin denylist page для add/remove denylist entries

---

## Что реализовано в MVP

- 3 screening providers: Chainalysis sanctions oracle, USDC `isBlacklisted(address)`, local `wallet_denylist`
- unified compliance service + append-only `compliance_checks`
- `risk_status` на уровне сделки
- pre-money seller/buyer gates
- post-funding rescreening + legal hold
- deferred risk-status recompute recovery через `deal_risk_recompute_requests`, чтобы partial write в `compliance_checks` не оставлял сделку с устаревшим `risk_status`
- payout-path legal hold для lifecycle и admin resolve
- canonical `403 COMPLIANCE_BLOCKED`
- frontend in-place compliance notice без redirect
- admin compliance detail и denylist UI

## Что отложено после MVP

- OFAC SDN local sync
- Chainabuse / external fraud-review providers
- IP geoblocking sanctioned jurisdictions
- enterprise KYT / indirect exposure screening
- velocity / pattern transaction monitoring
- KYC для fiat/banking expansions

**Примечание о type stubs:** Идентификаторы `ofac_sdn` и `chainabuse` зарезервированы в type системе (`ComplianceProviderId` union и `isProviderAuditId` guard в `lib/compliance/types.ts`), но ни одного активного provider implementation для них в MVP нет. Наличие этих идентификаторов в типах не означает, что провайдеры работают; они являются placeholders для будущей реализации.

## Историческая последовательность реализации

**Шаг 1 — On-chain gates (1-2 дня разработки):**
- USDC `isBlacklisted()` check перед prepare
- Chainalysis Sanctions Oracle call перед prepare
- Таблица `compliance_checks`, базовое логирование

**Шаг 2 — Local lists (1 день):**
- Local denylist таблица + admin UI для управления
- OFAC SDN list sync job (cron, раз в 24h) — отложено после MVP

**Шаг 3 — Lifecycle gates (1 день):**
- Подключить compliance check к confirmRelease / adminResolve endpoints
- Legal hold для `risk_status = Blocked`

**Шаг 4 — Admin UI (1 день):**
- Risk status в deal view
- Compliance checks list
- Warning перед payout

**Шаг 5 — ToS и legal (параллельно с разработкой):**
- Drafted Terms of Service
- IP geoblocking для sanctioned jurisdictions (nginx/Cloudflare rule)
- Privacy policy с disclosure о wallet screening

---

## Лист регистрации изменений

| Версия | Дата | Изменения |
|---|---|---|
| 1.0 | 2026-04-01 | Первичный выпуск |
| 1.1 | 2026-04-28 | Добавлено примечание о type stubs (ofac_sdn, chainabuse) в секции "Что отложено после MVP"; добавлен version header |
