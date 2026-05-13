import type {
  DealEventSyncCursorAdvanceResult,
  DealEventSyncCursorInsert,
  DealEventSyncCursorRow,
} from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";

export class DealEventSyncCursorsRepositoryError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "DealEventSyncCursorsRepositoryError";
    this.code = code;
  }
}

const DEAL_EVENTS_CURSOR_NAME = "deal_events";

function parseBlockString(value: string): bigint {
  return BigInt(value);
}

export async function getDealEventsSyncCursor(): Promise<bigint | null> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("deal_event_sync_cursors")
    .select("*")
    .eq("name", DEAL_EVENTS_CURSOR_NAME)
    .maybeSingle();

  if (error) {
    throw new DealEventSyncCursorsRepositoryError(
      `Failed to load deal event sync cursor: ${error.message}`,
      error.code,
    );
  }

  if (!data) {
    return null;
  }

  return parseBlockString(data.last_indexed_block);
}

export async function initializeDealEventsSyncCursorIfMissing(
  startBlock: bigint,
): Promise<bigint> {
  const db = getServerDbClient().schema("public");
  const payload: DealEventSyncCursorInsert = {
    last_indexed_block: (startBlock - BigInt(1)).toString(10),
    name: DEAL_EVENTS_CURSOR_NAME,
  };

  const { error } = await db
    .from("deal_event_sync_cursors")
    .insert(payload);

  if (error && error.code !== "23505") {
    throw new DealEventSyncCursorsRepositoryError(
      `Failed to initialize deal event sync cursor: ${error.message}`,
      error.code,
    );
  }

  const cursor = await getDealEventsSyncCursor();

  if (cursor === null) {
    throw new DealEventSyncCursorsRepositoryError(
      "Deal event sync cursor was not found after initialization.",
    );
  }

  return cursor;
}

export async function advanceDealEventsSyncCursor(
  lastIndexedBlock: bigint,
): Promise<bigint> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .rpc("advance_deal_event_sync_cursor", {
      p_last_indexed_block: lastIndexedBlock.toString(10),
      p_name: DEAL_EVENTS_CURSOR_NAME,
    })
    .returns<DealEventSyncCursorAdvanceResult[]>()
    .single();

  if (error) {
    throw new DealEventSyncCursorsRepositoryError(
      `Failed to advance deal event sync cursor: ${error.message}`,
      error.code,
    );
  }

  return parseBlockString(data.last_indexed_block);
}
