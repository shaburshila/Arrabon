import "server-only";

export interface ValidationIssue {
  field: string;
  message: string;
}

export class ConsultationLinkValidationError extends Error {
  issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super("Invalid consultation link payload.");
    this.name = "ConsultationLinkValidationError";
    this.issues = issues;
  }
}

export interface CreateConsultationLinkInput {
  title: string;
  description: string;
  priceUsdc: string;
  scheduledAt: Date;
  timezone: string;
  durationMinutes: number;
  gracePeriodMinutes: number;
  expiresAt: Date;
  meetingUrl: string;
}

const MIN_PRICE_USDC = 10;
const MAX_PRICE_USDC = 1000;
const MIN_LEAD_TIME_MS = 15 * 60 * 1000;
const DECIMAL_PRICE_PATTERN = /^(0|[1-9]\d*)(\.\d{1,6})?$/;
const ISO_UTC_OR_OFFSET_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRequiredString(
  source: Record<string, unknown>,
  field: string,
  issues: ValidationIssue[],
): string | null {
  const value = source[field];

  if (typeof value !== "string") {
    issues.push({ field, message: "Expected a string." });
    return null;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    issues.push({ field, message: "Value is required." });
    return null;
  }

  return trimmedValue;
}

function readInteger(
  source: Record<string, unknown>,
  field: string,
  issues: ValidationIssue[],
): number | null {
  const value = source[field];

  if (typeof value !== "number" || !Number.isInteger(value)) {
    issues.push({ field, message: "Expected an integer." });
    return null;
  }

  return value;
}

function readUtcDate(
  source: Record<string, unknown>,
  field: string,
  issues: ValidationIssue[],
): Date | null {
  const value = readRequiredString(source, field, issues);

  if (!value) {
    return null;
  }

  if (!ISO_UTC_OR_OFFSET_PATTERN.test(value)) {
    issues.push({
      field,
      message: "Expected an ISO-8601 timestamp with UTC designator or explicit offset.",
    });
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    issues.push({ field, message: "Expected a valid timestamp." });
    return null;
  }

  return parsedDate;
}

function validatePrice(
  source: Record<string, unknown>,
  issues: ValidationIssue[],
): string | null {
  const priceUsdc = readRequiredString(source, "price_usdc", issues);

  if (!priceUsdc) {
    return null;
  }

  if (!DECIMAL_PRICE_PATTERN.test(priceUsdc)) {
    issues.push({
      field: "price_usdc",
      message: "Expected a decimal string with up to 6 fractional digits.",
    });
    return null;
  }

  const numericValue = Number(priceUsdc);

  if (Number.isNaN(numericValue)) {
    issues.push({ field: "price_usdc", message: "Expected a valid decimal amount." });
    return null;
  }

  if (numericValue < MIN_PRICE_USDC || numericValue > MAX_PRICE_USDC) {
    issues.push({
      field: "price_usdc",
      message: `Must be between ${MIN_PRICE_USDC} and ${MAX_PRICE_USDC} USDC.`,
    });
    return null;
  }

  return priceUsdc;
}

function validateMeetingUrl(
  source: Record<string, unknown>,
  issues: ValidationIssue[],
): string | null {
  const meetingUrl = readRequiredString(source, "meeting_url", issues);

  if (!meetingUrl) {
    return null;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(meetingUrl);
  } catch {
    issues.push({ field: "meeting_url", message: "Expected a valid URL." });
    return null;
  }

  if (parsedUrl.protocol !== "https:") {
    issues.push({
      field: "meeting_url",
      message: "Expected an https URL.",
    });
    return null;
  }

  return meetingUrl;
}

export function parseCreateConsultationLinkInput(
  payload: unknown,
  now: Date = new Date(),
): CreateConsultationLinkInput {
  const issues: ValidationIssue[] = [];

  if (!isRecord(payload)) {
    throw new ConsultationLinkValidationError([
      { field: "body", message: "Expected a JSON object." },
    ]);
  }

  const title = readRequiredString(payload, "title", issues);
  const description = readRequiredString(payload, "description", issues);
  const priceUsdc = validatePrice(payload, issues);
  const scheduledAt = readUtcDate(payload, "scheduled_at", issues);
  const timezone = readRequiredString(payload, "timezone", issues);
  const durationMinutes = readInteger(payload, "duration_minutes", issues);
  const gracePeriodMinutes = readInteger(payload, "grace_period_minutes", issues);
  const expiresAt = readUtcDate(payload, "expires_at", issues);
  const meetingUrl = validateMeetingUrl(payload, issues);

  if (durationMinutes !== null && durationMinutes <= 0) {
    issues.push({
      field: "duration_minutes",
      message: "Must be greater than 0.",
    });
  }

  if (gracePeriodMinutes !== null && gracePeriodMinutes < 0) {
    issues.push({
      field: "grace_period_minutes",
      message: "Must be greater than or equal to 0.",
    });
  }

  if (scheduledAt && scheduledAt.getTime() <= now.getTime()) {
    issues.push({
      field: "scheduled_at",
      message: "Must be later than the current time.",
    });
  }

  if (scheduledAt && expiresAt && expiresAt.getTime() >= scheduledAt.getTime()) {
    issues.push({
      field: "expires_at",
      message: "Must be earlier than scheduled_at.",
    });
  }

  if (
    scheduledAt &&
    expiresAt &&
    scheduledAt.getTime() - expiresAt.getTime() < MIN_LEAD_TIME_MS
  ) {
    issues.push({
      field: "expires_at",
      message: "Must be at least 15 minutes earlier than scheduled_at.",
    });
  }

  if (
    issues.length > 0 ||
    !title ||
    !description ||
    !priceUsdc ||
    !scheduledAt ||
    !timezone ||
    durationMinutes === null ||
    gracePeriodMinutes === null ||
    !expiresAt ||
    !meetingUrl
  ) {
    throw new ConsultationLinkValidationError(issues);
  }

  return {
    title,
    description,
    priceUsdc,
    scheduledAt,
    timezone,
    durationMinutes,
    gracePeriodMinutes,
    expiresAt,
    meetingUrl,
  };
}
