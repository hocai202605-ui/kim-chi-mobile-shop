import type { StoreId } from "@/types";
import { toVnDate } from "@/lib/datetime";
import { getPool, withTransaction } from "./pool";

/** Nguồn công nợ (sale/repair: UI/tab; API ghi nợ hiện hỗ trợ software + manual). */
export type DebtSource = "software" | "manual" | "sale" | "repair";
export type DebtStatus = "open" | "paid" | "cancelled";

export type DebtItem = {
  id: string;
  source: DebtSource;
  sourceId: string;
  storeId: Exclude<StoreId, "all">;
  customerName: string;
  customerPhone: string;
  title: string;
  amount: number;
  debtDate: string;
  dueDate?: string;
  status: DebtStatus;
  note: string;
  paidAt?: string;
};

export type ManualDebtInput = {
  id?: string;
  storeId: Exclude<StoreId, "all">;
  customerName: string;
  customerPhone?: string;
  title: string;
  amount: number;
  debtDate?: string;
  dueDate?: string;
  note?: string;
  actorUsername?: string;
};

export type DebtListFilters = {
  storeId?: StoreId;
  source?: DebtSource | "all";
  status?: DebtStatus | "all";
  dateFrom?: string;
  dateTo?: string;
  query?: string;
};

function normalizeActor(value?: string | null): string | null {
  const t = String(value ?? "").trim();
  return t || null;
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

/** Calendar day in VN — tránh toISOString().slice(0,10) lùi 1 ngày trên UTC+7. */
function toDateOnly(value: Date | string | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return toVnDate(s) || s.slice(0, 10);
  }
  return toVnDate(value) || "";
}

function moneyN(n: unknown): number {
  return Math.round(Number(n) || 0);
}

type SoftwareDebtRow = {
  id: string;
  store_code: string | null;
  customer_name: string;
  device_name: string;
  quote: string | number;
  deposit: string | number;
  receive_at: Date | string | null;
  created_at: Date | string;
  payment_status: "paid" | "debt";
  payment_at: Date | string | null;
  issue: string | null;
};

type ManualDebtRow = {
  id: string;
  store_id: string;
  customer_name: string;
  customer_phone: string;
  title: string;
  amount: string | number;
  debt_date: Date | string;
  due_date: Date | string | null;
  status: "open" | "paid" | "cancelled";
  note: string;
  paid_at: Date | string | null;
};

function mapSoftware(row: SoftwareDebtRow): DebtItem {
  const storeId =
    row.store_code === "store-1" || row.store_code === "store-2" || row.store_code === "store-3"
      ? row.store_code
      : "store-1";
  const quote = moneyN(row.quote);
  const isOpen = row.payment_status === "debt";
  return {
    id: `software:${row.id}`,
    source: "software",
    sourceId: String(row.id),
    storeId,
    customerName: String(row.customer_name),
    customerPhone: "",
    title: String(row.device_name ?? "").trim(),
    amount: quote,
    debtDate: toDateOnly(row.receive_at) || toDateOnly(row.created_at),
    status: isOpen ? "open" : "paid",
    note: String(row.issue ?? ""),
    paidAt: row.payment_at ? toDateOnly(row.payment_at) : undefined,
  };
}

function mapManual(
  row: ManualDebtRow,
  idToCode: Map<string, Exclude<StoreId, "all">>
): DebtItem {
  return {
    id: `manual:${row.id}`,
    source: "manual",
    sourceId: String(row.id),
    storeId: idToCode.get(String(row.store_id)) ?? "store-1",
    customerName: String(row.customer_name),
    customerPhone: String(row.customer_phone ?? ""),
    title: String(row.title),
    amount: moneyN(row.amount),
    debtDate: toDateOnly(row.debt_date),
    dueDate: row.due_date ? toDateOnly(row.due_date) : undefined,
    status: row.status,
    note: String(row.note ?? ""),
    paidAt: row.paid_at ? toDateOnly(row.paid_at) : undefined,
  };
}

function passFilters(item: DebtItem, filters: DebtListFilters): boolean {
  if (filters.storeId && filters.storeId !== "all" && item.storeId !== filters.storeId) {
    return false;
  }
  if (filters.source && filters.source !== "all" && item.source !== filters.source) {
    return false;
  }
  if (filters.status && filters.status !== "all" && item.status !== filters.status) {
    return false;
  }
  if (filters.dateFrom && item.debtDate && item.debtDate < filters.dateFrom) return false;
  if (filters.dateTo && item.debtDate && item.debtDate > filters.dateTo) return false;
  const q = filters.query?.trim().toLowerCase();
  if (q) {
    const hay = [item.customerName, item.customerPhone, item.title, item.note, item.sourceId]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

/** Danh sách công nợ thống nhất: Phần mềm (NỢ DAI/đã TT gần đây) + nợ tay. */
export async function repoListDebts(filters: DebtListFilters = {}): Promise<DebtItem[]> {
  const { idToCode } = await loadStoreMaps();
  const pool = getPool();

  // Software: còn nợ + đã TT (để lọc "Đã TT" vẫn thấy). Không có store_id trên software_orders → gán store-1.
  // Nếu sau này có store trên PM thì join.
  const sw = await pool.query<SoftwareDebtRow>(
    `select
       o.id,
       null::text as store_code,
       o.customer_name,
       o.device_name,
       o.quote,
       o.deposit,
       o.receive_at,
       o.created_at,
       o.payment_status,
       o.payment_at,
       o.issue
     from public.software_orders o
     where o.payment_status in ('debt', 'paid')
     order by o.receive_at desc nulls last, o.created_at desc
     limit 2000`
  );

  let manual: ManualDebtRow[] = [];
  try {
    const m = await pool.query<ManualDebtRow>(
      `select * from public.manual_debts
       order by debt_date desc, created_at desc
       limit 2000`
    );
    manual = m.rows;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/manual_debts|does not exist/i.test(msg)) throw err;
    // bảng chưa migrate — chỉ software
  }

  const items: DebtItem[] = [
    ...sw.rows.map(mapSoftware),
    ...manual.map((r) => mapManual(r, idToCode)),
  ];

  return items
    .filter((item) => passFilters(item, filters))
    .sort((a, b) => {
      const da = a.debtDate || "";
      const db = b.debtDate || "";
      if (da !== db) return db.localeCompare(da);
      return b.id.localeCompare(a.id);
    });
}

export async function repoUpsertManualDebt(input: ManualDebtInput): Promise<DebtItem> {
  const { codeToId, idToCode } = await loadStoreMaps();
  const storeUuid = codeToId.get(input.storeId);
  if (!storeUuid) throw new Error(`Không tìm thấy cửa hàng ${input.storeId}`);

  const customerName = String(input.customerName ?? "").trim();
  const title = String(input.title ?? "").trim();
  if (!customerName) throw new Error("Tên khách / đối tượng không được trống.");
  if (!title) throw new Error("Nội dung nợ không được trống.");
  const amount = moneyN(input.amount);
  if (amount <= 0) throw new Error("Số tiền phải lớn hơn 0.");

  const actor = normalizeActor(input.actorUsername);
  const debtDate =
    String(input.debtDate ?? "").trim().slice(0, 10) ||
    new Date().toISOString().slice(0, 10);
  const dueDate = String(input.dueDate ?? "").trim().slice(0, 10) || null;
  const phone = String(input.customerPhone ?? "").trim();
  const note = String(input.note ?? "").trim();

  if (input.id) {
    const { rows } = await getPool().query<ManualDebtRow>(
      `update public.manual_debts set
         store_id = $1,
         customer_name = $2,
         customer_phone = $3,
         title = $4,
         amount = $5,
         debt_date = $6::date,
         due_date = $7::date,
         note = $8,
         updated_by = coalesce($9, updated_by),
         updated_at = now()
       where id = $10
         and status = 'open'
       returning *`,
      [storeUuid, customerName, phone, title, amount, debtDate, dueDate, note, actor, input.id]
    );
    if (!rows[0]) throw new Error("Không tìm thấy nợ tay để sửa (hoặc đã thanh toán/hủy).");
    return mapManual(rows[0], idToCode);
  }

  const { rows } = await getPool().query<ManualDebtRow>(
    `insert into public.manual_debts (
       store_id, customer_name, customer_phone, title, amount,
       debt_date, due_date, note, status, created_by, updated_by
     ) values ($1,$2,$3,$4,$5,$6::date,$7::date,$8,'open',$9,$9)
     returning *`,
    [storeUuid, customerName, phone, title, amount, debtDate, dueDate, note, actor]
  );
  return mapManual(rows[0], idToCode);
}

export async function repoCancelManualDebt(
  id: string,
  actorUsername?: string
): Promise<DebtItem> {
  const { idToCode } = await loadStoreMaps();
  const actor = normalizeActor(actorUsername);
  const { rows } = await getPool().query<ManualDebtRow>(
    `update public.manual_debts set
       status = 'cancelled',
       cancelled_at = now(),
       updated_by = coalesce($2, updated_by),
       updated_at = now()
     where id = $1 and status = 'open'
     returning *`,
    [id, actor]
  );
  if (!rows[0]) throw new Error("Không hủy được (không tìm thấy hoặc không còn mở).");
  return mapManual(rows[0], idToCode);
}

export type MarkPaidRef = { source: DebtSource; sourceId: string };

export async function repoMarkDebtsPaid(
  refs: MarkPaidRef[],
  actorUsername?: string
): Promise<{ updated: number; items: DebtItem[] }> {
  const actor = normalizeActor(actorUsername);
  const { idToCode } = await loadStoreMaps();
  const softwareIds = Array.from(
    new Set(
      refs
        .filter((r) => r.source === "software")
        .map((r) => r.sourceId.trim())
        .filter(Boolean)
    )
  );
  const manualIds = Array.from(
    new Set(
      refs
        .filter((r) => r.source === "manual")
        .map((r) => r.sourceId.trim())
        .filter(Boolean)
    )
  );
  // sale / repair: chưa có mark-paid API — bỏ qua

  return withTransaction(async (client) => {
    const items: DebtItem[] = [];

    if (softwareIds.length) {
      const { rows } = await client.query<SoftwareDebtRow>(
        `update public.software_orders
         set payment_status = 'paid',
             payment_at = now(),
             updated_by = coalesce($2, updated_by),
             updated_at = now()
         where id = any($1::uuid[])
           and payment_status = 'debt'
         returning
           id, null::text as store_code, customer_name, device_name, quote, deposit,
           receive_at, created_at, payment_status, payment_at, issue`,
        [softwareIds, actor]
      );
      items.push(...rows.map(mapSoftware));
    }

    if (manualIds.length) {
      const { rows } = await client.query<ManualDebtRow>(
        `update public.manual_debts
         set status = 'paid',
             paid_at = now(),
             updated_by = coalesce($2, updated_by),
             updated_at = now()
         where id = any($1::uuid[])
           and status = 'open'
         returning *`,
        [manualIds, actor]
      );
      items.push(...rows.map((r) => mapManual(r, idToCode)));
    }

    return { updated: items.length, items };
  });
}
