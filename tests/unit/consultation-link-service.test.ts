/**
 * Unit tests for getPublicConsultationLinkById in server/services/consultation-links.ts.
 *
 * What is tested:
 *   - Open link (no deal)     → 200, status "Open",     deal_id null
 *   - Open link (deal exists) → 200, status "Open",     deal_id set
 *   - Consumed link + deal    → 200, status "Consumed", deal_id set   ← key change
 *   - Consumed link, no deal  → 200, status "Consumed", deal_id null  ← key change
 *   - Open but past expires_at → 410 LINK_EXPIRED
 *   - DB status Expired        → 410 LINK_EXPIRED
 *   - DB status Cancelled      → 410 LINK_CANCELLED
 *   - DB status Draft          → 404 LINK_NOT_FOUND
 *   - Link not found           → 404 LINK_NOT_FOUND
 *   - ConsultationLinksRepositoryError on getById     → 500
 *   - DealsRepositoryError on getByConsultationLinkId → 500
 *   - Full response field mapping
 *
 * Dependencies (getById, getByConsultationLinkId) are injected via
 * global.__serviceMocks, populated by setup-services.cjs before this module
 * is loaded.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import type { ConsultationLinkRow, DealRow } from '../../lib/db/types';
import {
  getPublicConsultationLinkById,
  ConsultationLinkServiceError,
} from '../../server/services/consultation-links';

// ── Typed access to the mutable mock state set up by setup-services.cjs ─────

interface ServiceMocks {
  getById: (id: string) => Promise<ConsultationLinkRow | null>;
  getByConsultationLinkId: (id: string) => Promise<DealRow | null>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ConsultationLinksRepositoryError: new (message: string, code?: string) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DealsRepositoryError: new (message: string, code?: string) => any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mocks = (global as any).__serviceMocks as ServiceMocks;

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FUTURE = new Date(Date.now() + 60 * 60 * 1_000).toISOString();
const PAST   = new Date(Date.now() - 60 * 60 * 1_000).toISOString();

function makeLink(overrides: Partial<ConsultationLinkRow> = {}): ConsultationLinkRow {
  return {
    id: 'link-uuid-001',
    creator_user_id: 'user-uuid-001',
    expert_address: '0xExpertAddress',
    title: 'Test Consultation',
    description: 'A test consultation',
    price_usdc: '100.00',
    scheduled_at: FUTURE,
    timezone: 'UTC',
    expires_at: FUTURE,
    duration_minutes: 30,
    grace_period_minutes: 10,
    meeting_url_encrypted: 'mock-encrypted-url',
    link_hash: '0x' + 'a'.repeat(64),
    status: 'Open',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeDeal(overrides: Partial<DealRow> = {}): DealRow {
  return {
    id: 'deal-uuid-999',
    consultation_link_id: 'link-uuid-001',
    onchain_deal_id: '1',
    buyer_address: '0xBuyerAddress',
    seller_address: '0xExpertAddress',
    status: 'Funded',
    funded_at: new Date().toISOString(),
    completed_at: null,
    released_at: null,
    tx_hash: '0x' + 'b'.repeat(64),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ── Reset mocks before each test ─────────────────────────────────────────────

beforeEach(() => {
  mocks.getById = async () => null;
  mocks.getByConsultationLinkId = async () => null;
});

// ── link not found ────────────────────────────────────────────────────────────

describe('link not found', () => {
  test('throws 404 LINK_NOT_FOUND when getById returns null', async () => {
    await assert.rejects(
      () => getPublicConsultationLinkById('link-uuid-001'),
      (err: unknown) => {
        assert.ok(err instanceof ConsultationLinkServiceError);
        assert.equal(err.status, 404);
        assert.equal(err.code, 'LINK_NOT_FOUND');
        return true;
      },
    );
  });
});

// ── Draft link ────────────────────────────────────────────────────────────────

describe('Draft link', () => {
  test('throws 404 for Draft status', async () => {
    mocks.getById = async () => makeLink({ status: 'Draft' });

    await assert.rejects(
      () => getPublicConsultationLinkById('link-uuid-001'),
      (err: unknown) => {
        assert.ok(err instanceof ConsultationLinkServiceError);
        assert.equal(err.status, 404);
        assert.equal(err.code, 'LINK_NOT_FOUND');
        return true;
      },
    );
  });
});

// ── Expired link ──────────────────────────────────────────────────────────────

describe('Expired link', () => {
  test('throws 410 LINK_EXPIRED when DB status is Expired', async () => {
    mocks.getById = async () => makeLink({ status: 'Expired', expires_at: PAST });

    await assert.rejects(
      () => getPublicConsultationLinkById('link-uuid-001'),
      (err: unknown) => {
        assert.ok(err instanceof ConsultationLinkServiceError);
        assert.equal(err.status, 410);
        assert.equal(err.code, 'LINK_EXPIRED');
        assert.equal(err.statusValue, 'Expired');
        return true;
      },
    );
  });

  test('throws 410 LINK_EXPIRED when Open but expires_at is in the past', async () => {
    const expiredNow = new Date(Date.now() + 1); // just after PAST
    mocks.getById = async () => makeLink({ status: 'Open', expires_at: PAST });

    await assert.rejects(
      () => getPublicConsultationLinkById('link-uuid-001', expiredNow),
      (err: unknown) => {
        assert.ok(err instanceof ConsultationLinkServiceError);
        assert.equal(err.status, 410);
        assert.equal(err.code, 'LINK_EXPIRED');
        return true;
      },
    );
  });
});

// ── Cancelled link ────────────────────────────────────────────────────────────

describe('Cancelled link', () => {
  test('throws 410 LINK_CANCELLED', async () => {
    mocks.getById = async () => makeLink({ status: 'Cancelled' });

    await assert.rejects(
      () => getPublicConsultationLinkById('link-uuid-001'),
      (err: unknown) => {
        assert.ok(err instanceof ConsultationLinkServiceError);
        assert.equal(err.status, 410);
        assert.equal(err.code, 'LINK_CANCELLED');
        assert.equal(err.statusValue, 'Cancelled');
        return true;
      },
    );
  });
});

// ── Open link (happy path) ────────────────────────────────────────────────────

describe('Open link — happy path', () => {
  test('returns status Open and deal_id null when no deal exists', async () => {
    mocks.getById = async () => makeLink({ status: 'Open' });
    // mocks.getByConsultationLinkId already returns null

    const result = await getPublicConsultationLinkById('link-uuid-001');

    assert.equal(result.status, 'Open');
    assert.equal(result.deal_id, null);
    assert.equal(result.id, 'link-uuid-001');
    assert.equal(result.meeting_url_revealed, false);
  });

  test('returns status Open and deal_id when deal exists', async () => {
    const deal = makeDeal({ id: 'deal-uuid-999' });
    mocks.getById = async () => makeLink({ status: 'Open' });
    mocks.getByConsultationLinkId = async () => deal;

    const result = await getPublicConsultationLinkById('link-uuid-001');

    assert.equal(result.status, 'Open');
    assert.equal(result.deal_id, 'deal-uuid-999');
  });
});

// ── Consumed link (key change: now returns 200, not 410) ──────────────────────

describe('Consumed link — returns 200 (key change)', () => {
  test('returns status Consumed with deal_id when deal is indexed', async () => {
    const deal = makeDeal({ id: 'deal-uuid-999' });
    mocks.getById = async () => makeLink({ status: 'Consumed' });
    mocks.getByConsultationLinkId = async () => deal;

    const result = await getPublicConsultationLinkById('link-uuid-001');

    assert.equal(result.status, 'Consumed');
    assert.equal(result.deal_id, 'deal-uuid-999');
    assert.equal(result.meeting_url_revealed, false);
  });

  test('returns status Consumed with deal_id null when deal not yet indexed', async () => {
    mocks.getById = async () => makeLink({ status: 'Consumed' });
    // mocks.getByConsultationLinkId returns null (deal not indexed yet)

    const result = await getPublicConsultationLinkById('link-uuid-001');

    assert.equal(result.status, 'Consumed');
    assert.equal(result.deal_id, null);
  });

  test('Consumed link ignores expires_at — stays 200 even when expires_at is in the past', async () => {
    const deal = makeDeal({ id: 'deal-uuid-999' });
    mocks.getById = async () => makeLink({ status: 'Consumed', expires_at: PAST });
    mocks.getByConsultationLinkId = async () => deal;

    const result = await getPublicConsultationLinkById('link-uuid-001');

    // resolvePublicStatus only converts *Open* links to Expired; Consumed stays Consumed
    assert.equal(result.status, 'Consumed');
    assert.equal(result.deal_id, 'deal-uuid-999');
  });
});

// ── Repository error handling ─────────────────────────────────────────────────

describe('repository errors', () => {
  test('wraps ConsultationLinksRepositoryError from getById as 500', async () => {
    const { ConsultationLinksRepositoryError: RepoErr } = mocks;
    mocks.getById = async () => { throw new RepoErr('DB error', '42P01'); };

    await assert.rejects(
      () => getPublicConsultationLinkById('link-uuid-001'),
      (err: unknown) => {
        assert.ok(err instanceof ConsultationLinkServiceError);
        assert.equal(err.status, 500);
        return true;
      },
    );
  });

  test('wraps DealsRepositoryError from getByConsultationLinkId as 500', async () => {
    const { DealsRepositoryError: RepoErr } = mocks;
    mocks.getById = async () => makeLink({ status: 'Open' });
    mocks.getByConsultationLinkId = async () => { throw new RepoErr('DB error', '42P01'); };

    await assert.rejects(
      () => getPublicConsultationLinkById('link-uuid-001'),
      (err: unknown) => {
        assert.ok(err instanceof ConsultationLinkServiceError);
        assert.equal(err.status, 500);
        return true;
      },
    );
  });

  test('re-throws unknown errors from getById unchanged', async () => {
    const boom = new Error('unexpected network failure');
    mocks.getById = async () => { throw boom; };

    await assert.rejects(
      () => getPublicConsultationLinkById('link-uuid-001'),
      (err: unknown) => {
        assert.strictEqual(err, boom);
        return true;
      },
    );
  });
});

// ── Response shape ────────────────────────────────────────────────────────────

describe('response shape', () => {
  test('maps all expected fields from the link row', async () => {
    const link = makeLink({
      status: 'Open',
      id: 'link-uuid-001',
      title: 'My Consult',
      description: 'Details here',
      price_usdc: '250.00',
      expert_address: '0xExpert',
      timezone: 'America/New_York',
      duration_minutes: 60,
      grace_period_minutes: 15,
      scheduled_at: FUTURE,
      expires_at: FUTURE,
    });
    mocks.getById = async () => link;

    const result = await getPublicConsultationLinkById('link-uuid-001');

    assert.equal(result.id, 'link-uuid-001');
    assert.equal(result.title, 'My Consult');
    assert.equal(result.description, 'Details here');
    assert.equal(result.price_usdc, '250.00');
    assert.equal(result.seller_address, '0xExpert');
    assert.equal(result.timezone, 'America/New_York');
    assert.equal(result.duration_minutes, 60);
    assert.equal(result.grace_period_minutes, 15);
    assert.equal(result.scheduled_at, FUTURE);
    assert.equal(result.expires_at, FUTURE);
    assert.equal(result.meeting_url_revealed, false);
    assert.equal(result.deal_id, null);
  });
});
