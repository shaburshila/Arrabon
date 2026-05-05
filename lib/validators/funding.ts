import "server-only";

export interface ValidationIssue {
  field: string;
  message: string;
}

export class FundingValidationError extends Error {
  issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super("Invalid funding preparation input.");
    this.name = "FundingValidationError";
    this.issues = issues;
  }
}

export interface PrepareFundingParams {
  linkId: string;
}

export interface FundingExecutionGrantBody {
  grant_token: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parsePrepareFundingParams(
  params: { id?: string | undefined },
): PrepareFundingParams {
  return parseLinkRouteParams(params);
}

export function parseLinkRouteParams(
  params: { id?: string | undefined },
): PrepareFundingParams {
  const issues: ValidationIssue[] = [];

  if (typeof params.id !== "string" || params.id.trim().length === 0) {
    issues.push({
      field: "id",
      message: "Link id is required.",
    });
  } else if (!UUID_PATTERN.test(params.id)) {
    issues.push({
      field: "id",
      message: "Link id must be a valid UUID.",
    });
  }

  if (issues.length > 0) {
    throw new FundingValidationError(issues);
  }

  return {
    linkId: params.id!,
  };
}

const GRANT_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

export function parseFundingExecutionGrantBody(payload: unknown): FundingExecutionGrantBody {
  const issues: ValidationIssue[] = [];
  const body =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : {};

  if (
    typeof body.grant_token !== "string" ||
    !GRANT_TOKEN_PATTERN.test(body.grant_token)
  ) {
    issues.push({
      field: "grant_token",
      message: "grant_token must be a 32-byte hex token.",
    });
  }

  if (issues.length > 0) {
    throw new FundingValidationError(issues);
  }

  return {
    grant_token: body.grant_token as string,
  };
}
