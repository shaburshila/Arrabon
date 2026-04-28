import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "@/lib/api/auth";
import {
  addAdminDenylistEntry,
  fetchAdminDealCompliance,
  fetchAdminDenylist,
  removeAdminDenylistEntry,
} from "@/lib/api/admin";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe("admin api wrappers", () => {
  test("fetches admin deal compliance detail", async () => {
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          checks: [],
          compliance_summary: { checks_count: 0 },
          deal_id: "deal-id-1",
          risk_status: "Clear",
        }),
        { status: 200 },
      );

    const result = await fetchAdminDealCompliance("deal-id-1");

    assert.equal(result.deal_id, "deal-id-1");
    assert.equal(result.risk_status, "Clear");
  });

  test("fetches denylist entries with pagination", async () => {
    global.fetch = async (input) => {
      assert.match(String(input), /limit=10/);
      assert.match(String(input), /offset=20/);
      return new Response(JSON.stringify([{ wallet: "0xabc" }]), { status: 200 });
    };

    const result = await fetchAdminDenylist({ limit: 10, offset: 20 });

    assert.equal(result.length, 1);
    assert.equal(result[0].wallet, "0xabc");
  });

  test("posts a denylist add request", async () => {
    global.fetch = async (_input, init) => {
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        notes: null,
        reason: "fraud",
        wallet: "0xabc",
      });
      return new Response(JSON.stringify({ wallet: "0xabc" }), { status: 200 });
    };

    const result = await addAdminDenylistEntry({
      notes: null,
      reason: "fraud",
      wallet: "0xabc",
    });

    assert.equal(result.wallet, "0xabc");
  });

  test("deletes a denylist entry with mandatory comment", async () => {
    global.fetch = async (_input, init) => {
      assert.equal(init?.method, "DELETE");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        comment: "cleanup",
      });
      return new Response(JSON.stringify({ removed_wallet: "0xabc" }), { status: 200 });
    };

    const result = await removeAdminDenylistEntry("0xabc", { comment: "cleanup" });

    assert.equal(result.removed_wallet, "0xabc");
  });

  test("throws ApiError on non-2xx responses", async () => {
    global.fetch = async () =>
      new Response(JSON.stringify({ error: "Access denied." }), { status: 403 });

    await assert.rejects(
      () => fetchAdminDealCompliance("deal-id-1"),
      (error) => error instanceof ApiError && error.status === 403,
    );
  });
});
