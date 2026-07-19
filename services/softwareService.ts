import type { OnlineRepair } from "@/types";

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return body.data as T;
}

/**
 * Always from DB via Next API.
 * `store`: all | store-1|2|3 — staff phải kèm `actor` để server khóa CH.
 */
export async function listSoftwareOrders(
  store?: string | null,
  actorUsername?: string | null
): Promise<OnlineRepair[]> {
  const params = new URLSearchParams();
  if (store && store !== "all") params.set("store", store);
  if (actorUsername?.trim()) params.set("actor", actorUsername.trim());
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/software${q}`, { cache: "no-store" });
  return parseJson<OnlineRepair[]>(res);
}

export type SoftwareOrderUpsertInput = Omit<OnlineRepair, "id" | "createdAt" | "isPaid"> & {
  id?: string;
  createdAt?: string;
  isPaid?: boolean;
  /** Username app_accounts — audit created_by / updated_by. */
  actorUsername?: string;
};

export async function upsertSoftwareOrder(
  input: SoftwareOrderUpsertInput
): Promise<OnlineRepair> {
  const res = await fetch("/api/software", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<OnlineRepair>(res);
}

/** Đánh dấu hàng loạt NỢ DAI → Đã thanh toán. */
export async function markSoftwareOrdersPaid(
  ids: string[],
  actorUsername?: string
): Promise<OnlineRepair[]> {
  const res = await fetch("/api/software", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "mark-paid", ids, actorUsername }),
  });
  return parseJson<OnlineRepair[]>(res);
}

export async function deleteSoftwareOrder(id: string): Promise<OnlineRepair> {
  const res = await fetch("/api/software", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  return parseJson<OnlineRepair>(res);
}
