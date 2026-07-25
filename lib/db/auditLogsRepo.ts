import type {
  AuditLog,
  AuditLogFilters,
  AuditLogListResult,
  StoreId,
} from "@/types";
import { formatVnDateTime } from "@/lib/datetime";
import { getPool } from "./pool";

type StoreRow = { id: string; code: string };

async function loadStoreMaps() {
  const { rows } = await getPool().query<StoreRow>(
    `select id, code from public.stores where is_active = true`
  );
  const codeToId = new Map(rows.map((r) => [r.code, r.id]));
  const idToCode = new Map(rows.map((r) => [r.id, r.code as Exclude<StoreId, "all">]));
  return { codeToId, idToCode };
}

function mapAuditLog(
  row: Record<string, unknown>,
  idToCode: Map<string, Exclude<StoreId, "all">>
): AuditLog {
  const storeUuid = row.store_id != null ? String(row.store_id) : "";
  const storeId = (storeUuid && idToCode.get(storeUuid)) || "store-1";
  let meta: Record<string, unknown> | undefined;
  if (row.meta != null && typeof row.meta === "object" && !Array.isArray(row.meta)) {
    meta = row.meta as Record<string, unknown>;
  }
  return {
    id: String(row.id),
    createdAt: formatVnDateTime(row.created_at as string | Date) || "",
    user: String(row.actor_name ?? ""),
    storeId,
    action: String(row.action ?? ""),
    target: String(row.target ?? ""),
    meta,
  };
}

export type CreateAuditLogInput = {
  actorName: string;
  storeId?: Exclude<StoreId, "all"> | string | null;
  action: string;
  target?: string;
  meta?: Record<string, unknown>;
};

export async function repoCreateAuditLog(input: CreateAuditLogInput): Promise<AuditLog> {
  const actorName = String(input.actorName ?? "").trim() || "unknown";
  const action = String(input.action ?? "").trim();
  if (!action) throw new Error("Thiếu hành động nhật ký.");

  const { codeToId, idToCode } = await loadStoreMaps();
  const storeCode = String(input.storeId ?? "").trim();
  const storeUuid =
    storeCode && storeCode !== "all" ? codeToId.get(storeCode) ?? null : null;

  const meta = input.meta && typeof input.meta === "object" ? input.meta : {};

  const { rows } = await getPool().query(
    `insert into public.audit_logs (actor_name, store_id, action, target, meta)
     values ($1, $2, $3, $4, $5::jsonb)
     returning *`,
    [
      actorName,
      storeUuid,
      action,
      String(input.target ?? ""),
      JSON.stringify(meta),
    ]
  );
  if (!rows[0]) throw new Error("Không ghi được nhật ký.");
  return mapAuditLog(rows[0], idToCode);
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export async function repoListAuditLogs(
  filters: AuditLogFilters = {}
): Promise<AuditLogListResult> {
  const { codeToId, idToCode } = await loadStoreMaps();

  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(filters.pageSize) || DEFAULT_PAGE_SIZE)
  );
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  const storeCode = String(filters.storeId ?? "").trim();
  if (storeCode && storeCode !== "all") {
    const uuid = codeToId.get(storeCode);
    if (uuid) {
      where.push(`store_id = $${i++}`);
      params.push(uuid);
    } else {
      // store code lạ → không có kết quả
      return { rows: [], total: 0, page, pageSize };
    }
  }

  const from = String(filters.from ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    // VN calendar day start → timestamptz
    where.push(`created_at >= ($${i++}::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`);
    params.push(`${from} 00:00:00`);
  }

  const to = String(filters.to ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    // exclusive end: next day 00:00 VN
    where.push(
      `created_at < (($${i++}::date + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`
    );
    params.push(to);
  }

  const user = String(filters.user ?? "").trim();
  if (user) {
    where.push(`actor_name ilike $${i++}`);
    params.push(`%${user}%`);
  }

  const action = String(filters.action ?? "").trim();
  if (action) {
    where.push(`action ilike $${i++}`);
    params.push(`%${action}%`);
  }

  const q = String(filters.q ?? "").trim();
  if (q) {
    where.push(`(coalesce(action,'') || ' ' || coalesce(target,'')) ilike $${i++}`);
    params.push(`%${q}%`);
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const countRes = await getPool().query<{ c: string }>(
    `select count(*)::text as c from public.audit_logs ${whereSql}`,
    params
  );
  const total = Number(countRes.rows[0]?.c ?? 0);

  const listParams = [...params, pageSize, offset];
  const { rows } = await getPool().query(
    `select id, created_at, actor_name, store_id, action, target, meta
     from public.audit_logs
     ${whereSql}
     order by created_at desc
     limit $${i++} offset $${i}`,
    listParams
  );

  return {
    rows: rows.map((r) => mapAuditLog(r, idToCode)),
    total,
    page,
    pageSize,
  };
}
