import { NextResponse } from "next/server";

import { timingSafeEqualSecret } from "@/lib/crypto/timing-safe-secret";
import { classifyDealEventsWorkerError } from "@/server/workers/deal-events-error-classification";
import {
  runDealEventsWorker,
  serializeDealEventsWorkerRunSummary,
} from "@/server/workers/deal-events";

export const runtime = "nodejs";

function jsonError(
  message: string,
  status: number,
  details?: {
    code?: string;
    failure_type?: "fatal" | "retryable";
  },
) {
  return NextResponse.json({ error: message, ...details }, { status });
}

function isAuthorized(request: Request, configuredSecret: string): boolean {
  const providedSecret = request.headers.get("x-internal-sync-secret");

  if (!providedSecret) {
    return false;
  }

  return timingSafeEqualSecret(configuredSecret, providedSecret);
}

export async function POST(request: Request) {
  const configuredSecret = process.env.INTERNAL_SYNC_SECRET?.trim();

  if (!configuredSecret) {
    console.error("Internal deal events sync is not configured.", {
      code: "INTERNAL_SYNC_SECRET_NOT_CONFIGURED",
    });

    return jsonError("Internal sync is not configured.", 503, {
      code: "INTERNAL_SYNC_SECRET_NOT_CONFIGURED",
      failure_type: "fatal",
    });
  }

  if (!isAuthorized(request, configuredSecret)) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const summary = await runDealEventsWorker();

    return NextResponse.json(serializeDealEventsWorkerRunSummary(summary));
  } catch (error) {
    const classifiedError = classifyDealEventsWorkerError(error);

    console.error("Failed to run deal events worker.", {
      code: classifiedError.code,
      error,
      failureType: classifiedError.type,
    });

    return jsonError(
      "Failed to run deal events worker.",
      classifiedError.type === "retryable" ? 503 : 500,
      {
        code: classifiedError.code,
        failure_type: classifiedError.type,
      },
    );
  }
}
