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
      return mapPhone(rows[0], idToCode);
    }

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
    return mapPhone(rows[0], idToCode);
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
