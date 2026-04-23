export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 100;

export interface ListPagination {
  limit: number;
  offset: number;
}

export class PaginationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaginationValidationError";
  }
}

function parseNonNegativeInteger(value: string, field: string): number {
  if (!/^\d+$/.test(value)) {
    throw new PaginationValidationError(`${field} must be a non-negative integer.`);
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw new PaginationValidationError(`${field} must be a safe integer.`);
  }

  return parsed;
}

export function normalizeListPagination(input?: Partial<ListPagination>): ListPagination {
  const limit = input?.limit ?? DEFAULT_LIST_LIMIT;
  const offset = input?.offset ?? 0;

  return {
    limit: Math.min(limit, MAX_LIST_LIMIT),
    offset,
  };
}

export function parseListPagination(searchParams: URLSearchParams): ListPagination {
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");
  const limit = limitParam === null
    ? DEFAULT_LIST_LIMIT
    : parseNonNegativeInteger(limitParam, "limit");
  const offset = offsetParam === null
    ? 0
    : parseNonNegativeInteger(offsetParam, "offset");

  if (limit <= 0) {
    throw new PaginationValidationError("limit must be greater than 0.");
  }

  return normalizeListPagination({ limit, offset });
}
