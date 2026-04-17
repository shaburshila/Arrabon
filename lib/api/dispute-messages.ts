import { ApiError } from "@/lib/api/auth";

async function parseResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export type DisputeMessageAuthorRole = "admin" | "buyer" | "seller";

export interface DisputeMessage {
  author_role: DisputeMessageAuthorRole;
  author_wallet: string;
  body: string;
  created_at: string;
  deal_id: string;
  evidence_url: string | null;
  id: string;
}

export interface CreateDisputeMessageInput {
  body: string;
  evidence_url: string | null;
}

export async function fetchDisputeMessages(dealId: string): Promise<DisputeMessage[]> {
  const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/dispute-messages`);
  return parseResponse<DisputeMessage[]>(res);
}

export async function createDisputeMessage(
  dealId: string,
  input: CreateDisputeMessageInput,
): Promise<DisputeMessage> {
  const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/dispute-messages`, {
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  return parseResponse<DisputeMessage>(res);
}
