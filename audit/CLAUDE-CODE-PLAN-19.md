# Claude Code — план №19 (/not-found + /error + receipt + wallet pill address)

**Дата:** 2026‑05‑21
**Контекст:** Объединённый аудит: 404/500/receipt + wallet pill address в шапке.

**Правила:**
- Не коммить.
- После плана — `npm run typecheck && npm run build && npm run test:unit`.
- Запись в `audit/PROGRESS.md` (секция `## Plan-19`).

---

# Phase 1 — [P0] not-found / error: ограничить content width 540px

**Проблема:** Прототип обёртывает контент в `<div className="not-found__inner">` с **max-width: 540, margin: 0 auto**. Имплементация рендерит контент прямо внутри `.not-found` без max-width — заголовок (96px serif), lede, buttons распирают вширь до viewport'а на больших экранах.

## Действие

### 1.1 — `app/globals.css` — добавить `.not-found__inner`:

```css
.not-found__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 18px;
  max-width: 540px;
  margin: 0 auto;
}
```

И убрать `gap` из `.not-found`:
```diff
  .not-found {
    ...
-   gap: 16px;
  }
```

### 1.2 — `app/not-found.tsx`: обернуть контент в `<div className="not-found__inner">`.

### 1.3 — `app/error.tsx`: то же самое.

## Acceptance
- На широком экране 404/500 контент сжат в 540px column
- Gap между elements — 18px

---

# Phase 2 — [P1] Receipt: "Funds refunded" → "Refund issued"

**Файл:** `app/deal/[id]/receipt/page.tsx`:

```diff
  function getReceiptTitle(status: DealReadModel["status"]): string {
    if (status === "Released") return "Payment released";
-   if (status === "Refunded") return "Funds refunded";
+   if (status === "Refunded") return "Refund issued";
    return "Settlement receipt";
  }
```

Опц. sub text более brand-voice:
```diff
  function getReceiptSub(deal: DealReadModel): string {
    if (deal.status === "Released") {
-     return `${formatUsdcPrice(deal.price_usdc)} USDC was released to the seller after the consultation was completed.`;
+     return "Your consultation has been settled. Funds have arrived in the seller's wallet on Base.";
    }
    if (deal.status === "Refunded") {
-     return `${formatUsdcPrice(deal.price_usdc)} USDC was returned to the buyer after the dispute was resolved.`;
+     return "The deal has been refunded to the buyer per admin resolution.";
    }
    ...
  }
```

> Альтернатива: оставить sub с конкретной суммой (информативнее). Обязательно только title.

---

# Phase 3 — [P1] Receipt Status DetailRow: Refunded tone "accent" → "purple"

**Файл:** `app/deal/[id]/receipt/page.tsx`:

```diff
  <DetailRow
    label="Status"
    value={
      <StatusPill
        label={deal.status === "Released" ? "Released" : "Refunded"}
-       tone={deal.status === "Released" ? "success" : "accent"}
+       tone={deal.status === "Released" ? "green" : "purple"}
      />
    }
  />
```

## Acceptance
- Refunded receipt показывает purple pill (status taxonomy correct)

---

# Phase 4 — [P2] Receipt Settlement tx: добавить last 6 chars

**Файл:** `app/deal/[id]/receipt/page.tsx`:

```diff
  <a ...>
-   {deal.tx_hash.slice(0, 10)}…
+   {deal.tx_hash.slice(0, 10)}…{deal.tx_hash.slice(-6)}
  </a>
```

---

# Phase 5 — [P2] Receipt dates с timezone suffix

**Файл:** `app/deal/[id]/receipt/page.tsx`:

```diff
- value={formatDate(deal.scheduled_at)}
+ value={formatDate(deal.scheduled_at, { showTimeZoneName: true })}

- value={formatDate(settledAt)}
+ value={formatDate(settledAt, { showTimeZoneName: true })}
```

---

# Phase 6 — [P0] Wallet pill address font fix (header dropdown)

**Проблема:** Адрес в pill (`0x1234…abcd`) — fontSize 12 (прототип 12.5), letterSpacing -0.01em (буквы тесные, выглядят слитно/«в caps»). Плюс wagmi возвращает lowercase — прототип использует EIP-55 mixed-case checksum.

## 6.1 — pillAddressStyle размер 12.5, убрать letter-spacing

**Файл:** `components/app/wallet-status-pill.tsx`:

```diff
  const pillAddressStyle = {
    color: "var(--ink)",
    fontFamily: "var(--font-mono)",
-   fontSize: 12,
+   fontSize: 12.5,
    fontWeight: 500,
-   letterSpacing: "-0.01em",
  } as const;
```

## 6.2 — EIP-55 checksum через `getAddress`

```diff
+ import { getAddress } from "viem";
  ...
- const address = session.address ? truncatePill(session.address) : "…";
+ const address = session.address ? truncatePill(getAddress(session.address)) : "…";
```

И в dropdown header:
```diff
  <p style={dropdownAddressStyle}>
-   {session.address ? truncateAddress(session.address) : ""}
+   {session.address ? truncateAddress(getAddress(session.address)) : ""}
  </p>
```

## 6.3 — dropdownAddressStyle: убрать letter-spacing

```diff
  const dropdownAddressStyle = {
    color: "var(--ink)",
    fontFamily: "var(--font-mono)",
    fontSize: 14,
    fontWeight: 500,
-   letterSpacing: "-0.01em",
    margin: 0,
    overflowWrap: "anywhere" as const,
  } as const;
```

## Acceptance
- Адрес в pill: `0x6E5d…CdC4` (mixed-case checksum) шрифт mono 12.5px без сжатия
- Адрес в dropdown header: тот же checksum, 14px mono без letter-spacing

---

# Финал

```bash
npm run typecheck && npm run build && npm run test:unit
```

Допиши в `audit/PROGRESS.md`:
```md
## Plan-19 — completed (not-found / error / receipt / wallet pill)

### Phase 1 — not-found inner wrapper (max-width 540)
- app/globals.css — added .not-found__inner; removed gap from .not-found
- app/not-found.tsx — wrapped content in <div className="not-found__inner">
- app/error.tsx — same

### Phase 2 — Receipt Refunded title
- app/deal/[id]/receipt/page.tsx — getReceiptTitle Refunded: "Funds refunded" → "Refund issued"
- getReceiptSub: prototype voice (or kept current per developer choice)

### Phase 3 — Receipt Status pill purple for Refunded
- app/deal/[id]/receipt/page.tsx — tone "accent" → "purple" for Refunded; "success" → "green" for Released

### Phase 4 — Settlement tx last 6 chars
- app/deal/[id]/receipt/page.tsx — anchor text: added .slice(-6) suffix

### Phase 5 — Receipt dates с timezone
- app/deal/[id]/receipt/page.tsx — formatDate(... { showTimeZoneName: true })

### Phase 6 — Wallet pill address
- components/app/wallet-status-pill.tsx — pillAddressStyle fontSize 12→12.5, removed letter-spacing -0.01em
- components/app/wallet-status-pill.tsx — getAddress(session.address) для EIP-55 checksum в pill + dropdown
- components/app/wallet-status-pill.tsx — dropdownAddressStyle removed letter-spacing -0.01em
```

---

# Сводка

| Phase | Что | Приоритет |
|---|---|---|
| **1** | not-found / error: 540px inner wrapper | P0 |
| **2** | Receipt Refunded title "Refund issued" + sub | P1 |
| **3** | Receipt StatusPill purple for Refunded | P1 |
| **4** | Settlement tx — last 6 chars | P2 |
| **5** | Receipt dates с timezone | P2 |
| **6** | Wallet pill address: 12.5 + no letter-spacing + EIP-55 checksum | P0 |
