# Claude Code — план №16 (страница /create)

**Дата:** 2026‑05‑21
**Контекст:** Детальный аудит `/create` — каждая надпись, отступ, блок. Нашёл системную проблему ActionPanel (затрагивает всю кодовую базу) и **16 specific issues** на /create.

**Правила:**
- Не коммить.
- После каждой Part — `npm run typecheck && npm run build && npm run test:unit`.
- Запись в `audit/PROGRESS.md` (секция `## Plan-16`).

---

# Главное расхождение: ActionPanel ≠ прототиповый `.card`

**Проблема:** `<ActionPanel>` рендерит:
```ts
borderRadius: var(--r-5)        // = 20px
border: 1px solid var(--border)  // alpha 0.08
boxShadow: var(--shadow-panel)   // = shadow-3 (deepest)
```

Прототип `<Card>` (default + `[data-card="soft"]`):
```css
border-radius: var(--r-3)        // = 12px (impl на 8 больше!)
border: 1px solid var(--border-soft)  // alpha 0.04 (impl ярче)
box-shadow: var(--shadow-2)      // soft (impl heavier)
```

**Visual impact:** form cards на /create выглядят **сильно более «толстыми/округлыми/тяжёлыми»** чем прототип. Это же касается DealDetailsCard, KeyTimes, admin dispute cards, list panels на my-deals/my-links — везде где используется ActionPanel.

**Решение:** изменить дефолты ActionPanel — это **системный фикс на много страниц сразу**. Если разработчик хочет ограничить scope только /create — можно создать `<ActionPanel variant="form">` или override через style. Но предпочтительнее системно.

---

# Part I — Структурные правки (visual heavy)

## Phase 1 — [P0] ActionPanel дефолты → прототиповые

**Файл:** `components/shared/action-panel.tsx`

```diff
  return (
    <Component
      style={{
        background: "var(--surface)",
-       border: "1px solid var(--border)",
-       borderRadius: "var(--r-5)",
-       boxShadow: "var(--shadow-panel)",
+       border: "1px solid var(--border-soft)",
+       borderRadius: "var(--r-3)",
+       boxShadow: "var(--shadow-2)",
        ...style,
      }}
    >
```

### Acceptance
- Все ActionPanel’ы (форма create, admin disputes, list panels, deal details, key times) имеют:
  - border-radius 12 (вместо 20)
  - border 1px alpha 0.04 (вместо 0.08)
  - shadow-2 soft (вместо shadow-3 deep)
- Визуально cards «приземлились» — чище, ближе к прототипу

---

## Phase 2 — [P0] Preview card: section-label + nested eyebrow

**Проблема:** Сейчас preview card имеет ровно `<p className="eyebrow">Preview</p>` сверху. Прототип имеет двухслойную структуру:
1. Outer `<p className="section-label">Preview</p>` (с горизонтальной линией справа через `::after`)
2. Inner `<div className="stack-12">` с `<p className="eyebrow">Consultation</p>` + title + description

**Файл:** `components/link/link-preview-card.tsx`

```diff
  <div style={cardStyle}>
-   <p className="eyebrow">Preview</p>
-   <h3 style={titleStyle}>{values.title || "Consultation title"}</h3>
-   {values.description && <p style={descStyle}>{values.description}</p>}
+   <p className="section-label" style={{ marginBottom: 18 }}>Preview</p>
+   <div className="stack-12">
+     <p className="eyebrow">Consultation</p>
+     <h3 style={titleStyle}>{values.title || "Untitled consultation"}</h3>
+     {values.description && <p className="small" style={{ color: "var(--muted)" }}>{values.description}</p>}
+   </div>
    <div style={divider} />
    <DetailRow label="Price" ... />
    ...
  </div>
```

Удалить `descStyle` const (replaced by `.small` class).

### Acceptance
- "Preview" сверху имеет горизонтальную линию справа (от `.section-label::after`)
- Под ним внутри stack-12: "CONSULTATION" eyebrow → h3 title → small description (с gap 12 от stack-12)
- Placeholder text: "Untitled consultation" (match прототипу)

---

## Phase 3 — [P0] Preview inset card: padding 14/16 → 28

**Проблема:** `insetStyle.padding: "14px 16px"` — слишком тесно. Прототип `<Card inset padded>` = `var(--pad-card) = 28px` все стороны.

**Файл:** `components/link/link-preview-card.tsx`

```diff
  const insetStyle = {
    alignItems: "center",
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "var(--r-3)",
    display: "flex",
    gap: 14,
-   padding: "14px 16px",
+   padding: 28,
  };
```

### Acceptance
- "Secured by Arrabon" inset card в правой колонке значительно больше — 28px всех сторон, как в прототипе

---

## Phase 4 — [P0] Preview stack gap: 16 → 20

Прототип использует `<div className="stack-20">` для правой колонки (preview + inset). Impl: `stack.gap: 16` — на 4px меньше.

**Файл:** `components/link/link-preview-card.tsx`

```diff
- const stack = { display: "flex", flexDirection: "column" as const, gap: 16 };
+ const stack = { display: "flex", flexDirection: "column" as const, gap: 20 };
```

### Acceptance
- Расстояние между preview card и inset card = 20px

---

# Part II — Type / copy mismatch

## Phase 5 — [P1] Preview inset title → `.tiny` class

**Проблема:** "Secured by Arrabon" сейчас 13/600 без upper. Прототип использует `.tiny` (11.5px sans 600 CAPS letter-spacing 0.06em muted).

**Файл:** `components/link/link-preview-card.tsx`

```diff
- <p style={insetTitleStyle}>Secured by Arrabon</p>
- <p style={insetSubStyle}>Onchain escrow · Trusted settlement</p>
+ <p className="tiny">Secured by Arrabon</p>
+ <p className="small" style={{ color: "var(--muted)", marginTop: 4 }}>
+   Onchain escrow · Trusted settlement
+ </p>
```

Удалить `insetTitleStyle` и `insetSubStyle` const.

### Acceptance
- "SECURED BY ARRABON" uppercase, мелким letter-spacing'ом muted
- Subtitle 13px (через `.small`) с marginTop 4

---

## Phase 6 — [P1] Description field helper text

**Файл:** `components/link/create-link-form.tsx`, Consultation section

```diff
- <FormField label="Description" helper="A short note for the buyer.">
+ <FormField label="Description" helper="A short note for the buyer. Markdown not supported.">
```

Добавляет важный контекст для user-а (не пытайся форматировать через markdown).

---

## Phase 7 — [P1] Payment sublabel wording match прототипу

**Файл:** `components/link/create-link-form.tsx`, Payment section

```diff
  <TokenAmountRow
    amount={form.price_usdc}
    label="Price"
    onChange={(value) => setField("price_usdc", value)}
    required
-   sublabel="You will receive this amount in full. Buyer pays an additional 3% platform fee (min $1.50, max $30)."
+   sublabel="You receive this amount in full. Buyer pays an additional 3% fee (min $1.50, max $30)."
    token="USDC"
  />
```

Изменения: "You will receive" → "You receive", "3% platform fee" → "3% fee".

---

## Phase 8 — [P1] Preview Duration "min" → "minutes"

**Файл:** `components/link/link-preview-card.tsx`

```diff
- <DetailRow label="Duration" value={values.duration_minutes ? `${values.duration_minutes} min` : "—"} />
+ <DetailRow label="Duration" value={values.duration_minutes ? `${values.duration_minutes} minutes` : "—"} />
```

---

## Phase 9 — [P1] LinkPreviewCard cardStyle: добавить boxShadow

После Phase 1 ActionPanel получит box-shadow. Но LinkPreviewCard использует **inline** `cardStyle`, без shadow. Visual inconsistency: form cards имеют shadow, preview card — flat.

**Файл:** `components/link/link-preview-card.tsx`

```diff
  const cardStyle = {
    background: "var(--surface)",
    border: "1px solid var(--border-soft)",
    borderRadius: "var(--r-3)",
+   boxShadow: "var(--shadow-2)",
    display: "flex",
    flexDirection: "column" as const,
    padding: 28,
  };
```

Заодно `border: var(--border)` → `var(--border-soft)` чтобы match c form cards после Phase 1.

### Acceptance
- Preview card имеет soft elevation — match с формой слева

---

# Part III — Page header

## Phase 10 — [P1] Page header margin-bottom: 48 → 40

**Проблема:** `pageHeaderStyle.marginBottom: 48`. Прототип `.page__head { margin-bottom: 40px }`.

Plan-3 phase K ранее bumped 32→48 для «дыхания». Но это противоречит прототипу. Сейчас восстанавливаем.

**Файл:** `app/create/page.tsx`

```diff
  const pageHeaderStyle = {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
-   marginBottom: 48,
+   marginBottom: 40,
    maxWidth: 720,
  };
```

---

# Part IV — Cleanup / DRY

## Phase 11 — [P2] Replace inline `helperTextStyle` with `.field__help` class

`.field__help` уже определён в globals.css (после plan-10) с идентичными values. Inline дубль — лишний.

**Файл:** `components/link/create-link-form.tsx`

```diff
  <p style={helperTextStyle}>
    The link cannot be funded after this time. Defaults to 5 minutes before the consultation.
  </p>
+ // Replace with:
+ <p className="field__help">
+   The link cannot be funded after this time. Defaults to 5 minutes before the consultation.
+ </p>
```

Удалить `helperTextStyle` const.

---

## Phase 12 — [P2] TokenAmountRow label/helper → field classes

`labelStyle` и `helperStyle` в TokenAmountRow — дубли `.field__label` / `.field__help`.

**Файл:** `components/shared/token-amount-row.tsx`

```diff
- {label && <span style={labelStyle}>{label}</span>}
+ {label && <span className="field__label">{label}</span>}
  ...
- {sublabel && <span style={helperStyle}>{sublabel}</span>}
+ {sublabel && <span className="field__help">{sublabel}</span>}
```

Удалить `labelStyle` и `helperStyle` const.

---

# Part V — Финал

```bash
npm run typecheck && npm run build && npm run test:unit
```

Допиши в `audit/PROGRESS.md`:
```md
## Plan-16 — completed (/create page audit)

### Part I — Structural

#### Phase 1 — ActionPanel defaults match prototype Card
- components/shared/action-panel.tsx — borderRadius var(--r-5)→var(--r-3); border var(--border)→var(--border-soft); boxShadow var(--shadow-panel)→var(--shadow-2)
- (affects ALL ActionPanel usage: create form, DealDetailsCard, KeyTimes, my-deals/my-links list panels, admin disputes — system-wide visual lighter/less rounded)

#### Phase 2 — Preview section-label + nested eyebrow
- components/link/link-preview-card.tsx — restructured preview: section-label "Preview" (with divider line) → stack-12 inner with eyebrow "Consultation" + h3 + description; removed descStyle; placeholder "Consultation title" → "Untitled consultation"

#### Phase 3 — Preview inset padding 28
- components/link/link-preview-card.tsx — insetStyle padding "14px 16px" → 28

#### Phase 4 — Preview stack gap 20
- components/link/link-preview-card.tsx — stack.gap 16→20

### Part II — Type / copy

#### Phase 5 — Inset title .tiny class
- components/link/link-preview-card.tsx — inset title → className="tiny" (CAPS 0.06em); subtitle → className="small" + inline color/marginTop; removed insetTitleStyle/insetSubStyle

#### Phase 6 — Description helper
- components/link/create-link-form.tsx — Description helper added ". Markdown not supported."

#### Phase 7 — Payment sublabel wording
- components/link/create-link-form.tsx — TokenAmountRow sublabel: "You will receive" → "You receive"; "3% platform fee" → "3% fee"

#### Phase 8 — Duration "min" → "minutes"
- components/link/link-preview-card.tsx — Duration DetailRow value

#### Phase 9 — Preview cardStyle boxShadow
- components/link/link-preview-card.tsx — cardStyle: border → border-soft; added boxShadow var(--shadow-2)

### Part III — Page header

#### Phase 10 — pageHeader marginBottom 40
- app/create/page.tsx — pageHeaderStyle marginBottom 48→40

### Part IV — Cleanup / DRY

#### Phase 11 — helperTextStyle → .field__help
- components/link/create-link-form.tsx — inline helperTextStyle → className="field__help"; removed const

#### Phase 12 — TokenAmountRow label/helper → field classes
- components/shared/token-amount-row.tsx — labelStyle → className="field__label"; helperStyle → className="field__help"; removed both consts
```

---

# Сводка

| Phase | Что | Приоритет | Влияние |
|---|---|---|---|
| **1** | ActionPanel defaults (r-3 / border-soft / shadow-2) | P0 | **Все страницы** где есть ActionPanel — формы, list panels, deal/admin cards |
| **2** | Preview restructure (section-label + nested eyebrow) | P0 | /create preview card |
| **3** | Preview inset padding 14/16 → 28 | P0 | /create preview inset |
| **4** | Preview stack gap 16→20 | P0 | /create preview spacing |
| **5** | Inset title → .tiny CAPS | P1 | /create preview |
| **6** | Description "Markdown not supported" copy | P1 | /create form |
| **7** | Payment sublabel exact wording | P1 | /create form |
| **8** | Duration "min" → "minutes" | P1 | /create preview |
| **9** | Preview card boxShadow + border-soft | P1 | /create preview |
| **10** | Page header margin 48→40 | P1 | /create header |
| **11** | helperTextStyle → .field__help class | P2 | /create cleanup |
| **12** | TokenAmountRow label/helper → field classes | P2 | TokenAmountRow cleanup (affects /create + receipt) |

После Plan-16:
- ✅ `/create` визуально идентична прототипу
- ✅ Preview card имеет правильную секционную структуру с divider линиями
- ✅ Inset cards правильного размера
- ✅ Все form cards (и большинство других страниц через ActionPanel) имеют менее «толстые» rounded углы и более лёгкие shadows — soft elevation как в прототипе
- ✅ Copy текста match прототипу

## ⚠ Внимание к Phase 1

ActionPanel изменение затрагивает **всю кодовую базу**. Это правильно семантически, но визуально каждая страница где есть ActionPanel получит:
- Меньше rounded углы (12 вместо 20) — выглядит «строже»
- Тоньше border (soft вместо normal) — выглядит «легче»
- Slabсю shadow (shadow-2 вместо shadow-3) — менее «выпуклое»

Если разработчик хочет ограничить scope только /create — можно вместо изменения ActionPanel **override через style prop** на каждом ActionPanel в `create-link-form.tsx`. Но это менее чисто.

Рекомендую сделать systemic fix (изменить ActionPanel дефолты) — это починит много страниц за один заход.
