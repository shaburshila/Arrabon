# Claude Code — план №5 (sweep: типографика и spacing)

Продолжение `audit/CLAUDE-CODE-PLAN-4.md`. Сейчас закроем единственную крупную нерешённую категорию: **«почти везде не совпадают» шрифты, размеры блоков, отступы**. Причина — на разных страницах живут параллельные inline-системы (h1 28px на одних, 40px на других, sub 14/15/16/17 в разных файлах). В `globals.css` УЖЕ есть единые утилит-классы (`.h-display`, `.h1`, `.h2`, `.h3`, `.lede`, `.body`, `.small`, `.tiny`, `.eyebrow`, `.mono`), но они почти нигде не используются.

**Цель плана** — заменить все bespoke inline стили заголовков/абзацев на utility-классы. Это разово выровняет всё.

**Правила те же.** Иди по фазам, `npm run build` clean в конце, не коммить, секция `## Plan-5` в `audit/PROGRESS.md`.

---

## Phase S — Style guide (reference, не код)

Этот блок — не действие, а **карта истины**. Открой её рядом и держи как чек-лист пока правишь.

### Типографика — что для чего

| Элемент | Utility-класс | Параметры |
|---|---|---|
| Hero на landing | `<h1>` внутри `.landing-hero` (CSS уже есть) | Cormorant 36-56px clamp |
| Top‑level page header (`<h1>` на /create, /my-deals, /my-links, /admin/*) | `.h1` | Cormorant 40px 500, lh 1.08, -0.008em |
| Section heading inside page (`<h2>` "Add denylist entry", "Disputes list", и т.д.) | `.h2` | Cormorant 28px 500, lh 1.18, -0.005em |
| Card titles (admin dispute card, list row title) | `.h3` | Inter 16px 600, lh 1.3, -0.003em |
| Subtitle/lede (under page h1) | `.lede` | Inter 17px, lh 1.55, muted, max 56ch |
| Body text | `.body` | Inter 14.5px, lh 1.55, ink-soft |
| Small / helper text | `.small` | Inter 13px, lh 1.5, muted |
| Tiny labels (CAPS) | `.tiny` | Inter 11.5px 600, 0.06em, uppercase, muted |
| Eyebrow (section eyebrows) | `.eyebrow` | Inter 11px 600, 0.18em, uppercase, muted |
| Monospace (addresses, IDs, tx) | `.mono` | IBM Plex Mono 13px, -0.01em, ink-soft |
| Section label (внутри карточек, "PAYMENT" / "SCHEDULE") | `<SectionLabel>` или `.section-label` | Inter 11px 600, 0.16em, uppercase, muted |

### Spacing — что для чего

| Контекст | Значение |
|---|---|
| Card padding (стандартная карточка) | `24px 28px` |
| Page header marginBottom | `48px` |
| Между primary блоками на странице (gap в AppShell content) | `24px` |
| Между cards внутри form (gap у form stack) | `24px` |
| Внутри section в card (stack между field'ами) | `18px` |
| Section label marginBottom | `16px` |

### Сначала добавь `margin: 0` к utility-классам

**Файл:** `app/globals.css`

Найди `.h-display`, `.h1`, `.h2`, `.h3` и убедись, что в каждом есть `margin: 0;`. Если нет — добавь. Без этого нативные h1/h2 будут иметь default browser margin, что сломает spacing.

Например:
```css
.h-display {
  font-family: var(--font-serif);
  font-weight: 500;
  font-size: 56px;
  line-height: 1.04;
  letter-spacing: -0.012em;
  color: var(--ink);
  margin: 0;          /* ← добавить если нет */
}
```

То же для `.h1`, `.h2`, `.h3`, `.lede`, `.body`, `.small`, `.tiny`, `.mono`, `.eyebrow`. Также `.section-label` если требуется (он вроде уже с margin 0).

**Acceptance:** `grep "^\.h1 {" app/globals.css` найдёт класс, и в нём `margin: 0` присутствует.

---

## Phase T — Унифицировать page headers (top‑level h1 + sub)

Сейчас на `/create` h1 = 40px serif, на `/my-deals`, `/my-links`, `/admin/disputes`, `/admin/denylist` — h1 = 28px serif (что является размером `.h2`, не `.h1`). Подтянуть всё на `.h1`.

### Step T.1 — `app/my-deals/page.tsx`

Найди:
```tsx
<h1 style={h1Style}>My deals</h1>
<p style={subStyle}>Consultations you've paid for as a buyer.</p>
```

Замени на:
```tsx
<h1 className="h1">My deals</h1>
<p className="lede" style={{ marginTop: 8 }}>Consultations you've paid for as a buyer.</p>
```

Удали в конце файла объявления `h1Style` и `subStyle` если они нигде больше не используются.

Также проверь `pageHeaderStyle`:
```tsx
const pageHeaderStyle = {
  alignItems: "flex-start",
  display: "flex",
  gap: 16,
  justifyContent: "space-between",
};
```
Замени `gap: 16` на `marginBottom: 32` (это контейнер для h1+sub блока на странице, нужна вертикальная дистанция до tabs row). Если флекс уже горизонтальный (`display: flex` + `justify-content: space-between`) и держит "New link" кнопку справа — оставь, но добавь `marginBottom: 32` в style.

### Step T.2 — `app/my-links/page.tsx`

Та же замена:
```tsx
<h1 className="h1">My links</h1>
<p className="lede" style={{ marginTop: 8 }}>Consultation links you've created. Each link can be funded once.</p>
```

Удали `h1Style` и `subStyle` объявления.

### Step T.3 — `app/admin/disputes/page.tsx`

```tsx
<h1 className="h1">Disputes</h1>
<p className="lede" style={{ marginTop: 8 }}>Review disputed and blocked payout-path deals and prepare the admin resolution transaction.</p>
```

Удали `h1Style` и `subtitleStyle`.

### Step T.4 — `app/admin/denylist/page.tsx`

```tsx
<h1 className="h1">Compliance denylist</h1>
<p className="lede" style={{ marginTop: 8 }}>Add or remove blocked wallets and keep an auditable compliance trail.</p>
```

Удали `h1Style` и `subtitleStyle`.

### Step T.5 — `app/create/page.tsx`

Уже h1=40px serif (правильный). Заменяем inline на класс для консистентности:

Найди:
```tsx
<header style={pageHeaderStyle}>
  <h1 style={pageTitleStyle}>Create consultation link</h1>
  <p style={pageSubStyle}>...</p>
</header>
```

Замени на:
```tsx
<header style={pageHeaderStyle}>
  <h1 className="h1">Create consultation link</h1>
  <p className="lede" style={{ marginTop: 8 }}>
    Define the consultation, set the price, and share a single link.
    Funds settle in USDC on Base.
  </p>
</header>
```

Удали `pageTitleStyle` и `pageSubStyle`. `pageHeaderStyle` оставь.

**Acceptance:** На всех 5 страницах h1 одинакового размера (40px Cormorant), sub — 17px muted. Build clean.

---

## Phase U — Унифицировать sub-headings (внутрипейджевые h2 / card titles)

### Step U.1 — Admin dispute card title

**Файл:** `app/admin/disputes/page.tsx`

Найди:
```tsx
<h2 style={dealTitleStyle}>{deal.title}</h2>
```

Замени на:
```tsx
<h2 className="h2" style={{ overflowWrap: "anywhere" as const }}>{deal.title}</h2>
```

(Оба места — open disputes loop и resolved loop.)

Удали `dealTitleStyle`.

### Step U.2 — Admin denylist section titles

**Файл:** `app/admin/denylist/page.tsx`

Найди:
```tsx
<h2 style={sectionTitleStyle}>Add denylist entry</h2>
...
<h2 style={sectionTitleStyle}>Current entries</h2>
```

Замени на:
```tsx
<h2 className="h2">Add denylist entry</h2>
...
<h2 className="h2">Current entries</h2>
```

Удали `sectionTitleStyle`.

Также `sectionDescriptionStyle` (sub под этими h2) — замени на `className="lede"`:
```tsx
<p className="lede" style={{ marginTop: 6 }}>Use this for fraud, abuse, sanctions escalation, or manual legal decisions.</p>
```

### Step U.3 — Landing card titles на /

**Файл:** `app/page.tsx`

Найди `StepCard` и `BenefitCard`. Внутри них:
```tsx
<h3 style={cardTitleStyle}>{title}</h3>
```

`cardTitleStyle` сейчас — serif 22px 500 -0.005em. Это не utility-класс. Оставь inline (это переходный размер между `.h3` 16px и `.h2` 28px), но удали `lineHeight` если не задан — пусть будет default.

Можно оставить как есть. Решение: оставь inline без изменений.

### Step U.4 — Landing section h2 (`Three steps. One settlement.` и т.д.)

**Файл:** `app/page.tsx`

Найди `sectionH2Style`:
```tsx
const sectionH2Style = {
  fontFamily: "var(--font-serif)",
  fontSize: "clamp(28px, 4vw, 44px)",
  ...
};
```

`clamp(28, 4vw, 44)` — между `.h2` (28) и `.h1` (40). Оставь как есть, это художественный choice для responsive landing.

**Acceptance:** Admin pages используют `.h2` для card titles, build clean.

---

## Phase V — Eyebrows / Section labels

### Step V.1 — Eyebrow в landing

**Файл:** `app/page.tsx`

Сейчас:
```tsx
const eyebrowStyle = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.1em",
  margin: 0,
  textTransform: "uppercase",
};
```

Стандарт `.eyebrow`: `font-size: 11, font-weight: 600, letter-spacing: 0.18em`.

В `app/page.tsx` найди все `<p style={eyebrowStyle}>` (примерно 5-6 мест — HeroSection, StepsSection, BenefitsSection, StatsSection) и замени на:

```tsx
<p className="eyebrow">Onchain Escrow · Base Network</p>
```

Удали `eyebrowStyle` объявление из стилей файла.

### Step V.2 — Eyebrow в `StepCard`

Внутри `StepCard` тоже стоит `eyebrowStyle` (для "01", "02", "03"). Замени:
```tsx
<span className="eyebrow">{n}</span>
```

### Step V.3 — Footer head label

В `app/page.tsx` есть `footerHeadStyle`:
```tsx
const footerHeadStyle = {
  color: "var(--muted-2)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.1em",
  ...
};
```

Замени на `className="eyebrow"` на `<p>PRODUCT</p>` etc. Удали `footerHeadStyle`.

### Step V.4 — Eyebrow на admin pages

**Файл:** `app/admin/disputes/page.tsx`

`infoLabelStyle` (для "RISK", "PRICE", "SCHEDULED" в Info chips):
```tsx
const infoLabelStyle = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
};
```

Это аналог `.eyebrow` но с `letterSpacing: 0.08em` ниже. Оставь inline, но **поменяй на `font-weight: 600, letter-spacing: 0.1em`** для премиальности.

```tsx
const infoLabelStyle = {
  color: "var(--muted)",
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};
```

**Acceptance:** Все eyebrows на странице визуально одинаковые (один и тот же weight, letter-spacing). Build clean.

---

## Phase W — Card padding / page block spacing

Цель — одна и та же padding-pattern для всех контентных карточек.

### Step W.1 — Унифицировать card padding в `LinkSummary`

**Файл:** `components/link/link-summary.tsx`

Найди `cardStyle`:
```tsx
padding: "28px 32px",
```

Замени на:
```tsx
padding: "24px 28px",
```

Также `gap: 24` оставь.

### Step W.2 — Унифицировать в `LinkPreviewCard`

**Файл:** `components/link/link-preview-card.tsx`

Найди `cardStyle` (в файле LinkPreviewCard):
```tsx
padding: 24,
```

Замени на:
```tsx
padding: "24px 28px",
```

### Step W.3 — Унифицировать в CreateLinkForm

**Файл:** `components/link/create-link-form.tsx`

Найди `cardPaddedStyle`:
```tsx
const cardPaddedStyle = {
  padding: "24px 28px",
};
```

Это уже правильно. Просто убедись.

### Step W.4 — Admin dispute card padding

**Файл:** `app/admin/disputes/page.tsx`

`dealCardStyle`:
```tsx
const dealCardStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  padding: 20,
};
```

Замени `padding: 20` на `padding: "24px 28px"`. И `gap: 16` на `gap: 20`.

### Step W.5 — Admin info chip padding

В том же файле:
```tsx
const infoStyle = {
  background: "var(--panel-muted)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  ...
  padding: 12,
};
```

Замени `borderRadius: 8` на `borderRadius: "var(--r-2)"`, `padding: 12` на `padding: "12px 14px"`, `border: "1px solid var(--border)"` на `border: "1px solid var(--border-soft)"` и `background: "var(--panel-muted)"` на `background: "var(--surface-2)"`.

**Acceptance:** Все content cards имеют одинаковый padding `24px 28px`, info chips одинаковый padding, согласованные токены.

---

## Phase X — AppShell content gap

### Step X.1 — Gap между блоками на странице

**Файл:** `components/app/app-shell.tsx`

Найди `contentStyle`:
```tsx
const contentStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  width: "100%",
};
```

Замени `gap: 16` на `gap: 24`. Так между header'ом, hero, countdown, split — везде будет одинаковая дистанция.

**Acceptance:** Визуально между блоками на странице немного больше воздуха.

---

## Phase Y — Финал

### Step Y.1 — Прогоны

```bash
npm run typecheck && npm run build && npm run test:unit
```

### Step Y.2 — Чек-лист (визуально)

- [ ] /create, /my-deals, /my-links, /admin/disputes, /admin/denylist — все h1 одинакового размера (40px serif Cormorant)
- [ ] У всех h1 одинаковый sub (17px muted)
- [ ] Eyebrow на landing и admin pages — одинаковая (11px 600 0.18em uppercase)
- [ ] Content cards — padding 24px 28px везде
- [ ] Между блоками на страницах больше воздуха (gap 24 вместо 16)

### Step Y.3 — Допиши в `audit/PROGRESS.md`

```md
## Plan-5 — completed

### Phase S — Style guide reference (no code; targets documented)

### Phase T — Page headers unified
- app/my-deals/page.tsx — h1 28→40 (className="h1"), sub 14→17 (className="lede")
- app/my-links/page.tsx — same
- app/admin/disputes/page.tsx — same
- app/admin/denylist/page.tsx — same
- app/create/page.tsx — converted inline styles to className

### Phase U — Sub-headings unified
- app/admin/disputes/page.tsx — dealTitle 18→28 serif (className="h2")
- app/admin/denylist/page.tsx — sectionTitle 18→28 serif (className="h2"), description className="lede"

### Phase V — Eyebrows unified
- app/page.tsx — all eyebrows now use className="eyebrow", removed inline eyebrowStyle/footerHeadStyle
- app/admin/disputes/page.tsx — infoLabelStyle aligned (600 weight, 0.08em)

### Phase W — Card padding standardized
- LinkSummary, LinkPreviewCard, CreateLinkForm cards, admin dealCard — all padding 24px 28px
- Admin info chips — surface-2 bg, border-soft, r-2 radius

### Phase X — AppShell content gap 16→24

**Final checks:** typecheck clean, build clean, tests passing.
```

---

Точка входа: **Phase S → Step S** (style guide reference, потом сразу margin:0 fix). Затем Phase T. Не задавай вопросов, не коммить.
