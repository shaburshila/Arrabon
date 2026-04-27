import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

function makeEntry(id: string, exports: unknown) {
  return {
    id,
    filename: id,
    loaded: true,
    exports,
    paths: [],
    parent: null,
    children: [],
  } as any;
}

const dbServerPath = path.resolve(__dirname, "../../lib/db/server.ts");

interface ComplianceChecksRepoMocks {
  calls: {
    eq: Array<[string, unknown]>;
    from: string[];
    insert: unknown[];
    order: Array<[string, { ascending: boolean }]>;
    schema: string[];
    select: string[];
    single: number;
  };
  reset: () => void;
  singleResult: { data: unknown; error: unknown };
  selectResult: { data: unknown[] | null; error: unknown };
}

const mocks: ComplianceChecksRepoMocks = {
  calls: {
    eq: [],
    from: [],
    insert: [],
    order: [],
    schema: [],
    select: [],
    single: 0,
  },
  reset() {
    this.calls = {
      eq: [],
      from: [],
      insert: [],
      order: [],
      schema: [],
      select: [],
      single: 0,
    };
    this.singleResult = {
      data: {
        id: "check-id-1",
        actor_wallet: null,
        checked_at: "2026-04-27T00:00:00.000Z",
        deal_id: "deal-id-1",
        provider: "chainalysis_sanctions_oracle",
        raw_summary: {},
        reason_code: "NO_HIT",
        result: "Clear",
        subject_type: "wallet",
        subject_value: "0xabc",
      },
      error: null,
    };
    this.selectResult = {
      data: [],
      error: null,
    };
  },
  singleResult: { data: null, error: null },
  selectResult: { data: [], error: null },
};

function makeQueryBuilder() {
  let mode: "delete" | "insert" | "select" | null = null;

  return {
    from(table: string) {
      mocks.calls.from.push(table);
      return this;
    },
    schema(schemaName: string) {
      mocks.calls.schema.push(schemaName);
      return this;
    },
    insert(payload: unknown) {
      mode = "insert";
      mocks.calls.insert.push(payload);
      return this;
    },
    select(columns: string) {
      mode = "select";
      mocks.calls.select.push(columns);
      return this;
    },
    eq(column: string, value: unknown) {
      mocks.calls.eq.push([column, value]);
      return this;
    },
    order(column: string, options: { ascending: boolean }) {
      mocks.calls.order.push([column, options]);
      return Promise.resolve(mocks.selectResult);
    },
    async single() {
      mocks.calls.single += 1;
      return mocks.singleResult;
    },
  };
}

(require.cache as Record<string, unknown>)[dbServerPath] = makeEntry(dbServerPath, {
  getServerDbClient: () => makeQueryBuilder(),
});

const {
  createComplianceCheck,
  findByDeal,
  findBySubject,
} = require("../../server/repositories/compliance-checks");

beforeEach(() => {
  mocks.reset();
});

describe("compliance-checks repository", () => {
  test("normalizes subject_value to lowercase on insert", async () => {
    await createComplianceCheck({
      actorWallet: null,
      dealId: "deal-id-1",
      provider: "chainalysis_sanctions_oracle",
      reasonCode: "NO_HIT",
      result: "Clear",
      subjectType: "wallet",
      subjectValue: "0xABC",
    });

    assert.deepEqual(mocks.calls.insert[0], {
      actor_wallet: null,
      checked_at: undefined,
      deal_id: "deal-id-1",
      provider: "chainalysis_sanctions_oracle",
      raw_summary: {},
      reason_code: "NO_HIT",
      result: "Clear",
      subject_type: "wallet",
      subject_value: "0xabc",
    });
  });

  test("findBySubject lowercases wallet and orders by checked_at ascending", async () => {
    await findBySubject("wallet", "0xABC");

    assert.deepEqual(mocks.calls.eq, [
      ["subject_type", "wallet"],
      ["subject_value", "0xabc"],
    ]);
    assert.deepEqual(mocks.calls.order, [["checked_at", { ascending: true }]]);
  });

  test("findByDeal filters by deal_id and orders by checked_at ascending", async () => {
    await findByDeal("deal-id-1");

    assert.deepEqual(mocks.calls.eq, [["deal_id", "deal-id-1"]]);
    assert.deepEqual(mocks.calls.order, [["checked_at", { ascending: true }]]);
  });
});
