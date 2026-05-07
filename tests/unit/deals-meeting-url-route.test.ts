import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import { GET } from "../../app/api/deals/[id]/meeting-url/route";

interface DealsMeetingUrlRouteMocks {
  countRecentSecurityRequestAttempts: (...args: unknown[]) => Promise<number>;
  createAuditLogEntry: (...args: unknown[]) => Promise<unknown>;
  createSecurityRequestAttempt: (...args: unknown[]) => Promise<unknown>;
  deleteExpiredSecurityRequestAttempts: (...args: unknown[]) => Promise<void>;
  parseDealRouteParams: (...args: unknown[]) => { dealId: string };
  requireUser: (...args: unknown[]) => Promise<{
    avatar_url: null;
    expires_at: string;
    id: string;
    is_admin: boolean;
    username: null;
    wallet_address: string;
  }>;
  revealMeetingUrlForDeal: (...args: unknown[]) => Promise<unknown>;
}

const mocks = (global as typeof globalThis & { __dealsMeetingUrlRouteMocks: DealsMeetingUrlRouteMocks })
  .__dealsMeetingUrlRouteMocks;
const AuthGuardError = (
  global as typeof globalThis & {
    __dealsMeetingUrlRouteAuthGuardError: new (message: string, status: number) => Error;
  }
).__dealsMeetingUrlRouteAuthGuardError;

beforeEach(() => {
  mocks.countRecentSecurityRequestAttempts = async () => 0;
  mocks.createAuditLogEntry = async () => ({});
  mocks.createSecurityRequestAttempt = async () => ({
    id: "attempt-id-1",
  });
  mocks.deleteExpiredSecurityRequestAttempts = async () => {};
  mocks.parseDealRouteParams = () => ({
    dealId: "deal-id-1",
  });
  mocks.requireUser = async () => ({
    avatar_url: null,
    expires_at: "2026-04-28T00:00:00.000Z",
    id: "user-id-1",
    is_admin: false,
    username: null,
    wallet_address: "0x00000000000000000000000000000000000000AA",
  });
  mocks.revealMeetingUrlForDeal = async () => ({
    meeting_url: "https://example.com/meeting",
  });
});

test("returns 429 and skips reveal service when meeting-url rate limit is exceeded", async () => {
  let revealCalled = false;
  mocks.countRecentSecurityRequestAttempts = async () => 10;
  mocks.revealMeetingUrlForDeal = async () => {
    revealCalled = true;
    return {
      meeting_url: "https://example.com/meeting",
    };
  };

  const response = await GET(new Request("http://localhost"), {
    params: Promise.resolve({ id: "deal-id-1" }),
  });

  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), {
    error: "Too many meeting URL reveal attempts. Please try again later.",
  });
  assert.equal(revealCalled, false);
});

test("unauthenticated branch still logs audit attempt and returns auth error", async () => {
  let auditCalled = false;
  mocks.requireUser = async () => {
    throw new AuthGuardError("Authentication required.", 401);
  };
  mocks.createAuditLogEntry = async () => {
    auditCalled = true;
    return {};
  };

  const response = await GET(new Request("http://localhost"), {
    params: Promise.resolve({ id: "deal-id-1" }),
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Authentication required.",
  });
  assert.equal(auditCalled, true);
});
