# Claude Code — план №23 (мини-фиксы из чата — консолидация)

**Дата:** 2026‑05‑21
**Контекст:** В чате я давал разработчику серию точечных мини-фиксов между планами 20 и 21 — они не были оформлены как plan-файлы, поэтому агент их пропустил. Объединяю в один план чтобы применить одной волной.

**Правила:**
- Не коммить.
- После плана — `npm run typecheck && npm run build && npm run test:unit`.
- Запись в `audit/PROGRESS.md` (секция `## Plan-23`).

---

# Phase 1 — [P0] Wallet pill address: uppercase + fontWeight 400

**Проблема:** В шапке (свёрнутое состояние pill):
1. Буквы адреса визуально жирнее чем в прототипе — `fontWeight: 500` тяжелее чем default mono 400
2. Адрес показывается в EIP-55 mixed-case checksum (`0xDta4Sy6`), а нужен **uppercase hex** (`0xDTA4SY6`) с lowercase `0x` префиксом

Plan-19 Phase 6 ввёл `getAddress()` (EIP-55 mixed-case) — это **нужно откатить** и заменить на uppercase format.

## Действие

**Файл:** `components/app/wallet-status-pill.tsx`

### 1.1 — убрать `getAddress` импорт, заменить на uppercase format

```diff
- import { getAddress } from "viem";
  ...
+ // Display format: 0x lowercase + UPPERCASE hex (NOT EIP-55 checksum)
+ function formatDisplayAddress(addr: string): string {
+   return `0x${addr.slice(2).toUpperCase()}`;
+ }

- const address = session.address ? truncatePill(getAddress(session.address)) : "…";
+ const address = session.address ? truncatePill(formatDisplayAddress(session.address)) : "…";
```

И в dropdown header:
```diff
  <p style={dropdownAddressStyle}>
-   {session.address ? truncateAddress(getAddress(session.address)) : ""}
+   {session.address ? truncateAddress(formatDisplayAddress(session.address)) : ""}
  </p>
```

### 1.2 — уменьшить fontWeight 500 → 400 в обоих styles

```diff
  const pillAddressStyle = {
    color: "var(--ink)",
    fontFamily: "var(--font-mono)",
    fontSize: 12.5,
-   fontWeight: 500,
+   fontWeight: 400,
  } as const;

  const dropdownAddressStyle = {
    color: "var(--ink)",
    fontFamily: "var(--font-mono)",
    fontSize: 14,
-   fontWeight: 500,
+   fontWeight: 400,
    margin: 0,
    overflowWrap: "anywhere" as const,
  } as const;
```

## Acceptance
- Pill: `0xDTA4…SY6F` — `0x` lowercase + остальное uppercase, IBM Plex Mono 400 weight
- Dropdown header: тот же формат, 14px mono 400

---

# Phase 2 — [P0] /deal/[id] Hero amount: золотой цвет

**Проблема:** `.deal-hero__amount-num` рендерится в `--ink` (дефолт), но в прототипе число (`33.00`) — золотое.

## Действие

**Файл:** `app/globals.css`, правило `.deal-hero__amount-num`:

```diff
  .deal-hero__amount-num {
    font-family: var(--font-serif);
    font-size: 48px;
    font-weight: 500;
+   color: var(--gold-deep);
    ...
  }

+ [data-theme="dark"] .deal-hero__amount-num {
+   color: var(--gold);
+ }
```

> Dark mode: `--gold-deep` слишком тёмный — `--gold` (#C6A15B) для контраста.

> Этот же класс используется в LinkSummary на `/link/[id]` — фикс применится автоматически на обеих страницах.

## Acceptance
- /deal/[id] hero: `33.00` золотым (light: gold-deep, dark: gold)
- /link/[id] LinkSummary amount: тоже золотым

---

# Phase 3 — [P0] /deal/[id] Details: убрать accent на Amount + удалить Deal ID

**Проблема:** В блоке Details сумма сейчас с `accent` prop (золотая) — но логика: hero — золото (акцент), details — нейтральный ink (чёрный/белый). Плюс Deal ID не несёт пользы для пользователя.

## Действие

**Файл:** `components/deal/deal-details-card.tsx`:

```diff
  <DetailRow
    label="Amount"
    value={`${formatUsdcPrice(deal.price_usdc)} USDC`}
-   accent
  />
- <DetailRow
-   label="Deal ID"
-   mono
-   value={deal.id.slice(0, 8).toUpperCase()}
- />
  <DetailRow
    label="Seller"
    ...
```

## Acceptance
- Details Amount нейтральный ink (не золотой)
- Deal ID row удалён — список начинается с Amount → Seller

---

# Phase 4 — [P0] Status labels Refunded / Released: сократить

**Проблема:** Labels `"Refunded after dispute"` и `"Released after dispute"` слишком длинные для StatusPill (`whiteSpace: nowrap` + 24px height). Текст вылазит за границы овала.

Контекст «after dispute» уже виден через:
- DisputeThread секцию
- Lifecycle timeline (disputed → resolved)

Pill должен быть кратким status indicator, не объяснением.

## Действие

**Файл:** `lib/ui/deal-status.ts` (или где задаются labels)

```diff
- label: "Refunded after dispute"
+ label: "Refunded"

- label: "Released after dispute"
+ label: "Released"
```

Если есть два кейса Refunded (auto vs after-dispute) — использовать один label `"Refunded"` для pill, а контекст рендерить через `resolution_type` в hero subtitle или Notice.

## Acceptance
- Pill `Refunded` / `Released` помещается в свой овал
- Контекст dispute показывается в title / DisputeThread / Lifecycle

---

# Phase 5 — [P1] /link/[id] — Copy link button в seller variant

**Проблема:** На `/link/[id]` если ты seller, правая ActionPanel (`role === "seller"`) показывает только `<p className="section-label">Your link</p>` без полезных действий. Владелец ссылки должен иметь быстрый способ её скопировать.

## Действие

**Файл:** `components/link/link-action-card.tsx`, seller branch:

```tsx
if (role === "seller") {
  const shareUrl = link.share_url || `${window.location.origin}/link/${link.id}`;
  
  return (
    <ActionPanel style={{ padding: 28 }}>
      <p className="section-label" style={{ marginBottom: 18 }}>Your link</p>
      
      <div className="copy-field" style={{ marginBottom: 12 }}>
        <span className="copy-field__value" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {shareUrl}
        </span>
      </div>
      
      <CopyBtn 
        value={shareUrl} 
        fullWidth
        size="lg"
        label="Copy link"
      />
      
      <p className="small" style={{ color: "var(--muted)", margin: "12px 0 0", textAlign: "center" }}>
        Share this link with the buyer to receive payment.
      </p>
    </ActionPanel>
  );
}
```

Использовать существующий `<CopyBtn>` (есть в `components/shared/copy-btn.tsx` с clipboard fallback из plan-14).

> `useEffect(() => setOrigin(window.location.origin), [])` уже есть в `app/link/[id]/page.tsx` для LinkRow — нужно передать origin в LinkSummary/LinkActionCard если share_url нет напрямую (либо использовать window.location.origin в client component).

## Acceptance
- На /link/[id] если seller — видишь полный URL в `.copy-field` + большая Copy кнопка
- Клик — copy в clipboard + кнопка показывает Copied state (check icon, plan-12 II.7)
- Helper text объясняет назначение

---

# Финал

```bash
npm run typecheck && npm run build && npm run test:unit
```

Допиши в `audit/PROGRESS.md`:

```md
## Plan-23 — completed (chat mini-fixes consolidation)

### Phase 1 — Wallet pill uppercase + 400
- components/app/wallet-status-pill.tsx — removed getAddress import; added formatDisplayAddress (0x + UPPERCASE hex); pillAddressStyle + dropdownAddressStyle fontWeight 500→400

### Phase 2 — Hero amount gold
- app/globals.css — .deal-hero__amount-num color: var(--gold-deep); [data-theme="dark"] override → var(--gold)
- (auto-affects LinkSummary on /link/[id] using same class)

### Phase 3 — Details Amount + Deal ID
- components/deal/deal-details-card.tsx — removed accent on Amount DetailRow; removed Deal ID DetailRow

### Phase 4 — Status labels shortened
- lib/ui/deal-status.ts — "Refunded after dispute" → "Refunded"; "Released after dispute" → "Released"

### Phase 5 — Copy link button (seller)
- components/link/link-action-card.tsx — seller branch: added .copy-field with shareUrl + <CopyBtn fullWidth size="lg" label="Copy link"> + helper text
```

---

# Сводка

| Phase | Что | Приоритет |
|---|---|---|
| **1** | Wallet pill: uppercase address + fontWeight 400 (откат EIP-55 checksum) | P0 |
| **2** | Hero `.deal-hero__amount-num` color gold-deep (light) / gold (dark) | P0 |
| **3** | Details: убрать accent на Amount + удалить Deal ID row | P0 |
| **4** | Labels Refunded/Released — сократить (убрать "after dispute") | P0 |
| **5** | /link/[id] seller — Copy link button | P1 |

После plan-23:
- ✅ Wallet pill адрес uppercase + light weight (match прототипу)
- ✅ Amount золотой в hero (на /deal и /link)
- ✅ Details список без accent и без Deal ID
- ✅ Status pills вмещаются в овал (Refunded/Released)
- ✅ Seller может скопировать свою ссылку
