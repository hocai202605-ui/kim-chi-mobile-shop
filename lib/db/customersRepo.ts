import { getPool } from "./pool";

export type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  address: string;
  note: string;
};

export type UpsertCustomerInput = {
  id?: string;
  name: string;
  phone?: string;
  address?: string;
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
  address?: string | null;
  note: string | null;
}): CustomerRow {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    phone: String(row.phone ?? ""),
    address: String(row.address ?? ""),
    note: String(row.note ?? ""),
  };
}

/** Danh sách khách active (mới nhất trước). */
export async function repoListCustomers(limit = 500): Promise<CustomerRow[]> {
  const { rows } = await getPool().query(
    `select id, name, phone, coalesce(address, '') as address, note
     from public.customers
     where is_active
     order by updated_at desc nulls last, created_at desc
     limit $1`,
    [Math.min(Math.max(limit, 1), 2000)]
  );
  return rows.map(mapCustomer);
}

/**
 * Lưu khách: tên bắt buộc, SĐT / địa chỉ không bắt buộc.
 * - Có id → cập nhật.
 * - Có SĐT trùng khách active → cập nhật.
 * - Không → tạo mới.
 */
export async function repoUpsertCustomer(input: UpsertCustomerInput): Promise<CustomerRow> {
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("Tên khách không được trống.");
  const phone = String(input.phone ?? "").trim();
  const address = String(input.address ?? "").trim();
  const note = String(input.note ?? "").trim();
  const actor = normalizeActor(input.actorUsername);

  if (input.id) {
    const { rows } = await getPool().query(
      `update public.customers
       set name = $2,
           phone = $3,
           address = $4,
           note = $5,
           updated_by = coalesce($6, updated_by),
           updated_at = now()
       where id = $1 and is_active
       returning id, name, phone, coalesce(address, '') as address, note`,
      [input.id, name, phone, address, note, actor]
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
             address = case when $3 = '' then address else $3 end,
             note = case when $4 = '' then note else $4 end,
             updated_by = coalesce($5, updated_by),
             updated_at = now()
         where id = $1
         returning id, name, phone, coalesce(address, '') as address, note`,
        [existing.rows[0].id, name, address, note, actor]
      );
      return mapCustomer(rows[0]);
    }
  }

  const { rows } = await getPool().query(
    `insert into public.customers (name, phone, address, note, created_by, updated_by)
     values ($1, $2, $3, $4, $5, $5)
     returning id, name, phone, coalesce(address, '') as address, note`,
    [name, phone, address, note, actor]
  );
  if (!rows[0]) throw new Error("Không tạo được khách hàng.");
  return mapCustomer(rows[0]);
}
