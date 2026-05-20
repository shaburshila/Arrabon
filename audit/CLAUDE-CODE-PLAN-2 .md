# Claude Code — план №2 (доработка после ревью)

Это **продолжение** работы по `audit/CLAUDE-CODE-PLAN.md`. План №1 ты уже выполнил (см. `audit/PROGRESS.md`). После ревью пользователь обнаружил конкретные проблемы — этот файл их закрывает.

**Правила те же:**
- Иди по фазам сверху вниз, не пропускай, не задавай вопросов.
- `npm run typecheck && npm run build` в конце каждой фазы.
- Не коммить — оставь в working tree.
- В конце каждой фазы — допиши в `audit/PROGRESS.md` раздел `## Phase X (plan-2) — completed` с изменёнными файлами.
- Не трогай `lib/api/*`, `hooks/*`, `contexts/*`, `server/*`.

---

## Phase A — Landing page: footer и scroll-hint

### Step A.1 — Уменьшить высоту footer’а

**Файл:** `app/page.tsx`

Сейчас футтер занимает много места из-за **двойного padding**:
- `<footer className="site-footer" style={fullBleedSection}>` — `fullBleedSection` имеет `padding: "64px calc(50vw - 50% + 16px)"` (64px сверху и снизу)
- Внутри `<div style={{ ...sectionInner, paddingTop: 48, paddingBottom: 48 }}>` — ещё 48px сверху и снизу
- **Итого:** 64+48 = 112px сверху и 112px снизу

Плюс grid имеет `padding-bottom: 36` + `border-bottom`, плюс `.site-footer__base` имеет `padding-top: 24`. Получается ~290px вертикали для футера в три ссылочных колонки и копирайт. Слишком много.

**Действие.** Замени блок `<SiteFooter>` функции в `app/page.tsx`:

```tsx
function SiteFooter() {
  return (
    <footer className="site-footer" style={footerSectionStyle}>
      <div style={{ ...sectionInner, paddingTop: 32, paddingBottom: 24 }}>
        <div className="site-footer__grid">
          {/* содержимое колонок без изменений */}
        </div>
        <div className="site-footer__base">
          {/* содержимое base без изменений */}
        </div>
      </div>
    </footer>
  );
}
```

И добавь в стили в этом же файле (или замени `fullBleedSection` использование):

```tsx
const footerSectionStyle = {
  boxSizing: "border-box" as const,
  marginLeft: "calc(50% - 50vw)",
  marginRight: "calc(50% - 50vw)",
  padding: "32px calc(50vw - 50% + 16px) 16px",  // ← было 64px
  width: "auto",
};
```

Также в `app/globals.css` найди `.site-footer__grid` и замени `padding-bottom: 36px` на `padding-bottom: 24px`. Так же `.site-footer__base` — `padding-top: 24px` → `padding-top: 18px`.

**Acceptance:**
- Общая вертикаль футера сократилась примерно в 2 раза
- Все три колонки + base row помещаются в ~150-180px вертикали вместо ~290px

---

### Step A.2 — Поднять scroll-hint выше от низа экрана

**Файл:** `app/globals.css`

Найди `.landing-scroll-hint` (строка ~984) и замени `bottom: 24px;` на `bottom: 64px;`:

```css
.landing-scroll-hint {
  position: absolute;
  bottom: 64px;          /* ← было 24px */
  ...
}
```

Также убедись, что в `.landing-hero-section` есть `padding-bottom: 80px` или больше (чтобы не наезжал на следующую секцию). Если нет — добавь:

```css
.landing-hero-section {
  position: relative;
  min-height: calc(100vh - 64px);
  display: flex;
  align-items: center;
  padding: 32px 0 120px;   /* ← было 32px 0 */
  z-index: 0;
}
```

**Acceptance:**
- На загруженной странице scroll-hint pill находится в ~80-100px от низа viewport, не прилипает к краю
- При скролле он плавно исчезает (parallax уже работает)

---

### Step A.3 — Финал фазы A

```bash
npm run typecheck && npm run build
```

Допиши в `audit/PROGRESS.md`:
```md
## Phase A (plan-2) — completed
- app/page.tsx — SiteFooter padding 64+48 → 32+24 vertical
- app/globals.css — site-footer__grid padding-bottom 36→24, site-footer__base padding-top 24→18, landing-scroll-hint bottom 24→64, landing-hero-section padding-bottom 0→120
```

---

## Phase B — List rows на /my-deals и /my-links

### Step B.1 — Добавить иконку в StatusPill в DealRow

**Файл:** `app/my-deals/page.tsx`

Найди функцию `DealRow` и в строке с `<StatusPill ...>` добавь `icon`:

**Было:**
```tsx
<StatusPill bg={badge.bg} color={badge.color} label={badge.label} />
```

**Стало:**
```tsx
<StatusPill bg={badge.bg} color={badge.color} icon={badge.icon} label={badge.label} />
```

`badge` приходит из `getDealDisplayConfig` — в типе `DealStatusConfig` уже есть поле `icon: IconName`. StatusPill компонент уже поддерживает prop `icon`.

### Step B.2 — То же для LinkRow

**Файл:** `app/my-links/page.tsx`

Тот же фикс в `LinkRow`:

```tsx
<StatusPill bg={badge.bg} color={badge.color} icon={badge.icon} label={badge.label} />
```

`badge` для линков приходит из `getMyLinkBadge` — это helper в том же файле. Проверь его сигнатуру: если он возвращает объект **без** `icon`, нужно расширить:

```ts
function getMyLinkBadge(link: MyLink): MyLinkBadge & { icon?: IconName } {
  if (link.deal_status) {
    return getDealDisplayConfig({
      resolution_type: link.deal_resolution_type,
      status: link.deal_status,
    });  // уже имеет icon
  }

  // для линков без deal_status — добавь icon по link.status
  const linkIconByStatus: Record<MyLink["status"], IconName> = {
    Open: "status-open",
    Consumed: "status-funded-escrow-held",
    Cancelled: "utility-close",
    Draft: "status-payment-pending",
    Expired: "status-expired",
  };
  return {
    ...LINK_STATUS_CONFIG[link.status],
    icon: linkIconByStatus[link.status],
  };
}
```

Добавь импорт `IconName` если нет:
```ts
import type { IconName } from "@/components/icons";
```

### Step B.3 — Расширить колонку pill в .list-row CSS

**Файл:** `app/globals.css`

Найди `.list-row` (строка с `grid-template-columns: minmax(0, 1fr) 130px 110px 150px 28px;`) и поменяй на:

```css
.list-row {
  ...
  grid-template-columns: minmax(0, 1fr) 130px minmax(160px, auto) 160px 28px;
  ...
}
```

`minmax(160px, auto)` даст pill минимум 160px, но позволит расширяться под длинные лейблы вроде "Awaiting confirmation".

### Step B.4 — Сократить лейблы статусов чтобы пилюли не торчали

**Файл:** `lib/ui/deal-status.ts`

Сейчас:
```ts
ConfirmPending: { ..., label: "Awaiting confirmation" },
```
21 символ — длинно. Замени на короткие, как в прототипе:

```ts
ConfirmPending: { bg: "var(--amber-bg)", color: "var(--amber)", icon: "status-confirm-pending", label: "Confirm Pending" },
```

Остальные label оставь как есть (Funded / Released / Disputed / Refunded — короткие).

### Step B.5 — Финал фазы B

```bash
npm run typecheck && npm run build
```

Допиши в `audit/PROGRESS.md`:
```md
## Phase B (plan-2) — completed
- app/my-deals/page.tsx — StatusPill теперь получает icon prop
- app/my-links/page.tsx — StatusPill icon prop + getMyLinkBadge возвращает icon для link statuses
- app/globals.css — list-row pill column 110px → minmax(160px, auto)
- lib/ui/deal-status.ts — ConfirmPending label сокращён "Awaiting confirmation" → "Confirm Pending"
```

---

## Phase C — Реструктуризация CreateLinkForm

Это самая объёмная часть плана №2. Сейчас `components/link/create-link-form.tsx` — это 676-строчный файл со старой архитектурой: один большой `<ActionPanel>` обёрткой над всеми секциями, плюс лишние блоки (`<WalletSessionCard>`, дублирующий `<PageHeader>` внутри формы, второй `<h2>` внутри ActionPanel). Прототип в `handoff/prototype/screens.jsx` (функция `CreateScreen` строки 310-440) показывает совсем другую структуру: **5 отдельных `<Card padded>` блоков в `stack-24`**, каждый с `.section-label` подписью, без обёртки.

### Step C.1 — Удалить дубли из CreateLinkForm

**Файл:** `components/link/create-link-form.tsx`

В функции `CreateLinkForm`, в основном return‑блоке (где `if (shareUrl)` false), найди:

```tsx
return (
  <>
    <PageHeader />              ← УДАЛИТЬ

    <WalletSessionCard session={session} hideActions />   ← УДАЛИТЬ

    <form onSubmit={handleSubmit}>
      <ActionPanel style={formPanelStyle}>
        <div style={panelHeaderStyle}>            ← УДАЛИТЬ весь div
          <h2 style={panelTitleStyle}>Create link</h2>
          <p style={panelSubtitleStyle}>...</p>
        </div>
        ... остальные секции
      </ActionPanel>
    </form>
  </>
);
```

Удали:
- `<PageHeader />` рендер
- Функцию `function PageHeader()` целиком из файла (она больше не нужна — заголовок теперь рендерится на уровне страницы, см. Step C.4)
- `<WalletSessionCard ... />` импорт и рендер
- Внутренний `<div style={panelHeaderStyle}>...</div>` с h2 "Create link" и subtitle

Также удали неиспользуемые после этого стили: `headerStyle`, `h1Style`, `subtitleStyle`, `panelHeaderStyle`, `panelTitleStyle`, `panelSubtitleStyle`.

Удали неиспользуемые импорты: `WalletSessionCard` (если больше нигде в файле не используется — он используется в success branch `if (shareUrl)`, поэтому ОСТАВЬ импорт; рендер удалить только в main branch).

**Сверь:** `WalletSessionCard` в success‑бранче — нужен ли он там? Скорее всего нет (success экран показывает share link, top‑pill в shell тоже есть). Если хочешь — удали его и оттуда тоже.

### Step C.2 — Разбить один ActionPanel на 5 separate cards

**Файл:** `components/link/create-link-form.tsx`

Внутри `<form onSubmit={handleSubmit}>` замени **весь** `<ActionPanel style={formPanelStyle}>...</ActionPanel>` на стек из 5 отдельных ActionPanel + Notice + Btn:

```tsx
<form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
  {/* Consultation */}
  <ActionPanel style={cardPaddedStyle}>
    <div style={sectionStackStyle}>
      <SectionLabel>Consultation</SectionLabel>
      <FormField label="Title">
        <TextInput
          id="title"
          onChange={(e) => setField("title", e.target.value)}
          placeholder="e.g. 30-min Strategy Call"
          required
          type="text"
          value={form.title}
        />
      </FormField>
      <FormField label="Description" helper="A short note for the buyer.">
        <TextArea
          id="description"
          onChange={(e) => setField("description", e.target.value)}
          placeholder="What will you cover in this consultation?"
          rows={4}
          value={form.description}
        />
      </FormField>
    </div>
  </ActionPanel>

  {/* Payment */}
  <ActionPanel style={cardPaddedStyle}>
    <div style={sectionStackStyle}>
      <SectionLabel>Payment</SectionLabel>
      <TokenAmountRow
        amount={form.price_usdc}
        label="Price"
        onChange={(value) => setField("price_usdc", value)}
        required
        sublabel="You will receive this amount in full. Buyer pays an additional 3% platform fee (min $1.50, max $30)."
        token="USDC"
      />
      <Divider />
      <DetailRow bordered={false} label="Seller wallet" mono value={sellerAddress} />
    </div>
  </ActionPanel>

  {/* Schedule */}
  <ActionPanel style={cardPaddedStyle}>
    <div style={sectionStackStyle}>
      <SectionLabel>Schedule</SectionLabel>
      <div style={twoColumnRowStyle}>
        <FormField label="Date">
          <TextInput
            id="scheduled_date"
            onChange={(e) => setField("scheduled_date", e.target.value)}
            required
            type="date"
            value={form.scheduled_date}
          />
        </FormField>
        <FormField label="Time">
          <TextInput
            id="scheduled_time"
            onChange={(e) => setField("scheduled_time", e.target.value)}
            required
            type="time"
            value={form.scheduled_time}
          />
        </FormField>
      </div>
      <FormField label="Duration (minutes)">
        <TextInput
          id="duration_minutes"
          max="1440"
          min="1"
          onChange={(e) => setField("duration_minutes", e.target.value)}
          required
          type="number"
          value={form.duration_minutes}
        />
      </FormField>
      <FormField helper="Locked to your browser's timezone." label="Timezone">
        <TextInput disabled id="timezone" type="text" value={form.timezone} />
      </FormField>
    </div>
  </ActionPanel>

  {/* Link expiration */}
  <ActionPanel style={cardPaddedStyle}>
    <div style={sectionStackStyle}>
      <SectionLabel>Link expiration</SectionLabel>
      <div style={twoColumnRowStyle}>
        <FormField label="Expiration date">
          <TextInput
            id="expires_date"
            onChange={(e) => setExpirationField("expires_date", e.target.value)}
            required
            type="date"
            value={form.expires_date}
          />
        </FormField>
        <FormField label="Expiration time">
          <TextInput
            id="expires_time"
            onChange={(e) => setExpirationField("expires_time", e.target.value)}
            required
            type="time"
            value={form.expires_time}
          />
        </FormField>
      </div>
      <p style={helperTextStyle}>
        The link cannot be funded after this time. Defaults to 5 minutes before the consultation.
      </p>
    </div>
  </ActionPanel>

  {/* Private meeting */}
  <ActionPanel style={cardPaddedStyle}>
    <div style={sectionStackStyle}>
      <SectionLabel>Private meeting</SectionLabel>
      <FormField helper="Revealed only after the buyer funds escrow." label="Meeting URL">
        <TextInput
          id="meeting_url"
          onChange={(e) => setField("meeting_url", e.target.value)}
          placeholder="https://meet.example.com/your-room"
          required
          type="url"
          value={form.meeting_url}
        />
      </FormField>
    </div>
  </ActionPanel>

  {/* Compliance / errors */}
  {compliance.isBlocked && (
    <ComplianceBlockedNotice
      reasonCode={compliance.complianceReasonCode}
      walletAddress={compliance.complianceWallet}
    />
  )}
  {!compliance.isBlocked && error && (
    <Notice message={error} title="Could not create link" tone="danger" />
  )}

  {/* Gold reassurance notice */}
  <Notice
    icon="utility-secure-subtle"
    message="USDC is locked in the Arrabon contract on Base until the consultation is confirmed or disputed."
    title="Funds held in escrow"
    tone="gold"
  />

  {/* Submit */}
  <Btn
    disabled={primaryAction.disabled}
    fullWidth
    loading={primaryAction.loading}
    onClick={primaryAction.onClick}
    size="lg"
    type={primaryAction.type}
  >
    {primaryAction.label}
  </Btn>
</form>
```

Стили в этом же файле (замени старые):

```tsx
const cardPaddedStyle = {
  padding: "24px 28px",
};

const sectionStackStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 18,
};

const twoColumnRowStyle = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "1fr 1fr",
};

const helperTextStyle = {
  color: "var(--muted-2)",
  fontSize: 12,
  lineHeight: 1.45,
  margin: 0,
};
```

Удали неиспользуемые стили: `formPanelStyle`, и `Divider` функцию если она была — заменена прямым `<DetailRow bordered={false}>` использованием.

Также в `<ActionPanel>` уже стоит `box-shadow: var(--shadow-panel)`. Если хочется visually consistent с прототипом (где `.card` имеет лёгкую `--shadow-1`), можно `style={{ ...cardPaddedStyle, boxShadow: "var(--shadow-1)" }}`. Опционально.

**Acceptance:**
- В DOM теперь 5 отдельных `<ActionPanel>` блоков с `gap: 24` между ними (раньше был один)
- Нет `<PageHeader>`, `<WalletSessionCard hideActions>`, `<h2>Create link</h2>` внутри формы
- `npm run typecheck` проходит
- `npm run build` проходит

### Step C.3 — Перенести заголовок страницы наверх `app/create/page.tsx`

**Файл:** `app/create/page.tsx`

Сейчас:
```tsx
<AppShell maxWidth={1100}>
  <div className="create-split">
    <div>
      <CreateLinkForm ... />
    </div>
    <aside className="create-split__preview">
      <LinkPreviewCard values={preview} />
    </aside>
  </div>
</AppShell>
```

Замени на:

```tsx
<AppShell maxWidth={1100}>
  <header style={pageHeaderStyle}>
    <h1 style={pageTitleStyle}>Create consultation link</h1>
    <p style={pageSubStyle}>
      Define the consultation, set the price, and share a single link.
      Funds settle in USDC on Base.
    </p>
  </header>

  <div className="create-split">
    <div>
      <CreateLinkForm
        session={session}
        onValuesChange={(values) => setPreview({ ... })}
      />
    </div>
    <aside className="create-split__preview">
      <LinkPreviewCard values={preview} />
    </aside>
  </div>
</AppShell>
```

И добавь стили в этот же файл:

```tsx
const pageHeaderStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
  marginBottom: 32,
  maxWidth: 720,
};

const pageTitleStyle = {
  color: "var(--ink)",
  fontFamily: "var(--font-serif)",
  fontSize: 40,
  fontWeight: 500,
  letterSpacing: "-0.008em",
  lineHeight: 1.08,
  margin: 0,
  textWrap: "balance" as const,
};

const pageSubStyle = {
  color: "var(--muted)",
  fontSize: 16,
  lineHeight: 1.55,
  margin: 0,
};
```

**Acceptance:**
- На странице `/create` теперь сверху большой serif h1 «Create consultation link» (40px Cormorant Garamond)
- Под ним lede в 16px muted
- Дальше split layout с формой слева и preview справа

### Step C.4 — Перепроверить sticky preview позиционирование

**Файл:** `app/globals.css`

Найди `.create-split__preview`:

```css
.create-split__preview {
  position: sticky;
  top: 88px;
}
```

С нашим новым page header (40px h1 + 16px sub + 32px margin = ~120px вверху страницы) preview может оказаться слишком высоко. Замени `top: 88px` на `top: 24px` чтобы preview прилипал ближе к верху viewport’а (под `<TopNav>` 64px высоты):

Wait — `top: 88px` соответствует topnav 64px + 24px breathing. То есть preview прилипает на 88px от верха viewport — это под top-nav. Хорошо. Оставь `top: 88px`.

Но проверь: если есть проблема `position: sticky` не работает — это часто из-за `overflow: hidden` на родителе. Убедись что в `.create-split` нет overflow. Если есть — убери. Также проверь `<AppShell>` — `main` элемент имеет `min-height: 100vh` и какой-то padding. sticky должен работать.

Если sticky всё равно ведёт себя странно — добавь `align-self: start` к `.create-split__preview`.

**Acceptance:**
- При scroll вниз страницы /create правая колонка preview остаётся видимой и обновляется в реальном времени
- На <900px preview уходит вниз под форму

### Step C.5 — Финал фазы C

```bash
npm run typecheck && npm run build
```

Допиши в `audit/PROGRESS.md`:
```md
## Phase C (plan-2) — completed
- components/link/create-link-form.tsx — restructured: removed PageHeader, WalletSessionCard, duplicate h2; one ActionPanel split into 5 separate Card blocks with SectionLabel
- app/create/page.tsx — page header now lives on page (h1 serif 40px), not inside form
- app/globals.css — verified create-split__preview sticky behaviour, added align-self: start if needed
```

---

## Phase D — Sanity check / финальная проверка

### Step D.1 — Прогоны

```bash
npm run typecheck
npm run build
npm run test:unit
```

Если падают тесты в `tests/unit/create-link-form.test.tsx` (возможно есть) — обнови их под новую структуру: проверь что они не ищут несуществующий h2 "Create link" или `<WalletSessionCard>` внутри формы.

Если в каком-то тесте чёрный ящик — пометь BLOCKED в `audit/PROGRESS.md`.

### Step D.2 — Чек-лист для self-review

Перед финалом убедись:

- [ ] Landing footer стал короче (визуально 2x меньше)
- [ ] Landing scroll-hint не прилипает к самому низу (есть ~64-100px от края)
- [ ] My-deals: status пилюли имеют иконку слева
- [ ] My-deals: "Confirm Pending" pill больше не подрезается
- [ ] My-links: status пилюли имеют иконку
- [ ] Create page: серый h1 серифом наверху страницы
- [ ] Create page: НЕТ `<WalletSessionCard>` внутри формы (top-pill справляется)
- [ ] Create page: НЕТ дублирующего h2 "Create link" внутри карточек
- [ ] Create page: 5 отдельных карточек (Consultation / Payment / Schedule / Link expiration / Private meeting) с gap 24px
- [ ] Create page: Notice gold "Funds held in escrow" ВНЕ карточек, прямо в form stack
- [ ] Create page: preview справа sticky обновляется в реальном времени

### Step D.3 — Финальный отчёт

Допиши в `audit/PROGRESS.md`:

```md
## Plan-2 — completed

Все 3 фазы плана №2 закрыты. См. отдельные секции выше.

**Notes / deviations** (если есть)
- ...
```

Не коммить. Передай работу пользователю.

---

## Если что-то выглядит криво визуально

Не пытайся pixel-perfect — пользователь скажет. Главное чтобы:
- `npm run build` clean
- Structural changes как описано
- Нет дублирующих компонентов на странице

Точка входа: **Phase A, Step A.1**. Начинай.
