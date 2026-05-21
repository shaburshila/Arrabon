# Claude Code — план №14 (production readiness + a11y)

**Дата:** 2026‑05‑21
**Контекст:** Все 13 планов закрыли визуальный матчинг прототипа. Этот план переходит от «дизайн pixel-perfect» к **production readiness** — кросс-браузер, SSR, мобильные платформы, печать — и завершается полноценным **a11y audit** (WCAG 2.1 Level AA).

План разбит на **2 части по 7+8 фаз**. Можно делать последовательно или останавливаться после Part I (production-safe) либо Part II (full a11y).

**Правила:**
- Не коммить.
- После каждой фазы — `npm run typecheck && npm run build && npm run test:unit`.
- Запись в `audit/PROGRESS.md` (секция `## Plan-14`).

---

# Part I — Production readiness

## Phase 1 — [P0] SSR theme flash (hydration mismatch)

**Проблема:** `ThemeToggle` / `ArrabonSeal` читают `document.documentElement.dataset.theme` через `useLayoutEffect`. На сервере темы нет → SSR рендерит light. Клиент гидрируется → flash light → dark. На прода это «моргание» при каждой загрузке страницы.

### Действие

**Файл:** `app/layout.tsx`

Inline script в `<head>` ДО hydration, ставит data-theme:

```tsx
<head>
  <script
    dangerouslySetInnerHTML={{
      __html: `
        try {
          var t = localStorage.getItem('theme');
          if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', t);
        } catch (e) {}
      `,
    }}
  />
</head>
<body suppressHydrationWarning>
  ...
</body>
```

**Файл:** `components/shared/theme-toggle.tsx` — useLayoutEffect уже работает, просто теперь рендер на сервере и до hydration совпадает.

### Acceptance
- Перезагрузить страницу в dark mode → нет flash от light к dark.
- В DevTools отключить JS → светлая тема (default) — graceful degradation.

---

## Phase 2 — [P0] iOS Safari `100vh` → `100dvh`

**Проблема:** `100vh` на iOS Safari включает URL bar, которая схлопывается при скролле. `.landing-hero-section` с `min-height: calc(100vh - 64px)` визуально «прыгает» когда bar схлопнется/появится.

### Действие

**Файл:** `app/globals.css`

```diff
  .landing-hero-section {
-   min-height: calc(100vh - 64px);
+   min-height: calc(100dvh - 64px);
  }

  .not-found {
-   min-height: calc(100vh - 64px);
+   min-height: calc(100dvh - 64px);
  }
```

И `<main>`:
```diff
- main { min-height: 100vh; }
+ main { min-height: 100dvh; }
```

`dvh` (dynamic viewport height) — поддерживается iOS 15.4+, Chrome 108+, Firefox 101+. Fallback `100vh` ok для legacy.

### Acceptance
- На iPhone Safari hero на главной не «прыгает» при свайпе вверх (когда URL bar схлопывается).

---

## Phase 3 — [P0] iOS input zoom prevention

**Проблема:** Plan-10 установил `.input` font-size 14px. На iOS Safari любой input < 16px **auto-zooms** при focus → весь viewport резко увеличивается. Sport — UX disaster для mobile users.

### Действие

**Файл:** `app/globals.css`

Mobile bump до 16px:

```css
@media (max-width: 768px) {
  .input,
  .textarea,
  .select,
  .amount-input input,
  .search-input input {
    font-size: 16px;
  }
}
```

> Альтернатива — `<meta name="viewport" content="..., maximum-scale=1">`, но это ломает доступность zoom для слабовидящих. Не делать.

### Acceptance
- На iPhone Safari focus на input/textarea/select не вызывает page zoom.

---

## Phase 4 — [P1] Browser autofill стилизация

**Проблема:** Chrome/Safari подсвечивают autofilled inputs жёлтым/синим (логин, кошелёк, дата). Перекрывает `var(--surface)` background и gold focus ring.

### Действие

**Файл:** `app/globals.css` — добавить в form-fields секцию:

```css
/* Override browser autofill highlight */
.input:-webkit-autofill,
.input:-webkit-autofill:hover,
.input:-webkit-autofill:focus,
.textarea:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 1000px var(--surface) inset;
  -webkit-text-fill-color: var(--ink);
  transition: background-color 5000s ease-in-out 0s;
  caret-color: var(--ink);
}

[data-theme="dark"] .input:-webkit-autofill,
[data-theme="dark"] .textarea:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 1000px var(--surface) inset;
  -webkit-text-fill-color: var(--ink);
}
```

### Acceptance
- Browser autofill в /create форме сохраняет фирменные цвета (white bg light / graphite bg dark), а не жёлтый Chrome default.

---

## Phase 5 — [P1] `color-mix()` fallback

**Проблема:** Используется в `.notice--*` borders, `.btn--danger:hover`, `.admin-badge` border, `.btn--secondary:hover`. **Не поддерживается Safari < 16.4** (≈ начало 2023) и старых Chromium. Border не отрендерится вообще.

### Действие

**Файл:** `app/globals.css` — после блоков с `color-mix`, добавить fallback:

```css
@supports not (color: color-mix(in srgb, red, blue)) {
  .notice--danger  { border-color: rgba(239, 68, 68, 0.22); }
  .notice--warning { border-color: rgba(245, 158, 11, 0.22); }
  .notice--success { border-color: rgba(34, 197, 94, 0.22); }
  .notice--gold    { border-color: rgba(198, 161, 91, 0.26); }
  .notice--info    { border-color: rgba(59, 130, 246, 0.22); }

  .btn--danger:hover:not(:disabled) {
    border-color: rgba(239, 68, 68, 0.30);
  }

  .admin-badge {
    border-color: rgba(198, 161, 91, 0.25);
  }
}
```

### Acceptance
- На Safari 16.3 или старее borders на Notice / admin badge видны (не transparent).

---

## Phase 6 — [P1] Print styles

**Проблема:** Receipt page имеет «Print receipt» кнопку, но нет `@media print` правил. При печати:
- Top-nav (sticky) рисуется наверху
- Bottom-tabs (на mobile) могут просочиться
- Background gradients на body будут тратить тонер
- Card shadows / blurs визуальный шум

### Действие

**Файл:** `app/globals.css` — добавить в конец:

```css
/* ─── Print styles ─────────────────────────────────────────────────── */

@media print {
  /* Hide all interactive chrome */
  .topnav,
  .bottom-tabs,
  .toasts,
  .landing-scroll-hint,
  .tweaks-panel {
    display: none !important;
  }

  /* Reset page background */
  body {
    background: white !important;
    background-image: none !important;
    color: black !important;
  }

  /* Card shadows / blurs off */
  .card,
  .receipt,
  .deal-hero,
  .modal {
    box-shadow: none !important;
    border: 1px solid #ccc !important;
  }

  /* Receipt full width on paper */
  .receipt {
    max-width: 100% !important;
    page-break-inside: avoid;
  }

  /* Avoid splitting key sections across pages */
  .receipt__details,
  .receipt__foot,
  .deal-hero {
    page-break-inside: avoid;
  }

  /* Hide gradients */
  .deal-hero::before,
  .receipt::before,
  .landing-cta::before {
    display: none !important;
  }

  /* Black text everywhere */
  .h-display,
  .h1,
  .h2,
  .h3,
  .lede,
  .body,
  .mono,
  .small {
    color: black !important;
  }

  /* Don't break links across pages */
  a {
    color: black !important;
    text-decoration: underline;
  }
}
```

### Acceptance
- Cmd/Ctrl + P на /deal/[id]/receipt → preview показывает только receipt content без nav/tabs/toasts/gradients, чёрный текст, ничего не разрывается между страницами.

---

## Phase 7 — [P2] Clipboard fallback (HTTP graceful degradation)

**Проблема:** `navigator.clipboard.writeText` доступен **только на HTTPS** или `localhost`. На staging через http://10.0.0.5 — silent fail в try/catch. CopyBtn показывает «Copied» но не копирует.

### Действие

**Файл:** `components/shared/copy-btn.tsx`

```tsx
const handleCopy = async () => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      // HTTP fallback — execCommand deprecated but широко поддерживается
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    // ничего нельзя сделать
  }
};
```

То же в `components/app/wallet-status-pill.tsx` `copyAddress()`.

### Acceptance
- На localhost via http://10.0.0.5 (или ngrok HTTP) copy кнопки работают.

---

# Part II — A11y audit (WCAG 2.1 AA)

Базовый уровень доступности уже хороший (nav landmarks, aria-labels на icon-only buttons, focus rings на inputs, Modal с ESC + body lock). Остались 8 системных пробелов.

## ✅ Что уже сделано хорошо (не трогать)

- `<nav aria-label="Primary navigation">` — TopNav, BottomTabBar, Pagination
- Icon-only buttons имеют `aria-label`: Bell, Theme, Modal close, Toast dismiss, Scroll-hint, Pagination prev/next
- Wallet pill: `aria-expanded` + `aria-haspopup="menu"`, dropdown `role="menu"`, items `role="menuitem"`
- Icon component: default `aria-hidden={true}` + опциональный `aria-label`/`role="img"`
- Modal: ESC handling + body scroll lock
- Inputs: focus ring (gold border + 3px gold-soft shadow)
- `<label>` wraps inputs (FormField)
- Disabled buttons корректно `<button disabled>`

---

## Phase 8 — [P0] Focus visibility на всех buttons/links

**Проблема:** focus rings есть только на form inputs. Все остальные кнопки (`.btn`, `.iconbtn`, `.list-row`, `.copy-field__btn`, `.admin-subnav__tab`, `.toast__close`, `.modal__close`, `.bottom-tabs__item`, nav links) полагаются на browser default focus outline, часто невидимый.

**Файл:** `app/globals.css`:

```css
/* ─── Keyboard focus indicators ─────────────────────────────────── */

.btn:focus-visible,
.iconbtn:focus-visible,
.copy-field__btn:focus-visible,
.admin-subnav__tab:focus-visible,
.bottom-tabs__item:focus-visible,
.toast__close:focus-visible,
.modal__close:focus-visible,
.landing-scroll-hint:focus-visible,
.list-row:focus-visible,
.search-input input:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
  border-radius: var(--r-2);
}

a:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
  border-radius: var(--r-1);
}
```

---

## Phase 9 — [P0] `prefers-reduced-motion`

**Проблема:** landing parallax, scroll-hint bob, skeleton shimmer, modal scale, toast slide-in, spinner — всегда играют. Пользователи с vestibular disorders не могут отключить.

**Файл:** `app/globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  .landing-scroll-hint__arrow,
  .live-dot,
  .spin {
    animation: none !important;
  }

  .live-dot { box-shadow: none !important; }
  .skeleton {
    animation: none !important;
    background: var(--surface-2) !important;
  }
}
```

**Файл:** `app/page.tsx` `HeroSection()`:

```diff
  useEffect(() => {
+   const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
+   if (prefersReduce) return;
    let raf = 0;
    ...
```

---

## Phase 10 — [P0] Live regions

**Проблема:** Screen readers не объявляют toast/loading/funding-progress.

### 10.1 Toast

**Файл:** `components/shared/toast.tsx`:

```diff
  <div
    className="toasts"
+   aria-live="polite"
+   aria-atomic="false"
+   role="region"
+   aria-label="Notifications"
  >
    ...
    <div
      key={t.id}
      className={`toast toast--${t.tone}`}
+     role={t.tone === "danger" ? "alert" : "status"}
    >
```

### 10.2 Loading texts

**Файлы:** `app/link/[id]/page.tsx`, `app/deal/[id]/page.tsx`, `app/deal/[id]/receipt/page.tsx`:

```diff
- <p className="small">Loading…</p>
+ <p className="small" role="status" aria-live="polite">Loading…</p>
```

### 10.3 Funding progress

**Файл:** `components/link/funding-progress.tsx`:

```diff
- <p className="section-label">Progress</p>
- <ol style={stepsListStyle}>
+ <p className="section-label" id="funding-progress-label">Progress</p>
+ <ol style={stepsListStyle} aria-labelledby="funding-progress-label" aria-live="polite">
```

---

## Phase 11 — [P1] Modal — focus trap + roles

**Проблема:** Modal имеет ESC + body lock, но без `role="dialog"`, `aria-modal`, focus trap, auto-focus, return-focus.

**Файл:** `components/shared/modal.tsx` — переписать целиком:

```tsx
"use client";

import { useEffect, useRef } from "react";

interface Props {
  children: React.ReactNode;
  onClose: () => void;
  open: boolean;
  width?: number;
  labelledBy?: string;
  describedBy?: string;
}

export function Modal({ open, onClose, width = 440, children, labelledBy, describedBy }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousActiveElement.current = document.activeElement as HTMLElement;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    requestAnimationFrame(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
    });

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previousActiveElement.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-modal="true"
        role="dialog"
        className="modal"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
```

**Файл:** `components/shared/siwe-sign-modal.tsx`:

```diff
- <Modal open={open} width={460} onClose={onReject}>
+ <Modal open={open} width={460} onClose={onReject} labelledBy="siwe-modal-title">
    ...
-   <h3 style={...}>Sign in with Ethereum</h3>
+   <h3 id="siwe-modal-title" style={...}>Sign in with Ethereum</h3>
```

---

## Phase 12 — [P1] Skip-to-content link

**Файл:** `app/layout.tsx`:

```tsx
<body>
  <a href="#main-content" className="skip-link">Skip to main content</a>
  <Providers>{children}</Providers>
  ...
</body>
```

**Файл:** `components/app/app-shell.tsx`:

```diff
- <main style={mainStyle}>
+ <main id="main-content" style={mainStyle}>
```

**Файл:** `app/globals.css`:

```css
.skip-link {
  position: absolute;
  top: -100px;
  left: 16px;
  z-index: 200;
  background: var(--ink);
  color: var(--bg);
  padding: 10px 16px;
  border-radius: var(--r-2);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: top 0.15s;
}

.skip-link:focus {
  top: 16px;
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}
```

---

## Phase 13 — [P1] Search input aria-label

**Файлы:** `app/my-deals/page.tsx`, `app/my-links/page.tsx`:

```diff
  <input
+   aria-label="Search by title or deal ID"
    onChange={...}
    placeholder="Search by title or deal ID…"
    type="search"
    value={query}
  />
```

(my-links: `aria-label="Search by title or link ID"`.)

---

## Phase 14 — [P1] Color contrast

### Audit results

| Token | Light value | На --bg | Ratio | AA |
|---|---|---|---|---|
| `--ink` | #161616 | #FAF8F2 | 16.4:1 | ✅ |
| `--ink-soft` | #2A2A2E | | 13.6:1 | ✅ |
| `--muted` | #6B6660 | | 5.7:1 | ✅ |
| `--muted-2` | #8B847B | | **3.6:1** | ⚠ FAIL для normal text |
| `--gold` | #C6A15B | | **2.5:1** | ❌ FAIL — НЕ для текста |
| `--gold-deep` | #8B6914 | | 5.4:1 | ✅ |

### Действия

1. **Grep `var(--gold)` в коде** → если есть `color: var(--gold)` (text), заменить на `var(--gold-deep)`.

2. **Аудит `--muted-2`** — используется для:
   - `.field__help` (12px small)
   - footerCopyStyle (13px)
   - `.tiny` (11.5px)
   - input placeholder

   Все ≤ 13px = normal text → FAIL. Варианты:
   - **A:** ужесточить токен `--muted-2: #8B847B → #757067` (4.5:1 contrast)
   - **B:** заменить usage `--muted-2` → `--muted` для text styles

**Файл:** `app/globals.css`:
```diff
- --muted-2:       #8B847B;
+ --muted-2:       #757067;
```

(Dark mode `#6F6A60` на #0F0F0F = 4.6:1 — OK как есть.)

---

## Phase 15 — [P2] Footer landmark

**Файл:** `app/page.tsx` `SiteFooter()`:

```diff
- <footer className="site-footer" style={footerSectionStyle}>
+ <footer className="site-footer" style={footerSectionStyle} role="contentinfo">
    <div style={{...}}>
-     <div className="site-footer__grid">
+     <nav aria-label="Footer navigation" className="site-footer__grid">
        ...
-     </div>
+     </nav>
```

---

# Финал

```bash
npm run typecheck && npm run build && npm run test:unit
```

Допиши в `audit/PROGRESS.md`:
```md
## Plan-14 — Production readiness + A11y

### Part I — Production readiness

#### Phase 1 — SSR theme flash
- app/layout.tsx — inline script in <head> sets data-theme before hydration; body suppressHydrationWarning

#### Phase 2 — iOS dvh
- app/globals.css — 100vh → 100dvh in .landing-hero-section, .not-found, main

#### Phase 3 — iOS input zoom
- app/globals.css — @media (max-width: 768px) bumps .input/.textarea/.select/.amount-input input/.search-input input to 16px

#### Phase 4 — Autofill styling
- app/globals.css — -webkit-autofill overrides for .input/.textarea (light + dark)

#### Phase 5 — color-mix fallback
- app/globals.css — @supports not (color-mix()) fallback rgba() for .notice--*, .btn--danger:hover, .admin-badge

#### Phase 6 — Print styles
- app/globals.css — @media print: hide chrome, white bg, black text, no shadows, page-break-inside avoid for key sections

#### Phase 7 — Clipboard fallback [optional]
- components/shared/copy-btn.tsx + wallet-status-pill.tsx — execCommand fallback for non-secure contexts

### Part II — A11y

#### Phase 8 — Focus visibility
- app/globals.css — :focus-visible outlines for .btn / .iconbtn / .list-row / .copy-field__btn / .admin-subnav__tab / .bottom-tabs__item / etc + a links

#### Phase 9 — Reduced motion
- app/globals.css — @media (prefers-reduced-motion: reduce) blocks
- app/page.tsx — HeroSection.onScroll early-return if reduced motion

#### Phase 10 — Live regions
- components/shared/toast.tsx — container aria-live=polite; individual role=alert/status
- 3× page.tsx — Loading texts with role=status aria-live=polite
- components/link/funding-progress.tsx — steps list aria-labelledby + aria-live

#### Phase 11 — Modal a11y
- components/shared/modal.tsx — role=dialog, aria-modal, focus trap, auto-focus, return-focus
- components/shared/siwe-sign-modal.tsx — labelledBy + h3 id

#### Phase 12 — Skip link
- app/layout.tsx + app-shell.tsx — skip-link + main id
- app/globals.css — .skip-link styles

#### Phase 13 — Search aria-label
- app/my-deals/page.tsx + my-links/page.tsx — aria-label on search inputs

#### Phase 14 — Color contrast
- (audit documented; --muted-2 → #757067 [if applied])
- (--gold not used as text — verified)

#### Phase 15 — Footer landmark
- app/page.tsx SiteFooter — role=contentinfo, nav aria-label="Footer navigation"
```

---

# Сводка

| Phase | Часть | Что | Приоритет |
|---|---|---|---|
| 1 | Production | SSR theme flash (hydration) | P0 |
| 2 | Production | iOS 100vh → 100dvh | P0 |
| 3 | Production | iOS input zoom prevention | P0 |
| 4 | Production | Autofill styling | P1 |
| 5 | Production | color-mix fallback | P1 |
| 6 | Production | Print styles | P1 |
| 7 | Production | Clipboard HTTP fallback | P2 |
| 8 | A11y | Focus visibility | P0 |
| 9 | A11y | Reduced motion | P0 |
| 10 | A11y | Live regions | P0 |
| 11 | A11y | Modal — focus trap + role=dialog | P1 |
| 12 | A11y | Skip-to-content link | P1 |
| 13 | A11y | Search aria-label | P1 |
| 14 | A11y | Color contrast | P1 |
| 15 | A11y | Footer landmark | P2 |

После Plan-14 проект готов к продакшну:
- ✅ SSR-safe (нет theme flash)
- ✅ Mobile Safari совместим (no input zoom, dvh)
- ✅ Browser compat (autofill, color-mix fallback)
- ✅ Print-ready (receipt)
- ✅ WCAG 2.1 AA compliant
