# Claude Code — план №12 (cleanup после plan-11 + icons audit)

**Дата:** 2026‑05‑21
**Контекст:** Plan-11 typography sweep пропустил несколько мест. Плюс separate audit иконок и SVG показал серьёзные расхождения. Этот план закрывает обе категории.

**Правила:**
- Не коммить ничего.
- После каждой фазы — `npm run typecheck && npm run build && npm run test:unit`.
- После каждой фазы — запись в `audit/PROGRESS.md` (секция `## Plan-12`).

---

# Часть I — Cleanup после plan-11 (10 правок)

Plan-11 заявил «0 results» на грепы, но осталось 10 нарушений.

## I.1 — `fontWeight: 700` оставшиеся (6 файлов)

### Admin refresh buttons (3 идентичных места)

**`app/admin/disputes/page.tsx:842`**, **`app/admin/disputes/[id]/page.tsx:695`**, **`app/admin/denylist/page.tsx:426`** — `smallButtonStyle`:

```diff
- fontSize: 13,
- fontWeight: 700,
+ fontSize: 13,
+ fontWeight: 500,
```

(Соответствует `.btn--sm` который 13/500.)

### funding-progress.tsx (2 места)

**`components/link/funding-progress.tsx:185`** — marker number:
```diff
- fontWeight: 700,
+ fontWeight: 600,
```

**`components/link/funding-progress.tsx:278`** — `recoveryLinkStyle`:
```diff
- fontWeight: 700,
+ fontWeight: 600,
```

### link-action-card.tsx (1 место)

**`components/link/link-action-card.tsx:282`** — `myLinksLinkStyle`:
```diff
- fontWeight: 700,
+ fontWeight: 600,
```

## I.2 — Legacy tokens оставшиеся (3 места)

**`app/my-links/page.tsx:53`** — `LINK_STATUS_CONFIG.Consumed.bg`:
```diff
  Consumed: {
-   bg: "var(--accent-muted)",
+   bg: "var(--gold-soft)",
    color: "var(--gold-deep)",
    label: "Funded",
  },
```

**`app/globals.css:1232`** — `.receipt`:
```diff
  background: var(--panel);
+ background: var(--surface);
```
(Plan-11 явно оставил это как future work, теперь добиваем.)

## I.3 — Denylist `<select>` → класс `.select`

**`app/admin/denylist/page.tsx`** — native select был флагнут после plan-10 как future work и не починен. Сейчас 48px / r-4 / 16px font — не матчит inputs рядом (44px / r-2 / 14px через `.input`).

```diff
  <select
    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
      setField("reason", event.target.value)
    }
-   style={selectStyle}
+   className="select"
    value={form.reason}
  >
```

Удалить весь `selectStyle` const в конце файла.

## I.4 — Delete `components/shared/wallet-session-card.tsx`

Plan-11 D.9 заявил «DELETED», но файл остался. Grep по проекту:
- `WalletSessionCard` / `wallet-session-card` упоминается **только** в audit/ и handoff/ docs
- Ни один production файл (app/, components/) его не импортирует

**Действие:** удалить файл `components/shared/wallet-session-card.tsx`.

## I.5 — `--accent-muted` в my-links

Заменён в I.2 выше.

---

# Часть II — Icons & SVG audit

Систематически прошёлся по всем `<Icon name="...">` в коде vs прототипе. Нашёл 4 категории расхождений:

## II.1 — Missing icons в `components/icons/index.tsx`

Реализация имеет 42 иконки (status-* + utility-*). Прототип использует 32 простых имени. Из них **7 базовых иконок отсутствуют** в реализации — соответствующих generic shapes нет:

| Прототип | Импл — есть? | Где нужно |
|---|---|---|
| `check` | ❌ есть только `status-released` (circle+check) | CopyBtn after-click, Notice success badge, progress steps done state |
| `alert` | ❌ есть только `status-disputed` (specific) | Notice tone=danger / warning badge |
| `shield-check` | ❌ | Notice tone=success, landing trust items, RiskBadge Clear |
| `lock` | ❌ есть `status-funded-escrow-held` (lock+$) и `status-locked-meeting-url-hidden` (lock+нижнее) — но не «plain lock» | SIWE modal badge, generic secure indicator |
| `external` | ❌ есть `status-external-link-view-deal` (specific framed) | Generic external links |
| `circle` (plain outline) | ❌ есть `status-open` (circle+filled dot) | Plain status markers, progress dots |
| `hourglass` | ❌ | Generic time/waiting indicator (прототип использует для PaymentPending + ConfirmPending) |

### Действие — добавить в `components/icons/index.tsx`:

В `IconName` type union добавить:
```ts
| "utility-alert"
| "utility-check"
| "utility-circle"
| "utility-external-link"
| "utility-hourglass"
| "utility-lock"
| "utility-shield"          // alias для secure-subtle, если хочется отдельно
| "utility-shield-check"
```

В `icons` Record добавить SVG paths (всё в 24×24 viewBox, currentColor, 2px stroke):

```tsx
"utility-alert": (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v6" />
    <path d="M12 17h.01" />
  </>
),
"utility-check": <path d="M4 12l6 6L20 6" />,
"utility-circle": <circle cx="12" cy="12" r="9" />,
"utility-external-link": (
  <>
    <path d="M14 4h6v6" />
    <path d="M10 14L20 4" />
    <path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />
  </>
),
"utility-hourglass": (
  <>
    <path d="M7 3h10" />
    <path d="M7 21h10" />
    <path d="M7 3v5l5 4 5-4V3" />
    <path d="M7 21v-5l5-4 5 4v5" />
  </>
),
"utility-lock": (
  <>
    <rect x="5" y="10" width="14" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </>
),
"utility-shield-check": (
  <>
    <path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3Z" />
    <path d="M9 12l2 2 4-4" />
  </>
),
```

## II.2 — Stroke prop отсутствует в Icon component

Прототип Icon принимает `stroke={1.4|1.6|1.7|1.8|2|2.2|3}` для тонкого/толстого штриха. Реализация **хардкодит** `strokeWidth={2}` — нет prop для override.

В разных местах теряется элегантность:
- Empty-state icon (прототип `size={28} stroke={1.4}` — тонкая иконка для воздушности)
- Landing trust items (`size={13} stroke={1.7}`)
- Pill icons (`size={12} stroke={2.2}` — bolder для маленьких)
- Card icons / scroll-hint (`size={16} stroke={1.6}`)

### Действие — добавить в `components/icons/index.tsx`:

```diff
  interface IconProps {
    name: IconName;
    size?: number;
+   stroke?: number;
    style?: CSSProperties;
    className?: string;
    "aria-label"?: string;
    "aria-hidden"?: boolean | "true" | "false";
  }

  export function Icon({
    name,
    size = 24,
+   stroke = 2,
    style,
    className,
    "aria-label": ariaLabel,
    "aria-hidden": ariaHidden,
  }: IconProps) {
    return (
      <svg
        …
-       strokeWidth={2}
+       strokeWidth={stroke}
        …
      >
        {icons[name]}
      </svg>
    );
  }
```

Не нужно сразу всем местам выставлять — но теперь это **возможно**. Это backward-compatible (default 2).

## II.3 — StatusPill icon size + stroke не матчат прототип

Прототип `<StatusPill size="lg">` рендерит:
```tsx
<Icon name={cfg.icon} size={size === "lg" ? 13 : 12} stroke={2.2} />
```

Реализация (после plan-7 CC):
```ts
const iconSize = size === "md" ? 16 : 14;  // sm=14, md=16
// stroke не передаётся — default 2
```

| Размер | Прототип | Импл |
|---|---|---|
| sm/md | 12 (stroke 2.2) | 14 (stroke 2) |
| lg | 13 (stroke 2.2) | 16 (stroke 2) |

Импл иконки **крупнее но тоньше**, прототип **меньше но толще**. Pill’ы визуально различаются.

### Действие — в `components/shared/status-pill.tsx`:

После добавления stroke prop в Icon (II.2):

```diff
- const iconSize = size === "md" ? 16 : 14;
+ const iconSize = size === "md" ? 13 : 12;

  return (
    <span style={{…}}>
-     {icon && <Icon aria-hidden name={icon} size={iconSize} />}
+     {icon && <Icon aria-hidden name={icon} size={iconSize} stroke={2.2} />}
      {label}
    </span>
  );
```

## II.4 — Status icon mapping — иконки иные чем в прототипе

Прототип использует **простые generic shapes** для статусов. Реализация в `lib/ui/deal-status.ts` (через `getDealDisplayConfig`) выдаёт **специфичные iconographic shapes**.

| Status | Прототип | Реализация | Diff |
|---|---|---|---|
| Open | `circle` (plain outline) | `status-open` (circle с filled dot) | Точка внутри |
| PaymentPending | `hourglass` | `status-payment-pending` (clock-like) | Тип shape |
| Funded | `lock` (plain) | `status-funded-escrow-held` (lock + $ внутри) | $ внутри |
| ConfirmPending | `hourglass` | `status-confirm-pending` (4 пересечённых линии) | Не hourglass |
| Released | `check` (plain stroke) | `status-released` (circle с check) | Circle wrapper |
| Disputed | `alert` (triangle/circle с !) | `status-disputed` (circle с !) | OK ≈ matches |
| Refunded | `refund` (curved arrow + arrow) | `status-refunded` | ✓ matches |
| Expired | `clock` | `status-expired` | ✓ matches |
| Cancelled | `close` (X) | `utility-close` (X) | ✓ matches |

Влияет на StatusPill и StatusIcon (в hero deal card).

### Действие — Path B (match прототипу — выбрано user-ом):

В `lib/ui/deal-status.ts` (где `getDealDisplayConfig` живёт) перемапить status icons на простые generic shapes:

```diff
const DEAL_STATUS_CONFIG = {
- Open:           { icon: "status-open", ... },
+ Open:           { icon: "utility-circle", ... },
- PaymentPending: { icon: "status-payment-pending", ... },
+ PaymentPending: { icon: "utility-hourglass", ... },
- Funded:         { icon: "status-funded-escrow-held", ... },
+ Funded:         { icon: "utility-lock", ... },
- ConfirmPending: { icon: "status-confirm-pending", ... },
+ ConfirmPending: { icon: "utility-hourglass", ... },
- Released:       { icon: "status-released", ... },
+ Released:       { icon: "utility-check", ... },
- Disputed:       { icon: "status-disputed", ... },
+ Disputed:       { icon: "utility-alert", ... },
  // Refunded → status-refunded (curved arrow) ✓ matches, leave
  // Expired → status-expired (clock) ✓ matches, leave
  // Cancelled → utility-close ✓ matches, leave
};
```

После добавления icons в II.1 — типы IconName уже включают все 5 нужных utility-*. Зависимость: II.1 должен быть сделан **первым**.

Также проверь:
- `LINK_STATUS_CONFIG` в `app/my-links/page.tsx` (`linkIconByStatus` mapping) — там тоже status-* для линков. Если хочется консистентность — переmappить аналогично.
- `RiskBadge` в `components/admin/risk-badge.tsx` — прототип использует `shield-check` (Clear) / `alert` (Review) / `shield` (Blocked). Проверь и подгони.

## II.5 — Notice icon defaults (per tone)

Прототип `<Notice>` имеет default icon per tone:
```js
const iconName = icon || (
  tone === "danger" ? "alert" :
  tone === "warning" ? "alert" :
  tone === "success" ? "shield-check" :
  tone === "gold" ? "shield" :
  "info"
);
```

Реализация Notice (по plan-9 нот) принимает `icon` prop но **не делает default per tone**. Notice без явного icon → без иконки.

### Действие — в `components/shared/notice.tsx`:

Добавить default mapping (после II.1 — иконки доступны):

```tsx
function getDefaultIcon(tone: NoticeTone): IconName {
  switch (tone) {
    case "danger":
    case "warning":  return "utility-alert";
    case "success":  return "utility-shield-check";
    case "gold":     return "utility-secure-subtle";
    case "info":
    default:         return "utility-info";
  }
}
```

И:
```diff
- {icon && <span style={iconWrapStyle}><Icon name={icon} size={16} /></span>}
+ <span style={iconWrapStyle}>
+   <Icon name={icon ?? getDefaultIcon(tone)} size={16} />
+ </span>
```

Импортировать `IconName` если нет.

## II.6 — CopyBtn after-click icon

Прототип CopyField:
```tsx
<Icon name={copied ? "check" : "copy"} size={13} />
```

Импл `CopyBtn` — нужно проверить, что именно она использует после клика. После II.1 если она использует `utility-copy-address` → ОК для idle state, но после клика должна показывать `utility-check`.

### Действие
Загрузить `components/shared/copy-btn.tsx` (он был удалён локально), проверить icon switch logic. Если нет — добавить:
```tsx
<Icon name={copied ? "utility-check" : "utility-copy-address"} size={14} />
```

## II.7 — funding-progress использует `status-released` для done state

`components/link/funding-progress.tsx:145`:
```tsx
{s.state === "done" ? (
  <Icon name="status-released" size={11} />
) : ...}
```

Это **circle с check внутри** — но в этом контексте уже есть свой circle (markerStyle), получается circle-in-circle. Прототип использует plain `check`.

### Действие (после II.1):
```diff
- <Icon name="status-released" size={11} />
+ <Icon name="utility-check" size={11} stroke={3} />
```

stroke 3 — match prototype (line 691 в screens.jsx) для прогресс-маркеров.

## II.8 — ArrabonSeal — проверка

`components/shared/arrabon-seal.tsx` маппит:
- "gold-on-graphite" → `/arrabon-seal-gold-on-graphite.svg` ✓
- "graphite-on-ivory" → `/arrabon-seal-graphite-on-ivory.svg` ✓
- "gold-line" → `/arrabon-seal-one-color-gold.svg` ✓
- "ink-line" → `/arrabon-seal-one-color-black.svg` ✓

Все 4 файла существуют в `public/`. **Маппинг корректный, нет правок.** ✓

---

# Финал

```bash
npm run typecheck && npm run build && npm run test:unit
```

Допиши в `audit/PROGRESS.md`:
```md
## Plan-12 — completed

### Part I — Cleanup after plan-11
- 3× admin smallButtonStyle fontWeight 700→500 (disputes, disputes/[id], denylist Refresh buttons)
- 2× funding-progress.tsx fontWeight 700→600 (marker + recoveryLinkStyle)
- 1× link-action-card.tsx myLinksLinkStyle fontWeight 700→600
- app/my-links/page.tsx — LINK_STATUS_CONFIG.Consumed.bg --accent-muted→--gold-soft
- app/globals.css — .receipt background --panel→--surface
- app/admin/denylist/page.tsx — selectStyle inline → className="select" + removed const
- DELETED components/shared/wallet-session-card.tsx (unused, plan-11 D.9 claim fulfilled)

### Part II — Icons audit
- components/icons/index.tsx — added 7 generic icons: utility-alert, utility-check, utility-circle, utility-external-link, utility-hourglass, utility-lock, utility-shield-check
- components/icons/index.tsx — added stroke?: number prop to Icon (default 2)
- components/shared/status-pill.tsx — iconSize md→13/sm→12; pass stroke={2.2} for prototype-matching boldness
- lib/ui/deal-status.ts — [Path B applied / Path A kept per user choice]: status-* mappings → generic utility-* for prototype match
- components/shared/notice.tsx — added getDefaultIcon(tone) for per-tone defaults (alert/shield-check/secure-subtle/info)
- components/shared/copy-btn.tsx — after-click icon utility-copy-address → utility-check
- components/link/funding-progress.tsx — done marker status-released → utility-check stroke 3
```

---

# Сводка

| # | Часть | Цель | Файлов |
|---|---|---|---|
| **I.1-I.5** | Plan-11 cleanup | Добить остаточные fontWeight 700 + legacy tokens + denylist select + delete wallet-session-card | 7 |
| **II.1** | Add 7 missing generic icons | check, alert, shield-check, lock, external, circle, hourglass | 1 |
| **II.2** | Stroke prop в Icon | Backward-compat enhancement | 1 |
| **II.3** | StatusPill icon size/stroke | 14-16 / 2 → 12-13 / 2.2 (prototype match) | 1 |
| **II.4** | Status icon mapping (Path B — выбрано user-ом) | status-* → utility-* per prototype + проверить LINK_STATUS_CONFIG + RiskBadge | 1-3 |
| **II.5** | Notice default icons per tone | Danger показывает alert, success — shield-check, etc | 1 |
| **II.6-II.7** | CopyBtn + funding-progress done icon | Plain check вместо circle-check | 2 |
| **II.8** | ArrabonSeal verify | ✓ No fix | — |

Все правки чисто визуальные/cosmetic.

**II.4: Path B выбран user-ом** — generic иконки прототипа (plain check / circle / lock / hourglass / alert) вместо специфичных status-*. Также проверить RiskBadge (Clear→shield-check, Review→alert, Blocked→shield) и LINK_STATUS_CONFIG в my-links.
