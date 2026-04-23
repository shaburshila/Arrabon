import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_LIST_LIMIT,
  PaginationValidationError,
  parseListPagination,
} from "../../lib/validators/pagination";

describe("parseListPagination", () => {
  test("uses default limit and offset when query params are absent", () => {
    const result = parseListPagination(new URLSearchParams());

    assert.deepEqual(result, {
      limit: 50,
      offset: 0,
    });
  });

  test("parses valid limit and offset params", () => {
    const result = parseListPagination(new URLSearchParams("limit=25&offset=50"));

    assert.deepEqual(result, {
      limit: 25,
      offset: 50,
    });
  });

  test("clamps limit to the maximum list limit", () => {
    const result = parseListPagination(new URLSearchParams("limit=200&offset=0"));

    assert.deepEqual(result, {
      limit: MAX_LIST_LIMIT,
      offset: 0,
    });
  });

  test("rejects invalid pagination params", () => {
    assert.throws(
      () => parseListPagination(new URLSearchParams("limit=0")),
      PaginationValidationError,
    );
    assert.throws(
      () => parseListPagination(new URLSearchParams("limit=-1")),
      PaginationValidationError,
    );
    assert.throws(
      () => parseListPagination(new URLSearchParams("limit=abc")),
      PaginationValidationError,
    );
    assert.throws(
      () => parseListPagination(new URLSearchParams("offset=-1")),
      PaginationValidationError,
    );
    assert.throws(
      () => parseListPagination(new URLSearchParams("offset=abc")),
      PaginationValidationError,
    );
  });
});
