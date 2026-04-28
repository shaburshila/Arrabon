# Documentation Index — Base Consult Link

> Version: 1.0 | Status: Актуален | Date: 2026-04-28
> Составил: Base Consult Link Team | Проверил: — | Утвердил: —

Индекс проектной документации MVP. Все документы расположены в `/docs/`. Технологический стек: Next.js App Router, TypeScript, wagmi + viem, Supabase PostgreSQL, SIWE.

---

## Индекс документов

| Код | Документ | Версия | Статус | Описание |
|---|---|---|---|---|
| BCL-SPEC | [product-spec.md](product-spec.md) | 1.2 | Актуален | Техническое задание: product scope, lifecycle, auth, AML/Compliance |
| BCL-ARCH | [architecture.md](architecture.md) | 1.1 | Актуален | Системная архитектура: модули, DB schema, deployment view |
| BCL-FRONT | [frontend-mvp-architecture.md](frontend-mvp-architecture.md) | 2.0 | Актуален | Frontend-архитектура: routes, компоненты, хуки, Compliance UI |
| BCL-AUTH | [auth-model.md](auth-model.md) | 1.1 | Актуален | Auth model: SIWE flow, session fields, классификация endpoints |
| BCL-API | [api-contract.md](api-contract.md) | 1.1 | Актуален | API contract: shapes всех endpoints, коды ошибок, freeze surface |
| BCL-FLOW | [flows.md](flows.md) | 1.1 | Актуален | User/system flows: happy path, unhappy path, compliance flows |
| BCL-SM | [state-machine.md](state-machine.md) | 1.1 | Актуален | State machines: link lifecycle, deal lifecycle, risk_status ось |
| BCL-DEC | [decisions.md](decisions.md) | 1.1 | Актуален | Замороженные архитектурные решения; agent rules; stage gate |
| BCL-QA | [qa-scenarios.md](qa-scenarios.md) | 1.1 | Актуален | QA-сценарии QA-001…QA-068; Critical Invariants I-1…I-20 |
| BCL-THREAT | [threat-model.md](threat-model.md) | 1.0 | Актуален | Модель угроз: attack surface, STRIDE-анализ, mitigations |
| BCL-AML | [compliance-aml-analysis.md](compliance-aml-analysis.md) | 1.1 | Актуален | AML/Compliance: провайдеры, gate-точки, risk_status design |
| BCL-DEPLOY | [deployments.md](deployments.md) | 1.0 | Актуален | Записи о деплое контракта; адреса, tx hashes, сеть |
| BCL-PROD | [production-readiness.md](production-readiness.md) | 1.0 | Актуален | Pre-production checklist: конфиг, безопасность, мониторинг |
| BCL-GLOSS | [glossary.md](glossary.md) | 1.1 | Актуален | Глоссарий терминов проекта |

---

## Порядок чтения

Рекомендуемый порядок для нового участника команды:

1. [product-spec.md](product-spec.md) — что строим и почему
2. [decisions.md](decisions.md) — что заморожено и не подлежит изменению
3. [architecture.md](architecture.md) — как устроена система
4. [auth-model.md](auth-model.md) — auth и сессии
5. [state-machine.md](state-machine.md) — state machines link и deal, ось risk_status
6. [flows.md](flows.md) — детальные flow сценарии
7. [api-contract.md](api-contract.md) — API контракт
8. [compliance-aml-analysis.md](compliance-aml-analysis.md) — AML/Compliance слой
9. [threat-model.md](threat-model.md) — модель угроз
10. [qa-scenarios.md](qa-scenarios.md) — QA-сценарии

---

## Stage Gate — Этап 1

Все документы, необходимые для завершения Этапа 1 (см. `decisions.md` §6), присутствуют и актуальны:

| Документ | Требование | Версия |
|---|---|---|
| architecture.md | ✓ | v1.1 |
| decisions.md | ✓ | v1.1 |
| auth-model.md | ✓ | v1.1 |
| state-machine.md | ✓ | v1.1 |
| threat-model.md | ✓ | v1.0 |
| api-contract.md | ✓ | v1.1 |
| flows.md | ✓ | v1.1 |
| qa-scenarios.md | ✓ | v1.1 |

**Заключение: Stage 1 Gate — пройден.**

---

## Лист регистрации изменений

| Версия | Дата | Изменения |
|---|---|---|
| 1.0 | 2026-04-28 | Первичный выпуск |
