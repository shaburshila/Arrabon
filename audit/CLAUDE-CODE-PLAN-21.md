# Claude Code — план №21 (финальный глубокий аудит)

**Дата:** 2026‑05‑21
**Контекст:** После 20 планов реализация визуально и функционально соответствует прототипу. Этот финальный план — **систематическая проверка** всего что могло остаться или незаметно регрессировать. Не вводит новые правки заранее — даёт grep‑команды и чек‑лист.

**Правила:**
- Не коммить.
- Найденные проблемы фиксировать как **deviations** в `audit/PROGRESS.md` под секцией `## Plan-21 — Findings`.
- После каждого Step — короткая запись «verified clean» либо «issues found: [list]».

---

# Step 1 — Grep‑аудит остаточных code-smells

Выполнить grep по `components/**/*.tsx` + `app/**/*.tsx` (исключая `app/global-error.tsx` который self-contained). Для каждой команды ожидается **0 results**:

```bash
# Legacy design tokens
grep -rn "var(--foreground)" components/ app/
grep -rn "var(--accent)[^-]" components/ app/
grep -rn "var(--radius)" components/ app/
grep -rn "var(--panel)" components/ app/
grep -rn "var(--input-bg)\|var(--input-border)" components/ app/

# Font weight violations (type scale max = 600)
grep -rn "fontWeight: 800" components/ app/
grep -rn "fontWeight: 700" components/ app/

# Inline numeric border-radius
grep -rn "borderRadius: 8[^0-9]\|borderRadius: 16[^0-9]" components/ app/

# Inline hex colors (should all be tokens)
grep -rEn "color: \"#[0-9a-fA-F]" components/ app/
grep -rEn "background: \"#[0-9a-fA-F]" components/ app/

# Stale "..." instead of "…" U+2026
grep -rn "\.\.\." components/ app/ | grep -v "// \|TODO\|FIXME\|node_modules\|: \"\.\.\."

# any-casts
grep -rn "as any" components/ app/

# Skipped imports
grep -rn "from \"@/components/shared/wallet-session-card\"" components/ app/
```

**Acceptance:** All commands return 0 matches.

---

# Step 2 — Mobile responsive check (<768px)

Реализация в основном строилась desktop‑first. Прототип имеет media queries для `.list-row` (grid-areas restructure), `.deal-hero` (vertical stack), tabs (overflow scroll), nav (hide center). Проверка на реальном устройстве/DevTools mobile mode:

### 2.1 — Viewport 375px (iPhone SE-like)

- [ ] **Top-nav**: brand mark visible, theme + wallet toolbar справа. Center nav (Create/My links/My deals) **скрыта** на mobile (via `.topnav-desktop-nav { display: none }` plan-9 2.G).
- [ ] **BottomTabBar**: видна снизу (3 таба, fixed bottom, safe-area-inset-bottom).
- [ ] **Landing hero**: seal скрыт (`.landing-hero__seal { display: none }` <900px), h1 32px (`@media (max-width:600px) .landing-hero h1`).
- [ ] **/my-deals, /my-links lists**: list-row перекомпонован в `grid-template-areas: "title price" "title pill" "trailing chevron"` (plan-9 2.F).
- [ ] **/deal/[id] hero**: amount под title (stacks), padding 24x20 (`@media (max-width: 768px) .deal-hero`).
- [ ] **/create form**: split разваливается в single column (`@media (max-width:900px) .create-split`).
- [ ] **Modal на small screen**: `.modal-overlay padding: 16px` (plan-7 PP), Modal не выходит за viewport.
- [ ] **Receipt**: padding 32×20 на <600px (`@media (max-width:600px) .receipt`).
- [ ] **Wallet pill**: на <768px размер пилюли уменьшается (через CSS если есть, либо graceful fit).
- [ ] **Forms inputs**: fontSize 16px (predtv iOS auto-zoom prevention, plan-14 Phase 3).

### 2.2 — Viewport 480px (mid-mobile)

- [ ] **.h-display** scale (44px landing hero, .not-found__title 44px).
- [ ] Landing CTA buttons stack vertically (`flex-wrap: wrap`).

### 2.3 — Landscape low-height (<480px height)

- [ ] BottomTabBar **скрыта** (`@media (max-height: 480px) and (orientation: landscape)`).

---

# Step 3 — Dark mode visual check

Все изменения шли через CSS токены, dark mode должен работать автоматически. Но некоторые элементы могут смотреться иначе:

### 3.1 — Toggle theme to dark, visit каждую страницу

- [ ] **Landing hero gradient** на body — alpha 0.08 / 0.05 (приглушённее чем light)
- [ ] **Receipt gradient** — `.receipt::before` с gold-soft (на surface dark — gold-soft alpha 0.14)
- [ ] **Deal hero gradient** — `.deal-hero::before linear-gradient 135deg gold-soft 0% → transparent 50%`
- [ ] **Brand mark** — top-nav всегда gold (alpha-lock-full-gold.svg) — должен быть видим на dark surface
- [ ] **Status pill icons** — strokes видны на coloured backgrounds (gold/blue/amber/green/red/purple)
- [ ] **Wallet pill** — `--ink` text on `--surface` (light text on dark)
- [ ] **Modal overlay** — `rgba(0,0,0,0.6)` (light theme override → rgba(22,22,22,0.35)) — verify dark theme uses 0.6
- [ ] **Code blocks** в SIWE modal — surface-2 mono text on dark
- [ ] **Skeleton shimmer** — surface-2 → surface-3 → surface-2 gradient
- [ ] **Btn--primary**: `var(--gold-on)` = `#0F0F0F` (dark text on gold) — verify не белый
- [ ] **`.section-label::after` divider** — `var(--rule)` alpha 0.10 (видим на dark surface)
- [ ] **Receipt: foot ink-soft strong** — strong text visible

### 3.2 — Edge cases в dark

- [ ] Toast danger — red bg + red text — contrast OK?
- [ ] Notice gold (Funds held in escrow) — gold-soft bg + gold-deep text → dark version uses var(--gold) instead via `[data-theme="dark"] .pill--gold { color: var(--gold) }`
- [ ] Hover states на cards (surface-2 on hover via `.list-row:hover`)
- [ ] Wallet pill `--green` dot (network indicator) — пульсирует, видим?

---

# Step 4 — A11y automated check

Использовать axe-core или Lighthouse:

```bash
# Если есть Playwright tests:
npx playwright test --grep a11y

# Или manual через Chrome DevTools:
# 1. Открыть DevTools → Lighthouse → Accessibility audit
# 2. Запустить на /, /create, /deal/[id], /admin/disputes
```

Ожидаемые scores ≥ 95 / 100.

**Чек:**
- [ ] Все `<button>` имеют label или aria-label
- [ ] Все `<input>` имеют `<label>` либо aria-label
- [ ] Контраст ≥ 4.5:1 (light) и ≥ 4.5:1 (dark)
- [ ] Tab order логичный (top → main content → footer)
- [ ] Focus visible на всех interactive elements
- [ ] Modal — `aria-modal=true`, focus trap работает
- [ ] Live regions — toast / loading / progress озвучиваются

---

# Step 5 — Performance check

```bash
# Build size
npm run build

# Look for:
# - First Load JS per route < 200kB ideal
# - Largest chunk size
# - Font loading strategy
```

**Чек:**
- [ ] Build вывод показывает size per route
- [ ] No console.warn during build (font loading, image optimization)
- [ ] Lighthouse Performance ≥ 90 на landing

---

# Step 6 — Cross-browser sanity

Открыть `/`, `/create`, `/deal/[id]`, `/admin/disputes`:

- [ ] **Chrome** (latest) — baseline
- [ ] **Safari** (latest macOS / iOS Safari) — `100dvh`, `:focus-visible`, `color-mix()` fallback
- [ ] **Firefox** — `backdrop-filter` (top-nav blur), focus rings
- [ ] **Mobile Safari** — input zoom prevention (font 16px on <768px)

---

# Step 7 — Code-level final pass

### 7.1 — Remaining cleanup из plan-20

- [ ] Apply Refresh button → `<Btn variant="ghost" size="sm">` consistency to:
  - `app/admin/disputes/[id]/page.tsx`
  - `app/admin/denylist/page.tsx`
  - Remove `smallButtonStyle` const if no other uses

### 7.2 — Stale comments / TODO

```bash
grep -rn "TODO\|FIXME\|XXX\|HACK" components/ app/
```

Adddress any leftover.

### 7.3 — Dead code

- [ ] Все imports используются (TypeScript surface через `noUnusedLocals`)
- [ ] Components в `components/shared/` — все используются? (особенно `inner-section.tsx`, `live-badge.tsx` если они есть legacy)

```bash
# For each shared component, check if imported anywhere
for f in components/shared/*.tsx; do
  name=$(basename "$f" .tsx)
  count=$(grep -rln "$name" components/ app/ | grep -v "$f" | wc -l)
  echo "$name: $count usages"
done
```

Компоненты с 0 usages — кандидаты на удаление.

---

# Step 8 — Documentation pass

- [ ] `audit/PROGRESS.md` finalized с записями всех 21 планов
- [ ] `README.md` — обновлён если упоминает архитектуру / стили
- [ ] `audit/COMPARISON.md` — пометить как archived (если есть)
- [ ] Plan files в `audit/` — оставить как historical reference

---

# Финал — Sign-off

После всех Steps:

```bash
npm run typecheck && npm run build && npm run test:unit
```

Допиши в `audit/PROGRESS.md`:

```md
## Plan-21 — Final audit completed

### Step 1 — Grep audit
- Legacy tokens: 0 results ✓
- fontWeight 800/700: 0 results ✓
- Inline borderRadius 8/16: 0 results ✓
- Hex colors in code: 0 results ✓
- "..." instead of "…": 0 results ✓
- as any casts: [list or 0] ✓
- wallet-session-card imports: 0 results ✓

### Step 2 — Mobile sweep
- 375px: [verified clean / issues: ...]
- 480px: [verified clean / issues: ...]
- Landscape: [verified clean / issues: ...]

### Step 3 — Dark mode
- All pages verified ✓ / issues found: [...]

### Step 4 — A11y
- Lighthouse scores: /=XX, /create=XX, /deal=XX, /admin=XX

### Step 5 — Performance
- Build sizes: [summary]
- Lighthouse perf: [scores]

### Step 6 — Cross-browser
- Chrome / Safari / Firefox / Mobile Safari: [pass/issues]

### Step 7 — Cleanup applied
- (any actual code changes from Step 7 fixes)

### Step 8 — Docs
- PROGRESS.md complete ✓
```

Всё что выявлено как `[issues found]` — формализовать как plan-22 если нужны исправления, либо зафиксировать как known limitations.

---

# Сводка

Plan-21 — **верификационный**, не вводит code changes (кроме Step 7.1 если применить). Цель — формальное sign-off реализации vs прототипа.

Найденные deviations документируются. Пробелы P0/P1 → plan-22.
