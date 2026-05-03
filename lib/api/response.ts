import { NextResponse } from "next/server";

export function jsonError(message: string, status: number, details?: unknown) {
  const body: {
    details?: unknown;
    error: string;
  } = {
    error: message,
  };

  if (details !== undefined) {
    body.details = details;
  }

  return NextResponse.json(body, { status });
}
