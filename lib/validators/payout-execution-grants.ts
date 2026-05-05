import "server-only";

import { z } from "zod";

export interface ValidationIssue {
  field: string;
  message: string;
}

export class PayoutExecutionGrantValidationError extends Error {
  issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super("Invalid payout execution grant input.");
    this.name = "PayoutExecutionGrantValidationError";
    this.issues = issues;
  }
}

export interface PayoutExecutionGrantBody {
  grant_token: string;
}

const payoutExecutionGrantBodySchema = z.object({
  grant_token: z.string().regex(/^[0-9a-f]{64}$/i, "Grant token must be a 64-character hex string."),
});

function formatZodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "body",
    message: issue.message,
  }));
}

export function parsePayoutExecutionGrantBody(value: unknown): PayoutExecutionGrantBody {
  const result = payoutExecutionGrantBodySchema.safeParse(value);

  if (!result.success) {
    throw new PayoutExecutionGrantValidationError(formatZodIssues(result.error));
  }

  return result.data;
}
