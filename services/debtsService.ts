import type { DebtItem, DebtListFilters, DebtSource, ManualDebtInput, MarkPaidRef } from "@/lib/db/debtsRepo";

export type { DebtItem, DebtListFilters, DebtSource, ManualDebtInput, MarkPaidRef };

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return body.data as T;
}

function toQuery(filters: DebtListFilters = {}): string {
  const p = new URLSearchParams();
  if (filters.storeId && filters.storeId !== "all") p.set("storeId", filters.storeId);
  if (filters.source && filters.source !== "all") p.set("source", filters.source);
  if (filters.status && filters.status !== "all") p.set("status", filters.status);
  if (filters.dateFrom) p.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) p.set("dateTo", filters.dateTo);
  if (filters.query) p.set("query", filters.query);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function listDebts(filters: DebtListFilters = {}): Promise<DebtItem[]> {
  const res = await fetch(`/api/debts${toQuery(filters)}`, { cache: "no-store" });
  return parseJson<DebtItem[]>(res);
}

export async function upsertManualDebt(input: ManualDebtInput): Promise<DebtItem> {
  const res = await fetch("/api/debts/manual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<DebtItem>(res);
}

export async function cancelManualDebt(
  id: string,
  actorUsername?: string
): Promise<DebtItem> {
  const res = await fetch("/api/debts/manual", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, actorUsername }),
  });
  return parseJson<DebtItem>(res);
}

export async function markDebtsPaid(
  refs: MarkPaidRef[],
  actorUsername?: string
): Promise<{ updated: number; items: DebtItem[] }> {
  const res = await fetch("/api/debts/mark-paid", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refs, actorUsername }),
  });
  return parseJson<{ updated: number; items: DebtItem[] }>(res);
}
