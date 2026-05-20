# Claude Code — план №4 (точечные правки)

Продолжение `audit/CLAUDE-CODE-PLAN-3.md`. После plan-3 закрылись основные баги, но всплыли последствия и мелкие визуальные расхождения. Этот план их закрывает.

**Правила те же.** Иди сверху вниз, `npm run build` в конце, не коммить, секция `## Plan-4` в `audit/PROGRESS.md`.

---

## Phase M — Lifecycle vertical line вернуть на место

### Контекст
В plan-3 phase G я добавил `align-items: start` в `.timeline__row` чтобы починить grid. Это починило колонки, но **сломало связующую вертикальную линию между шагами**: левая колонка (где node + line) теперь сжимается до высоты ноды (~20px), а `1fr` для линии получает 0px.

### Step M.1 — Убрать `align-items: start`

**Файл:** `app/globals.css`

Найди блок `.timeline__row` (он добавлен в plan-3 G). Сейчас:
```css
.timeline__row {
  display: grid;
  grid-template-columns: 20px 1fr;
  gap: 0 14px;
  align-items: start;     /* ← удалить эту строку */
}
```

Удали строку `align-items: start;`. Default `stretch` — левая колонка вытянется на высоту правой (где текст), и `1fr` для линии получит реальную высоту.

### Step M.2 — Проверка

На `/deal/[id]` между нодами в Lifecycle снова появится тонкая золотая/серая вертикальная линия (для done — `--gold` opacity 0.6, для idle — `--rule`).

**Acceptance:** `npm run build` clean + визуально линия между нодами видна.

---

## Phase N — Воздух между хедером и контентом

### Контекст
В plan-3 K я поднял padding-top с 88 до 104. Пользователь говорит что content всё ещё "прилипло к хеддеру" — нужно больше.

### Step N.1 — AppShell padding-top 104 → 128

**Файл:** `components/app/app-shell.tsx`

Найди:
```tsx
const mainStyle = {
  display: "flex",
  justifyContent: "center",
  minHeight: "100vh",
  padding: "104px 16px 48px",
};
```

Замени на:
```tsx
padding: "128px 16px 64px",
```

Теперь между top-nav (~68px) и началом контента ~60px воздуха.

### Step N.2 — На /deal/[id] чуть отступ перед back-link

**Файл:** `app/deal/[id]/page.tsx`

Найди `backLinkStyle`:
```tsx
const backLinkStyle = {
  alignItems: "center",
  alignSelf: "flex-start",
  color: "var(--muted)",
  display: "inline-flex",
  fontSize: 13,
  fontWeight: 500,
  textDecoration: "none",
  gap: 4,
};
```

Добавь `marginBottom: 16`:
```tsx
const backLinkStyle = {
  alignItems: "center",
  alignSelf: "flex-start",
  color: "var(--muted)",
  display: "inline-flex",
  fontSize: 13,
  fontWeight: 500,
  textDecoration: "none",
  gap: 4,
  marginBottom: 16,         /* ← новое */
};
```

Так back-link и заголовок hero не будут липнуть друг к другу.

---

## Phase O — Top-nav: brand крупнее, wallet pill чевронка видимее

### Step O.1 — Brand text 22 → 24px

**Файл:** `components/app/top-nav.tsx`

Найди `brandWordStyle`:
```tsx
const brandWordStyle = {
  fontFamily: "var(--font-serif)",
  fontSize: 22,
  fontWeight: 500,
  letterSpacing: "0.005em",
  lineHeight: 1,
  color: "var(--ink)",
  whiteSpace: "nowrap" as const,
};
```

Замени `fontSize: 22` на `fontSize: 24`.

### Step O.2 — Wallet pill chevron видимее

**Файл:** `components/app/wallet-status-pill.tsx`

Найди функцию `ChevronIcon`:
```tsx
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        borderBottom: "1.5px solid currentColor",
        borderRight: "1.5px solid currentColor",
        color: "var(--muted)",
        display: "inline-block",
        height: 5,
        marginRight: 2,
        opacity: 0.6,
        ...
      }}
    />
  );
}
```

Замени на использование реальной иконки из набора:

```tsx
import { Icon } from "@/components/icons";

// ...

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        color: "var(--muted)",
        display: "inline-flex",
        marginRight: 4,
        transition: "transform 0.15s ease",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
      }}
    >
      <Icon name="utility-chevron-down" size={12} />
    </span>
  );
}
```

Если импорт `Icon` уже есть в файле — не дублируй.

### Step O.3 — Wallet pill avatar — убрать SVG внутри, оставить чистый круг

**Файл:** `components/app/wallet-status-pill.tsx`

Найди в JSX:
```tsx
<span style={pillAvatarStyle}>
  {isAdmin ? <AdminSvg size={11} /> : <WalletSvg size={11} />}
</span>
```

Замени на просто пустой круг:
```tsx
<span style={pillAvatarStyle} />
```

Удали неиспользуемый импорт `WalletSvg` если он становится мёртвым — но **только из pill render**. В dropdown header он всё ещё нужен (там 16px и читается):
```tsx
<span style={dropdownAvatarStyle}>
  {isAdmin ? <AdminSvg size={16} /> : <WalletSvg size={16} />}
</span>
```
там оставь как было.

Это сделает золотой кружок аватара pill'а чистым (как в дизайн-референсе), без визуального шума на 11px svg.

---

## Phase Q — Landing scroll-hint правильно скроллит к How it works

### Контекст
При клике на pill "How it works ↓" на лендинге остаётся видимая полоса между header'ом и блоком "How it works" — низ hero‑секции не докручен. Причина: handler делает `window.scrollTo({ top: window.innerHeight - 64 })`, но из‑за `padding-top: 128` у AppShell main и `min-height: calc(100vh - 64px)` у hero‑секции, реальный bottom секции находится дальше чем `innerHeight - 64`.

### Step Q.1 — Сменить scroll-target на конкретный элемент

**Файл:** `app/page.tsx`

Найди handler `onClick` у `.landing-scroll-hint`:

```tsx
<button
  ...
  className="landing-scroll-hint"
  onClick={() => window.scrollTo({ top: window.innerHeight - 64, behavior: "smooth" })}
  ...
>
```

Замени на:

```tsx
<button
  ...
  className="landing-scroll-hint"
  onClick={() => {
    const el = document.querySelector(".landing-steps");
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top, behavior: "smooth" });
  }}
  ...
>
```

Так скроллим к **началу секции `.landing-steps`** минус 64px (компенсация фиксированного top-nav).

### Step Q.2 — Запасной CSS: scroll-margin-top на секциях

**Файл:** `app/globals.css`

В конец файла добавь:

```css
/* Compensate fixed top-nav when programmatic scrolling to sections */
.landing-steps,
.landing-benefits,
.landing-stats,
.landing-cta {
  scroll-margin-top: 64px;
}
```

Это страховка на случай если в будущем кто-то будет использовать `scrollIntoView` или hash-навигацию — все секции будут уезжать на 64px ниже nav.

### Acceptance
- Клик по "How it works ↓" плавно скроллит так, что заголовок "Three steps. One settlement." появляется сразу под топ‑nav без полосы

---

## Phase R — Финал

### Step R.1 — Прогоны

```bash
npm run typecheck && npm run build && npm run test:unit
```

### Step R.2 — Допиши в `audit/PROGRESS.md`

```md
## Plan-4 — completed

### Phase M — Timeline vertical line restored
- app/globals.css — removed `align-items: start` from .timeline__row

### Phase N — Header breathing
- components/app/app-shell.tsx — mainStyle padding 104→128 / bottom 48→64
- app/deal/[id]/page.tsx — backLinkStyle marginBottom 0→16

### Phase O — Top-nav polish
- components/app/top-nav.tsx — brand fontSize 22→24
- components/app/wallet-status-pill.tsx — ChevronIcon → `<Icon name="utility-chevron-down" />`, pill avatar clean (no inner SVG)

### Phase Q — Scroll-hint accurate scroll
- app/page.tsx — landing-scroll-hint onClick uses getBoundingClientRect on .landing-steps
- app/globals.css — scroll-margin-top: 64px on landing-* sections

**Final checks:** npm run build clean, typecheck clean, tests passing.
```

---

Точка входа: **Phase M, Step M.1**. Поехали.