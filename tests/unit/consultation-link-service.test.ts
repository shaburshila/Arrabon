/**
 * Unit tests for getPublicConsultationLinkById in server/services/consultation-links.ts.
 *
 * What is tested:
 *   - Open link (no deal)     → 200, status "Open",     deal_id null
 *   - Open link (deal exists) → 200, status "Consumed", deal_id set
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
  createConsultationLink,
  getPublicConsultationLinkById,
  listMyConsultationLinks,
  ConsultationLinkServiceError,
} from '../../server/services/consultation-links';

// ── Typed access to the mutable mock state set up by setup-services.cjs ─────

interface ServiceMocks {
  assertCompliance: (...args: unknown[]) => void;
  createLink: (...args: unknown[]) => Promise<{ id: string; link_hash: string }>;
  getAllByCreatorUserId: (...args: unknown[]) => Promise<ConsultationLinkRow[]>;
  getById: (id: string) => Promise<ConsultationLinkRow | null>;
  getByCreatorUserId: (...args: unknown[]) => Promise<ConsultationLinkRow[]>;
  getByConsultationLinkId: (id: string) => Promise<DealRow | null>;
  getByConsultationLinkIds: (ids: readonly string[]) => Promise<DealRow[]>;
  screenWalletForDeal: (...args: unknown[]) => Promise<{
    normalizedWallet: string;
    provider: string | null;
    rawSummary: Record<string, unknown>;
    reasonCode: string;
    result: string;
    walletAddress: string;
  }>;
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

const currentUser = {
  avatar_url: null,
  expires_at: FUTURE,
  id: 'user-uuid-001',
  is_admin: false,
  username: null,
  wallet_address: '0xExpertAddress',
};

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
    risk_status: 'Clear',
    funded_at: new Date().toISOString(),
    completed_at: null,
    released_at: null,
    resolution_type: null,
    resolved_at: null,
    resolved_by_wallet: null,
    resolved_from_status: null,
    tx_hash: '0x' + 'b'.repeat(64),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ── Reset mocks before each test ─────────────────────────────────────────────

beforeEach(() => {
  mocks.assertCompliance = () => undefined;
  mocks.createLink = async () => ({
    id: 'link-uuid-created',
    link_hash: '0x' + 'c'.repeat(64),
  });
  mocks.getAllByCreatorUserId = async () => [];
  mocks.getById = async () => null;
  mocks.getByCreatorUserId = async () => [];
  mocks.getByConsultationLinkId = async () => null;
  mocks.getByConsultationLinkIds = async () => [];
  mocks.screenWalletForDeal = async () => ({
    normalizedWallet: currentUser.wallet_address.toLowerCase(),
    provider: null,
    rawSummary: { providerResults: [] },
    reasonCode: 'NO_HIT',
    result: 'Clear',
    walletAddress: currentUser.wallet_address,
  });
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

  test('returns status Consumed and deal_id when DB status is Expired but deal exists', async () => {
    const deal = makeDeal({ id: 'deal-uuid-999' });
    mocks.getById = async () => makeLink({ status: 'Expired', expires_at: PAST });
    mocks.getByConsultationLinkId = async () => deal;

    const result = await getPublicConsultationLinkById('link-uuid-001');

    assert.equal(result.status, 'Consumed');
    assert.equal(result.deal_id, 'deal-uuid-999');
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

  test('throws 410 LINK_EXPIRED when now equals expires_at exactly', async () => {
    const expiresAt = new Date().toISOString();
    mocks.getById = async () => makeLink({ status: 'Open', expires_at: expiresAt });

    await assert.rejects(
      () => getPublicConsultationLinkById('link-uuid-001', new Date(expiresAt)),
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

  test('returns status Consumed and deal_id when deal exists', async () => {
    const deal = makeDeal({ id: 'deal-uuid-999' });
    mocks.getById = async () => makeLink({ status: 'Open' });
    mocks.getByConsultationLinkId = async () => deal;

    const result = await getPublicConsultationLinkById('link-uuid-001');

    assert.equal(result.status, 'Consumed');
    assert.equal(result.deal_id, 'deal-uuid-999');
  });

  test('returns status Consumed and deal_id when Open link expired after deal indexing', async () => {
    const deal = makeDeal({ id: 'deal-uuid-999' });
    mocks.getById = async () => makeLink({ status: 'Open', expires_at: PAST });
    mocks.getByConsultationLinkId = async () => deal;

    const result = await getPublicConsultationLinkById('link-uuid-001');

    assert.equal(result.status, 'Consumed');
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
    assert.equal(result.scheduled_at, FUTURE);
    assert.equal(result.expires_at, FUTURE);
    assert.equal(result.meeting_url_revealed, false);
    assert.equal(result.deal_id, null);
  });
});

// ── Seller link list ─────────────────────────────────────────────────────────

describe('listMyConsultationLinks', () => {
  test('loads all seller links before applying pagination', async () => {
    let receivedArgs: unknown[] = [];
    mocks.getAllByCreatorUserId = async (...args) => {
      receivedArgs = args;
      return [];
    };

    await listMyConsultationLinks(currentUser, new Date(FUTURE), { limit: 25, offset: 50 });

    assert.deepEqual(receivedArgs, ['user-uuid-001']);
  });

  test('returns Expired for a time-expired Open link when a deal exists', async () => {
    const link = makeLink({
      expires_at: PAST,
      id: 'link-uuid-001',
      status: 'Open',
    });
    const deal = makeDeal({
      consultation_link_id: link.id,
      id: 'deal-uuid-999',
    });

    mocks.getAllByCreatorUserId = async () => [link];
    mocks.getByConsultationLinkIds = async (ids) => {
      assert.deepEqual(ids, ['link-uuid-001']);
      return [deal];
    };

    const result = await listMyConsultationLinks(currentUser);

    assert.equal(result.length, 1);
    assert.equal(result[0].deal_id, 'deal-uuid-999');
    assert.equal(result[0].deal_status, 'Funded');
    assert.equal(result[0].status, 'Expired');
    assert.equal(result[0].share_url, '/deal/deal-uuid-999');
  });

  test('returns the real deal status when an existing deal is already released', async () => {
    const link = makeLink({
      expires_at: PAST,
      id: 'link-uuid-001',
      status: 'Open',
    });
    const deal = makeDeal({
      consultation_link_id: link.id,
      id: 'deal-uuid-999',
      resolution_type: 'admin_release',
      resolved_at: '2026-04-12T12:00:00.000Z',
      resolved_from_status: 'Disputed',
      status: 'Released',
    });

    mocks.getAllByCreatorUserId = async () => [link];
    mocks.getByConsultationLinkIds = async () => [deal];

    const result = await listMyConsultationLinks(currentUser);

    assert.equal(result.length, 1);
    assert.equal(result[0].deal_id, 'deal-uuid-999');
    assert.equal(result[0].deal_resolution_type, 'admin_release');
    assert.equal(result[0].deal_resolved_at, '2026-04-12T12:00:00.000Z');
    assert.equal(result[0].deal_resolved_from_status, 'Disputed');
    assert.equal(result[0].deal_status, 'Released');
    assert.equal(result[0].status, 'Expired');
    assert.equal(result[0].share_url, '/deal/deal-uuid-999');
  });

  test('returns Cancelled for a raw Cancelled link when a deal exists', async () => {
    const link = makeLink({
      id: 'link-uuid-001',
      status: 'Cancelled',
    });
    const deal = makeDeal({
      consultation_link_id: link.id,
      id: 'deal-uuid-999',
    });

    mocks.getAllByCreatorUserId = async () => [link];
    mocks.getByConsultationLinkIds = async () => [deal];

    const result = await listMyConsultationLinks(currentUser);

    assert.equal(result.length, 1);
    assert.equal(result[0].deal_id, 'deal-uuid-999');
    assert.equal(result[0].deal_status, 'Funded');
    assert.equal(result[0].status, 'Cancelled');
    assert.equal(result[0].share_url, '/deal/deal-uuid-999');
  });

  test('returns Expired for a raw Expired link when a deal exists', async () => {
    const link = makeLink({
      expires_at: PAST,
      id: 'link-uuid-001',
      status: 'Expired',
    });
    const deal = makeDeal({
      consultation_link_id: link.id,
      id: 'deal-uuid-999',
    });

    mocks.getAllByCreatorUserId = async () => [link];
    mocks.getByConsultationLinkIds = async () => [deal];

    const result = await listMyConsultationLinks(currentUser);

    assert.equal(result.length, 1);
    assert.equal(result[0].deal_id, 'deal-uuid-999');
    assert.equal(result[0].deal_status, 'Funded');
    assert.equal(result[0].status, 'Expired');
    assert.equal(result[0].share_url, '/deal/deal-uuid-999');
  });

  test('returns Expired for a time-expired Open link when no deal exists', async () => {
    mocks.getAllByCreatorUserId = async () => [
      makeLink({
        expires_at: PAST,
        id: 'link-uuid-001',
        status: 'Open',
      }),
    ];
    mocks.getByConsultationLinkIds = async () => [];

    const result = await listMyConsultationLinks(currentUser);

    assert.equal(result.length, 1);
    assert.equal(result[0].deal_id, null);
    assert.equal(result[0].deal_status, null);
    assert.equal(result[0].status, 'Expired');
    assert.equal(result[0].share_url, '/link/link-uuid-001');
  });

  test('applies filter before pagination for available links', async () => {
    const futureAfterNow = new Date(Date.now() + 2 * 60 * 60 * 1_000).toISOString();
    const closedDealLinks = Array.from({ length: 20 }, (_, index) =>
      makeLink({ expires_at: futureAfterNow, id: `closed-link-${index}`, status: 'Open' }),
    );
    const availableLink = makeLink({ expires_at: futureAfterNow, id: 'available-link-1', status: 'Open' });
    const moreAvailableLink = makeLink({ expires_at: futureAfterNow, id: 'available-link-2', status: 'Open' });

    mocks.getAllByCreatorUserId = async () => [
      ...closedDealLinks,
      availableLink,
      moreAvailableLink,
    ];
    mocks.getByConsultationLinkIds = async (ids) => {
      return ids
        .filter((id) => String(id).startsWith('closed-link-'))
        .map((id) =>
          makeDeal({
            consultation_link_id: String(id),
            id: `deal-for-${id}`,
            status: 'Released',
          }),
        );
    };

    const result = await listMyConsultationLinks(
      currentUser,
      new Date(FUTURE),
      { limit: 20, offset: 0 },
      'available',
    );

    assert.equal(result.length, 2);
    assert.deepEqual(result.map((item) => item.id), ['available-link-1', 'available-link-2']);
  });

  test('returns only upcoming links for upcoming filter', async () => {
    const upcomingLink = makeLink({ id: 'link-upcoming' });
    const awaitingLink = makeLink({ id: 'link-awaiting' });
    const disputedLink = makeLink({ id: 'link-disputed' });

    mocks.getAllByCreatorUserId = async () => [upcomingLink, awaitingLink, disputedLink];
    mocks.getByConsultationLinkIds = async () => [
      makeDeal({ consultation_link_id: 'link-upcoming', id: 'deal-upcoming', status: 'Funded' }),
      makeDeal({ consultation_link_id: 'link-awaiting', id: 'deal-awaiting', status: 'ConfirmPending' }),
      makeDeal({ consultation_link_id: 'link-disputed', id: 'deal-disputed', status: 'Disputed' }),
    ];

    const result = await listMyConsultationLinks(
      currentUser,
      new Date(FUTURE),
      undefined,
      'upcoming',
    );

    assert.deepEqual(result.map((item) => item.id), ['link-upcoming']);
    assert.equal(result[0].deal_status, 'Funded');
  });

  test('returns only awaiting buyer links for awaiting_buyer filter', async () => {
    mocks.getAllByCreatorUserId = async () => [
      makeLink({ id: 'link-awaiting' }),
      makeLink({ id: 'link-disputed' }),
    ];
    mocks.getByConsultationLinkIds = async () => [
      makeDeal({ consultation_link_id: 'link-awaiting', id: 'deal-awaiting', status: 'ConfirmPending' }),
      makeDeal({ consultation_link_id: 'link-disputed', id: 'deal-disputed', status: 'Disputed' }),
    ];

    const result = await listMyConsultationLinks(
      currentUser,
      new Date(FUTURE),
      undefined,
      'awaiting_buyer',
    );

    assert.deepEqual(result.map((item) => item.id), ['link-awaiting']);
    assert.equal(result[0].deal_status, 'ConfirmPending');
  });

  test('returns only disputed links for disputed filter', async () => {
    mocks.getAllByCreatorUserId = async () => [
      makeLink({ id: 'link-disputed' }),
      makeLink({ id: 'link-closed' }),
    ];
    mocks.getByConsultationLinkIds = async () => [
      makeDeal({ consultation_link_id: 'link-disputed', id: 'deal-disputed', status: 'Disputed' }),
      makeDeal({ consultation_link_id: 'link-closed', id: 'deal-closed', status: 'Released' }),
    ];

    const result = await listMyConsultationLinks(
      currentUser,
      new Date(FUTURE),
      undefined,
      'disputed',
    );

    assert.deepEqual(result.map((item) => item.id), ['link-disputed']);
    assert.equal(result[0].deal_status, 'Disputed');
  });

  test('returns only closed links for closed filter', async () => {
    mocks.getAllByCreatorUserId = async () => [
      makeLink({ id: 'link-released' }),
      makeLink({ id: 'link-refunded' }),
      makeLink({ id: 'link-upcoming' }),
    ];
    mocks.getByConsultationLinkIds = async () => [
      makeDeal({ consultation_link_id: 'link-released', id: 'deal-released', status: 'Released' }),
      makeDeal({ consultation_link_id: 'link-refunded', id: 'deal-refunded', status: 'Refunded', resolution_type: 'admin_refund' }),
      makeDeal({ consultation_link_id: 'link-upcoming', id: 'deal-upcoming', status: 'Funded' }),
    ];

    const result = await listMyConsultationLinks(
      currentUser,
      new Date(FUTURE),
      undefined,
      'closed',
    );

    assert.deepEqual(result.map((item) => item.id), ['link-released', 'link-refunded']);
  });

  test('returns only inactive links for inactive filter', async () => {
    mocks.getAllByCreatorUserId = async () => [
      makeLink({ id: 'link-expired', status: 'Open', expires_at: PAST }),
      makeLink({ id: 'link-cancelled', status: 'Cancelled' }),
      makeLink({ id: 'link-booked-expired', status: 'Expired', expires_at: PAST }),
    ];
    mocks.getByConsultationLinkIds = async () => [
      makeDeal({ consultation_link_id: 'link-booked-expired', id: 'deal-booked-expired', status: 'Funded' }),
    ];

    const result = await listMyConsultationLinks(
      currentUser,
      new Date(FUTURE),
      undefined,
      'inactive',
    );

    assert.deepEqual(result.map((item) => item.id), ['link-expired', 'link-cancelled']);
  });
});

describe('createConsultationLink compliance gate', () => {
  const createInput = {
    title: 'Paid consult',
    description: 'desc',
    priceUsdc: '100.00',
    scheduledAt: new Date(FUTURE),
    timezone: 'UTC',
    durationMinutes: 30,
    expiresAt: new Date(FUTURE),
    meetingUrl: 'https://meet.example.com/room',
  };

  test('screens once before retry loop with dealId null and creates link on Clear', async () => {
    const screeningCalls: unknown[][] = [];
    const assertCalls: unknown[][] = [];
    let createCalls = 0;

    mocks.screenWalletForDeal = async (...args) => {
      screeningCalls.push(args);
      return {
        normalizedWallet: currentUser.wallet_address.toLowerCase(),
        provider: null,
        rawSummary: { providerResults: [] },
        reasonCode: 'NO_HIT',
        result: 'Clear',
        walletAddress: currentUser.wallet_address,
      };
    };
    mocks.assertCompliance = (...args) => {
      assertCalls.push(args);
    };
    mocks.createLink = async () => {
      createCalls += 1;
      return {
        id: 'link-uuid-created',
        link_hash: '0x' + 'c'.repeat(64),
      };
    };

    const result = await createConsultationLink(currentUser, createInput);

    assert.equal(result.id, 'link-uuid-created');
    assert.equal(screeningCalls.length, 1);
    assert.equal(assertCalls.length, 1);
    assert.equal(createCalls, 1);
    assert.deepEqual(screeningCalls[0], [
      currentUser.wallet_address,
      {
        action: 'link_create',
        actorWallet: currentUser.wallet_address,
        dealId: null,
      },
    ]);
  });

  test('does not rescreen when first createLink attempt hits hash collision', async () => {
    let screeningCalls = 0;
    let createCalls = 0;
    const { ConsultationLinksRepositoryError: RepoErr } = mocks;

    mocks.screenWalletForDeal = async () => {
      screeningCalls += 1;
      return {
        normalizedWallet: currentUser.wallet_address.toLowerCase(),
        provider: null,
        rawSummary: { providerResults: [] },
        reasonCode: 'NO_HIT',
        result: 'Clear',
        walletAddress: currentUser.wallet_address,
      };
    };
    mocks.createLink = async () => {
      createCalls += 1;
      if (createCalls === 1) {
        throw new RepoErr('duplicate', '23505');
      }

      return {
        id: 'link-uuid-created',
        link_hash: '0x' + 'c'.repeat(64),
      };
    };

    const result = await createConsultationLink(currentUser, createInput);

    assert.equal(result.id, 'link-uuid-created');
    assert.equal(screeningCalls, 1);
    assert.equal(createCalls, 2);
  });

  test('stops before createLink when assertCompliance blocks OFAC hit', async () => {
    let createCalls = 0;
    const blockedError = new Error('blocked');

    mocks.screenWalletForDeal = async () => ({
      normalizedWallet: currentUser.wallet_address.toLowerCase(),
      provider: 'chainalysis_sanctions_oracle',
      rawSummary: { providerResults: [] },
      reasonCode: 'OFAC_SANCTIONS',
      result: 'Blocked',
      walletAddress: currentUser.wallet_address,
    });
    mocks.assertCompliance = () => {
      throw blockedError;
    };
    mocks.createLink = async () => {
      createCalls += 1;
      return {
        id: 'link-uuid-created',
        link_hash: '0x' + 'c'.repeat(64),
      };
    };

    await assert.rejects(() => createConsultationLink(currentUser, createInput), blockedError);
    assert.equal(createCalls, 0);
  });

  test('stops before createLink when compliance provider is unavailable', async () => {
    let createCalls = 0;
    const blockedError = new Error('provider unavailable');

    mocks.screenWalletForDeal = async () => ({
      normalizedWallet: currentUser.wallet_address.toLowerCase(),
      provider: 'chainalysis_sanctions_oracle',
      rawSummary: { providerResults: [] },
      reasonCode: 'PROVIDER_UNAVAILABLE',
      result: 'Blocked',
      walletAddress: currentUser.wallet_address,
    });
    mocks.assertCompliance = () => {
      throw blockedError;
    };
    mocks.createLink = async () => {
      createCalls += 1;
      return {
        id: 'link-uuid-created',
        link_hash: '0x' + 'c'.repeat(64),
      };
    };

    await assert.rejects(() => createConsultationLink(currentUser, createInput), blockedError);
    assert.equal(createCalls, 0);
  });

  test('allows defensive Review to pass through', async () => {
    mocks.screenWalletForDeal = async () => ({
      normalizedWallet: currentUser.wallet_address.toLowerCase(),
      provider: 'local_denylist',
      rawSummary: { providerResults: [] },
      reasonCode: 'FRAUD_SIGNAL',
      result: 'Review',
      walletAddress: currentUser.wallet_address,
    });

    const result = await createConsultationLink(currentUser, createInput);

    assert.equal(result.status, 'Open');
  });
});
