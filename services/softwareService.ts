import type { OnlineRepair } from "@/types";

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return body.data as T;
}

/** Always from DB via Next API (no client mock). */
export async function listSoftwareOrders(): Promise<OnlineRepair[]> {
  const res = await fetch("/api/software", { cache: "no-store" });
  return parseJson<OnlineRepair[]>(res);
}

export type SoftwareOrderUpsertInput = Omit<OnlineRepair, "id" | "createdAt" | "isPaid"> & {
  id?: string;
  createdAt?: string;
  isPaid?: boolean;
  /** Store cho droplist ensure (store-1|2|3). */
  lookupStoreId?: string;
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

export async function deleteSoftwareOrder(id: string): Promise<OnlineRepair> {
  const res = await fetch("/api/software", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  return parseJson<OnlineRepair>(res);
}
