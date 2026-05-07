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
  DealsRepositoryError,
  getDealByTxHash,
} from "@/server/repositories/deals";
import {
  runDealEventsWorkerForTx,
  serializeDealEventsWorkerRunSummary,
  type SerializedDealEventsWorkerRunSummary,
} from "@/server/workers/deal-events";

export const runtime = "nodejs";

type FundingSyncResponse =
  | {
    ok: true;
    status: "pending_confirmations";
    summary: SerializedDealEventsWorkerRunSummary;
  }
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

class FundingSyncScopeError extends Error {
  code: string;
  status: number;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "FundingSyncScopeError";
    this.code = code;
    this.status = status;
  }
}

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

  if ("from_block" in body && body.from_block !== undefined) {
    throw new FundingSyncScopeError(
      "from_block is not allowed for this endpoint.",
      403,
      "FROM_BLOCK_NOT_ALLOWED",
    );
  }

  throw new FundingValidationError([
    {
      field: "tx_hash",
      message: "tx_hash is required.",
    },
  ]);
}

async function assertTxBelongsToLink(input: {
  linkId: string;
  txHash: Hex;
}) {
  const deal = await getDealByTxHash(input.txHash);

  if (!deal) {
    throw new FundingSyncScopeError(
      "Indexed transaction did not produce a deal.",
      409,
      "DEAL_NOT_FOUND_FOR_TX",
    );
  }

  if (deal.consultation_link_id !== input.linkId) {
    throw new FundingSyncScopeError(
      "Transaction does not belong to this link.",
      403,
      "TX_LINK_MISMATCH",
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser();
    const parsedParams = parsePrepareFundingParams(await params);
    const { txHash } = await readSyncRequestOverrides(request);

    if (txHash) {
      const result = await runDealEventsWorkerForTx(txHash);

      if (
        result.status !== "pending_confirmations" &&
        (result.summary.processed > 0 || result.summary.alreadyProcessed > 0)
      ) {
        await assertTxBelongsToLink({
          linkId: parsedParams.linkId,
          txHash,
        });
      }

      return NextResponse.json(
        {
          ok: true,
          status: result.status === "pending_confirmations"
            ? "pending_confirmations"
            : "success",
          summary: serializeDealEventsWorkerRunSummary(result.summary),
        } satisfies FundingSyncResponse,
        { status: result.status === "pending_confirmations" ? 202 : 200 },
      );
    }

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
        : "INVALID_LINK_ID";

      return jsonError(error.message, 400, {
        code,
        ok: false,
        status: "fatal",
      });
    }

    if (error instanceof FundingSyncScopeError) {
      return jsonError(error.message, error.status, {
        code: error.code,
        ok: false,
        status: "fatal",
      });
    }

    if (error instanceof DealsRepositoryError) {
      return jsonError("Failed to validate transaction link ownership.", 500, {
        code: error.code ?? "DEAL_TX_LOOKUP_FAILED",
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
