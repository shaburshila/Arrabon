# Compliance / AML — Анализ и архитектура для MVP

Документ содержит полный анализ минимального compliance-слоя для Base Consult Link: архитектурные решения, ответы на policy questions, рекомендованную последовательность реализации.

---

## Общая оценка ситуации

Base Consult Link — это crypto escrow на публичном блокчейне (Base), где деньги проходят путь: buyer wallet → USDC approve → smart contract → seller wallet / refund. Это ровно та схема, которую регуляторы и FATF называют "virtual asset service provider" (VASP). При этом admin wallet имеет возможность направлять средства — это дополнительный фактор риска с точки зрения money transmitter.

**Главный вывод:** полноценный KYC/AML перед public pilot скорее всего избыточен и нереализуем малой командой, но sanctions screening — необходим и реализуем бесплатно. Без него платформа несёт прямой legal риск с первой транзакции.

---

## Policy Questions — Ответы

### 1. Fail-closed или fail-open при недоступности провайдера?

Рекомендация: **fail-open для Clear-провайдеров, fail-closed для sanction-провайдеров.**

- Если OFAC list sync или Chainalysis sanctions API недоступны — блокировать действие и маршрутизировать в Review. Sanction-hit — это юридическая ответственность, а не бизнес-риск.
- Если Chainabuse недоступен — допустить транзакцию с пометкой Review. Это fraud signal, не sanctions.

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

- Compliance — это **gate**, не опция. Каждый lifecycle action идёт через compliance check.
- Все checks логируются с полным raw response — для audit trail.
- Provider interface изолирован, чтобы менять провайдеров без изменений бизнес-логики.
- MVP использует только sync/pre-check модель (проверить до действия), не stream monitoring.

### Provider Interface

```typescript
interface ComplianceProvider {
  screenWallet(address: string): Promise<WalletScreeningResult>;
  screenTransaction(txHash: string): Promise<TransactionScreeningResult>;
}
```

MVP — composite provider из:
- `ChainalysisSanctionsOracleProvider` — on-chain call
- `UsdcBlacklistProvider` — on-chain call
- `OfacLocalListProvider` — local sync
- `LocalDenylistProvider` — admin-managed DB table
- `ChainabuseProvider` — optional, Review-only signal

### Результаты проверки

- `Clear` — hits нет
- `Review` — подозрительные сигналы или provider unavailable
- `Blocked` — sanctions hit, USDC blacklist hit, local denylist hit

### Таблица `compliance_checks`

| Поле | Тип | Описание |
|---|---|---|
| `id` | uuid | PK |
| `subject_type` | `wallet` \| `transaction` | Тип субъекта проверки |
| `subject_value` | string | Address или tx hash |
| `provider` | string | Идентификатор провайдера |
| `result` | `Clear` \| `Review` \| `Blocked` | Итог проверки |
| `reason_code` | string | Код причины: `OFAC_SDN_HIT`, `USDC_BLACKLISTED`, и т.д. |
| `raw_summary` | JSON | Оригинальный ответ провайдера |
| `checked_at` | timestamp | Время проверки |
| `deal_id` | uuid nullable | FK к сделке |
| `actor_wallet` | string nullable | Кто инициировал действие |

### Deal-level risk state

Добавить к сделке поле `risk_status`: `Clear` | `Review` | `Blocked`

Это **derived/denormalized копия** worst-case результата всех compliance_checks связанных со сделкой. Обновляется при каждой проверке. Хранить отдельно от `deal_status` — это разные оси состояния.

### Provider приоритеты для MVP

**Уровень 1 — Обязательные (результат Blocked):**
- Chainalysis Sanctions Oracle — on-chain call, бесплатный
- USDC `isBlacklisted(address)` — on-chain, мгновенный
- Local admin denylist — таблица в БД

**Уровень 2 — Желательные (результат Review):**
- OFAC SDN list local sync — скачивать XML раз в 24h
- Chainabuse API — при достаточном signal threshold

### Check Points

**Before funding prepare** (`POST /api/links/:id/prepare`):
- Проверить buyer wallet через все L1 и L2 провайдеры
- Проверить seller wallet через все L1 провайдеры
- Если buyer или seller = `Blocked` — вернуть 403, не готовить calldata
- Если `Review` — логировать, разрешить продолжить (fail-open для Review на этапе до funding)

**After funding sync** (когда backend обнаруживает on-chain funding):
- Проверить buyer wallet
- Проверить seller wallet
- Проверить tx hash через Chainabuse / TRM если доступно
- Установить `deal.risk_status`
- Если `Blocked` обнаружен post-factum — заморозить deal, маршрутизировать в manual review

**Before payout/lifecycle** (`confirmRelease`, `autoRelease`, `adminResolveRelease`, `adminResolveRefund`):
- Проверить получателя выплаты (seller для release, buyer для refund)
- Если `Blocked` — fail-closed, не генерировать calldata, маршрутизировать к admin
- Если `Review` — отправить в manual review очередь, требовать admin approval

### Admin UI — что показывать

В dispute view и deal detail:
- `Risk Status` badge (Clear / Review / Blocked) на уровне сделки
- Список всех compliance_checks связанных со сделкой: provider, result, reason_code, timestamp
- Warning banner перед любым release/refund если risk_status != Clear
- Кнопка "Add to denylist" для конкретного wallet
- Manual override с обязательным audit comment

---

## Рекомендуемая последовательность реализации

**Шаг 1 — On-chain gates (1-2 дня разработки):**
- USDC `isBlacklisted()` check перед prepare
- Chainalysis Sanctions Oracle call перед prepare
- Таблица `compliance_checks`, базовое логирование

**Шаг 2 — Local lists (1 день):**
- Local denylist таблица + admin UI для управления
- OFAC SDN list sync job (cron, раз в 24h)

**Шаг 3 — Lifecycle gates (1 день):**
- Подключить compliance check к confirmRelease / adminResolve endpoints
- Review queue для admin

**Шаг 4 — Admin UI (1 день):**
- Risk status в deal view
- Compliance checks list
- Warning перед payout

**Шаг 5 — ToS и legal (параллельно с разработкой):**
- Drafted Terms of Service
- IP geoblocking для sanctioned jurisdictions (nginx/Cloudflare rule)
- Privacy policy с disclosure о wallet screening
