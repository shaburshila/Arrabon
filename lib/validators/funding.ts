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
