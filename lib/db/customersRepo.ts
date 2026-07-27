import { getPool, withTransaction } from "./pool";

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

export type DuplicatePhoneGroup = {
  phoneDigits: string;
  phoneDisplay: string;
  customers: CustomerRow[];
};

export type MergeCustomersInput = {
  keepId: string;
  mergeIds: string[];
  actorUsername?: string;
};

function normalizeActor(value?: string | null): string | null {
  const t = String(value ?? "").trim();
  return t || null;
}

/** Chỉ giữ chữ số — so khớp SĐT (bỏ space, dấu, +84…). */
export function digitsPhone(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
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
 * - Có SĐT (chuẩn hóa digits) trùng khách active → cập nhật.
 * - Không → tạo mới.
 */
export async function repoUpsertCustomer(input: UpsertCustomerInput): Promise<CustomerRow> {
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("Tên khách không được trống.");
  const phone = String(input.phone ?? "").trim();
  const phoneDigits = digitsPhone(phone);
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

  if (phoneDigits.length >= 8) {
    const existing = await getPool().query(
      `select id from public.customers
       where is_active
         and length(regexp_replace(coalesce(phone, ''), '\\D', '', 'g')) >= 8
         and regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = $1
       order by updated_at desc nulls last
       limit 1`,
      [phoneDigits]
    );
    if (existing.rows[0]?.id) {
      const { rows } = await getPool().query(
        `update public.customers
         set name = $2,
             phone = case when $3 = '' then phone else $3 end,
             address = case when $4 = '' then address else $4 end,
             note = case when $5 = '' then note else $5 end,
             updated_by = coalesce($6, updated_by),
             updated_at = now()
         where id = $1
         returning id, name, phone, coalesce(address, '') as address, note`,
        [existing.rows[0].id, name, phone, address, note, actor]
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

/** Soft-delete khách (is_active = false). */
export async function repoDeactivateCustomer(
  id: string,
  actorUsername?: string
): Promise<void> {
  const actor = normalizeActor(actorUsername);
  const { rows } = await getPool().query(
    `update public.customers
     set is_active = false,
         updated_by = coalesce($2, updated_by),
         updated_at = now()
     where id = $1 and is_active
     returning id`,
    [id, actor]
  );
  if (!rows[0]) throw new Error("Không tìm thấy khách để xóa.");
}

/** Nhóm SĐT trùng (chuẩn hóa digits, ≥8 số, ≥2 hồ sơ active). */
export async function repoListDuplicatePhoneGroups(): Promise<DuplicatePhoneGroup[]> {
  const rows = await repoListCustomers(2000);
  const map = new Map<string, CustomerRow[]>();
  for (const c of rows) {
    const d = digitsPhone(c.phone);
    if (d.length < 8) continue;
    const list = map.get(d) ?? [];
    list.push(c);
    map.set(d, list);
  }
  return Array.from(map.entries())
    .filter(([, list]) => list.length > 1)
    .map(([phoneDigits, customers]) => ({
      phoneDigits,
      phoneDisplay: customers.find((c) => c.phone.trim())?.phone || phoneDigits,
      customers,
    }))
    .sort((a, b) => b.customers.length - a.customers.length);
}

/**
 * Gộp hồ sơ trùng:
 * - Giữ keepId, ẩn mergeIds
 * - Chuyển sales.customer_id → keep
 * - Gộp address/note trống của keep từ bản merge (lấy bản đầu có data)
 */
export async function repoMergeCustomers(
  input: MergeCustomersInput
): Promise<CustomerRow> {
  const keepId = String(input.keepId || "").trim();
  const mergeIds = Array.from(
    new Set(
      (input.mergeIds || [])
        .map((id) => String(id || "").trim())
        .filter((id) => id && id !== keepId)
    )
  );
  if (!keepId) throw new Error("Thiếu hồ sơ giữ lại.");
  if (!mergeIds.length) throw new Error("Chọn ít nhất 1 hồ sơ để gộp vào.");
  const actor = normalizeActor(input.actorUsername);

  return withTransaction(async (client) => {
    const keepRes = await client.query(
      `select id, name, phone, coalesce(address, '') as address, note
       from public.customers where id = $1 and is_active for update`,
      [keepId]
    );
    if (!keepRes.rows[0]) throw new Error("Không tìm thấy hồ sơ giữ lại.");

    const mergeRes = await client.query(
      `select id, name, phone, coalesce(address, '') as address, note
       from public.customers
       where id = any($1::uuid[]) and is_active
       for update`,
      [mergeIds]
    );
    if (mergeRes.rows.length !== mergeIds.length) {
      throw new Error("Một số hồ sơ gộp không còn active / không tồn tại.");
    }

    const keep = mapCustomer(keepRes.rows[0]);
    const merged = mergeRes.rows.map(mapCustomer);

    let nextAddress = keep.address.trim();
    let nextNote = keep.note.trim();
    let nextPhone = keep.phone.trim();
    let nextName = keep.name.trim();

    for (const m of merged) {
      if (!nextAddress && m.address.trim()) nextAddress = m.address.trim();
      if (!nextNote && m.note.trim()) nextNote = m.note.trim();
      if (!nextPhone && m.phone.trim()) nextPhone = m.phone.trim();
      // Giữ tên keep; nếu keep là "Khách lẻ" mà merge có tên thật → lấy tên merge
      if (
        (!nextName || nextName.toLowerCase() === "khách lẻ" || nextName.toLowerCase() === "khach le") &&
        m.name.trim() &&
        m.name.trim().toLowerCase() !== "khách lẻ" &&
        m.name.trim().toLowerCase() !== "khach le"
      ) {
        nextName = m.name.trim();
      }
    }

    await client.query(
      `update public.customers
       set name = $2,
           phone = $3,
           address = $4,
           note = $5,
           updated_by = coalesce($6, updated_by),
           updated_at = now()
       where id = $1`,
      [keepId, nextName, nextPhone, nextAddress, nextNote, actor]
    );

    // Chuyển phiếu bán sang hồ sơ giữ
    await client.query(
      `update public.sales
       set customer_id = $1,
           updated_at = now()
       where customer_id = any($2::uuid[])`,
      [keepId, mergeIds]
    );

    // Ẩn hồ sơ trùng
    await client.query(
      `update public.customers
       set is_active = false,
           updated_by = coalesce($2, updated_by),
           updated_at = now()
       where id = any($1::uuid[]) and is_active`,
      [mergeIds, actor]
    );

    const { rows } = await client.query(
      `select id, name, phone, coalesce(address, '') as address, note
       from public.customers where id = $1`,
      [keepId]
    );
    return mapCustomer(rows[0]);
  });
}
