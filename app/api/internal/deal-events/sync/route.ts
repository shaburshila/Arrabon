import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { runDealEventsWorker } from "@/server/workers/deal-events";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isAuthorized(request: Request, configuredSecret: string): boolean {
  const providedSecret = request.headers.get("x-internal-sync-secret");

  if (!providedSecret) {
    return false;
  }

  const expectedBuffer = Buffer.from(configuredSecret, "utf8");
  const providedBuffer = Buffer.from(providedSecret, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: Request) {
  const configuredSecret = process.env.INTERNAL_SYNC_SECRET?.trim();

  if (!configuredSecret) {
    return jsonError("INTERNAL_SYNC_SECRET is not configured.", 500);
  }

  if (!isAuthorized(request, configuredSecret)) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const summary = await runDealEventsWorker();

    return NextResponse.json(summary);
  } catch {
    return jsonError("Failed to run deal events worker.", 500);
  }
}
