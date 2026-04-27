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

require.cache[require.resolve("server-only")] = makeEntry("server-only", {});

interface WalletDenylistRepoMocks {
  calls: {
    delete: number;
    eq: Array<[string, unknown]>;
    from: string[];
    insert: unknown[];
    order: Array<[string, { ascending: boolean }]>;
    range: Array<[number, number]>;
    schema: string[];
    select: string[];
    single: number;
  };
  maybeSingleResult: { data: unknown; error: unknown };
  reset: () => void;
  selectResult: { data: unknown[] | null; error: unknown };
  singleResult: { data: unknown; error: unknown };
}

const mocks: WalletDenylistRepoMocks = {
  calls: {
    delete: 0,
    eq: [],
    from: [],
    insert: [],
    order: [],
    range: [],
    schema: [],
    select: [],
    single: 0,
  },
  maybeSingleResult: { data: null, error: null },
  reset() {
    this.calls = {
      delete: 0,
      eq: [],
      from: [],
      insert: [],
      order: [],
      range: [],
      schema: [],
      select: [],
      single: 0,
    };
    this.maybeSingleResult = {
      data: {
        wallet: "0xabc",
        reason: "fraud",
        added_by_wallet: "0xadmin",
        added_at: "2026-04-27T00:00:00.000Z",
        notes: null,
      },
      error: null,
    };
    this.selectResult = {
      data: [],
      error: null,
    };
    this.singleResult = {
      data: {
        wallet: "0xabc",
        reason: "fraud",
        added_by_wallet: "0xadmin",
        added_at: "2026-04-27T00:00:00.000Z",
        notes: null,
      },
      error: null,
    };
  },
  selectResult: { data: [], error: null },
  singleResult: { data: null, error: null },
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
    select(columns: string) {
      mode = "select";
      mocks.calls.select.push(columns);
      return this;
    },
    insert(payload: unknown) {
      mode = "insert";
      mocks.calls.insert.push(payload);
      return this;
    },
    delete() {
      mode = "delete";
      mocks.calls.delete += 1;
      return this;
    },
    eq(column: string, value: unknown) {
      mocks.calls.eq.push([column, value]);
      if (mode === "delete") {
        return Promise.resolve({ error: null });
      }
      return this;
    },
    order(column: string, options: { ascending: boolean }) {
      mocks.calls.order.push([column, options]);
      return this;
    },
    range(from: number, to: number) {
      mocks.calls.range.push([from, to]);
      return Promise.resolve(mocks.selectResult);
    },
    async single() {
      mocks.calls.single += 1;
      return mocks.singleResult;
    },
    async maybeSingle() {
      return mocks.maybeSingleResult;
    },
  };
}

(require.cache as Record<string, unknown>)[dbServerPath] = makeEntry(dbServerPath, {
  getServerDbClient: () => makeQueryBuilder(),
});

const {
  add,
  existsByWallet,
  findByWallet,
  list,
  remove,
} = require("../../server/repositories/wallet-denylist");

beforeEach(() => {
  mocks.reset();
});

describe("wallet-denylist repository", () => {
  test("findByWallet lowercases wallet for lookup", async () => {
    await findByWallet("0xABC");

    assert.deepEqual(mocks.calls.eq, [["wallet", "0xabc"]]);
  });

  test("existsByWallet is a thin wrapper over findByWallet", async () => {
    const exists = await existsByWallet("0xABC");

    assert.equal(exists, true);
    assert.deepEqual(mocks.calls.eq, [["wallet", "0xabc"]]);
  });

  test("add normalizes wallet fields and inserts a new row", async () => {
    await add({
      addedByWallet: "0xADMIN",
      notes: "reason",
      reason: "fraud",
      wallet: "0xABC",
    });

    assert.deepEqual(mocks.calls.insert[0], {
      added_by_wallet: "0xadmin",
      notes: "reason",
      reason: "fraud",
      wallet: "0xabc",
    });
  });

  test("remove deletes by normalized wallet", async () => {
    await remove("0xABC");

    assert.equal(mocks.calls.delete, 1);
    assert.deepEqual(mocks.calls.eq, [["wallet", "0xabc"]]);
  });

  test("list orders by added_at descending", async () => {
    await list();

    assert.deepEqual(mocks.calls.order, [["added_at", { ascending: false }]]);
  });

  test("list applies pagination range", async () => {
    await list({ limit: 10, offset: 20 });

    assert.deepEqual(mocks.calls.range, [[20, 29]]);
  });
});
