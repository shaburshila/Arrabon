import "server-only";

import { z } from "zod";

export interface ValidationIssue {
  field: string;
  message: string;
}

export class DealAdminValidationError extends Error {
  issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super("Invalid admin deal input.");
    this.name = "DealAdminValidationError";
    this.issues = issues;
  }
}

export interface AdminResolveBody {
  resolution: "refund" | "release";
}

const adminResolveBodySchema = z.object({
  resolution: z.enum(["refund", "release"]),
});

function formatZodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "body",
    message: issue.message,
  }));
}

export function parseAdminResolveBody(value: unknown): AdminResolveBody {
  const result = adminResolveBodySchema.safeParse(value);

  if (!result.success) {
    throw new DealAdminValidationError(formatZodIssues(result.error));
  }

  return result.data;
}
