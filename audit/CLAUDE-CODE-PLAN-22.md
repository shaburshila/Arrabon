# Claude Code — план №22 (filter counts — production-grade)

**Дата:** 2026‑05‑21
**Контекст:** Текущая реализация `/my-deals` и `/my-links` показывает счётчики только на табе "All", и значение — это `deals.length` текущей страницы (≤ 20). Это обманчиво и неверно. Нужен production-grade подход: счётчики для каждого фильтра, минимум запросов к БД, кэширование, инвалидация при мутациях, optimistic UI.

**Правила:**
- Это **functional change**, затрагивает backend API + frontend cache layer
- План **architectural blueprint**, не diff-уровень — точная реализация зависит от текущего stack (Postgres / Prisma / тип ORM / есть ли Redis)
- Не коммить.

---

# Архитектура решения

## Принципы (как в больших проектах)

1. **One query, one round-trip** — counts вычисляются одним SQL aggregation (`COUNT(*) FILTER`), а не N отдельных запросов
2. **Inline counts в основном endpoint** — `GET /my-deals?include_counts=true` возвращает `{deals, counts}` в одном response (а не отдельный `/counts` endpoint)
3. **Server-side caching** — counts кэшируются per-user на 60s (Redis или in-memory LRU)
4. **Client-side caching через React Query / SWR** — frontend дедуплицирует, кэширует, refetch в background
5. **Cache invalidation on mutation** — create / release / refund / dispute → invalidate counts queryKey
6. **Stale-while-revalidate** — UI показывает старые counts мгновенно, обновляется в фоне
7. **Indexes на фильтрующих колонках** — `(buyer_address, status)`, `(seller_address, status)`, `(scheduled_at)` для эффективных aggregations
8. **No N+1** — counts не вычисляются отдельным запросом за каждый таб

---

# Phase 1 — Backend: single endpoint, single SQL query

## 1.1 — SQL pattern: COUNT(*) FILTER (один запрос для всех counts)

Postgres `FILTER` clause позволяет вычислить все counts одним запросом без UNION'ов / multiple round trips.

```sql
-- /my-deals counts (для buyer view)
SELECT
  COUNT(*) AS all_count,
  COUNT(*) FILTER (
    WHERE status IN ('Funded', 'ConfirmPending')
      AND scheduled_at > NOW()
  ) AS upcoming_count,
  COUNT(*) FILTER (
    WHERE (status = 'ConfirmPending' AND release_deadline_at < NOW() + INTERVAL '24 hours')
       OR (status = 'Funded' AND scheduled_at < NOW())
  ) AS needs_action_count,
  COUNT(*) FILTER (WHERE status = 'Disputed') AS disputed_count,
  COUNT(*) FILTER (WHERE status IN ('Released', 'Refunded')) AS resolved_count
FROM deals
WHERE buyer_address = $1;
```

**Преимущества:**
- 1 query вместо 5
- Same WHERE clause (buyer_address) — использует существующий index
- Postgres parallelizes filtered aggregations
- Total time ≈ time of single COUNT (a single index scan)

**Index requirements (если ещё нет):**
```sql
CREATE INDEX IF NOT EXISTS idx_deals_buyer_status_scheduled
  ON deals (buyer_address, status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_links_seller_status_expires
  ON consultation_links (seller_address, status, expires_at);
```

Composite index покрывает все фильтры — partial COUNT FILTER queries будут использовать **index-only scans** (без обращения к heap).

## 1.2 — API contract

Изменить существующий endpoint (не делать отдельный `/counts`):

```
GET /api/my-deals?filter=upcoming&limit=21&offset=0&include_counts=true
```

Response:
```json
{
  "deals": [...],         // current filter, page
  "counts": {              // included only if include_counts=true
    "all": 47,
    "upcoming": 12,
    "needs_action": 3,
    "disputed": 1,
    "resolved": 31
  },
  "counts_computed_at": "2026-05-21T14:30:12Z"  // for cache validation
}
```

**Только первая загрузка** запрашивает `include_counts=true`. Последующие переключения фильтров / пагинация — без counts (используют cached value на client).

## 1.3 — Server-side cache (Redis или in-memory)

```typescript
// lib/cache/counts-cache.ts
const COUNTS_TTL_SECONDS = 60;

async function getCachedCounts(
  userId: string,
  view: "buyer" | "seller"
): Promise<Counts | null> {
  const key = `counts:${view}:${userId}`;
  return redis.get(key); // or in-memory LRU
}

async function setCachedCounts(
  userId: string,
  view: "buyer" | "seller",
  counts: Counts
): Promise<void> {
  const key = `counts:${view}:${userId}`;
  await redis.set(key, JSON.stringify(counts), "EX", COUNTS_TTL_SECONDS);
}

async function invalidateCounts(userId: string, view: "buyer" | "seller"): Promise<void> {
  await redis.del(`counts:${view}:${userId}`);
}
```

Cache key включает user — нет cross-user leakage.

В handler:
```typescript
let counts = null;
if (includeCounts) {
  counts = await getCachedCounts(userId, view);
  if (!counts) {
    counts = await db.query<Counts>(COUNTS_SQL, [userId]);
    await setCachedCounts(userId, view, counts);
  }
}
```

## 1.4 — Cache invalidation на мутациях

Любая мутация которая может изменить counts — инвалидирует кэш:

```typescript
// При create link / fund deal / dispute / release / refund:
await invalidateCounts(buyerAddress, "buyer");
await invalidateCounts(sellerAddress, "seller");
```

Конкретно — в текущем коде это:
- POST /links/create → invalidate seller counts
- POST /links/:id/fund → invalidate buyer + seller counts
- POST /deals/:id/release → invalidate buyer + seller counts
- POST /deals/:id/refund → invalidate buyer + seller counts
- POST /deals/:id/dispute → invalidate buyer + seller counts
- POST /admin/disputes/:id/resolve → invalidate buyer + seller counts

**Без Redis (in-memory):** использовать Node LRU cache, но это не работает с multi-instance deployment. Если planning горизонтальное масштабирование — нужен shared cache (Redis / Memcached / etc).

---

# Phase 2 — Frontend: TanStack Query / SWR pattern

## 2.1 — Query keys + caching

Если проект использует `@tanstack/react-query` (если нет — добавить, это de-facto standard для Next.js):

```tsx
// hooks/use-my-deals-counts.ts
const COUNTS_STALE_TIME = 60_000; // 60s — match server TTL

export function useMyDealsCounts() {
  return useQuery({
    queryKey: ["my-deals-counts"],
    queryFn: () => fetchMyDealsCounts(),
    staleTime: COUNTS_STALE_TIME,
    gcTime: 5 * 60_000,
    enabled: isAuthenticated,
  });
}

// Same for links:
export function useMyLinksCounts() {
  return useQuery({
    queryKey: ["my-links-counts"],
    queryFn: () => fetchMyLinksCounts(),
    staleTime: COUNTS_STALE_TIME,
    enabled: isAuthenticated,
  });
}
```

**TanStack Query benefits:**
- Auto-dedupe одинаковых queries при mount нескольких компонентов
- Background refetch при window focus / network reconnect (configurable)
- Optimistic updates через `setQueryData` (мгновенное UI обновление)
- Built-in retry с exponential backoff

## 2.2 — Cache invalidation на мутациях

В существующих мутационных хуках добавить invalidation:

```tsx
// hooks/use-fund-link.ts
const queryClient = useQueryClient();

const fundMutation = useMutation({
  mutationFn: fundLink,
  onSuccess: () => {
    // Invalidate counts → triggers background refetch
    queryClient.invalidateQueries({ queryKey: ["my-deals-counts"] });
    queryClient.invalidateQueries({ queryKey: ["my-links-counts"] });
    queryClient.invalidateQueries({ queryKey: ["my-deals"] });
  },
});
```

## 2.3 — UI: FILTERS с counts

```tsx
// app/my-deals/page.tsx
const { data: counts } = useMyDealsCounts();

const FILTERS = useMemo(() => [
  {
    value: "all",
    label: counts ? `All · ${counts.all}` : "All",
  },
  {
    value: "upcoming",
    label: counts?.upcoming
      ? `Upcoming · ${counts.upcoming}`
      : "Upcoming",
  },
  {
    value: "needs_action",
    label: counts?.needs_action
      ? `Needs action · ${counts.needs_action}`
      : "Needs action",
  },
  // ... etc
], [counts]);
```

**Соглашение:**
- Count `0` — НЕ показывается (избегаем `Upcoming · 0` шума). Tab остаётся без count = "пусто"
- Count `null/undefined` (ещё не загружено) — тоже без count

## 2.4 — Optimistic UI

Когда юзер создаёт deal / fund link — UI обновляется мгновенно (до response от backend):

```tsx
const createMutation = useMutation({
  mutationFn: createLink,
  onMutate: async (newLink) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ["my-links-counts"] });
    
    // Snapshot previous value
    const prev = queryClient.getQueryData<Counts>(["my-links-counts"]);
    
    // Optimistic update
    queryClient.setQueryData<Counts>(["my-links-counts"], (old) => 
      old ? { ...old, all: old.all + 1, available: (old.available ?? 0) + 1 } : old
    );
    
    return { prev };
  },
  onError: (err, vars, ctx) => {
    // Rollback on error
    if (ctx?.prev) queryClient.setQueryData(["my-links-counts"], ctx.prev);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ["my-links-counts"] });
  },
});
```

---

# Phase 3 — Performance budget

## Метрики после implementation

| Action | Запросов к DB | Время (p95) |
|---|---|---|
| Initial page load (cold cache) | 2 (list + counts) | ~50ms |
| Initial page load (warm cache) | 1 (list only) | ~20ms |
| Tab switch (warm cache) | 1 (list only) | ~20ms |
| Mutation + invalidation | 1 (mutation) + 2 background (list + counts) | ~30ms perceived |
| Pagination | 1 (list only, counts from cache) | ~20ms |

**Без кэширования** (naive подход):
- 5 separate count queries × N filter buttons × page load = 5+ queries per page render
- Tab switch: 5 queries
- High DB load, slow UX

**С предложенной архитектурой:**
- 1-2 queries per page load (often 1 due to cache hit)
- Tab switch: 0 queries (counts from client cache)
- Mutation: 1 write + 2 invalidations (async)

## Index strategy

```sql
-- Existing or new composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_buyer_status_scheduled
  ON deals (buyer_address, status, scheduled_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_seller_status_scheduled
  ON deals (seller_address, status, scheduled_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_links_seller_status_expires
  ON consultation_links (seller_address, status, expires_at);
```

`CONCURRENTLY` — не блокирует таблицу, безопасно в production.

Partial indexes для часто-используемых filter conditions (если cardinality высокая):
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_disputed
  ON deals (buyer_address)
  WHERE status = 'Disputed';
```

---

# Phase 4 — Deployment steps

1. **Backend migration:**
   - Add composite indexes (CONCURRENTLY)
   - Deploy updated endpoint with `include_counts=true` param
   - Deploy cache layer (Redis if not present, или in-memory + sticky sessions)

2. **Frontend migration:**
   - Add TanStack Query if not present (`npm install @tanstack/react-query`)
   - Wrap app in `<QueryClientProvider>`
   - Create `useMyDealsCounts` / `useMyLinksCounts` hooks
   - Add `invalidateQueries` calls в существующих мутациях
   - Update FILTERS useMemo to consume counts

3. **Rollout:**
   - Feature flag (`COUNTS_ENABLED`) — позволяет включить/выключить без deploy
   - Monitor: counts query p95 latency, cache hit ratio (target ≥ 80%)
   - Alert on count query > 200ms (index missing / heavy table)

---

# Acceptance

- Каждый таб фильтра показывает реальный count из DB (или скрывает если 0)
- Page load: 1 round trip (list + counts inline) при cold cache, 1 trip при warm
- Tab switch — counts мгновенные (client cache), список — 1 request
- После мутации (create / fund / release / refund / dispute) — counts автоматически refresh
- Optimistic UI: счётчик `+1` сразу при action, перед server response
- Cache hit ratio ≥ 80% (production metric)
- p95 latency на counts endpoint ≤ 50ms

---

# Опционально — будущие улучшения

1. **WebSocket / SSE для real-time counts** — admin видит счётчик disputes растущий live без refresh. Requires pub/sub layer.

2. **Materialized view** для очень больших таблиц (>10M rows). Refresh раз в минуту. Read-only, sub-ms latency. Trade-off: stale data до 60s.

3. **Partial counts** — если у юзера 10000 deals, точный count может быть медленным. Показать `1000+` для перегруженных таб'ов (Stripe / GitHub pattern):
   ```sql
   SELECT LEAST(COUNT(*), 1000) FROM ...
   ```
   Plus client-side "Showing 1000+" indicator.

4. **Edge caching** — Cloudflare / Vercel KV для globally distributed cache, особенно если фронт hosted на edge.

---

# Сводка

Plan-22 — **архитектурный**, не diff-уровень. Конкретная реализация зависит от текущего stack (ORM, БД, есть ли Redis, использует ли проект TanStack Query). Передавать разработчику для review + adjustments под конкретный codebase.

Главное:
- **1 SQL query** (FILTER aggregations) — не 5 отдельных
- **Сacheable** на server (Redis 60s TTL) + client (TanStack Query 60s staleTime)
- **Invalidate on mutation** — counts всегда eventually consistent
- **Optimistic UI** — мгновенные обновления perception
- **Production-ready**: indexed, multi-instance safe, observable
