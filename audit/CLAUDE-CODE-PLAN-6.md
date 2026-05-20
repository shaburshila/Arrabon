# Claude Code — план №6 (исправление общих проблем)

Bug-фиксы и системные приведения к прототипу. После выполнения этого плана базовое поведение и плотность сетки должны соответствовать прототипу. Полировка отдельных страниц — в плане №7.

**Правила:** по фазам сверху вниз, `npm run typecheck && npm run build` clean в конце, не коммить, секция `## Plan-6` в `audit/PROGRESS.md`.

---

## Phase Z — Landing scroll-hint: viewport-relative (на всех экранах)

### Контекст
Сейчас `.landing-scroll-hint` использует `position: absolute; bottom: 64px` относительно `.landing-hero-section`. На разных размерах экрана даёт разный визуальный результат: на 1080-1440px монитор pill приклеен к нижнему краю viewport.

### Step Z.1 — position: fixed + viewport-fixed bottom

**Файл:** `app/globals.css`

Найди `.landing-scroll-hint`:
```css
.landing-scroll-hint {
  position: absolute;
  bottom: 64px;
  ...
}
```

Замени:
```css
.landing-scroll-hint {
  position: fixed;
  bottom: 40px;
  ...
}
```

### Step Z.2 — Убрать padding-bottom 120px у hero-section

**Файл:** `app/globals.css`

Найди `.landing-hero-section`:
```css
padding: 32px 0 120px;
```
Замени на:
```css
padding: 32px 0;
```

### Step Z.3 — Opacity формула viewport-fixed

**Файл:** `app/page.tsx`

В функции `HeroSection`, useEffect onScroll:
```tsx
const hintOp = Math.max(0, 1 - y / (vh * 0.06));
```

Замени на:
```tsx
const hintOp = Math.max(0, 1 - y / 80);
```

Так hint исчезает за первые 80px скролла одинаково на любом экране.

### Acceptance
- pill «How it works ↓» всегда на 40px от нижнего края viewport, на любой высоте монитора
- При скролле плавно исчезает за первые 80px

---

## Phase AA — Wallet pill polish

### Step AA.1 — Добавить `·` сепаратор

**Файл:** `components/app/wallet-status-pill.tsx`

Найди в JSX где Base label + address:
```tsx
{isSigned && (
  <>
    <span style={networkDotStyle} />
    <span style={networkLabelStyle}>Base</span>
  </>
)}
<span style={pillAddressStyle}>{address}</span>
```

Замени:
```tsx
{isSigned && (
  <>
    <span style={networkDotStyle} />
    <span style={networkLabelStyle}>Base</span>
    <span style={separatorStyle} aria-hidden>·</span>
  </>
)}
<span style={pillAddressStyle}>{address}</span>
```

И добавь стиль:
```tsx
const separatorStyle = {
  color: "var(--muted-2)",
  fontSize: 12,
  opacity: 0.6,
} as const;
```

### Step AA.2 — `…` (U+2026) вместо `...` в pill

**Файл:** `components/app/wallet-status-pill.tsx`

Сверху файла добавь локальный helper:
```tsx
function truncatePill(addr: string): string {
  if (!addr || addr.length < 12) return addr ?? "";
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`;  // unicode horizontal ellipsis
}
```

И замени:
```tsx
const address = session.address ? truncateAddress(session.address) : "…";
```
на:
```tsx
const address = session.address ? truncatePill(session.address) : "\u2026";
```

`truncateAddress()` в dropdown header'е НЕ трогать — там остаётся с `...`.

### Step AA.3 — Больше воздуха внутри pill

**Файл:** `components/app/wallet-status-pill.tsx`

Найди `connectedPillStyle`:
```tsx
gap: 7,
height: 34,
padding: "0 6px 0 10px",
```

Замени:
```tsx
gap: 10,
height: 34,
padding: "0 6px 0 14px",
```

### Acceptance
- pill: `● Base · 0x46e2…02Ca ⊕ ⌄` — элементы не слипшиеся

---

## Phase II — --dens 1.18 → 1 (match prototype default)

### Контекст
Прототип использует `--dens: 1` (default). Implementation поставила 1.18 без причины. Это пока не аффектит ничего (переменные `--pad-card`, `--gap-stack`, `--row-h` не используются в коде), но если когда-то начнут использоваться — должны соответствовать прототипу.

### Step II.1

**Файл:** `app/globals.css`

```css
--dens: 1.18;
```
→
```css
--dens: 1;
```

---

## Phase LL — Hero и Receipt gradients (verification)

### Step LL.1 — Проверь .deal-hero::before

**Файл:** `app/globals.css`

Должно быть **ровно** как в прототипе:
```css
.deal-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--gold-soft) 0%, transparent 50%);
  pointer-events: none;
  opacity: 0.6;
}

.deal-hero > * { position: relative; }
```

Если значения отличаются — поправить под эти. Если уже совпадают — не трогать.

### Step LL.2 — Проверь .receipt::before

**Файл:** `app/globals.css`

Должно быть:
```css
.receipt::before {
  content: "";
  position: absolute;
  top: -120px;
  left: 50%;
  transform: translateX(-50%);
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, var(--gold-soft) 0%, transparent 60%);
  pointer-events: none;
}
```

Если отличается — выровнять. Если совпадает — не трогать.

---

## Phase NN — Финал

```bash
npm run typecheck && npm run build && npm run test:unit
```

Допиши в `audit/PROGRESS.md`:
```md
## Plan-6 — completed

### Phase Z — Landing scroll-hint viewport-fixed
- app/globals.css — .landing-scroll-hint absolute→fixed, bottom 64→40
- app/globals.css — .landing-hero-section padding-bottom 120→0
- app/page.tsx — hint opacity formula vh-based → y/80

### Phase AA — Wallet pill polish
- components/app/wallet-status-pill.tsx — added `·` separator, truncatePill() with `…`, gap 7→10, padding-left 10→14

### Phase II — Density baseline matches prototype
- app/globals.css — --dens 1.18→1

### Phase LL — Hero/Receipt gradients verified
- app/globals.css — .deal-hero::before and .receipt::before values match prototype
```

---

Точка входа: **Phase Z, Step Z.1**.
