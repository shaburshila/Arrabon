import type {
  ComplianceCheckInsert,
  ComplianceCheckRow,
  ComplianceCheckSubjectType,
  ComplianceProviderId,
  ComplianceReasonCode,
  ComplianceCheckResult,
} from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";

export class ComplianceChecksRepositoryError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ComplianceChecksRepositoryError";
    this.code = code;
  }
}

export interface CreateComplianceCheckInput {
  actorWallet: string | null;
  checkedAt?: string;
  dealId: string | null;
  provider: ComplianceProviderId;
  rawSummary?: Record<string, unknown>;
  reasonCode: ComplianceReasonCode;
  result: ComplianceCheckResult;
  subjectType: ComplianceCheckSubjectType;
  subjectValue: string;
}

function normalizeSubjectValue(value: string): string {
  return value.trim().toLowerCase();
}

export async function createComplianceCheck(
  input: CreateComplianceCheckInput,
): Promise<ComplianceCheckRow> {
  const db = getServerDbClient().schema("public");
  const payload: ComplianceCheckInsert = {
    actor_wallet: input.actorWallet,
    checked_at: input.checkedAt,
    deal_id: input.dealId,
    provider: input.provider,
    raw_summary: input.rawSummary ?? {},
    reason_code: input.reasonCode,
    result: input.result,
    subject_type: input.subjectType,
    subject_value: normalizeSubjectValue(input.subjectValue),
  };

  const { data, error } = await db
    .from("compliance_checks")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new ComplianceChecksRepositoryError(
      `Failed to create compliance check: ${error.message}`,
      error.code,
    );
  }

  return data;
}

export async function findBySubject(
  subjectType: ComplianceCheckSubjectType,
  subjectValue: string,
): Promise<ComplianceCheckRow[]> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("compliance_checks")
    .select("*")
    .eq("subject_type", subjectType)
    .eq("subject_value", normalizeSubjectValue(subjectValue))
    .order("checked_at", { ascending: true });

  if (error) {
    throw new ComplianceChecksRepositoryError(
      `Failed to load compliance checks by subject: ${error.message}`,
      error.code,
    );
  }

  return data ?? [];
}

export async function findByDeal(dealId: string): Promise<ComplianceCheckRow[]> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("compliance_checks")
    .select("*")
    .eq("deal_id", dealId)
    .order("checked_at", { ascending: true });

  if (error) {
    throw new ComplianceChecksRepositoryError(
      `Failed to load compliance checks by deal: ${error.message}`,
      error.code,
    );
  }

  return data ?? [];
}
