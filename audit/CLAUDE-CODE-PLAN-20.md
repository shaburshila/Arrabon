# Claude Code — план №20 (admin страницы)

**Дата:** 2026‑05‑21
**Контекст:** Аудит /admin/disputes, /admin/disputes/[id], /admin/denylist. Большие функциональные страницы. Основные расхождения визуальные/семантические (status pill tone, ellipsis character, page header spacing).

---

## Phase 1 — [P0] StatusPill Refunded tone: "accent" → "purple"

Та же проблема что в plan-19 phase 3 — но в admin disputes resolved list, и в admin disputes detail page.

**Файл:** `app/admin/disputes/page.tsx` (~line 530, resolved deals list):

```diff
  <StatusPill
    label={deal.status === "Released" ? "Released" : "Refunded"}
    size="md"
-   tone={deal.status === "Released" ? "success" : "accent"}
+   tone={deal.status === "Released" ? "green" : "purple"}
  />
```

**Файл:** `app/admin/disputes/[id]/page.tsx` — найти аналогичный `<StatusPill>` для resolved deal status и применить ту же замену.

## Acceptance
- Refunded sделки в admin списке — purple pill (соответствие status taxonomy)
- Released — green (не "success" аlias)

---

## Phase 2 — [P1] Admin page header marginBottom 40

**Проблема:** `headerStyle` в admin/disputes/page.tsx (и [id], и denylist) только `{display: flex, flexDirection: column, gap: 8}` — без marginBottom. Spacing полагается на AppShell content gap 24. Прототип / другие страницы используют 40.

**Файлы:** `app/admin/disputes/page.tsx`, `app/admin/disputes/[id]/page.tsx`, `app/admin/denylist/page.tsx`:

```diff
  const headerStyle = {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
+   marginBottom: 40,
  };
```

(Имя `headerStyle` может отличаться — найти соответствующий const для h1+lede block.)

## Acceptance
- 40px gap между h1+lede и контентом (subnav tabs / toolbar / list)

---

## Phase 3 — [P1] truncateTxHash: использовать ellipsis "…" вместо "..."

**Файл:** `app/admin/disputes/page.tsx`:

```diff
  function truncateTxHash(value: string) {
-   return `${value.slice(0, 10)}...${value.slice(-6)}`;
+   return `${value.slice(0, 10)}…${value.slice(-6)}`;
  }
```

Везде в проекте используется character `…` (U+2026 horizontal ellipsis). 3 точки выглядят шире / другим шрифтом.

---

## Phase 4 — [P2] Confirm dialogs styling — verify

**Файл:** `app/admin/disputes/resolve-controls.tsx`

Проверить:
- `confirmStyle` borderRadius `var(--r-2)` ✓ (plan-13)
- padding 12 — match с прототипом admin-acknowledge / compliance-check (которые имеют 12x14)

Если padding не 12x14 — изменить на `"12px 14px"` для visual consistency.

---

## Phase 5 — [P2] Admin denylist — pass-through аудит

**Файл:** `app/admin/denylist/page.tsx`

Проверить (нет прямого доступа к prototype admin-denylist — но общие паттерны):
- `headerStyle.marginBottom: 40` (Phase 2)
- Все ActionPanel padding 28 (через plan-7 KK уже сделано)
- Section h2 28px через `.h2` class
- form helper text через `.field__help`
- DetailRows внутри entry card используют общую правильную типографику

---

## Phase 6 — [P2] Refresh button styling

**Файл:** `app/admin/disputes/page.tsx`, `smallButtonStyle`:

```ts
const smallButtonStyle = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-2)",   // ✓
  color: "var(--ink)",            // ✓ (plan-11)
  fontSize: 13,
  fontWeight: 500,                // ✓ (plan-12 cleanup)
  minHeight: 36,
  padding: "0 12px",
};
```

Сравнить с `.btn--sm` (h 36, padding "0 14px", font-size 13). Padding 12 vs 14 — 2px diff. Можно:
- Заменить кнопку на `<Btn variant="ghost" size="sm">Refresh</Btn>` (consistency)
- Или оставить inline и подкорректировать padding до 14

Рекомендую первое — заменить на `<Btn>`, удалить `smallButtonStyle` const.

---

# Финал

```bash
npm run typecheck && npm run build && npm run test:unit
```

```md
## Plan-20 — completed (admin pages)

### Phase 1 — StatusPill tone fix
- app/admin/disputes/page.tsx — resolved list StatusPill: success/accent → green/purple
- app/admin/disputes/[id]/page.tsx — same fix

### Phase 2 — Page header marginBottom 40
- app/admin/disputes/page.tsx — headerStyle marginBottom 40
- app/admin/disputes/[id]/page.tsx — same
- app/admin/denylist/page.tsx — same

### Phase 3 — Ellipsis character
- app/admin/disputes/page.tsx — truncateTxHash uses "…" (U+2026) instead of "..."

### Phase 4 — Confirm dialog padding (if needed)
- app/admin/disputes/resolve-controls.tsx — confirmStyle padding match prototype

### Phase 5 — Denylist sweep
- (per-page checks per existing standards)

### Phase 6 — Refresh button
- app/admin/disputes/page.tsx — Refresh button → <Btn variant="ghost" size="sm">; removed smallButtonStyle const
```
