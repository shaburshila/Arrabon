# Claude Code — план №10 (gradient + forms + list rows)

**Дата:** 2026‑05‑21
**Контекст:** ревью после plan-9. Пользователь нашёл 3 серьёзных расхождения, которые попали в слепые зоны прошлых аудитов:

1. **Отсутствует радиальный gold gradient** на фоне страниц (`.app` background-image)
2. **Формы не похожи на прототип** — inputs квадратнее/крупнее/без фокус‑ring, labels UPPERCASE, AmountInput полностью другой
3. **List rows на /my-deals и /my-links не совпадают по типографике** — после plan-3 J / plan-7 CC размеры были «улучшены», но это сделало их более жирными чем в прототипе

Все 3 — P0. Делать по фазам сверху вниз. После каждой — `npm run typecheck && npm run build && npm run test:unit`, потом запись в `PROGRESS.md` (секция `## Plan-10`).

---

# Phase 1 — Радиальный gold gradient на фоне

## 1.1 — Добавить `.app` background-image

**Файл:** `app/globals.css`

В прототипе `styles.css:124`:
```css
.app {
  min-height: 100vh;
  background: var(--bg);
  background-image:
    radial-gradient(1200px 600px at 80% -100px, var(--gold-soft), transparent 60%),
    radial-gradient(900px 500px at -10% 120%, var(--gold-soft), transparent 60%);
}

[data-theme="dark"] .app {
  background-image:
    radial-gradient(1200px 600px at 80% -200px, rgba(198, 161, 91, 0.08), transparent 60%),
    radial-gradient(900px 500px at -10% 120%, rgba(198, 161, 91, 0.05), transparent 60%);
}
```

Реализация: только `body { background: var(--bg) }` — без gradient. Страницы пустые/плоские.

**Действие:** добавить в `app/globals.css` в конец секции base/resets (рядом с body):
```css
body {
  /* …existing… */
  background: var(--bg);
  background-image:
    radial-gradient(1200px 600px at 80% -100px, var(--gold-soft), transparent 60%),
    radial-gradient(900px 500px at -10% 120%, var(--gold-soft), transparent 60%);
  background-attachment: fixed;
}

[data-theme="dark"] body {
  background-image:
    radial-gradient(1200px 600px at 80% -200px, rgba(198, 161, 91, 0.08), transparent 60%),
    radial-gradient(900px 500px at -10% 120%, rgba(198, 161, 91, 0.05), transparent 60%);
}
```

> Прототип кладёт gradient на `.app` wrapper. У нас нет `.app` обёртки — кладём прямо на `body` с `background-attachment: fixed`, чтобы gradient оставался зафиксированным относительно viewport (как в прототипе, где `.app` 100vh + body не скроллится).

**Acceptance:** на любой странице в правом верхнем и левом нижнем углах появляется лёгкое тёплое золотистое свечение, особенно заметное на белом фоне landing/cards.

---

# Phase 2 — Формы (Inputs / TextArea / AmountInput / FormField)

Прототип использует CSS‑классы `.input`, `.textarea`, `.amount-input`, `.field__label`, `.field__help` — все они **отсутствуют** в `app/globals.css`. Реализация рендерит формы через inline styles, которые сильно отличаются от прототипа:

| Что | Прототип `.input` | Реализация `inputStyle` | Diff |
|---|---|---|---|
| height | **44px** | 48px | -4px |
| font-size | **14px** | 16px | -2px |
| border-radius | **var(--r-2)** (8) | var(--radius) = var(--r-4) (16) | quad rounded |
| background | var(--surface) | var(--input-bg) (alias same) | OK |
| border | var(--border) | var(--input-border) (alias) | OK |
| color | var(--ink) | var(--foreground) (alias) | OK |
| **focus** | gold border + 3px gold-soft ring | none | ❌ нет |

| FormField label | Прототип `.field__label` | Реализация | Diff |
|---|---|---|---|
| text-transform | normal | **UPPERCASE** | ❌ |
| letter-spacing | 0.005em | 0.04em | wider |
| font-size | 12 | 12 | OK |

| AmountInput | Прототип `.amount-input` | Реализация `TokenAmountRow` | Diff |
|---|---|---|---|
| структура | unified grid, focus-within ring | separate input + detached chip | ❌ структурно |
| input font | **serif 28px / 500** | sans 32px / 600 | ❌ |
| input height | 56px | min-height inherit | smaller |
| token chip | inline в общем border, surface-2 background, left-border | отдельный pill с border-radius | ❌ детач |
| token icon | none (prototype) | `$` в синем circle | ❌ slop |

## 2.1 — Добавить form classes в `app/globals.css`

В конец `app/globals.css` (или в подходящее место в секции после кнопок):

```css
/* ─── Form fields ──────────────────────────────────────────────────── */

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
  letter-spacing: 0.005em;
}

.field__help {
  font-size: 12px;
  color: var(--muted-2);
  line-height: 1.45;
}

.field__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.input,
.textarea,
.select {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-2);
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--ink);
  outline: none;
  transition: border-color .15s, background .15s, box-shadow .15s;
}

.input:focus,
.textarea:focus,
.select:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px var(--gold-soft);
}

.input--mono {
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: -0.01em;
}

.textarea {
  height: auto;
  min-height: 92px;
  padding: 12px 14px;
  line-height: 1.5;
  resize: vertical;
}

.input:disabled,
.textarea:disabled,
.select:disabled {
  background: var(--surface-2);
  color: var(--muted);
  cursor: not-allowed;
}

/* ─── Amount input (unified container with currency chip) ─────────── */

.amount-input {
  display: grid;
  grid-template-columns: 1fr auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-2);
  overflow: hidden;
  transition: border-color .15s, box-shadow .15s;
}

.amount-input:focus-within {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px var(--gold-soft);
}

.amount-input input {
  border: 0;
  background: transparent;
  height: 56px;
  font-family: var(--font-serif);
  font-weight: 500;
  font-size: 28px;
  color: var(--ink);
  padding: 0 16px;
  outline: none;
  letter-spacing: -0.01em;
}

.amount-input__token {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  background: var(--surface-2);
  border-left: 1px solid var(--border);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: 0.02em;
}

/* ─── Utility rule divider ────────────────────────────────────────── */

.rule {
  height: 1px;
  background: var(--rule);
  border: 0;
  margin: 0;
}
```

## 2.2 — TextInput → использовать `.input` класс

**Файл:** `components/shared/text-input.tsx`

```tsx
import type { InputHTMLAttributes } from "react";

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`input${className ? ` ${className}` : ""}`}
    />
  );
}
```

Полностью удалить `inputStyle` const. Использовать className вместо inline style.

> Если кто-то передаёт `style` prop сейчас — оставить поддержку:
> ```tsx
> <input {...props} className={…} style={style} />
> ```
> Но в большинстве вызовов style не передаётся.

## 2.3 — TextArea → использовать `.textarea` класс

**Файл:** `components/shared/text-area.tsx`

```tsx
import type { TextareaHTMLAttributes } from "react";

export function TextArea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`textarea${className ? ` ${className}` : ""}`}
    />
  );
}
```

Удалить `textareaStyle` const.

## 2.4 — TokenAmountRow → переписать через `.amount-input` структуру

**Файл:** `components/shared/token-amount-row.tsx`

Полностью заменить:

```tsx
import type { ChangeEvent } from "react";

export function TokenAmountRow({
  amount,
  label,
  onChange,
  readonly = false,
  required = false,
  sublabel,
  token = "USDC",
}: {
  amount: number | string;
  label?: string;
  onChange?: (value: string) => void;
  readonly?: boolean;
  required?: boolean;
  sublabel?: string;
  token?: string;
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(event.target.value);
  }

  return (
    <div style={fieldStyle}>
      {label && <span style={labelStyle}>{label}</span>}
      <div className="amount-input">
        {readonly ? (
          <span style={readonlyAmountStyle}>{amount}</span>
        ) : (
          <input
            inputMode="decimal"
            onChange={handleChange}
            placeholder="0.00"
            required={required}
            type="number"
            value={amount}
          />
        )}
        <span className="amount-input__token">{token}</span>
      </div>
      {sublabel && <span style={helperStyle}>{sublabel}</span>}
    </div>
  );
}

const fieldStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
};

const labelStyle = {
  color: "var(--muted)",
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.005em",
};

const helperStyle = {
  color: "var(--muted-2)",
  fontSize: 12,
  lineHeight: 1.45,
};

const readonlyAmountStyle = {
  alignItems: "center",
  color: "var(--ink)",
  display: "inline-flex",
  fontFamily: "var(--font-serif)",
  fontSize: 28,
  fontWeight: 500,
  height: 56,
  letterSpacing: "-0.01em",
  padding: "0 16px",
};
```

**Что изменилось:**
- Удалён синий circle с `$` (icon slop — не было в прототипе)
- Удалён detached pill для token — теперь это inline `.amount-input__token` с surface-2 background и left-border, как часть общего container'а
- Label и sublabel вынесены за пределы `.amount-input`, чтобы они выровнялись с другими `<FormField>` (label сверху, helper снизу)
- Input получает serif 28px / 500 / height 56 от `.amount-input input` CSS rule
- Получает focus-within gold ring от CSS

**ВАЖНО:** TokenAmountRow используется в CreateLinkForm Payment section *внутри* FormField? Проверь:

```tsx
<TokenAmountRow
  amount={form.price_usdc}
  label="Price"
  onChange={(value) => setField("price_usdc", value)}
  required
  sublabel="You will receive this amount in full…"
  token="USDC"
/>
```

Здесь `label` и `sublabel` приходят как props в TokenAmountRow, а **не** через внешний FormField. Так и должно быть — TokenAmountRow сам рендерит свой field‑wrapper.

## 2.5 — FormField → использовать `.field__label` / `.field__help`

**Файл:** `components/shared/form-field.tsx`

```tsx
import type { ReactNode } from "react";

export function FormField({
  children,
  error,
  helper,
  label,
}: {
  children: ReactNode;
  error?: string | null;
  helper?: ReactNode;
  label: string;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {helper && !error && <span className="field__help">{helper}</span>}
      {error && <span style={errorStyle}>{error}</span>}
    </label>
  );
}

const errorStyle = {
  color: "var(--red)",
  fontSize: 12,
  lineHeight: 1.4,
};
```

Удалить `fieldStyle`, `labelStyle`, `helperStyle` const.

**Эффект:** labels перестают быть UPPERCASE. Стали обычные «Title» / «Description» / «Date» вместо «TITLE» / «DESCRIPTION» / «DATE». Это значительно ближе к референсу.

## 2.6 — CreateLinkForm: проверить `twoColumnRowStyle` → `.field__row`

**Файл:** `components/link/create-link-form.tsx`

Сейчас:
```ts
const twoColumnRowStyle = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "1fr 1fr",
};
```

Это идентично `.field__row`. Можно либо оставить (не критично), либо заменить:
```diff
- <div style={twoColumnRowStyle}>
+ <div className="field__row">
```
и удалить const. **Опционально.**

## Phase 2 — финал

Проверь все места, где раньше использовались `style={inputStyle}` или собственные form‑стили — заменить на новые классы. Особенно:
- Search input на /my-deals и /my-links — уже использует `.search-input` (plan-9). ✓
- Inputs в SegmentedTabs — не применимо.
- Любые формы в admin/disputes resolve-controls.

```bash
npm run typecheck && npm run build && npm run test:unit
```

**Acceptance:**
- Inputs на /create стали ниже (44 vs 48), c gold focus ring при клике
- Labels перестали быть UPPERCASE — стали обычным caseом
- AmountInput стал unified pill с serif 28px цифрами и surface-2 token chip справа
- Синий circle "$" исчез

---

# Phase 3 — List rows: вернуть прототиповую типографику

## 3.1 — Откатить «premium‑bump» из plan-3 J / plan-7 CC

**Файл:** `app/globals.css`

| Селектор | Сейчас | Прототип | Изменение |
|---|---|---|---|
| `.list-row__title-name` font-size | 15.5px | **14.5px** | -1px |
| `.list-row__title-name` font-weight | 600 | **500** | -100 |
| `.list-row__title-name` letter-spacing | -0.005em | (none) | удалить |
| `.list-row__title-sub` margin-top | 2px | (none) | удалить |
| `.list-row__price` font-size | 16 | **14** | -2px |
| `.list-row__price` font-weight | 600 | **500** | -100 |
| `.list-row__price` letter-spacing | -0.01em | (none) | удалить |
| `.list-row__price-token` font-family | sans | (default = sans inherits) | ✓ оставить sans |
| `.list-row__price-token` font-size | 10.5 | **11** | +0.5 |
| `.list-row__price-token` font-weight | 600 | (none = default 400) | удалить |
| `.list-row__price-token` letter-spacing | 0.04em | (none) | удалить |
| `.list-row__price-token` text-transform | uppercase | (none) | удалить |
| `.list-row__price-token` margin-left | 6 | **4** | -2px |

Замени блоки в `app/globals.css`:

```css
.list-row__title {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.list-row__title-name {
  font-size: 14.5px;
  font-weight: 500;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-row__title-sub {
  font-size: 12px;
  color: var(--muted);
  font-family: var(--font-mono);
  letter-spacing: -0.005em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-row__price {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 500;
  color: var(--ink);
  text-align: right;
  white-space: nowrap;
}

.list-row__price-token {
  font-size: 11px;
  color: var(--muted);
  margin-left: 4px;
}

.list-row__trailing {
  color: var(--muted);
  font-size: 13px;
  text-align: right;
  white-space: nowrap;
}
```

**Acceptance:**
- Названия в списках стали тоньше (weight 500 вместо 600) и чуть меньше (14.5 vs 15.5)
- Цена в моно стала тоньше и меньше (14/500 vs 16/600)
- «USDC» рядом с ценой — обычный case, не UPPERCASE, font-weight 400 (default)
- Сетка списка визуально лёгче, как в прототипе

---

# Финал

```bash
npm run typecheck && npm run build && npm run test:unit
```

Допиши в `audit/PROGRESS.md`:
```md
## Plan-10 — completed

### Phase 1 — Background gradient
- app/globals.css — body background-image: 2 radial gradients (1200x600 at 80%/-100, 900x500 at -10%/120) with var(--gold-soft); background-attachment: fixed
- app/globals.css — [data-theme="dark"] body — darker gradient overrides (0.08 / 0.05 alpha)

### Phase 2 — Forms (.input / .textarea / .amount-input / .field*)
- app/globals.css — added .field, .field__label, .field__help, .field__row, .input, .textarea, .select, .input--mono, .amount-input, .amount-input__token, .rule classes
- components/shared/text-input.tsx — replaced inline style with className="input"
- components/shared/text-area.tsx — replaced inline style with className="textarea"
- components/shared/form-field.tsx — replaced inline styles with className="field" + .field__label / .field__help; labels no longer UPPERCASE
- components/shared/token-amount-row.tsx — rewritten with .amount-input grid: removed blue $ circle icon (slop), removed detached pill, integrated token chip with surface-2 + left-border; serif 28px / 500 input with focus-within gold ring; label + sublabel moved outside .amount-input as separate .field__label / .field__help

### Phase 3 — List rows typography revert
- app/globals.css — .list-row__title-name 15.5/600/letter-spacing → 14.5/500 (no letter-spacing)
- app/globals.css — .list-row__title-sub removed margin-top
- app/globals.css — .list-row__price 16/600/letter-spacing → 14/500 (no letter-spacing)
- app/globals.css — .list-row__price-token sans 10.5/600/uppercase/0.04em/ml 6 → sans 11/default-weight/no-case/no-letter-spacing/ml 4
- app/globals.css — .list-row__trailing 13.5 → 13

**Final checks:** npm run typecheck clean, npm run build clean, npm run test:unit 12/12 passing.

### Notes
- background-attachment: fixed used because we don't have an .app wrapper — gradient stays fixed relative to viewport (visually identical to prototype where .app has min-height 100vh)
- form labels reverted from UPPERCASE — prototype uses normal case "Title" / "Description"
- TokenAmountRow blue $ circle was iconographic noise not in prototype — removed
```

---

# Что осталось проверить отдельно (вне плана)

Эти моменты не вошли в plan-10 — пометить как future work:

1. **DatePicker / TimePicker / NumberInput** — type="date"/"time"/"number" inputs могут визуально расходиться с прототипом из‑за browser default arrows. Проверить в браузере на Chrome/Safari/Firefox.

2. **Select** — прототип определяет `.select` (44px h, var(--r-2)), но в реализации не нашёл custom Select component. Если используются native `<select>` где‑то — добавить `className="select"`.

3. **AmountInput readonly mode** — раньше использовался для отображения цены без редактирования. После переписи value рендерится в serif 28px — проверь, что выглядит OK где он используется.

4. **MyLink badge maps** в `app/my-links/page.tsx` — `LINK_STATUS_CONFIG.Cancelled` использует `var(--muted-bg)` которого может не быть. Проверь, что эти алиасы существуют (`--muted-bg` это backward-compat алиас для `--bg-deep` — должен работать).
