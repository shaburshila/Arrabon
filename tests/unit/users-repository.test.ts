import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  getOrCreateUser,
  UsersRepositoryError,
} from "../../server/repositories/users";

interface UsersRepositoryMocks {
  calls: {
    from: unknown[];
    schema: unknown[];
    select: unknown[];
    single: number;
    upsert: unknown[];
  };
  reset: () => void;
  singleResult: {
    data: unknown;
    error: unknown;
  };
}

const mocks = (global as typeof globalThis & { __usersRepositoryMocks: UsersRepositoryMocks })
  .__usersRepositoryMocks;

const WALLET = "0x0000000000000000000000000000000000000001";

beforeEach(() => {
  mocks.reset();
});

describe("users repository", () => {
  test("atomically gets or creates a user by wallet", async () => {
    const user = await getOrCreateUser(WALLET);

    assert.equal(user.wallet, WALLET);
    assert.deepEqual(mocks.calls.schema, ["public"]);
    assert.deepEqual(mocks.calls.from, ["users"]);
    assert.deepEqual(mocks.calls.upsert, [[{ wallet: WALLET }, { onConflict: "wallet" }]]);
    assert.deepEqual(mocks.calls.select, ["*"]);
    assert.equal(mocks.calls.single, 1);
  });

  test("throws a typed repository error when get or create fails", async () => {
    const dbError = { code: "XX000", message: "db down" };
    mocks.singleResult = {
      data: null,
      error: dbError,
    };

    await assert.rejects(
      () => getOrCreateUser(WALLET),
      (error) => {
        assert.ok(error instanceof UsersRepositoryError);
        assert.equal(error.code, "USER_GET_OR_CREATE_FAILED");
        assert.equal(error.cause, dbError);
        assert.match(error.message, /Failed to get or create user: db down/);
        return true;
      },
    );
  });
});
