import { getPool } from "./pool";

export type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  note: string;
};

export type UpsertCustomerInput = {
  id?: string;
  name: string;
  phone?: string;
  note?: string;
  actorUsername?: string;
};

function normalizeActor(value?: string | null): string | null {
  const t = String(value ?? "").trim();
  return t || null;
}

function mapCustomer(row: {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
}): CustomerRow {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    phone: String(row.phone ?? ""),
    note: String(row.note ?? ""),
  };
}

/** Danh sách khách active (mới nhất trước). */
export async function repoListCustomers(limit = 500): Promise<CustomerRow[]> {
  const { rows } = await getPool().query(
    `select id, name, phone, note
     from public.customers
     where is_active
     order by updated_at desc nulls last, created_at desc
     limit $1`,
    [Math.min(Math.max(limit, 1), 2000)]
  );
  return rows.map(mapCustomer);
}

/**
 * Lưu khách: tên bắt buộc, SĐT không bắt buộc.
 * - Có id → cập nhật.
 * - Có SĐT trùng khách active → cập nhật tên/ghi chú khách đó.
 * - Không → tạo mới.
 */
export async function repoUpsertCustomer(input: UpsertCustomerInput): Promise<CustomerRow> {
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("Tên khách không được trống.");
  const phone = String(input.phone ?? "").trim();
  const note = String(input.note ?? "").trim();
  const actor = normalizeActor(input.actorUsername);

  if (input.id) {
    const { rows } = await getPool().query(
      `update public.customers
       set name = $2,
           phone = $3,
           note = $4,
           updated_by = coalesce($5, updated_by),
           updated_at = now()
       where id = $1 and is_active
       returning id, name, phone, note`,
      [input.id, name, phone, note, actor]
    );
    if (!rows[0]) throw new Error("Không tìm thấy khách để cập nhật.");
    return mapCustomer(rows[0]);
  }

  if (phone) {
    const existing = await getPool().query(
      `select id from public.customers
       where is_active and phone = $1
       limit 1`,
      [phone]
    );
    if (existing.rows[0]?.id) {
      const { rows } = await getPool().query(
        `update public.customers
         set name = $2,
             note = case when $3 = '' then note else $3 end,
             updated_by = coalesce($4, updated_by),
             updated_at = now()
         where id = $1
         returning id, name, phone, note`,
        [existing.rows[0].id, name, note, actor]
      );
      return mapCustomer(rows[0]);
    }
  }

  const { rows } = await getPool().query(
    `insert into public.customers (name, phone, note, created_by, updated_by)
     values ($1, $2, $3, $4, $4)
     returning id, name, phone, note`,
    [name, phone, note, actor]
  );
  if (!rows[0]) throw new Error("Không tạo được khách hàng.");
  return mapCustomer(rows[0]);
}
