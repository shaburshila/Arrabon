import "server-only";

import { z } from "zod";

export interface CreateDisputeMessageBody {
  body: string;
  evidence_url: string | null;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export class DisputeMessageValidationError extends Error {
  issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super("Invalid dispute message body.");
    this.name = "DisputeMessageValidationError";
    this.issues = issues;
  }
}

const evidenceUrlSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();

    return trimmed.length === 0 ? null : trimmed;
  },
  z.string().url().max(2048).nullable().optional(),
);

const createDisputeMessageSchema = z.object({
  body: z.string().trim().min(1).max(3000),
  evidence_url: evidenceUrlSchema,
});

function formatZodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "body",
    message: issue.message,
  }));
}

export function parseCreateDisputeMessageBody(value: unknown): CreateDisputeMessageBody {
  const result = createDisputeMessageSchema.safeParse(value);

  if (!result.success) {
    throw new DisputeMessageValidationError(formatZodIssues(result.error));
  }

  return {
    body: result.data.body,
    evidence_url: result.data.evidence_url ?? null,
  };
}
