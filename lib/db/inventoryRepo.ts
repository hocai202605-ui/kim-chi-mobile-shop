import type { Accessory, PhoneItem, StoreId } from "@/types";
import {
  accessoryStatusToDb,
  accessoryStatusToUi,
  phoneStatusToDb,
  phoneStatusToUi,
} from "@/lib/mappers/inventory";
import { getPool, withTransaction } from "./pool";
import type { PoolClient } from "pg";

type StoreRow = { id: string; code: string };

async function loadStoreMaps() {
  const { rows } = await getPool().query<StoreRow>(
    `select id, code from public.stores where is_active = true`
  );
  const codeToId = new Map(rows.map((r) => [r.code, r.id]));
  const idToCode = new Map(rows.map((r) => [r.id, r.code as Exclude<StoreId, "all">]));
  return { codeToId, idToCode };
}

/** Skip status-guard triggers for this transaction only (same connection). */
async function skipStatusGuard(client: PoolClient) {
  await client.query(`select set_config('app.skip_status_guard', 'on', true)`);
}

function mapPhone(
  row: Record<string, unknown>,
  idToCode: Map<string, Exclude<StoreId, "all">>
): PhoneItem {
  return {
    id: String(row.id),
    brand: String(row.brand),
    name: String(row.model_name),
    imei: String(row.imei),
    color: String(row.color ?? ""),
    storage: String(row.storage ?? ""),
    madeIn: String(row.made_in ?? ""),
    networkVersion: String(row.network_version ?? ""),
    batteryCondition: String(row.battery_condition ?? ""),
    batteryCapacity: row.battery_capacity ? String(row.battery_capacity) : undefined,
    condition: String(row.condition ?? ""),
    note: row.note ? String(row.note) : undefined,
    importDate: row.import_date ? String(row.import_date).slice(0, 10) : undefined,
    saleDate: row.sale_date ? String(row.sale_date).slice(0, 10) : undefined,
    storeId: idToCode.get(String(row.store_id)) ?? "store-1",
    cost: Number(row.cost),
    expectedPrice: Number(row.expected_price),
    status: phoneStatusToUi(row.status as "in_stock" | "sold" | "pending" | "cancelled"),
  };
}

function mapAccessory(
  row: Record<string, unknown>,
  idToCode: Map<string, Exclude<StoreId, "all">>
): Accessory {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    storeId: idToCode.get(String(row.store_id)) ?? "store-1",
    quantity: Number(row.quantity),
    cost: Number(row.cost),
    price: Number(row.price),
    status: accessoryStatusToUi(row.status as "in_stock" | "out_of_stock" | "cancelled"),
  };
}

export async function repoListPhones(): Promise<PhoneItem[]> {
  const { idToCode } = await loadStoreMaps();
  const { rows } = await getPool().query(
    `select * from public.phones order by expected_price desc`
  );
  return rows.map((r) => mapPhone(r, idToCode));
}

export async function repoListAccessories(): Promise<Accessory[]> {
  const { idToCode } = await loadStoreMaps();
  const { rows } = await getPool().query(
    `select * from public.accessories order by price desc`
  );
  return rows.map((r) => mapAccessory(r, idToCode));
}

export async function repoUpsertPhone(
  input: Omit<PhoneItem, "id"> & { id?: string }
): Promise<PhoneItem> {
  const { codeToId, idToCode } = await loadStoreMaps();
  const storeId = codeToId.get(input.storeId);
  if (!storeId) throw new Error(`Không tìm thấy cửa hàng ${input.storeId}`);

  const status = phoneStatusToDb(input.status);

  return withTransaction(async (client) => {
    // keep set_config for older DBs that still have guards; no-op after migration drop
    await skipStatusGuard(client);

    let saved: PhoneItem;

    if (input.id) {
      const { rows } = await client.query(
        `update public.phones set
          store_id = $1, brand = $2, model_name = $3, imei = $4,
          color = $5, storage = $6, made_in = $7, network_version = $8,
          battery_condition = $9, battery_capacity = $10, condition = $11, note = $12,
          import_date = $13, sale_date = $14, cost = $15, expected_price = $16,
          status = $17::public.phone_status,
          updated_at = now()
        where id = $18
        returning *`,
        [
          storeId,
          input.brand,
          input.name,
          input.imei.trim(),
          input.color ?? "",
          input.storage ?? "",
          input.madeIn ?? "",
          input.networkVersion ?? "",
          input.batteryCondition ?? "",
          input.batteryCapacity ?? "",
          input.condition ?? "",
          input.note ?? "",
          input.importDate || null,
          input.saleDate || null,
          Math.round(input.cost),
          Math.round(input.expectedPrice),
          status,
          input.id,
        ]
      );
      if (!rows[0]) throw new Error("Không tìm thấy máy để cập nhật.");
      saved = mapPhone(rows[0], idToCode);
    } else {
      const { rows } = await client.query(
        `insert into public.phones (
          store_id, brand, model_name, imei, color, storage, made_in, network_version,
          battery_condition, battery_capacity, condition, note, import_date, sale_date,
          cost, expected_price, status
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::public.phone_status
        ) returning *`,
        [
          storeId,
          input.brand,
          input.name,
          input.imei.trim(),
          input.color ?? "",
          input.storage ?? "",
          input.madeIn ?? "",
          input.networkVersion ?? "",
          input.batteryCondition ?? "",
          input.batteryCapacity ?? "",
          input.condition ?? "",
          input.note ?? "",
          input.importDate || null,
          input.saleDate || null,
          Math.round(input.cost),
          Math.round(input.expectedPrice),
          status,
        ]
      );
      saved = mapPhone(rows[0], idToCode);
    }

    // Persist dropdown values into lookup_items so options survive reload
    await repoSyncPhoneLookupsFromValues(saved, client);
    return saved;
  });
}

export async function repoUpsertAccessory(
  input: Omit<Accessory, "id"> & { id?: string }
): Promise<Accessory> {
  const { codeToId, idToCode } = await loadStoreMaps();
  const storeId = codeToId.get(input.storeId);
  if (!storeId) throw new Error(`Không tìm thấy cửa hàng ${input.storeId}`);

  const qty = Math.max(0, Math.round(input.quantity));
  let status = accessoryStatusToDb(input.status);
  if (status === "cancelled" && !input.id) {
    status = qty > 0 ? "in_stock" : "out_of_stock";
  }

  return withTransaction(async (client) => {
    await skipStatusGuard(client);

    if (input.id) {
      const { rows } = await client.query(
        `update public.accessories set
          store_id = $1, code = $2, name = $3, quantity = $4,
          cost = $5, price = $6,
          status = case when $7 = 'cancelled' then status else $7::public.accessory_status end,
          updated_at = now()
        where id = $8
        returning *`,
        [
          storeId,
          input.code.trim(),
          input.name,
          qty,
          Math.round(input.cost),
          Math.round(input.price),
          status,
          input.id,
        ]
      );
      if (!rows[0]) throw new Error("Không tìm thấy phụ kiện để cập nhật.");
      return mapAccessory(rows[0], idToCode);
    }

    const { rows } = await client.query(
      `insert into public.accessories (store_id, code, name, quantity, cost, price, status)
       values ($1,$2,$3,$4,$5,$6, case when $4 > 0 then 'in_stock'::public.accessory_status else 'out_of_stock'::public.accessory_status end)
       returning *`,
      [storeId, input.code.trim(), input.name, qty, Math.round(input.cost), Math.round(input.price)]
    );
    return mapAccessory(rows[0], idToCode);
  });
}

export async function repoCancelPhone(id: string): Promise<PhoneItem> {
  const { idToCode } = await loadStoreMaps();
  return withTransaction(async (client) => {
    await skipStatusGuard(client);
    const { rows } = await client.query(
      `update public.phones
       set status = 'cancelled', cancelled_at = now(), updated_at = now()
       where id = $1 and status <> 'cancelled'
       returning *`,
      [id]
    );
    if (!rows[0]) throw new Error("Không hủy được máy (không tìm thấy hoặc đã hủy).");
    return mapPhone(rows[0], idToCode);
  });
}

export async function repoCancelAccessory(id: string): Promise<Accessory> {
  const { idToCode } = await loadStoreMaps();
  return withTransaction(async (client) => {
    await skipStatusGuard(client);
    const { rows } = await client.query(
      `update public.accessories
       set status = 'cancelled', cancelled_at = now(), updated_at = now()
       where id = $1 and status <> 'cancelled'
       returning *`,
      [id]
    );
    if (!rows[0]) throw new Error("Không hủy được phụ kiện (không tìm thấy hoặc đã hủy).");
    return mapAccessory(rows[0], idToCode);
  });
}

export async function repoListLookupLabels(categoryCode: string): Promise<string[]> {
  const { rows } = await getPool().query<{ label: string }>(
    `select i.label
     from public.lookup_items i
     join public.lookup_categories c on c.id = i.category_id
     where c.code = $1 and c.is_active and i.is_active
     order by i.sort_order, i.label`,
    [categoryCode]
  );
  return rows.map((r) => r.label);
}

/** One query for many lookup categories — avoids N parallel API/DB connections. */
export async function repoListLookupsByCategories(
  categoryCodes: string[]
): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const code of categoryCodes) out[code] = [];
  if (!categoryCodes.length) return out;

  const { rows } = await getPool().query<{ code: string; label: string }>(
    `select c.code, i.label
     from public.lookup_items i
     join public.lookup_categories c on c.id = i.category_id
     where c.code = any($1::text[]) and c.is_active and i.is_active
     order by c.code, i.sort_order, i.label`,
    [categoryCodes]
  );
  for (const row of rows) {
    if (!out[row.code]) out[row.code] = [];
    out[row.code].push(row.label);
  }
  return out;
}

/** Map lookup category → phones column (for rename cascade). */
const LOOKUP_PHONE_COLUMN: Record<string, string> = {
  phone_brand: "brand",
  phone_model_name: "model_name",
  phone_color: "color",
  phone_storage: "storage",
  phone_made_in: "made_in",
  phone_condition: "condition",
  phone_battery_condition: "battery_condition",
  phone_battery_capacity: "battery_capacity",
};

async function slugifyLabel(client: PoolClient, label: string): Promise<string> {
  const { rows } = await client.query<{ code: string }>(
    `select coalesce(nullif(public.slugify_label($1), ''), 'item-' || substr(gen_random_uuid()::text, 1, 8)) as code`,
    [label]
  );
  return rows[0]?.code ?? `item-${Date.now()}`;
}

async function getLookupCategory(
  client: PoolClient,
  categoryCode: string
): Promise<{ id: string; allow_user_add: boolean }> {
  const { rows } = await client.query<{ id: string; allow_user_add: boolean }>(
    `select id, allow_user_add from public.lookup_categories
     where code = $1 and is_active
     for update`,
    [categoryCode]
  );
  if (!rows[0]) throw new Error("lookup_category_not_found");
  return rows[0];
}

/**
 * Ensure label exists (active) in category. Reactivates inactive same code, or inserts.
 * Idempotent by lower(label) match on active rows.
 */
export async function repoEnsureLookupLabel(
  categoryCode: string,
  label: string,
  client?: PoolClient
): Promise<string> {
  const trimmed = label.trim();
  if (!trimmed) return "";

  const run = async (c: PoolClient) => {
    const cat = await getLookupCategory(c, categoryCode);

    const activeByLabel = await c.query<{ id: string; label: string }>(
      `select id, label from public.lookup_items
       where category_id = $1 and is_active and lower(label) = lower($2)
       limit 1`,
      [cat.id, trimmed]
    );
    if (activeByLabel.rows[0]) return activeByLabel.rows[0].label;

    const code = await slugifyLabel(c, trimmed);

    const inactive = await c.query<{ id: string }>(
      `select id from public.lookup_items
       where category_id = $1 and lower(code) = lower($2) and not is_active
       limit 1`,
      [cat.id, code]
    );
    if (inactive.rows[0]) {
      const { rows } = await c.query<{ label: string }>(
        `update public.lookup_items
         set is_active = true, label = $2, updated_at = now()
         where id = $1
         returning label`,
        [inactive.rows[0].id, trimmed]
      );
      return rows[0]?.label ?? trimmed;
    }

    const activeByCode = await c.query<{ id: string; label: string }>(
      `select id, label from public.lookup_items
       where category_id = $1 and lower(code) = lower($2) and is_active
       limit 1`,
      [cat.id, code]
    );
    if (activeByCode.rows[0]) {
      // Same slug, different label — keep existing option; still OK for phone free-text.
      return activeByCode.rows[0].label;
    }

    const maxSort = await c.query<{ m: number }>(
      `select coalesce(max(sort_order), 0)::int as m from public.lookup_items where category_id = $1`,
      [cat.id]
    );
    const sortOrder = (maxSort.rows[0]?.m ?? 0) + 10;

    const { rows } = await c.query<{ label: string }>(
      `insert into public.lookup_items (category_id, code, label, sort_order, is_system)
       values ($1, $2, $3, $4, false)
       returning label`,
      [cat.id, code, trimmed, sortOrder]
    );
    return rows[0]?.label ?? trimmed;
  };

  if (client) return run(client);
  return withTransaction(run);
}

/** Ensure many labels (skip empties). */
export async function repoEnsureLookupLabels(
  pairs: { categoryCode: string; label: string }[],
  client?: PoolClient
): Promise<void> {
  const filtered = pairs.filter((p) => p.label?.trim());
  if (!filtered.length) return;

  const run = async (c: PoolClient) => {
    for (const p of filtered) {
      await repoEnsureLookupLabel(p.categoryCode, p.label, c);
    }
  };
  if (client) return run(client);
  return withTransaction(run);
}

/** Add option (or reactivate). Throws if duplicate active label. */
export async function repoAddLookupLabel(categoryCode: string, label: string): Promise<string> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Nhãn option không được để trống.");

  return withTransaction(async (client) => {
    const cat = await getLookupCategory(client, categoryCode);
    if (!cat.allow_user_add) throw new Error("lookup_add_not_allowed");

    const exists = await client.query(
      `select 1 from public.lookup_items
       where category_id = $1 and is_active and lower(label) = lower($2)
       limit 1`,
      [cat.id, trimmed]
    );
    if (exists.rowCount) throw new Error(`Option "${trimmed}" đã có trong danh sách.`);

    return repoEnsureLookupLabel(categoryCode, trimmed, client);
  });
}

/** Rename option by label; cascade to phones free-text column when mapped. */
export async function repoRenameLookupLabel(
  categoryCode: string,
  oldLabel: string,
  newLabel: string
): Promise<string> {
  const from = oldLabel.trim();
  const to = newLabel.trim();
  if (!from) throw new Error("lookup_item_not_found");
  if (!to) throw new Error("Nhãn option không được để trống.");
  if (from.toLowerCase() === to.toLowerCase() && from !== to) {
    // only casing change — still update
  } else if (from === to) {
    return to;
  }

  return withTransaction(async (client) => {
    const cat = await getLookupCategory(client, categoryCode);

    const { rows: found } = await client.query<{ id: string }>(
      `select id from public.lookup_items
       where category_id = $1 and is_active and lower(label) = lower($2)
       limit 1
       for update`,
      [cat.id, from]
    );
    if (!found[0]) throw new Error("lookup_item_not_found");

    const clash = await client.query(
      `select 1 from public.lookup_items
       where category_id = $1 and is_active and lower(label) = lower($2) and id <> $3
       limit 1`,
      [cat.id, to, found[0].id]
    );
    if (clash.rowCount) throw new Error(`Option "${to}" đã có trong danh sách.`);

    const { rows } = await client.query<{ label: string }>(
      `update public.lookup_items
       set label = $2, updated_at = now()
       where id = $1
       returning label`,
      [found[0].id, to]
    );

    const col = LOOKUP_PHONE_COLUMN[categoryCode];
    if (col && from !== to) {
      // only allow known columns from map (not user input)
      await client.query(
        `update public.phones set ${col} = $1, updated_at = now() where ${col} = $2`,
        [to, from]
      );
    }

    return rows[0]?.label ?? to;
  });
}

/** Soft-deactivate option by label (owner-style; app-level allows all staff for MVP). */
export async function repoDeactivateLookupLabel(
  categoryCode: string,
  label: string
): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("lookup_item_not_found");

  await withTransaction(async (client) => {
    const cat = await getLookupCategory(client, categoryCode);
    const { rowCount } = await client.query(
      `update public.lookup_items
       set is_active = false, updated_at = now()
       where category_id = $1 and is_active and lower(label) = lower($2)`,
      [cat.id, trimmed]
    );
    if (!rowCount) throw new Error("lookup_item_not_found");
  });
}

/** Phone field values → ensure present in lookup tables. */
export async function repoSyncPhoneLookupsFromValues(
  phone: Pick<
    PhoneItem,
    | "brand"
    | "name"
    | "color"
    | "storage"
    | "madeIn"
    | "condition"
    | "batteryCondition"
    | "batteryCapacity"
  >,
  client?: PoolClient
): Promise<void> {
  await repoEnsureLookupLabels(
    [
      { categoryCode: "phone_brand", label: phone.brand },
      { categoryCode: "phone_model_name", label: phone.name },
      { categoryCode: "phone_color", label: phone.color },
      { categoryCode: "phone_storage", label: phone.storage },
      { categoryCode: "phone_made_in", label: phone.madeIn },
      { categoryCode: "phone_condition", label: phone.condition },
      { categoryCode: "phone_battery_condition", label: phone.batteryCondition },
      { categoryCode: "phone_battery_capacity", label: phone.batteryCapacity ?? "" },
    ],
    client
  );
}

/** Single round-trip bundle for inventory page bootstrap. */
export async function repoInventoryBootstrap(lookupCategoryCodes: string[]) {
  const [phones, accessories, lookups] = await Promise.all([
    repoListPhones(),
    repoListAccessories(),
    repoListLookupsByCategories(lookupCategoryCodes),
  ]);
  return { phones, accessories, lookups };
}

export async function repoReportMonthly(yearMonth: string, storeCode?: StoreId) {
  const pool = getPool();
  let storeId: string | null = null;
  if (storeCode && storeCode !== "all") {
    const { codeToId } = await loadStoreMaps();
    storeId = codeToId.get(storeCode) ?? null;
  }

  const { rows } = await pool.query(
    `select
      coalesce(sum(case when si.item_type = 'phone' then si.quantity else 0 end), 0)::bigint as sold_phones,
      coalesce(sum(s.total_amount), 0)::bigint as revenue,
      coalesce(sum(s.total_profit), 0)::bigint as profit
     from public.sales s
     left join public.sale_items si on si.sale_id = s.id and si.sale_status = 'completed'
     where s.status = 'completed'
       and to_char(s.sold_at, 'YYYY-MM') = $1
       and ($2::uuid is null or s.store_id = $2)`,
    [yearMonth, storeId]
  );
  const row = rows[0] ?? {};
  return {
    soldPhones: Number(row.sold_phones ?? 0),
    revenue: Number(row.revenue ?? 0),
    profit: Number(row.profit ?? 0),
  };
}

export async function repoReportYearly(year: number, storeCode?: StoreId) {
  const pool = getPool();
  let storeId: string | null = null;
  if (storeCode && storeCode !== "all") {
    const { codeToId } = await loadStoreMaps();
    storeId = codeToId.get(storeCode) ?? null;
  }

  const { rows } = await pool.query(
    `with months as (select generate_series(1, 12) as month),
     agg as (
       select extract(month from s.sold_at)::int as month,
         coalesce(sum(s.total_amount), 0)::bigint as revenue,
         coalesce(sum(s.total_profit), 0)::bigint as profit,
         coalesce(sum(case when si.item_type = 'phone' then si.quantity else 0 end), 0)::bigint as sold
       from public.sales s
       left join public.sale_items si on si.sale_id = s.id and si.sale_status = 'completed'
       where s.status = 'completed'
         and extract(year from s.sold_at) = $1
         and ($2::uuid is null or s.store_id = $2)
       group by 1
     )
     select m.month,
       coalesce(a.revenue, 0)::bigint as revenue,
       coalesce(a.profit, 0)::bigint as profit,
       coalesce(a.sold, 0)::bigint as sold
     from months m
     left join agg a on a.month = m.month
     order by m.month`,
    [year, storeId]
  );

  return rows.map((row) => ({
    month: Number(row.month),
    revenue: Number(row.revenue),
    profit: Number(row.profit),
    sold: Number(row.sold),
  }));
}
