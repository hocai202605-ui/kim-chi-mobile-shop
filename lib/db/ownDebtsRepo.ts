import type { StoreId } from "@/types";
import { toVnDate } from "@/lib/datetime";
import { getPool } from "./pool";

export type OwnDebtStatus = "open" | "paid" | "cancelled";

export type OwnDebt = {
  id: string;
  storeId: Exclude<StoreId, "all">;
  creditorName: string;
  debtDate: string;
  debtType: string;
  amount: number;
  note: string;
  status: OwnDebtStatus;
  paidAt?: string;
};

export type OwnDebtInput = {
  id?: string;
  storeId: Exclude<StoreId, "all">;
  creditorName: string;
  debtDate?: string;
  debtType: string;
  amount: number;
  note?: string;
  actorUsername?: string;
};

export type OwnDebtListFilters = {
  storeId?: StoreId;
  status?: OwnDebtStatus | "all";
  dateFrom?: string;
  dateTo?: string;
  query?: string;
};

type OwnDebtRow = {
  id: string;
  store_id: string;
  creditor_name: string;
  debt_date: Date | string;
  debt_type: string;
  amount: string | number;
  note: string;
  status: OwnDebtStatus;
  paid_at: Date | string | null;
};

function normalizeActor(value?: string | null): string | null {
  const t = String(value ?? "").trim();
  return t || null;
}

function moneyN(n: unknown): number {
  return Math.round(Number(n) || 0);
}

function toDateOnly(value: Date | string | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return toVnDate(s) || s.slice(0, 10);
  }
  return toVnDate(value) || "";
}

async function loadStoreMaps(): Promise<{
  codeToId: Map<string, string>;
  idToCode: Map<string, Exclude<StoreId, "all">>;
}> {
  const { rows } = await getPool().query<{ id: string; code: string }>(
    `select id, code from public.stores where is_active = true`
  );
  const codeToId = new Map<string, string>();
  const idToCode = new Map<string, Exclude<StoreId, "all">>();
  for (const r of rows) {
    codeToId.set(r.code, r.id);
    if (r.code === "store-1" || r.code === "store-2" || r.code === "store-3") {
      idToCode.set(r.id, r.code);
    }
  }
  return { codeToId, idToCode };
}

function mapOwnDebt(
  row: OwnDebtRow,
  idToCode: Map<string, Exclude<StoreId, "all">>
): OwnDebt {
  return {
    id: String(row.id),
    storeId: idToCode.get(String(row.store_id)) ?? "store-1",
    creditorName: String(row.creditor_name ?? ""),
    debtDate: toDateOnly(row.debt_date),
    debtType: String(row.debt_type ?? ""),
    amount: moneyN(row.amount),
    note: String(row.note ?? ""),
    status: row.status,
    paidAt: row.paid_at ? toDateOnly(row.paid_at) : undefined,
  };
}

export async function repoListOwnDebts(
  filters: OwnDebtListFilters = {}
): Promise<OwnDebt[]> {
  const { codeToId, idToCode } = await loadStoreMaps();

  const where: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  const storeCode = String(filters.storeId ?? "").trim();
  if (storeCode && storeCode !== "all") {
    const uuid = codeToId.get(storeCode);
    if (!uuid) return [];
    where.push(`store_id = $${i++}`);
    params.push(uuid);
  }

  const status = String(filters.status ?? "").trim();
  if (status && status !== "all") {
    where.push(`status = $${i++}::public.own_debt_status`);
    params.push(status);
  }

  const dateFrom = String(filters.dateFrom ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    where.push(`debt_date >= $${i++}::date`);
    params.push(dateFrom);
  }

  const dateTo = String(filters.dateTo ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    where.push(`debt_date <= $${i++}::date`);
    params.push(dateTo);
  }

  const q = String(filters.query ?? "").trim();
  if (q) {
    where.push(
      `(creditor_name ilike $${i} or debt_type ilike $${i} or note ilike $${i})`
    );
    params.push(`%${q}%`);
    i += 1;
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const { rows } = await getPool().query<OwnDebtRow>(
    `select id, store_id, creditor_name, debt_date, debt_type, amount, note, status, paid_at
     from public.own_debts
     ${whereSql}
     order by debt_date desc, created_at desc`,
    params
  );

  return rows.map((r) => mapOwnDebt(r, idToCode));
}

export async function repoUpsertOwnDebt(input: OwnDebtInput): Promise<OwnDebt> {
  const { codeToId, idToCode } = await loadStoreMaps();
  const storeUuid = codeToId.get(input.storeId);
  if (!storeUuid) throw new Error(`Không tìm thấy cửa hàng ${input.storeId}`);

  const creditorName = String(input.creditorName ?? "").trim();
  const debtType = String(input.debtType ?? "").trim();
  if (!creditorName) throw new Error("Người mình nợ không được trống.");
  if (!debtType) throw new Error("Loại món nợ không được trống.");
  const amount = moneyN(input.amount);
  if (amount <= 0) throw new Error("Số tiền nợ phải lớn hơn 0.");

  const actor = normalizeActor(input.actorUsername);
  const debtDate =
    String(input.debtDate ?? "").trim().slice(0, 10) || toVnDate(new Date()) || "";
  const note = String(input.note ?? "").trim();

  if (input.id) {
    const { rows } = await getPool().query<OwnDebtRow>(
      `update public.own_debts set
         store_id = $1,
         creditor_name = $2,
         debt_type = $3,
         amount = $4,
         debt_date = $5::date,
         note = $6,
         updated_by = coalesce($7, updated_by),
         updated_at = now()
       where id = $8
         and status <> 'cancelled'
       returning id, store_id, creditor_name, debt_date, debt_type, amount, note, status, paid_at`,
      [storeUuid, creditorName, debtType, amount, debtDate, note, actor, input.id]
    );
    if (!rows[0]) {
      throw new Error("Không tìm thấy khoản mình nợ để sửa (hoặc đã hủy).");
    }
    return mapOwnDebt(rows[0], idToCode);
  }

  const { rows } = await getPool().query<OwnDebtRow>(
    `insert into public.own_debts (
       store_id, creditor_name, debt_type, amount, debt_date, note,
       status, created_by, updated_by
     ) values ($1,$2,$3,$4,$5::date,$6,'open',$7,$7)
     returning id, store_id, creditor_name, debt_date, debt_type, amount, note, status, paid_at`,
    [storeUuid, creditorName, debtType, amount, debtDate, note, actor]
  );
  if (!rows[0]) throw new Error("Không tạo được khoản mình nợ.");
  return mapOwnDebt(rows[0], idToCode);
}

export async function repoMarkOwnDebtPaid(
  id: string,
  actorUsername?: string
): Promise<OwnDebt> {
  const { idToCode } = await loadStoreMaps();
  const actor = normalizeActor(actorUsername);
  const { rows } = await getPool().query<OwnDebtRow>(
    `update public.own_debts set
       status = 'paid',
       paid_at = now(),
       updated_by = coalesce($2, updated_by),
       updated_at = now()
     where id = $1 and status = 'open'
     returning id, store_id, creditor_name, debt_date, debt_type, amount, note, status, paid_at`,
    [id, actor]
  );
  if (!rows[0]) {
    throw new Error("Không đánh dấu đã trả (không tìm thấy hoặc không còn mở).");
  }
  return mapOwnDebt(rows[0], idToCode);
}

export async function repoCancelOwnDebt(
  id: string,
  actorUsername?: string
): Promise<OwnDebt> {
  const { idToCode } = await loadStoreMaps();
  const actor = normalizeActor(actorUsername);
  const { rows } = await getPool().query<OwnDebtRow>(
    `update public.own_debts set
       status = 'cancelled',
       cancelled_at = now(),
       updated_by = coalesce($2, updated_by),
       updated_at = now()
     where id = $1 and status <> 'cancelled'
     returning id, store_id, creditor_name, debt_date, debt_type, amount, note, status, paid_at`,
    [id, actor]
  );
  if (!rows[0]) {
    throw new Error("Không hủy được (không tìm thấy hoặc đã hủy).");
  }
  return mapOwnDebt(rows[0], idToCode);
}
