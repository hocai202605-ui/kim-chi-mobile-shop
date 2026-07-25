import type { StoreId } from "@/types";
import type {
  OwnDebt,
  OwnDebtInput,
  OwnDebtListFilters,
  OwnDebtStatus,
} from "@/lib/db/ownDebtsRepo";

export type { OwnDebt, OwnDebtInput, OwnDebtListFilters, OwnDebtStatus };

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return body.data as T;
}

function toQuery(filters: OwnDebtListFilters = {}): string {
  const p = new URLSearchParams();
  if (filters.storeId && filters.storeId !== "all") p.set("storeId", filters.storeId);
  if (filters.status && filters.status !== "all") p.set("status", filters.status);
  if (filters.dateFrom) p.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) p.set("dateTo", filters.dateTo);
  if (filters.query) p.set("query", filters.query);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function listOwnDebts(
  filters: OwnDebtListFilters = {}
): Promise<OwnDebt[]> {
  const res = await fetch(`/api/own-debts${toQuery(filters)}`, { cache: "no-store" });
  return parseJson<OwnDebt[]>(res);
}

export async function upsertOwnDebt(input: OwnDebtInput): Promise<OwnDebt> {
  const res = await fetch("/api/own-debts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<OwnDebt>(res);
}

export async function markOwnDebtPaid(
  id: string,
  actorUsername?: string
): Promise<OwnDebt> {
  const res = await fetch("/api/own-debts/mark-paid", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, actorUsername }),
  });
  return parseJson<OwnDebt>(res);
}

export async function cancelOwnDebt(
  id: string,
  actorUsername?: string
): Promise<OwnDebt> {
  const res = await fetch("/api/own-debts", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, actorUsername }),
  });
  return parseJson<OwnDebt>(res);
}

/** Helper type for store filter params from UI. */
export type OwnDebtStoreParam = StoreId;
