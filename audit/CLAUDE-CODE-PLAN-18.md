# Claude Code — план №18 (/my-deals + /my-links)

**Дата:** 2026‑05‑21
**Контекст:** Аудит /my-deals и /my-links. Главная находка — **StatusPill компонент позиционируется в верху row и имеет короткую высоту 16px вместо прототиповых 24px**. Плюс пара минорных правок.

**Правила:**
- Не коммить.
- После плана — `npm run typecheck && npm run build && npm run test:unit`.
- Запись в `audit/PROGRESS.md` (секция `## Plan-18`).

---

# Phase 1 — [P0] StatusPill: вертикальное центрирование + высота 24/28

**Проблемы:**

1. **`alignSelf: "flex-start"`** в inline style — pill **«цепляется» к верху** grid-ячейки в `.list-row` (который имеет `align-items: center`). Без этого override pill центрируется вертикально.

2. **Slishком тонкий** — текущие padding `2px 8px` (sm) дают эффективную высоту ~16px. Прототип `.pill` имеет explicit `height: 24px`. На фоне title+sub (40px+ высота row), 16px pill выглядит «низкой и смещённой вверх».

3. **md size fontSize 14 vs прототиповый 13** — impl size="md" соответствует прототиповому "lg" по семантике, но размер шрифта на 1px больше.

## Прототип (из styles.css):
```css
.pill {
  padding: 4px 10px;
  height: 24px;
  font-size: 12px;
  line-height: 1;
  align-items: center;
}
.pill--lg {
  padding: 6px 12px;
  height: 28px;
  font-size: 13px;
}
```

## Действие

**Файл:** `components/shared/status-pill.tsx`

```diff
  return (
    <span
      style={{
        alignItems: "center",
-       alignSelf: "flex-start",
        background: bg ?? colors.background,
        border: "1px solid transparent",
        borderRadius: 999,
        color: color ?? colors.color,
        display: "inline-flex",
        fontWeight: 500,
        gap: icon ? 5 : 0,
        lineHeight: 1,
        maxWidth: "100%",
        whiteSpace: "nowrap",
        width: "max-content",
        ...sizeStyle,
        ...style,
      }}
    >
```

И обновить sizeStyles:

```diff
  const smStyle = {
    fontSize: 12,
-   padding: "2px 8px",
+   height: 24,
+   padding: "0 10px",
  } as const;

  const mdStyle = {
-   fontSize: 14,
-   padding: "4px 12px",
+   fontSize: 13,
+   height: 28,
+   padding: "0 12px",
  } as const;
```

> `lineHeight: 1` остаётся — text центрируется через `align-items: center` flexbox-а в фиксированной высоте.

## Acceptance
- StatusPill в `.list-row` (my-deals/my-links) **вертикально центрирована** относительно title+sub block
- Высота sm = **24px** (вместо 16), md = **28px** (вместо ~22)
- Текст внутри pill визуально по центру
- md шрифт 13px (был 14)

> Влияние: StatusPill используется во многих местах (list rows, LifecycleTimeline current step, RiskBadge, admin disputes). Все получат корректную высоту и вертикальное центрирование.

---

# Phase 2 — [P0] List row chevron stroke 1.8

**Проблема:** Прототип `<Icon name="chevron-right" size={16} stroke={1.8} />`. Impl: `size={16}` без stroke (default 2). Chevron визуально толще чем в прототипе.

## Действие

**Файл:** `app/my-deals/page.tsx` (`DealRow`):
```diff
  <span className="list-row__chevron">
-   <Icon name="utility-chevron-right" size={16} />
+   <Icon name="utility-chevron-right" size={16} stroke={1.8} />
  </span>
```

**Файл:** `app/my-links/page.tsx` (`LinkRow`): то же самое.

## Acceptance
- Chevron справа в list-row визуально тоньше — match прототипу

---

# Phase 3 — [P1] Page header marginBottom 32 → 40

**Проблема:** прототип `.page__head { margin-bottom: 40 }`. Impl `pageHeaderStyle.marginBottom: 32`. Меньше воздуха между h1+lede и tabs row.

Plan-16 phase 10 уже сделал это для /create (40). Здесь то же для my-deals/my-links.

## Действие

**Файл:** `app/my-deals/page.tsx`:
```diff
  const pageHeaderStyle = {
    alignItems: "flex-start",
    display: "flex",
    justifyContent: "space-between",
-   marginBottom: 32,
+   marginBottom: 40,
  } as const;
```

**Файл:** `app/my-links/page.tsx`: то же.

## Acceptance
- 40px отступ от h1+lede до tabs row — match прототипу

---

# Phase 4 — [P1] EmptyState Icon stroke 1.4

**Проблема:** Прототип `<EmptyState icon="search" />` рендерит иконку с `stroke=1.4` внутри (тонкая, воздушная). Impl передаёт `icon={<Icon name="utility-search" size={28} />}` — без stroke (default 2). Иконка outline толще, выглядит «грубее».

## Действие

**Файлы:** `app/my-deals/page.tsx` (3 EmptyState вхождения) + `app/my-links/page.tsx` (3 EmptyState вхождения):

```diff
  icon={<Icon name="utility-wallet-connected" size={28} />}
  /* → */
  icon={<Icon name="utility-wallet-connected" size={28} stroke={1.4} />}

  icon={<Icon name="utility-search" size={28} />}
  /* → */
  icon={<Icon name="utility-search" size={28} stroke={1.4} />}

  icon={<Icon name="utility-plus" size={28} />}  (only in my-links)
  /* → */
  icon={<Icon name="utility-plus" size={28} stroke={1.4} />}
```

## Acceptance
- Иконки в EmptyState (no paid consultations / no matching deals / etc.) визуально тоньше и легче

---

# Phase 5 — [P2] Cleanup: убрать unused `isLast` prop

**Файл:** `app/my-deals/page.tsx`:
```diff
- function DealRow({ deal }: { deal: MyDeal; isLast?: boolean }) {
+ function DealRow({ deal }: { deal: MyDeal }) {
```

**Файл:** `app/my-links/page.tsx`:
```diff
- function LinkRow({ link }: { link: MyLink; isLast?: boolean }) {
+ function LinkRow({ link }: { link: MyLink }) {
```

Prop никогда не передаётся и не используется. TypeScript noUnused** ругаться не будет, но это легасный шум.

## Acceptance
- Чище JSX prop signatures

---

# Финал

```bash
npm run typecheck && npm run build && npm run test:unit
```

Допиши в `audit/PROGRESS.md`:
```md
## Plan-18 — completed (/my-deals + /my-links)

### Phase 1 — StatusPill vertical center + proper height
- components/shared/status-pill.tsx — removed alignSelf: "flex-start"; smStyle: height 24, padding "0 10px" (was "2px 8px"); mdStyle: height 28, padding "0 12px", fontSize 14→13 (was "4px 12px")
- (affects: list rows in my-deals/my-links, LifecycleTimeline current step pill, admin disputes badges, any StatusPill consumer)

### Phase 2 — Chevron stroke 1.8
- app/my-deals/page.tsx — DealRow chevron Icon stroke 1.8
- app/my-links/page.tsx — LinkRow chevron Icon stroke 1.8

### Phase 3 — Page header marginBottom 40
- app/my-deals/page.tsx — pageHeaderStyle marginBottom 32→40
- app/my-links/page.tsx — pageHeaderStyle marginBottom 32→40

### Phase 4 — EmptyState Icon stroke 1.4
- app/my-deals/page.tsx — 3 EmptyState icons get stroke=1.4
- app/my-links/page.tsx — 3 EmptyState icons get stroke=1.4

### Phase 5 — isLast cleanup
- app/my-deals/page.tsx — DealRow signature: removed unused isLast
- app/my-links/page.tsx — LinkRow signature: removed unused isLast
```

---

# Сводка

| Phase | Что | Приоритет | Влияние |
|---|---|---|---|
| **1** | StatusPill height 16→24 + удалить alignSelf: flex-start (центрирование) | P0 | **Все pills в проекте** (list rows, LifecycleTimeline, admin badges) |
| **2** | List chevron stroke 1.8 (тоньше) | P0 | /my-deals + /my-links |
| **3** | Page header 32→40 marginBottom | P1 | /my-deals + /my-links |
| **4** | EmptyState icons stroke 1.4 (тоньше) | P1 | /my-deals + /my-links |
| **5** | Cleanup `isLast` prop | P2 | /my-deals + /my-links |

После Plan-18:
- ✅ StatusPill вертикально центрируются в list rows (больше не «выше центра»)
- ✅ StatusPill **полноценной 24px высоты** — текст внутри пилюли visually centered
- ✅ Chevron справа от строки тоньше, соответствует прототипу
- ✅ Header вертикально дальше от tabs row (40 vs 32)
- ✅ Иконки в empty states легче и воздушнее

> Phase 1 это **systemic fix** — StatusPill используется не только в /my-deals/my-links. Все остальные места также получат правильную высоту 24/28px и корректное центрирование.
