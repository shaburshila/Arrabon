import { NextResponse } from "next/server";
import type { Hex } from "viem";

import { AuthGuardError, requireUser } from "@/lib/auth/guards";
import {
  FundingValidationError,
  parsePrepareFundingParams,
} from "@/lib/validators/funding";
import {
  classifyDealEventsWorkerError,
  type DealEventsWorkerFailureType,
} from "@/server/workers/deal-events-error-classification";
import {
  runDealEventsWorker,
  runDealEventsWorkerForTransaction,
  serializeDealEventsWorkerRunSummary,
  type SerializedDealEventsWorkerRunSummary,
} from "@/server/workers/deal-events";

export const runtime = "nodejs";

type FundingSyncResponse =
  | {
    ok: true;
    status: "success";
    summary: SerializedDealEventsWorkerRunSummary;
  }
  | {
    code: string;
    error: string;
    ok: false;
    status: DealEventsWorkerFailureType;
  };

function jsonError(
  message: string,
  status: number,
  body: Omit<Extract<FundingSyncResponse, { ok: false }>, "error">,
) {
  return NextResponse.json(
    {
      error: message,
      ...body,
    },
    { status },
  );
}

interface SyncRequestOverrides {
  fromBlock?: bigint;
  txHash?: Hex;
}

function isTransactionHash(value: string): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

async function readSyncRequestOverrides(request: Request): Promise<SyncRequestOverrides> {
  const body = await request.json().catch(() => ({}));

  if (typeof body !== "object" || body === null) {
    return {};
  }

  if ("tx_hash" in body && body.tx_hash !== undefined) {
    if (typeof body.tx_hash !== "string" || !isTransactionHash(body.tx_hash)) {
      throw new FundingValidationError([
        {
          field: "tx_hash",
          message: "tx_hash must be a 32-byte hex transaction hash.",
        },
      ]);
    }

    return { txHash: body.tx_hash };
  }

  if (
    !("from_block" in body) ||
    body.from_block === undefined
  ) {
    return {};
  }

  if (typeof body.from_block !== "string" || body.from_block.trim().length === 0) {
    throw new FundingValidationError([
      {
        field: "from_block",
        message: "from_block must be a decimal string.",
      },
    ]);
  }

  try {
    const fromBlock = BigInt(body.from_block);

    if (fromBlock < BigInt(0)) {
      throw new Error("negative");
    }

    return { fromBlock };
  } catch {
    throw new FundingValidationError([
      {
        field: "from_block",
        message: "from_block must be a non-negative decimal string.",
      },
    ]);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser();
    parsePrepareFundingParams(await params);
    const { fromBlock, txHash } = await readSyncRequestOverrides(request);

    const summary = txHash
      ? await runDealEventsWorkerForTransaction(txHash)
      : await runDealEventsWorker(fromBlock);

    return NextResponse.json({
      ok: true,
      status: "success",
      summary: serializeDealEventsWorkerRunSummary(summary),
    } satisfies FundingSyncResponse);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return jsonError(error.message, error.status, {
        code: "AUTH_REQUIRED",
        ok: false,
        status: "fatal",
      });
    }

    if (error instanceof FundingValidationError) {
      const code = error.issues.some((issue) => issue.field === "tx_hash")
        ? "INVALID_TX_HASH"
        : error.issues.some((issue) => issue.field === "from_block")
          ? "INVALID_FROM_BLOCK"
          : "INVALID_LINK_ID";

      return jsonError(error.message, 400, {
        code,
        ok: false,
        status: "fatal",
      });
    }

    const classifiedError = classifyDealEventsWorkerError(error);

    console.error("Failed to trigger funding sync.", {
      code: classifiedError.code,
      error,
      failureType: classifiedError.type,
    });

    return jsonError(
      classifiedError.type === "retryable"
        ? "Deal indexing is temporarily unavailable."
        : "Deal indexing is not configured correctly.",
      classifiedError.type === "retryable" ? 503 : 500,
      {
        code: classifiedError.code,
        ok: false,
        status: classifiedError.type,
      },
    );
  }
}
