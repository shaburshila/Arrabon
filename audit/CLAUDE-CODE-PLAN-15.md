# Claude Code — план №15 (top-nav header + landing fixes)

**Дата:** 2026‑05‑21
**Контекст:** После всех plans 2-14 нашли расхождения в шапке (top-nav) и на главной странице. Структура: **Part I — header (фазы 1-5), Part II — landing (фазы 6-10)**.

**Правила:**
- Не коммить.
- После каждой Part — `npm run typecheck && npm run build && npm run test:unit`.
- Запись в `audit/PROGRESS.md` (секция `## Plan-15`).

---

# Part I — Top-nav header

# Phase 1 — [P0] Brand mark: всегда gold (не theme-dependent)

**Проблема:** на light theme иконка бренда показывается **graphite** (чёрная). В прототипе на обеих темах используется **gold** версия — `ArrabonLogo` имеет `variant = "gold"` по умолчанию (см. `components.jsx:8`), которая всегда рендерит `alpha-lock-full-gold.svg`.

**Файл:** `components/app/top-nav.tsx`

```diff
- const [isDark, setIsDark] = useState(false);
-
- useEffect(() => {
-   const update = () =>
-     setIsDark(document.documentElement.dataset.theme === "dark");
-   update();
-   const obs = new MutationObserver(update);
-   obs.observe(document.documentElement, {
-     attributes: true,
-     attributeFilter: ["data-theme"],
-   });
-   return () => obs.disconnect();
- }, []);

  return (
    <header style={headerStyle}>
      <div style={headerInnerStyle}>
        {/* Brand */}
        <Link href="/" style={brandStyle} onClick={...}>
          <span style={brandMarkStyle}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Arrabon"
              height={32}
-             src={isDark ? "/alpha-lock-full-gold.svg" : "/alpha-lock-full-graphite.svg"}
+             src="/alpha-lock-full-gold.svg"
              width={32}
            />
          </span>
```

Удалить unused `useState` + `useEffect` + `useEffect` import + `isDark` state.

## Acceptance
- На light theme бренд показывается gold (#C6A15B), как на dark
- Никакого theme-tracking в TopNav — статичная иконка

---

# Phase 2 — [P0] Wallet pill height: 34 → 36 (match iconbtns)

**Проблема:** wallet pill высотой 34px, а соседние bell/theme кнопки — 36px (`.iconbtn`). Pill визуально «ниже по высоте» — нарушение горизонтального ритма toolbar'а.

В прототипе pill computed height = avatar 24px + vertical padding 6×2 = **36px** — равно iconbtns. Никаких explicit height — все измеряется content + padding.

**Файл:** `components/app/wallet-status-pill.tsx`

```diff
  const connectedPillStyle = {
    alignItems: "center",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 999,
    color: "var(--ink)",
    cursor: "pointer",
    display: "inline-flex",
    flexShrink: 0,
    gap: 10,
-   height: 34,
-   padding: "0 6px 0 14px",
+   padding: "6px 6px 6px 14px",
    whiteSpace: "nowrap" as const,
  } as const;
```

Аналогично для остальных pill state:

```diff
  const connectPillStyle = {
    ...
    background: "var(--gold)",
    border: "1px solid var(--gold)",
    borderRadius: 999,
    color: "var(--gold-on)",
    ...
-   height: 34,
-   padding: "0 18px",
+   padding: "8px 18px",  /* visual height ~34, нет avatar */
    ...
  };

  const wrongNetPillStyle = {
    ...
-   height: 34,
-   padding: "0 14px",
+   padding: "8px 14px",
    ...
  };
```

И avatar 22 → 24:

```diff
  const pillAvatarStyle = {
    ...
    background: "linear-gradient(135deg, var(--gold), var(--gold-deep))",
    borderRadius: "50%",
    ...
-   height: 22,
+   height: 24,
    marginLeft: 1,
-   width: 22,
+   width: 24,
  };
```

## Acceptance
- Wallet pill (`connectedPillStyle`) визуальная высота **36px**, как у bell/theme иконочных кнопок слева
- Avatar внутри pill — **24×24**
- Connect/wrong-network pill — близкая высота через vertical padding 8px

---

# Phase 3 — [P0] Theme toggle icon size: 15 → 16

**Проблема:** Bell icon — `size={16}`, Theme icon — `size={15}` (1px меньше). Прототип:
- Bell: `<Icon name="bell" size={16} />`
- Theme: `<Icon name="sun/moon" size={16} />` (оба 16)

**Файл:** `components/shared/theme-toggle.tsx`

```diff
- <Icon name={theme === "dark" ? "utility-theme-light" : "utility-theme-dark"} size={15} />
+ <Icon name={theme === "dark" ? "utility-theme-light" : "utility-theme-dark"} size={16} />
```

## Acceptance
- Theme icon и Bell icon одного размера (16px) — визуально равны

---

# Phase 4 — [P1] Bell button: убрать дублирующий inline border

**Проблема:** Bell кнопка имеет `className="iconbtn iconbtn--tooltip"` (даёт border через CSS) **И** inline `style={{ border: "1px solid var(--border)" }}` (то же значение). Дубль — стоит убрать inline.

**Файл:** `components/app/top-nav.tsx`

```diff
  <button
    aria-label="Notifications"
    className="iconbtn iconbtn--tooltip"
    data-tooltip="Soon"
-   style={{ border: "1px solid var(--border)" }}
    type="button"
  >
    <Icon name="utility-bell" size={16} />
  </button>
```

CSS `.iconbtn` уже задаёт `border: 1px solid var(--border)`. Inline override ничего не делает, кроме мусора в DOM.

## Acceptance
- Bell кнопка рендерится идентично (border остаётся через class)
- Cleaner JSX

---

# Phase 5 — [P2] `.iconbtn--tooltip:hover` color: muted → muted-2

**Проблема:** При hover на bell кнопку color меняется на `var(--muted)` (тёмно-серый, 5.7:1 на bg). Прототип использует `var(--muted-2)` (мягче, чуть светлее). После plan-14 `--muted-2` стал `#757067` (4.5:1) — всё ещё мягче чем `--muted` (`#6B6660`, 5.7:1).

**Файл:** `app/globals.css`

```diff
- .iconbtn--tooltip:hover { color: var(--muted); }
+ .iconbtn--tooltip:hover { color: var(--muted-2); }
```

## Acceptance
- Bell hover чуть мягче (более «отступающий», disabled-feel — корректно для "Soon" placeholder)

---

# Part II — Landing page

## Phase 6 — [P0] Footer brand: SealLogo → AlphaLock (соответствие top-nav)

**Проблема:** В footer слева сейчас используется `<ArrabonSeal>` (круглая печать). Прототип использует `<ArrabonLogo>` (alpha-lock SVG) — тот же brand mark, что в top-nav. Несоответствие: top-nav alpha-lock золотой, footer — круглая печать.

**Файл:** `app/page.tsx`, в `SiteFooter()`:

```diff
  <span style={brandStyle}>
-   <ArrabonSeal size={28} tone="auto" />
+   {/* eslint-disable-next-line @next/next/no-img-element */}
+   <img alt="Arrabon" height={28} src="/alpha-lock-full-gold.svg" width={28} />
    <span style={brandWordStyle}>Arrabon</span>
  </span>
```

Если `ArrabonSeal` импорт больше не используется в файле — удалить (но скорее всего используется в hero/CTA — оставить).

## Acceptance
- Footer brand идентичен top-nav brand: alpha-lock-full-gold.svg 28×28 + "Arrabon" serif 22px
- Круглая печать (ArrabonSeal) остаётся только в hero (320), CTA (56) и footer-base (20) — там она корректна

---

## Phase 7 — [P0] CTA trust items: 3 разных иконки

**Проблема:** `TRUST_ITEMS` использует 2 одинаковых иконки (`utility-secure-subtle × 2`). Прототип: 3 **разных** иконки — shield / lock / shield-check. После plan-12 II.1 все 3 utility-* добавлены в icons/index.tsx.

**Файл:** `app/page.tsx`:

```diff
  const TRUST_ITEMS = [
-   { icon: "utility-secure-subtle", label: "Built on Base" },
-   { icon: "utility-wallet-connected", label: "Wallet-signed actions" },
-   { icon: "utility-secure-subtle", label: "Neutral dispute review" },
+   { icon: "utility-secure-subtle", label: "Built on Base" },
+   { icon: "utility-lock", label: "Wallet-signed actions" },
+   { icon: "utility-shield-check", label: "Neutral dispute review" },
  ];
```

## Acceptance
- 3 trust-чипа в landing CTA имеют 3 разных иконки слева: shield / lock / shield-check
- Точное соответствие прототипу

---

## Phase 8 — [P1] StepCard / BenefitCard: добавить box-shadow

**Проблема:** Карточки на landing (Steps, Benefits) сейчас плоские — только border, без shadow. Прототип использует `<Card padded>` с `box-shadow: var(--shadow-2)` (через `[data-card="soft"]` default). Визуально на landing карточки «висят» в воздухе, в impl — плоско.

**Файл:** `app/page.tsx`:

```diff
  const cardStyle = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-4)",
+   boxShadow: "var(--shadow-2)",
    padding: 28,
  };
```

## Acceptance
- 3 StepCard'a + 3 BenefitCard'a имеют мягкую тень — поднимаются над фоном, как в прототипе

---

## Phase 9 — [P2] Иконки stroke: использовать prototype values

**Проблема:** После plan-12 II.2 Icon component принимает `stroke` prop. Прототип на landing использует тонкие штрихи для elegant feel:
- Scroll-hint chevron: `stroke={1.6}`
- CTA trust icons: `stroke={1.7}`
- Benefit card icons: `stroke={1.8}`

Currently impl all использует default `stroke={2}` — толще.

**Файл:** `app/page.tsx`

```diff
  // HeroSection scroll-hint
  <span className="landing-scroll-hint__arrow">
-   <Icon name="utility-chevron-down" size={16} />
+   <Icon name="utility-chevron-down" size={16} stroke={1.6} />
  </span>

  // FinalCtaSection trust items
  <span className="landing-cta__trust-item" key={t.label}>
-   <Icon name={t.icon as IconName} size={13} />
+   <Icon name={t.icon as IconName} size={13} stroke={1.7} />
    {t.label}
  </span>

  // BenefitCard
  <span className={`status-icon status-icon--md status-icon--${tone}`} style={{ marginBottom: 4 }}>
-   <Icon name={icon} size={18} />
+   <Icon name={icon} size={18} stroke={1.8} />
  </span>
```

## Acceptance
- Scroll-hint, trust icons, benefit icons визуально тоньше — соответствие прототипу

---

## Phase 10 — [P2] Cleanup + semantic landing-stat

### 10.1 — Удалить no-op inline `paddingTop: 0`

`.landing-cta__inner` в CSS не имеет padding-top, inline override не делает ничего:

**Файл:** `app/page.tsx`:

```diff
  return (
    <section className="landing-cta" style={fullBleedSection}>
-     <div className="landing-cta__inner" style={{ paddingTop: 0 }}>
+     <div className="landing-cta__inner">
```

### 10.2 — Обернуть stats в `<div className="landing-stat">`

Прототип каждый stat обёртывает в `<div className="landing-stat">` для semantic completeness:

**Файл:** `app/page.tsx`, `StatsSection()`:

```diff
  {STATS.map((s) => (
-   <div key={s.label}>
+   <div key={s.label} className="landing-stat">
      <span className="landing-stat__num">{s.num}</span>
      <span className="landing-stat__label">{s.label}</span>
    </div>
  ))}
```

(Визуально идентично — display:block на num/label уже даёт vertical stack. Класс добавляет semantic meaning + явный flex column gap 4 (но margin-top 12 на label overrides).)

### 10.3 — CTA h2 добавить `.h1` className для консистентности

Прототип: `<h2 className="h1 landing-cta__title">`. CSS `.landing-cta__title` overrides размер 36px, но `.h1` обеспечивает serif font-family и weight.

**Файл:** `app/page.tsx`:

```diff
- <h2 className="landing-cta__title">
+ <h2 className="h1 landing-cta__title">
    Ready to create your first{" "}
    <span className="accent">consultation link?</span>
  </h2>
```

(Визуально идентично — landing-cta__title уже задаёт font-family/weight. Класс для консистентности.)

## Acceptance
- Чище DOM в CTA (без бесполезного inline style)
- Stats имеют semantic class
- CTA h2 имеет полный набор классов как в прототипе

---

# Финал

```bash
npm run typecheck && npm run build && npm run test:unit
```

Допиши в `audit/PROGRESS.md`:
```md
## Plan-15 — completed (top-nav + landing fixes)

### Part I — Top-nav

#### Phase 1 — Brand always gold
- components/app/top-nav.tsx — removed theme tracking; brand mark always /alpha-lock-full-gold.svg; removed useState/useEffect/MutationObserver/isDark/import useState/useEffect

#### Phase 2 — Wallet pill height match iconbtns
- components/app/wallet-status-pill.tsx — connectedPillStyle: height 34 removed, padding "0 6 0 14" → "6 6 6 14" (content-based 36px height)
- pillAvatarStyle: 22×22 → 24×24
- connectPillStyle + wrongNetPillStyle: removed explicit height 34, vertical padding 8px

#### Phase 3 — Theme icon size
- components/shared/theme-toggle.tsx — Icon size 15→16

#### Phase 4 — Bell button cleanup
- components/app/top-nav.tsx — removed duplicate inline style border (already from .iconbtn class)

#### Phase 5 — Tooltip hover color
- app/globals.css — .iconbtn--tooltip:hover color var(--muted) → var(--muted-2)

### Part II — Landing page

#### Phase 6 — Footer brand → alpha-lock
- app/page.tsx — SiteFooter brand: <ArrabonSeal size=28> → <img src="/alpha-lock-full-gold.svg" 28×28> (match top-nav)

#### Phase 7 — CTA trust 3 distinct icons
- app/page.tsx — TRUST_ITEMS icons: utility-secure-subtle / utility-lock / utility-shield-check (was 2 same icons)

#### Phase 8 — Card box-shadow
- app/page.tsx — cardStyle: added boxShadow: var(--shadow-2)

#### Phase 9 — Icon stroke values per prototype
- app/page.tsx — scroll-hint chevron stroke 2→1.6; CTA trust icons stroke 2→1.7; BenefitCard icons stroke 2→1.8

#### Phase 10 — Cleanup + semantic
- app/page.tsx — removed inline paddingTop:0 on .landing-cta__inner (no-op)
- app/page.tsx — stats wrapped in <div className="landing-stat"> (semantic)
- app/page.tsx — CTA h2 className "landing-cta__title" → "h1 landing-cta__title"
```

---

# Сводка

| Phase | Часть | Что | Приоритет | Файлов |
|---|---|---|---|---|
| **1** | Header | Brand mark always gold | P0 | 1 |
| **2** | Header | Wallet pill height + avatar size | P0 | 1 |
| **3** | Header | Theme icon 15→16 | P0 | 1 |
| **4** | Header | Bell inline border cleanup | P1 | 1 |
| **5** | Header | Tooltip hover muted→muted-2 | P2 | 1 |
| **6** | Landing | Footer brand → alpha-lock (match top-nav) | P0 | 1 |
| **7** | Landing | CTA trust 3 distinct icons (shield/lock/shield-check) | P0 | 1 |
| **8** | Landing | Card box-shadow (soft elevation) | P1 | 1 |
| **9** | Landing | Icon stroke values (1.6/1.7/1.8) | P2 | 1 |
| **10** | Landing | Cleanup paddingTop + stat wrapper + cta h2 .h1 | P2 | 1 |

После Plan-15:
- ✅ Шапка визуально идентична прототипу (брэнд gold всегда, все 3 toolbar элемента 36px одного размера)
- ✅ Footer brand консистентен с top-nav (alpha-lock-gold вместо круглой печати)
- ✅ CTA trust items — 3 уникальные иконки
- ✅ Cards имеют soft elevation (как в прототипе)
- ✅ Stroke thinning на ключевых местах для elegant feel
