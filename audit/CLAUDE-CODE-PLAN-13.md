# Claude Code — план №13 (финальный полишинг)

**Дата:** 2026‑05‑21
**Контекст:** Накопленные находки после plan-12. Три категории: структурный фикс ширины контента, копировой полишинг списков, и остаток дизайн‑токенов.

**Правила:**
- Не коммить ничего.
- После каждой фазы — `npm run typecheck && npm run build && npm run test:unit`.
- После каждой фазы — запись в `audit/PROGRESS.md` (секция `## Plan-13`).

---

# Phase 1 — [P0] Фикс ширины контента на всех страницах

**Проблема:** контент на **64px шире прототипа** на всех страницах.

В прототипе `.page` использует `max-width: 1180px` + `padding: 56px 32px 96px` с дефолтным `box-sizing: border-box` → content area = **1180 − 64 = 1116px**.

В реализации `<main>` имеет padding 56/32/96, а `maxWidth` стоит на **внутреннем div** → content area = **1180px** (на 64px шире).

| Страница | maxWidth prop | Прототип | Импл | Разница |
|---|---|---|---|---|
| `/my-deals`, `/my-links`, `/deal/[id]`, `/admin/*` | 1180 | 1116px | 1180px | +64 |
| `/create` | 1100 | 1036px | 1100px | +64 |
| `/link/[id]` | 1040 | 976px | 1040px | +64 |
| `/receipt` | 760 | 696px | 760px | +64 |

## Действие

**Файл:** `components/app/app-shell.tsx`

Перенести padding с outer `<main>` на inner `<div>` (с `box-sizing: border-box`), чтобы `maxWidth` включал padding — match прототипу:

```diff
  export function AppShell({
    children,
    flushBottom = false,
    maxWidth = 640,
  }: {
    children: React.ReactNode;
    flushBottom?: boolean;
    maxWidth?: number;
  }) {
    const pathname = usePathname();

    useEffect(() => {
      window.scrollTo(0, 0);
    }, [pathname]);

    return (
      <>
        <TopNav />
-       <main style={{ ...mainStyle, paddingBottom: flushBottom ? 0 : 96 }}>
-         <div style={{ ...contentStyle, maxWidth }}>
+       <main style={mainStyle}>
+         <div
+           style={{
+             boxSizing: "border-box",
+             display: "flex",
+             flexDirection: "column",
+             gap: 24,
+             margin: "0 auto",
+             maxWidth,
+             padding: flushBottom ? "56px 32px 0" : "56px 32px 96px",
+             width: "100%",
+           }}
+         >
            {children}
          </div>
        </main>
        <BottomTabBar />
      </>
    );
  }

  const mainStyle = {
-   display: "flex",
-   justifyContent: "center",
    minHeight: "100vh",
  } as const;

- const contentStyle = {
-   display: "flex",
-   flexDirection: "column" as const,
-   gap: 24,
-   width: "100%",
- };
```

## Mobile padding override

**Файл:** `app/globals.css`

```diff
  @media (max-width: 768px) {
-   main {
-     padding-left: 16px !important;
-     padding-right: 16px !important;
-   }
+   main > div {
+     padding-left: 16px !important;
+     padding-right: 16px !important;
+   }
  }
```

## Acceptance
- На любой странице с `<AppShell maxWidth={1180}>` контент имеет фактическую ширину **1116px** (а не 1180px) на десктопе.
- Создание ссылки (`/create maxWidth=1100`) визуально соответствует прототипу с content 1036px.
- Receipt (`maxWidth=760`) — content 696px.
- На мобиле бок остаётся 16px.

> **Внимание к landing**: страница `/` использует full-bleed sections с собственным `sectionInner maxWidth: 1280`. Это вне AppShell — fix не затрагивает. Landing остаётся как было.

---

# Phase 2 — [P0] Списки my-deals / my-links: убрать ID из sub-meta

**Проблема:** под названием каждой сделки/линка отображается ID — лишний шум. Должны остаться только дата+время.

## Действие

**Файл:** `app/my-deals/page.tsx`, функция `DealRow`:

```diff
  <div className="list-row__title">
    <span className="list-row__title-name">{deal.title}</span>
    <span className="list-row__title-sub">
-     {deal.id.slice(0, 8).toUpperCase()} · {formatDate(deal.scheduled_at, { timeZone: deal.timezone })}
+     {formatDate(deal.scheduled_at, { timeZone: deal.timezone })}
    </span>
  </div>
```

**Файл:** `app/my-links/page.tsx`, функция `LinkRow`:

```diff
  <div className="list-row__title">
    <span className="list-row__title-name">{link.title}</span>
    <span className="list-row__title-sub">
-     {link.id.slice(0, 8).toUpperCase()} · {formatDate(link.scheduled_at, { timeZone: link.timezone })}
+     {formatDate(link.scheduled_at, { timeZone: link.timezone })}
    </span>
  </div>
```

## Acceptance
- В списках под названием — только «May 24, 2026 · 4:30 PM PDT» (или формат из formatDate)
- ID больше нигде не виден в строке (остаётся доступен через клик в URL)

> ID всё ещё видны на странице самой сделки/линка (через DealDetailsCard / LinkSummary `Deal ID` / `Link ID` DetailRow) — там они нужны.

---

# Phase 3 — [P1] Inline `borderRadius` literals → токены

**Проблема:** 9 inline `borderRadius` значений (8 и 16) хардкодом, должны быть через `var(--r-*)`. Это последняя категория системного отклонения от дизайн‑токенов.

## Замены

| Файл | Строка | Сейчас | На что заменить |
|---|---|---|---|
| `app/wallet-status-pill.tsx` | ~354 (dropdownStyle) | `borderRadius: 16` | `borderRadius: "var(--r-4)"` |
| `app/wallet-status-pill.tsx` | ~444 (icon container) | `borderRadius: 8` | `borderRadius: "var(--r-2)"` |
| `app/admin/disputes/[id]/page.tsx` | ~692 (smallButtonStyle) | `borderRadius: 8` | `borderRadius: "var(--r-2)"` |
| `app/admin/disputes/[id]/page.tsx` | ~773 (confirmStyle) | `borderRadius: 8` | `borderRadius: "var(--r-2)"` |
| `app/admin/disputes/page.tsx` | ~809 (confirmStyle) | `borderRadius: 8` | `borderRadius: "var(--r-2)"` |
| `app/admin/disputes/page.tsx` | ~839 (smallButtonStyle) | `borderRadius: 8` | `borderRadius: "var(--r-2)"` |
| `app/admin/disputes/resolve-controls.tsx` | ~126 | `borderRadius: 8` | `borderRadius: "var(--r-2)"` |
| `app/admin/denylist/page.tsx` | ~423 (smallButtonStyle) | `borderRadius: 8` | `borderRadius: "var(--r-2)"` |
| `app/admin/denylist/page.tsx` | ~440 (entryCardStyle) | `borderRadius: 8` | `borderRadius: "var(--r-2)"` |

> **НЕ трогать:** `app/global-error.tsx` — self-contained с `--g-*` токенами, не зависит от globals.css.

## Acceptance
- Grep `borderRadius: [0-9]+` по `components/` и `app/` (исключая `global-error.tsx` и `globals.css`) даёт 0 результатов.
- Визуально радиусы остаются те же (`--r-2` = 8, `--r-4` = 16) — но через токены.

---

# Phase 4 — [P0] Theme toggle → как bell кнопка

**Проблема:** `ThemeToggle` визуально выглядит как dropdown-pill (белая карточка с border-radius 10), а не как иконочная кнопка типа bell. На top-nav рядом стоят: bell (`.iconbtn` — transparent / border / `var(--r-2)`) и theme (custom inline pill). Нарушает консистентность toolbar'а.

## Действие

**Файл:** `components/shared/theme-toggle.tsx`

```diff
  return (
    <button
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
+     className="iconbtn"
      onClick={toggle}
-     style={btnStyle}
      type="button"
    >
      <Icon name={theme === "dark" ? "utility-theme-light" : "utility-theme-dark"} size={15} />
    </button>
  );
}

- const btnStyle = {
-   alignItems: "center",
-   background: "var(--surface)",
-   border: "1px solid var(--border)",
-   borderRadius: 10,
-   color: "var(--muted)",
-   cursor: "pointer",
-   display: "inline-flex",
-   flexShrink: 0,
-   height: 34,
-   justifyContent: "center",
-   padding: 0,
-   width: 34,
- } as const;
```

## Acceptance
- Theme toggle визуально идентичен bell кнопке слева от него: transparent background, 1px hairline border, 36×36, `var(--r-2)` border-radius.
- Hover: `var(--surface-2)` background + `var(--border-strong)` border (через `.iconbtn:hover`).
- На мобиле 32×32 (через `@media (max-width: 768px) .iconbtn`).

---

# Phase 5 — [P0] Landing hero: убрать лишний vertical offset

**Проблема:** на главной странице hero‑блок (текст + seal + кнопки) центрирован **ниже** чем в прототипе. Причина — двойной vertical padding:
- AppShell кладёт `padding-top: 56px` на main
- `.landing-hero-section` сверху добавляет `padding: 32px 0`
- Hero‑блок отжимается вниз на 88px от nav, плюс flex‑центрирование внутри `calc(100vh − 64px)` — content сидит ниже геометрического центра viewport'a.

В прототипе hero‑section рендерится с `<div className="page page--wide" style={{ paddingTop: 0, paddingBottom: 0 }}>` — vertical padding явно занулен, чтобы hero центрировался ровно посередине viewport'a.

## Действие (два варианта — выбери)

### Вариант A (рекомендуется) — добавить `flushTop` prop в AppShell

**Файл:** `components/app/app-shell.tsx`

```diff
  export function AppShell({
    children,
    flushBottom = false,
+   flushTop = false,
    maxWidth = 640,
  }: {
    children: React.ReactNode;
    flushBottom?: boolean;
+   flushTop?: boolean;
    maxWidth?: number;
  }) {
```

И в padding computation (после plan-13 Phase 1):
```ts
padding: `${flushTop ? 0 : 56}px 32px ${flushBottom ? 0 : 96}px`,
```

**Файл:** `app/page.tsx`

```diff
  export default function HomePage() {
    return (
-     <AppShell flushBottom maxWidth={1180}>
+     <AppShell flushBottom flushTop maxWidth={1180}>
```

Hero‑section теперь начинается прямо под nav (56px → 0), внутреннее `padding: 32px 0` остаётся → hero центрируется в `calc(100vh − 64px − 32px − 32px)` примерно посередине visible area, как в прототипе.

### Вариант B (проще, но узко-специфичный) — закомпенсировать `padding-top` в `.landing-hero-section`

**Файл:** `app/globals.css`

```diff
  .landing-hero-section {
    position: relative;
    min-height: calc(100vh - 64px);
    display: flex;
    align-items: center;
-   padding: 32px 0;
+   padding: 32px 0;
+   margin-top: -56px;
+   padding-top: 88px;  /* 56 (nav comp) + 32 (внутренний) */
    z-index: 0;
  }
```

Хак, но не требует изменений API AppShell. **Не рекомендуется** — затрудняет будущие правки.

## Acceptance (для Варианта A)
- Hero блок на главной центрирован относительно visible viewport (между низом nav и низом экрана).
- Прокрутка работает плавно, остальные секции (steps/benefits/stats/cta) сохраняют свои paddings.
- Footer не теряет `flushBottom` поведение — bottom 0.

> Other pages (my-deals, deal, link, etc.) не передают `flushTop` — у них top padding 56px сохраняется как было.

---

# Phase 6 — Финал

```bash
npm run typecheck && npm run build && npm run test:unit
```

Допиши в `audit/PROGRESS.md`:
```md
## Plan-13 — completed

### Phase 1 — Content width fix
- components/app/app-shell.tsx — moved padding from outer <main> to inner <div> with box-sizing:border-box, maxWidth now correctly includes 64px horizontal padding (matches prototype .page semantics)
- app/globals.css — mobile padding override updated: main → main > div

### Phase 2 — List sub-meta cleanup
- app/my-deals/page.tsx — DealRow sub-meta: removed deal.id prefix, only date+time remains
- app/my-links/page.tsx — LinkRow sub-meta: removed link.id prefix, only date+time remains

### Phase 3 — borderRadius literals → tokens
- app/wallet-status-pill.tsx — dropdownStyle 16→var(--r-4); icon container 8→var(--r-2)
- app/admin/disputes/page.tsx — confirmStyle + smallButtonStyle 8→var(--r-2)
- app/admin/disputes/[id]/page.tsx — same 2 styles 8→var(--r-2)
- app/admin/disputes/resolve-controls.tsx — 8→var(--r-2)
- app/admin/denylist/page.tsx — smallButtonStyle + entryCardStyle 8→var(--r-2)
- (global-error.tsx untouched — self-contained)

### Phase 4 — Theme toggle as iconbtn
- components/shared/theme-toggle.tsx — replaced inline btnStyle with className="iconbtn"; removed btnStyle const

### Phase 5 — Landing hero centering
- components/app/app-shell.tsx — added flushTop?: boolean prop; conditional padding 56|0px top
- app/page.tsx — HomePage uses <AppShell flushBottom flushTop maxWidth={1180}>
```

---

# Сводка

| Phase | Что | Приоритет | Файлов |
|---|---|---|---|
| **1** | Content width −64px (структурный фикс AppShell) | P0 | 2 |
| **2** | Убрать ID из my-deals / my-links list rows | P0 | 2 |
| **3** | 9× borderRadius literals → var(--r-*) | P1 | 5 |
| **4** | Theme toggle → `.iconbtn` (как bell) | P0 | 1 |
| **5** | Landing hero — убрать лишний 56px top padding | P0 | 2 |

Все правки чисто визуальные / структурные. Логика не трогается.

После plan-13 реализация должна совпадать с прототипом с точностью до пикселя на всех 11 страницах.
