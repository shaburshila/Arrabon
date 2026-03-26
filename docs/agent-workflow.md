# Agent Workflow — Base Consult Link

> Version: 1.0 | Date: 2026-03-25

---

## 1. Mandatory Sequence

Для любого агента действует порядок:

1. `Plan`
2. `Interfaces`
3. `Risks`
4. `Code`

Прыгать сразу к шагу `Code` запрещено.

---

## 2. Required Output Template

### Plan

- scope текущей задачи;
- список файлов/модулей;
- зависимость от других агентов;
- критерий завершения.

### Interfaces

- входные данные;
- выходные данные;
- API/ABI/schema/contracts;
- ограничения и frozen assumptions.

### Risks

- что может сломать архитектуру;
- что может нарушить security assumptions;
- где возможна несовместимость с соседним модулем;
- какие решения требуют эскалации.

### Code

- только после freeze интерфейсов и рисков;
- только в своей зоне ответственности;
- без изменения замороженных решений.

---

## 3. Escalation Triggers

Агент обязан остановиться и поднять вопрос, если хочет:

- изменить state machine;
- изменить auth model;
- изменить funding model;
- расширить product scope;
- добавить новый тип пользователя;
- заменить single-use link на multi-use;
- внедрить Base Pay в основной flow.

---

## 4. Ownership Discipline

- Frontend Agent не меняет contract semantics
- Smart Contract Agent не меняет product scope
- Backend/API Agent не меняет auth model
- Database Agent не меняет business flow
- Security Agent не добавляет feature scope под видом hardening
- QA Agent валидирует freeze, а не перепридумывает продукт
