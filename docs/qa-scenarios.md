# QA Scenarios — Base Consult Link (ТЗ v1.2)

Формат: Given / When / Then
Уровни: **[CONTRACT]** — onchain, **[API]** — backend, **[UI]** — frontend

---

## 1. Funding & Single-use

### QA-001 Успешное funding
**[CONTRACT]**
- Given: ссылка Open, link_hash не использован, amount ∈ [$10, $1000], now < expires_at
- When: buyer вызывает `createAndFundDeal(link_hash, seller, buyer, amount, ...)`
- Then: событие `Funded` эмитируется; `usedLinkHashes[link_hash] == true`; deal.status == Funded; USDC locked в контракте

### QA-002 Повторный funding — revert
**[CONTRACT]**
- Given: link_hash уже использован (usedLinkHashes[link_hash] == true)
- When: любой адрес вызывает `createAndFundDeal` с тем же link_hash
- Then: транзакция reverts; состояние контракта не изменяется

### QA-003 Funding истёкшей ссылки — недоступно
**[API]**
- Given: link.status == Expired (now ≥ expires_at)
- When: клиент пытается инициировать funding
- Then: backend возвращает 4xx; CTA в UI неактивна

### QA-004 Funding отменённой ссылки — недоступно
**[API]**
- Given: link.status == Cancelled
- When: клиент открывает ссылку
- Then: UI показывает "Ссылка отменена"; funding недоступен

### QA-005 Funding: сумма ниже $10
**[CONTRACT] [API]**
- Given: price_usdc < 10 USDC
- When: вызов `createAndFundDeal`
- Then: revert / backend validation error; deal не создаётся

### QA-006 Funding: сумма выше $1000
**[CONTRACT] [API]**
- Given: price_usdc > 1000 USDC
- When: вызов `createAndFundDeal`
- Then: revert / backend validation error; deal не создаётся

### QA-007 Atomicity: один вызов = одна сделка
**[CONTRACT]**
- Given: валидные параметры
- When: `createAndFundDeal` выполняется
- Then: escrow создан и профинансирован в одной транзакции; нет промежуточного состояния "создан, но не профинансирован"

---

## 2. Link Time Invariants

### QA-008 expires_at < scheduled_at (обязательно)
**[API] [UI]**
- Given: expert заполняет форму с expires_at ≥ scheduled_at
- When: submit
- Then: validation error; ссылка не создаётся

### QA-009 Минимальный разрыв expires_at / scheduled_at
**[API]**
- Given: scheduled_at - expires_at < 15 мин
- When: попытка создать ссылку
- Then: validation error "минимум 15 минут до scheduled_at"

### QA-010 scheduled_at в прошлом
**[API] [UI]**
- Given: scheduled_at ≤ now
- When: expert создаёт ссылку
- Then: validation error; Draft не создаётся

### QA-011 duration_minutes = 0
**[API]**
- Given: duration_minutes = 0
- When: создание ссылки
- Then: validation error; duration_minutes должен быть > 0

### QA-012 grace_period_minutes = 0 (валидно)
**[API]**
- Given: grace_period_minutes = 0
- When: создание ссылки
- Then: ссылка создаётся успешно; markCompleted доступен сразу после scheduled_at + duration

---

## 3. markCompleted

### QA-013 markCompleted слишком рано — revert
**[CONTRACT]**
- Given: deal.status == Funded; now < scheduled_at + duration + grace_period
- When: seller вызывает `markCompleted(dealId)`
- Then: revert; deal остаётся Funded

### QA-014 markCompleted вовремя — успех
**[CONTRACT]**
- Given: deal.status == Funded; now ≥ scheduled_at + duration + grace_period
- When: seller вызывает `markCompleted(dealId)`
- Then: событие `Completed` эмитируется; deal.status == ConfirmPending

### QA-015 markCompleted не от seller — revert
**[CONTRACT]**
- Given: deal.status == Funded; вызов от адреса не seller
- When: чужой адрес вызывает `markCompleted(dealId)`
- Then: revert; deal остаётся Funded

### QA-016 markCompleted повторно — revert
**[CONTRACT]**
- Given: deal.status == ConfirmPending (уже вызывали markCompleted)
- When: seller повторно вызывает `markCompleted(dealId)`
- Then: revert; статус не меняется

---

## 4. confirmRelease

### QA-017 confirmRelease в пределах 48h — успех
**[CONTRACT]**
- Given: deal.status == ConfirmPending; now ≤ markCompleted_ts + 48h; вызов от buyer
- When: buyer вызывает `confirmRelease(dealId)`
- Then: событие `Released`; deal.status == Released; funds → seller (price - fee); fee → treasury

### QA-018 confirmRelease не от buyer — revert
**[CONTRACT]**
- Given: deal.status == ConfirmPending
- When: seller или третий адрес вызывает `confirmRelease`
- Then: revert

### QA-019 confirmRelease из статуса не ConfirmPending — revert
**[CONTRACT]**
- Given: deal.status == Funded / Released / Disputed / Refunded
- When: buyer вызывает `confirmRelease(dealId)`
- Then: revert

---

## 5. autoRelease

### QA-020 autoRelease до дедлайна — revert
**[CONTRACT]**
- Given: deal.status == ConfirmPending; now ≤ markCompleted_ts + 48h
- When: anyone вызывает `autoRelease(dealId)`
- Then: revert; deal остаётся ConfirmPending

### QA-021 autoRelease после дедлайна — успех
**[CONTRACT]**
- Given: deal.status == ConfirmPending; no dispute; now > markCompleted_ts + 48h
- When: anyone вызывает `autoRelease(dealId)`
- Then: событие `Released`; deal.status == Released; funds → seller; fee → treasury

### QA-022 autoRelease при открытом dispute — revert
**[CONTRACT]**
- Given: deal.status == Disputed
- When: anyone вызывает `autoRelease(dealId)`
- Then: revert

### QA-023 autoRelease permissionless (вызов не от backend)
**[CONTRACT]**
- Given: deal.status == ConfirmPending; дедлайн истёк
- When: произвольный внешний адрес (не backend) вызывает `autoRelease(dealId)`
- Then: транзакция успешна; Released

---

## 6. Dispute

### QA-024 openDispute из ConfirmPending — успех
**[CONTRACT]**
- Given: deal.status == ConfirmPending; вызов от buyer; now ≤ markCompleted_ts + 48h
- When: buyer вызывает `openDispute(dealId)`
- Then: событие `Disputed`; deal.status == Disputed; autoRelease заблокирован

### QA-025 openDispute из Funded (no-show) — успех
**[CONTRACT]**
- Given: deal.status == Funded; вызов от buyer
- When: buyer вызывает `openDispute(dealId)`
- Then: событие `Disputed`; deal.status == Disputed

### QA-026 openDispute не от buyer — revert
**[CONTRACT]**
- Given: deal.status == ConfirmPending или Funded
- When: seller или третий адрес вызывает `openDispute`
- Then: revert

### QA-027 openDispute повторно — revert
**[CONTRACT]**
- Given: deal.status == Disputed
- When: buyer вызывает `openDispute(dealId)` ещё раз
- Then: revert; статус не меняется

### QA-028 openDispute после Released — revert
**[CONTRACT]**
- Given: deal.status == Released
- When: buyer вызывает `openDispute`
- Then: revert

### QA-029 adminResolveRelease — успех
**[CONTRACT]**
- Given: deal.status == Disputed; caller ∈ admin whitelist
- When: admin вызывает `adminResolveRelease(dealId)`
- Then: событие `Released`; deal.status == Released; funds → seller; fee → treasury

### QA-030 adminResolveRefund — успех
**[CONTRACT]**
- Given: deal.status == Disputed; caller ∈ admin whitelist
- When: admin вызывает `adminResolveRefund(dealId)`
- Then: событие `Refunded`; deal.status == Refunded; funds → buyer

### QA-031 adminResolve не от admin — revert
**[CONTRACT]**
- Given: deal.status == Disputed; caller ∉ admin whitelist
- When: anyone вызывает `adminResolveRelease` или `adminResolveRefund`
- Then: revert

---

## 7. Meeting URL Security

### QA-032 Доступ без SIWE сессии — 401
**[API]**
- Given: no session cookie
- When: GET /api/deals/{id}/meeting-url
- Then: HTTP 401; meeting_url не раскрывается; попытка логируется

### QA-033 Доступ не участника — 403
**[API]**
- Given: валидная SIWE сессия; wallet не является buyer и не является seller
- When: GET /api/deals/{id}/meeting-url
- Then: HTTP 403; meeting_url не раскрывается; попытка логируется

### QA-034 Доступ до funding — 409
**[API]**
- Given: валидная SIWE сессия; wallet == buyer или seller; deal.status != Funded (link не consumed)
- When: GET /api/deals/{id}/meeting-url
- Then: HTTP 409; meeting_url не раскрывается

### QA-035 Доступ buyer после funding — 200
**[API]**
- Given: deal.status ∈ {Funded, ConfirmPending, Released, Disputed} (Refunded intentionally excluded — see I-13); SIWE сессия buyer
- When: GET /api/deals/{id}/meeting-url
- Then: HTTP 200; meeting_url расшифровывается и возвращается

### QA-036 Доступ seller после funding — 200
**[API]**
- Given: deal.status ∈ {Funded, ConfirmPending, Released, Disputed} (Refunded intentionally excluded — see I-13); SIWE сессия seller
- When: GET /api/deals/{id}/meeting-url
- Then: HTTP 200; meeting_url расшифровывается и возвращается

---

## 8. Fee

### QA-037 Fee 2% фиксируется при funding
**[CONTRACT]**
- Given: expert старше 14 дней с регистрации; amount = 100 USDC
- When: `createAndFundDeal`
- Then: fee_amount = floor(100 × 0.02) = 2 USDC зафиксировано в сделке

### QA-038 Fee waiver (≤14 дней)
**[CONTRACT]**
- Given: expert зарегистрирован ≤14 дней назад
- When: `createAndFundDeal`
- Then: fee_amount = 0; seller получает полную сумму при release

### QA-039 Fee округляется вниз
**[CONTRACT]**
- Given: amount = 15 USDC; fee rate = 2%
- When: funding
- Then: fee_amount = floor(15 × 0.02) = floor(0.30) = 0 USDC (если USDC без дробей) или корректное округление вниз

### QA-040 Fee snapshot не меняется после funding
**[CONTRACT]**
- Given: fee_amount зафиксирован при funding
- When: admin меняет fee rate после funding
- Then: существующая сделка использует старый fee_amount snapshot

---

## 9. SIWE Auth

### QA-041 Nonce одноразовый
**[API]**
- Given: nonce выдан клиенту
- When: nonce использован в SIWE подписи и подпись принята
- Then: повторное использование того же nonce → 401

### QA-042 Сессия привязана к wallet
**[API]**
- Given: session cookie от wallet A
- When: запрос выполняется с session cookie wallet A, но с wallet B подписью
- Then: 401 или 403

---

## 10. Idempotency / Chain Sync

### QA-043 tx_hash обрабатывается ровно один раз
**[API]**
- Given: событие с tx_hash X уже обработано (processed_transactions содержит X)
- When: то же событие приходит повторно (replay / дубль webhook)
- Then: INSERT игнорируется (UNIQUE constraint); deal.status не меняется

### QA-044 offchain state == onchain state
**[API]**
- Given: onchain deal.status == Released
- When: backend синхронизируется (periodic check или replay)
- Then: db.deals.status == Released; расхождения устраняются

### QA-045 deals.consultation_link_id UNIQUE
**[API]**
- Given: одна ссылка уже имеет сделку
- When: попытка создать вторую сделку для той же ссылки
- Then: constraint violation; второй deal не создаётся

---

## 11. Sponsored Transactions

### QA-046 Sponsored tx — createAndFundDeal
**[UI] [API]**
- Given: paymaster доступен; метод в allowlist
- When: buyer инициирует createAndFundDeal
- Then: транзакция отправляется через paymaster; gas не списывается с buyer

### QA-047 Paymaster fallback — ошибка без user-paid fallback
**[UI]**
- Given: paymaster недоступен; user-paid fallback не поддерживается
- When: buyer инициирует любой sponsored метод
- Then: UI показывает ошибку; транзакция не отправляется; state не меняется

### QA-048 Admin методы не спонсируются
**[CONTRACT]**
- Given: admin вызывает `adminResolveRelease` / `adminResolveRefund`
- When: попытка отправить через paymaster
- Then: paymaster allowlist rejects; admin платит gas самостоятельно

---

## 12. UI / UX

### QA-049 Meeting URL скрыт до funding
**[UI]**
- Given: link.status == Open; deal не создана
- When: клиент открывает ссылку
- Then: meeting_url не отображается нигде в DOM / source

### QA-050 Meeting URL виден после funding
**[UI]**
- Given: deal.status == Funded; пользователь — buyer (SIWE сессия)
- When: страница сделки
- Then: meeting_url отображается

### QA-051 CTA одна на экране
**[UI]**
- Given: любой статус сделки/ссылки
- When: страница открыта
- Then: не более одной primary CTA кнопки видимо одновременно

### QA-052 Touch target ≥ 44px
**[UI]**
- Given: мобильный viewport
- When: инспекция интерактивных элементов
- Then: все кнопки и ссылки имеют touch target height/width ≥ 44px

---

## 13. Reentrancy & Double Execution

### QA-053 Reentrancy guard на release
**[CONTRACT]**
- Given: malicious USDC receiver contract пытается повторно войти в `confirmRelease` / `autoRelease`
- When: вызов
- Then: reentrancy guard blocks; funds не списываются дважды

### QA-054 Double markCompleted невозможен
**[CONTRACT]**
- Given: deal.status == ConfirmPending
- When: seller вызывает `markCompleted` снова
- Then: revert (state machine не допускает ConfirmPending → ConfirmPending)

---

## 14. Cancellation

### QA-055 Отмена ссылки до funding
**[API]**
- Given: link.status == Open; deal не создана; запрос от seller
- When: POST /api/links/{id}/cancel
- Then: link.status == Cancelled; funding более недоступен

### QA-056 Отмена ссылки после funding — невозможна
**[API]**
- Given: link.status == Consumed; deal существует
- When: seller пытается отменить ссылку
- Then: 4xx error; link остаётся Consumed

---

## Summary: Critical Invariants

| # | Инвариант | Уровень |
|---|---|---|
| I-1 | Повторный funding с тем же link_hash → revert | CONTRACT |
| I-2 | markCompleted раньше scheduled_at + duration + grace → revert | CONTRACT |
| I-3 | autoRelease до дедлайна → revert | CONTRACT |
| I-4 | autoRelease при dispute → revert | CONTRACT |
| I-5 | autoRelease после дедлайна (нет dispute) → Released | CONTRACT |
| I-6 | meeting_url без сессии → 401 | API |
| I-7 | meeting_url не участнику → 403 | API |
| I-8 | meeting_url до funding → 409 | API |
| I-9 | tx_hash обрабатывается 1 раз | API |
| I-10 | offchain state == onchain state | API |
| I-11 | fee snapshot фиксируется при funding | CONTRACT |
| I-12 | admin actions не спонсируются | CONTRACT |
| I-13 | meeting_url при deal.status == Refunded → 409; intentional product + security decision | API |
