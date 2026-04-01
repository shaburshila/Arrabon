import "server-only";

export interface ValidationIssue {
  field: string;
  message: string;
}

export class DealCompletionValidationError extends Error {
  issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super("Invalid deal completion input.");
    this.name = "DealCompletionValidationError";
    this.issues = issues;
  }
}

export interface DealCompletionRouteParams {
  dealId: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseDealCompletionRouteParams(
  params: { id?: string | undefined },
): DealCompletionRouteParams {
  const issues: ValidationIssue[] = [];

  if (typeof params.id !== "string" || params.id.trim().length === 0) {
    issues.push({
      field: "id",
      message: "Deal id is required.",
    });
  } else if (!UUID_PATTERN.test(params.id)) {
    issues.push({
      field: "id",
      message: "Deal id must be a valid UUID.",
    });
  }

  if (issues.length > 0) {
    throw new DealCompletionValidationError(issues);
  }

  return {
    dealId: params.id!,
  };
}
