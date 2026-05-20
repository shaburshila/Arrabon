# Claude Code — план №3 (доработка №2)

**Продолжение** `audit/CLAUDE-CODE-PLAN.md` и `audit/CLAUDE-CODE-PLAN-2.md`. Они выполнены. После второго раунда ревью обнаружены конкретные проблемы — этот план их закрывает.

**Правила те же:** иди по фазам сверху вниз, не задавай вопросов, `npm run typecheck && npm run build` в конце каждой фазы, не коммить, в конце допиши секцию `## Plan-3` в `audit/PROGRESS.md`.

**Самое критичное:** Phase G и Phase H — это два бага, которые либо ломают визуал страницы /deal целиком (timeline grid), либо вешают браузер на /create (infinite render loop). Их сделай первыми.

---

## Phase G — КРИТИЧНО: Fix LifecycleTimeline grid

### Контекст
На странице `/deal/[id]` Lifecycle-блок выглядит «развалившимся» — заголовки шагов наслаиваются друг на друга, описания типа "Seller created the consultation link" рендерятся **по одному слову на строку** в колонке шириной ~20px.

### Причина
`components/deal/lifecycle-timeline.tsx` рендерит:
```tsx
<div className="timeline">
  {lifecycle.map((step, i) => (
    <div key={step.key} className="timeline__row">
      <div>{/* node + line */}</div>
      <div className="timeline__content">{/* text */}</div>
    </div>
  ))}
</div>
```

А CSS `.timeline` в `app/globals.css` — это **2‑колоночный grid** (`grid-template-columns: 20px 1fr`), который ожидает **плоских детей** (node, content, node, content, ...). Из‑за wrapper‑дива `.timeline__row` каждый шаг занимает только первую колонку 20px, а контент-блок сжимается в эти же 20px.

### Step G.1 — Поправить CSS `.timeline`

**Файл:** `app/globals.css`

Найди блок `.timeline` (примерно строка 380):

```css
.timeline {
  display: grid;
  grid-template-columns: 20px 1fr;
  gap: 0 14px;
  position: relative;
}
```

Замени на:

```css
.timeline {
  display: flex;
  flex-direction: column;
  position: relative;
}

.timeline__row {
  display: grid;
  grid-template-columns: 20px 1fr;
  gap: 0 14px;
  align-items: start;
}
```

Так каждый `.timeline__row` становится собственным 2‑колоночным grid'ом, а node-блок и content-блок встают по местам.

### Step G.2 — Проверка

После изменения визуально на `/deal/[id]` должно быть:
- Узкая колонка слева 20px с золотыми точками и соединительной линией
- Широкая колонка справа с заголовками («Link created», «Escrow funded», «Seller confirmed», «Funds released») в одну строку каждый
- Под заголовком описание тоже в одну строку или 2-3 строки нормального wrap'а
- Под описанием — timestamp моноширинным

**Acceptance:** `npm run build` clean + визуально timeline читается.

---

## Phase H — КРИТИЧНО: Fix infinite render loop на /create

### Контекст
Браузер выдаёт:
```
Maximum update depth exceeded. ... app/create/page.tsx (41:15) @ onValuesChange
```

### Причина
В `app/create/page.tsx`:
```tsx
<CreateLinkForm
  onValuesChange={(values) =>      // ← НОВАЯ функция КАЖДЫЙ рендер
    setPreview({ ... })
  }
/>
```

В `components/link/create-link-form.tsx`:
```tsx
useEffect(() => {
  props.onValuesChange?.(form);
}, [form, props.onValuesChange]);    // ← onValuesChange меняется → effect срабатывает → setPreview → re-render родителя → новая onValuesChange → ...
```

### Step H.1 — Стабилизировать onValuesChange через useCallback

**Файл:** `app/create/page.tsx`

Добавь импорт:
```tsx
import { useCallback, useState } from "react";
```

И замени блок:
```tsx
<CreateLinkForm
  session={session}
  onValuesChange={(values) =>
    setPreview({
      description: values.description,
      duration_minutes: values.duration_minutes,
      expires_date: values.expires_date,
      expires_time: values.expires_time,
      price_usdc: values.price_usdc,
      scheduled_date: values.scheduled_date,
      scheduled_time: values.scheduled_time,
      seller_address: session.address ?? "",
      title: values.title,
    })
  }
/>
```

На:
```tsx
const sellerAddress = session.address ?? "";

const handleValuesChange = useCallback(
  (values: {
    description: string;
    duration_minutes: string;
    expires_date: string;
    expires_time: string;
    price_usdc: string;
    scheduled_date: string;
    scheduled_time: string;
    title: string;
  }) => {
    setPreview({
      description: values.description,
      duration_minutes: values.duration_minutes,
      expires_date: values.expires_date,
      expires_time: values.expires_time,
      price_usdc: values.price_usdc,
      scheduled_date: values.scheduled_date,
      scheduled_time: values.scheduled_time,
      seller_address: sellerAddress,
      title: values.title,
    });
  },
  [sellerAddress],
);

// ...

<CreateLinkForm session={session} onValuesChange={handleValuesChange} />
```

(объяви `handleValuesChange` внутри `CreatePage` после `useState`.)

### Step H.2 — Проверка

Открой `/create` в браузере, поделай ввод — не должно быть ошибки в консоли, preview обновляется в реальном времени.

**Acceptance:** `npm run build` clean + страница `/create` загружается без warning'ов в консоли.

---

## Phase I — Landing: italic gold на CTA + header padding

### Step I.1 — Italic gold accent в Final CTA

**Файл:** `app/globals.css`

Найди селекторы для `.accent` (примерно строка 285):
```css
.h1 .accent,
.h-display .accent,
.landing-hero h1 .accent {
  font-style: italic;
  font-weight: 500;
  color: var(--gold-deep);
  display: inline-block;
  padding-right: 0.2em;
  margin-bottom: -0.08em;
}

[data-theme="dark"] .h-display .accent,
[data-theme="dark"] .landing-hero h1 .accent { color: var(--gold); }
```

Добавь `.landing-cta__title .accent` в оба правила:

```css
.h1 .accent,
.h-display .accent,
.landing-hero h1 .accent,
.landing-cta__title .accent {           /* ← добавить */
  font-style: italic;
  font-weight: 500;
  color: var(--gold-deep);
  display: inline-block;
  padding-right: 0.2em;
  margin-bottom: -0.08em;
}

[data-theme="dark"] .h-display .accent,
[data-theme="dark"] .landing-hero h1 .accent,
[data-theme="dark"] .landing-cta__title .accent {       /* ← добавить */
  color: var(--gold);
}
```

**Acceptance:** На лендинге в Final CTA "Ready to create your first **_consultation link?_**" — слова "consultation link?" теперь курсивные золотые.

### Step I.2 — Поднять top-nav на 4px

**Файл:** `components/app/top-nav.tsx`

Найди `headerInnerStyle`:
```tsx
const headerInnerStyle = {
  ...
  padding: "14px 32px",
  ...
};
```

Замени padding на:
```tsx
padding: "18px 32px",
```

Также найди `brandMarkStyle`:
```tsx
const brandMarkStyle = {
  alignItems: "center",
  display: "inline-grid",
  height: 28,
  placeItems: "center",
  width: 28,
};
```

И бамп до 32:
```tsx
height: 32,
width: 32,
```

И в JSX, найди `<img alt="Arrabon" height={28} src=... width={28} />` — поменяй на `height={32}` и `width={32}`.

**Acceptance:** Header стал ~64-68px высоты вместо ~56px. Bran-mark немного крупнее. Не должно ничего сломать.

### Step I.3 — Финал I

```bash
npm run typecheck && npm run build
```

---

## Phase J — List rows: типографика «дорого-богато»

Пользователь жалуется что list rows на `/my-deals` и `/my-links` выглядят неcoлидно — мелкий шрифт, тонкие линии. Сейчас:
- title 14.5px / weight 500
- sub-meta 11.5px / mono

Подбамп для премиальности.

### Step J.1 — CSS list-row typography

**Файл:** `app/globals.css`

Найди `.list-row__title-name`, `.list-row__title-sub`, `.list-row__price`, `.list-row__trailing` и замени значения:

```css
.list-row__title-name {
  color: var(--ink);
  font-size: 15.5px;        /* было 14.5 */
  font-weight: 600;         /* было 500 */
  letter-spacing: -0.005em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-row__title-sub {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 12px;          /* было 11.5 */
  letter-spacing: -0.005em;
  margin-top: 2px;          /* добавить, дать дыхания */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-row__price {
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 14.5px;        /* было 14 */
  font-weight: 600;         /* было 500 */
  text-align: right;
  white-space: nowrap;
}

.list-row__trailing {
  color: var(--muted);
  font-size: 13.5px;        /* было 13 */
  text-align: right;
  white-space: nowrap;
}
```

Также найди `.list-row` и увеличь vertical padding:
```css
.list-row {
  ...
  padding: 20px 24px;       /* было 18 */
  ...
}
```

### Step J.2 — Проверка

Открой `/my-deals` и `/my-links` — title жирнее и крупнее, sub-meta чуть крупнее, строки выше. Должно стать читабельнее и солиднее.

---

## Phase K — Create page: больше воздуха

### Step K.1 — Page header breathing

**Файл:** `app/create/page.tsx`

Найди `pageHeaderStyle` (если его ещё нет — он добавлен в plan-2) и увеличь `marginBottom`:

```tsx
const pageHeaderStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,                  /* было 10, чуть больше между h1 и lede */
  marginBottom: 48,         /* было 32 */
  maxWidth: 720,
};
```

### Step K.2 — AppShell padding-top

**Файл:** `components/app/app-shell.tsx`

В этом файле есть `mainStyle`:
```tsx
const mainStyle = {
  display: "flex",
  justifyContent: "center",
  minHeight: "100vh",
  padding: "88px 16px 48px",
};
```

`88px` сверху — с учётом фиксированного header'а ~64px после Step I.2, остаётся 24px breathing. Подними padding-top:

```tsx
padding: "104px 16px 48px",
```

Это даст ~40px между nav и началом content'а — premium.

### Step K.3 — Проверка

`npm run build` + визуально на `/create` сверху есть нормальное расстояние между nav и h1.

---

## Phase L — Финал

### Step L.1 — Полный прогон

```bash
npm run typecheck
npm run build
npm run test:unit
```

### Step L.2 — Чек-лист

- [ ] `/deal/[id]` Funded — Lifecycle timeline читается, тексты в одну строку, не наслаиваются
- [ ] `/deal/[id]` ConfirmPending — то же + есть Release/Dispute actions в правой колонке
- [ ] `/deal/[id]` Released — то же + ReceiptInset card в правой колонке
- [ ] `/create` — нет ошибки `Maximum update depth` в консоли
- [ ] `/create` — preview обновляется в реальном времени при вводе в форму
- [ ] `/create` — между header'ом и формой есть дыхание
- [ ] Landing Final CTA — "consultation link?" курсивное золотое
- [ ] Top-nav слегка выше, brand-mark чуть крупнее
- [ ] `/my-deals` / `/my-links` — title крупнее и жирнее, строки солиднее

### Step L.3 — Допиши в audit/PROGRESS.md

```md
## Plan-3 — completed

### Phase G — LifecycleTimeline grid fix
- app/globals.css — .timeline → flex column, .timeline__row → grid 20px/1fr

### Phase H — Infinite loop fix on /create
- app/create/page.tsx — handleValuesChange wrapped in useCallback

### Phase I — Landing CTA accent + top-nav height
- app/globals.css — .landing-cta__title .accent added to italic-gold selectors
- components/app/top-nav.tsx — header padding 14→18, brand-mark 28→32

### Phase J — List rows typography
- app/globals.css — .list-row* font-sizes bumped for premium feel

### Phase K — Create page breathing
- app/create/page.tsx — pageHeaderStyle marginBottom 32→48, gap 10→12
- components/app/app-shell.tsx — mainStyle padding-top 88→104

**Final checks:**
- npm run typecheck — clean
- npm run build — clean
- npm run test:unit — passing
```

---

Точка входа: **Phase G, Step G.1**. Начинай.

Не запрашивай confirmation между шагами. Если упадёт что-то непонятное — пометь BLOCKED и пиши в PROGRESS.md почему.
