import type { ShopRepairOrder } from "@/types";

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
export async function listRepairOrders(
  store?: string | null,
  actorUsername?: string | null
): Promise<ShopRepairOrder[]> {
  const params = new URLSearchParams();
  if (store && store !== "all") params.set("store", store);
  if (actorUsername?.trim()) params.set("actor", actorUsername.trim());
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/repairs${q}`, { cache: "no-store" });
  return parseJson<ShopRepairOrder[]>(res);
}

export type RepairOrderUpsertInput = Omit<ShopRepairOrder, "id" | "createdAt" | "isPaid"> & {
  id?: string;
  createdAt?: string;
  isPaid?: boolean;
  /** Username app_accounts — audit created_by / updated_by. */
  actorUsername?: string;
};

export async function upsertRepairOrder(
  input: RepairOrderUpsertInput
): Promise<ShopRepairOrder> {
  const res = await fetch("/api/repairs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<ShopRepairOrder>(res);
}

/** Đánh dấu hàng loạt NỢ DAI → Đã thanh toán. */
export async function markRepairOrdersPaid(
  ids: string[],
  actorUsername?: string
): Promise<ShopRepairOrder[]> {
  const res = await fetch("/api/repairs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "mark-paid", ids, actorUsername }),
  });
  return parseJson<ShopRepairOrder[]>(res);
}

export async function deleteRepairOrder(id: string): Promise<ShopRepairOrder> {
  const res = await fetch("/api/repairs", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  return parseJson<ShopRepairOrder>(res);
}
