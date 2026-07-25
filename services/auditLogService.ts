import type { AuditLog, AuditLogFilters, AuditLogListResult, StoreId } from "@/types";

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return body.data as T;
}

export type CreateAuditLogInput = {
  actorName: string;
  storeId?: Exclude<StoreId, "all"> | string | null;
  action: string;
  target?: string;
  meta?: Record<string, unknown>;
};

/** Ghi 1 dòng nhật ký vào DB. */
export async function createAuditLog(input: CreateAuditLogInput): Promise<AuditLog> {
  const res = await fetch("/api/audit-logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<AuditLog>(res);
}

/** List + filter + phân trang từ DB. */
export async function listAuditLogs(
  filters: AuditLogFilters = {}
): Promise<AuditLogListResult> {
  const sp = new URLSearchParams();
  if (filters.storeId && filters.storeId !== "all") sp.set("storeId", filters.storeId);
  if (filters.from) sp.set("from", filters.from);
  if (filters.to) sp.set("to", filters.to);
  if (filters.user) sp.set("user", filters.user);
  if (filters.action) sp.set("action", filters.action);
  if (filters.q) sp.set("q", filters.q);
  if (filters.page != null) sp.set("page", String(filters.page));
  if (filters.pageSize != null) sp.set("pageSize", String(filters.pageSize));

  const qs = sp.toString();
  const res = await fetch(`/api/audit-logs${qs ? `?${qs}` : ""}`, { cache: "no-store" });
  return parseJson<AuditLogListResult>(res);
}
