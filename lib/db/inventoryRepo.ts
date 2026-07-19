import type { Accessory, PhoneItem, StoreId } from "@/types";
import { shopMoneyToVnd, toShopMoney, vndToShopMoney } from "@/lib/format";
import { toVnDate, toVnDateTimeLocal, vnDateTimeLocalToIso } from "@/lib/datetime";
import {
  accessoryStatusToDb,
  accessoryStatusToUi,
  phoneStatusToDb,
  phoneStatusToUi,
} from "@/lib/mappers/inventory";
import { getPool, withTransaction } from "./pool";
import type { PoolClient } from "pg";

/** Một dòng trong phiếu bán (multi-line). */
export type CreateSaleLineInput =
  | {
      itemType: "phone";
      phoneId: string;
      /** Giá bán 1 máy (short shop OK). */
      unitPrice: number;
    }
  | {
      itemType: "accessory";
      /** Free-text: tên PK gõ tay (không trừ tồn nếu không có accessoryId). */
      itemName: string;
      /** Loại PK (Ốp, củ sạc…) — ghép vào item_name khi lưu. */
      category?: string;
      quantity: number;
      /** Đơn giá 1 cái (short shop OK). Thành tiền = unitPrice × quantity. */
      unitPrice: number;
      /** Giá nhập short 1 cái (free-text); PK kho lấy cost từ DB. */
      unitCost?: number;
      /** Tuỳ chọn — nếu có thì trừ tồn kho PK. */
      accessoryId?: string;
    };

export type CreateSaleInput = {
  storeId: Exclude<StoreId, "all">;
  payment: "cash" | "transfer" | "card" | "other" | "debt" | "partial";
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  note?: string;
  /**
   * Ngày giờ bán — `YYYY-MM-DDTHH:mm` (giờ VN) hoặc ISO.
   * Mặc định: now VN.
   */
  soldAt?: string;
  /** Username app_accounts — created_by / updated_by. */
  actorUsername?: string;
  /** Nhiều dòng / phiếu. Ưu tiên hơn single-item legacy. */
  lines?: CreateSaleLineInput[];
  /** @deprecated Dùng lines[]. Giữ tương thích API cũ 1 dòng. */
  itemType?: "phone" | "accessory";
  phoneId?: string;
  accessoryId?: string;
  quantity?: number;
  /**
   * Legacy single-line: Máy = giá 1 máy; PK gắn kho = tổng dòng.
   * Multi-line (lines[]): luôn là đơn giá.
   */
  unitPrice?: number;
};

/** Phiếu bán trả về UI — amount/profit đơn vị **short shop** (giống kho). */
export type CreatedSale = {
  id: string;
  soldAt: string;
  storeId: Exclude<StoreId, "all">;
  itemName: string;
  itemType: "Máy" | "Phụ kiện";
  quantity: number;
  /** Short shop (DB VND ÷ 1000). */
  amount: number;
  /** Short shop (DB VND ÷ 1000). */
  profit: number;
  payment: string;
  status: "Hoàn tất" | "Đã hủy";
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  /** Ghi chú phiếu (vd: bảo hành bán máy). */
  note?: string;
  lineCount?: number;
};

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

/**
 * PG `date` / `timestamptz` → `YYYY-MM-DD` theo lịch Việt Nam (Asia/Ho_Chi_Minh).
 *
 * Không dùng getUTC* / toISOString().slice(0,10):
 * - node-pg map cột `date` → Date lúc 00:00 **local**
 * - trên máy UTC+7 (VN), getUTC* lùi 1 ngày → grid bán hàng nhảy sai ngày
 * Không dùng String(date).slice(0,10) — ra "Wed Jul 01" mất năm → UI hiện 2001.
 */
function toDateOnly(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    const vn = toVnDate(value);
    return vn || undefined;
  }
  const s = String(value).trim();
  // Pure calendar date as stored — keep as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const vn = toVnDate(s);
  return vn || undefined;
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
    importDate: toDateOnly(row.import_date),
    saleDate: toDateOnly(row.sale_date),
    storeId: idToCode.get(String(row.store_id)) ?? "store-1",
    cost: toShopMoney(Number(row.cost)),
    expectedPrice: toShopMoney(Number(row.expected_price)),
    status: phoneStatusToUi(row.status as "in_stock" | "sold" | "pending" | "cancelled"),
  };
}

function mapAccessory(
  row: Record<string, unknown>,
  idToCode: Map<string, Exclude<StoreId, "all">>
): Accessory {
  return {
    id: String(row.id),
    category: String(row.category ?? ""),
    brand: String(row.brand ?? ""),
    code: String(row.code),
    name: String(row.name),
    storeId: idToCode.get(String(row.store_id)) ?? "store-1",
    quantity: Number(row.quantity),
    cost: toShopMoney(Number(row.cost)),
    price: toShopMoney(Number(row.price)),
    status: accessoryStatusToUi(row.status as "in_stock" | "out_of_stock" | "cancelled"),
    note: row.note ? String(row.note) : undefined,
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

function normalizeActorUsername(value?: string | null): string | null {
  const t = String(value ?? "").trim();
  return t || null;
}

export async function repoUpsertPhone(
  input: Omit<PhoneItem, "id"> & { id?: string; actorUsername?: string }
): Promise<PhoneItem> {
  const { codeToId, idToCode } = await loadStoreMaps();
  const storeId = codeToId.get(input.storeId);
  if (!storeId) throw new Error(`Không tìm thấy cửa hàng ${input.storeId}`);

  const status = phoneStatusToDb(input.status);
  const actor = normalizeActorUsername(input.actorUsername);

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
          updated_by = coalesce($18, updated_by),
          updated_at = now()
        where id = $19
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
          toShopMoney(Number(input.cost)),
          toShopMoney(Number(input.expectedPrice)),
          status,
          actor,
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
          cost, expected_price, status,
          created_by, updated_by
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::public.phone_status,$18,$18
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
          toShopMoney(Number(input.cost)),
          toShopMoney(Number(input.expectedPrice)),
          status,
          actor,
        ]
      );
      saved = mapPhone(rows[0], idToCode);
    }

    // Droplist chỉ cập nhật khi bấm nút + (ManageableSelect), không auto-ensure khi lưu máy.
    return saved;
  });
}

export async function repoUpsertAccessory(
  input: Omit<Accessory, "id"> & { id?: string; actorUsername?: string }
): Promise<Accessory> {
  const { codeToId, idToCode } = await loadStoreMaps();
  const storeId = codeToId.get(input.storeId);
  if (!storeId) throw new Error(`Không tìm thấy cửa hàng ${input.storeId}`);

  const code = String(input.code ?? "").trim();
  const name = String(input.name ?? "").trim();
  if (!code) throw new Error("Mã hàng không được để trống.");
  if (!name) throw new Error("Tên hàng không được để trống.");

  const qty = Math.max(0, Math.round(Number(input.quantity) || 0));
  let status = accessoryStatusToDb(input.status);
  // Tạo mới: không cho ghi "Đã hủy"; auto theo SL nếu status rỗng/không hợp lệ.
  if (!input.id) {
    if (status === "cancelled") {
      status = qty > 0 ? "in_stock" : "out_of_stock";
    }
  }
  // Còn hàng / hết hàng tự khớp SL khi không phải hủy
  if (status !== "cancelled") {
    status = qty > 0 ? "in_stock" : "out_of_stock";
  }
  const actor = normalizeActorUsername(input.actorUsername);
  const category = String(input.category ?? "").trim();
  const brand = String(input.brand ?? "").trim();
  const note = String(input.note ?? "").trim();
  const cost = toShopMoney(Number(input.cost));
  const price = toShopMoney(Number(input.price));

  return withTransaction(async (client) => {
    await skipStatusGuard(client);

    if (input.id) {
      const { rows } = await client.query(
        `update public.accessories set
          store_id = $1, code = $2, name = $3, quantity = $4,
          cost = $5, price = $6,
          status = case when $7 = 'cancelled' then status else $7::public.accessory_status end,
          category = $8, brand = $9, note = $10,
          updated_by = coalesce($11, updated_by),
          updated_at = now()
        where id = $12
        returning *`,
        [
          storeId,
          code,
          name,
          qty,
          cost,
          price,
          status,
          category,
          brand,
          note,
          actor,
          input.id,
        ]
      );
      if (!rows[0]) throw new Error("Không tìm thấy phụ kiện để cập nhật.");
      // Droplist chỉ cập nhật khi bấm nút + (ManageableSelect), không auto-ensure khi lưu phụ kiện.
      return mapAccessory(rows[0], idToCode);
    }

    const { rows } = await client.query(
      `insert into public.accessories (
         store_id, code, name, quantity, cost, price, status,
         category, brand, note,
         created_by, updated_by
       )
       values (
         $1,$2,$3,$4,$5,$6,$7::public.accessory_status,
         $8,$9,$10,
         $11, $11
       )
       returning *`,
      [
        storeId,
        code,
        name,
        qty,
        cost,
        price,
        status,
        category,
        brand,
        note,
        actor,
      ]
    );
    // Droplist chỉ cập nhật khi bấm nút + (ManageableSelect), không auto-ensure khi lưu phụ kiện.
    return mapAccessory(rows[0], idToCode);
  });
}

export async function repoCancelPhone(
  id: string,
  actorUsername?: string
): Promise<PhoneItem> {
  const { idToCode } = await loadStoreMaps();
  const actor = normalizeActorUsername(actorUsername);
  return withTransaction(async (client) => {
    await skipStatusGuard(client);
    const { rows } = await client.query(
      `update public.phones
       set status = 'cancelled',
           cancelled_at = now(),
           cancelled_by = coalesce($2, cancelled_by),
           updated_by = coalesce($2, updated_by),
           updated_at = now()
       where id = $1 and status <> 'cancelled'
       returning *`,
      [id, actor]
    );
    if (!rows[0]) throw new Error("Không hủy được máy (không tìm thấy hoặc đã hủy).");
    return mapPhone(rows[0], idToCode);
  });
}

export async function repoCancelAccessory(
  id: string,
  actorUsername?: string
): Promise<Accessory> {
  const { idToCode } = await loadStoreMaps();
  const actor = normalizeActorUsername(actorUsername);
  return withTransaction(async (client) => {
    await skipStatusGuard(client);
    const { rows } = await client.query(
      `update public.accessories
       set status = 'cancelled',
           cancelled_at = now(),
           cancelled_by = coalesce($2, cancelled_by),
           updated_by = coalesce($2, updated_by),
           updated_at = now()
       where id = $1 and status <> 'cancelled'
       returning *`,
      [id, actor]
    );
    if (!rows[0]) throw new Error("Không hủy được phụ kiện (không tìm thấy hoặc đã hủy).");
    return mapAccessory(rows[0], idToCode);
  });
}

/** Xóa cứng phụ kiện khỏi DB (và sale_items gắn accessory nếu có). */
export async function repoDeleteAccessory(id: string): Promise<Accessory> {
  const accessoryId = String(id || "").trim();
  if (!accessoryId) throw new Error("Thiếu mã phụ kiện.");
  const { idToCode } = await loadStoreMaps();

  return withTransaction(async (client) => {
    await skipStatusGuard(client);
    // Gỡ dòng bán gắn PK (FK sale_items.accessory_id → accessories)
    await client.query(`delete from public.sale_items where accessory_id = $1`, [accessoryId]);
    const { rows } = await client.query(
      `delete from public.accessories where id = $1 returning *`,
      [accessoryId]
    );
    if (!rows[0]) throw new Error("Không tìm thấy phụ kiện để xóa.");
    return mapAccessory(rows[0], idToCode);
  });
}

/** Xóa cứng máy khỏi DB (và sale_items gắn phone nếu có). */
export async function repoDeletePhone(id: string): Promise<PhoneItem> {
  const phoneId = String(id || "").trim();
  if (!phoneId) throw new Error("Thiếu mã máy.");
  const { idToCode } = await loadStoreMaps();

  return withTransaction(async (client) => {
    await skipStatusGuard(client);
    // Gỡ dòng bán gắn máy (FK sale_items.phone_id → phones)
    await client.query(`delete from public.sale_items where phone_id = $1`, [phoneId]);
    const { rows } = await client.query(
      `delete from public.phones where id = $1 returning *`,
      [phoneId]
    );
    if (!rows[0]) throw new Error("Không tìm thấy máy để xóa.");
    return mapPhone(rows[0], idToCode);
  });
}

async function resolveStoreUuid(
  storeCode: string,
  client?: PoolClient
): Promise<string> {
  const q = client ?? getPool();
  const { rows } = await q.query<{ id: string }>(
    `select id from public.stores where code = $1 and is_active = true limit 1`,
    [storeCode]
  );
  if (!rows[0]?.id) throw new Error(`Không tìm thấy cửa hàng ${storeCode}`);
  return rows[0].id;
}

export async function repoListLookupLabels(
  categoryCode: string,
  storeCode: string
): Promise<string[]> {
  const { rows } = await getPool().query<{ label: string }>(
    `select i.label
     from public.lookup_items i
     join public.lookup_categories c on c.id = i.category_id
     join public.stores s on s.id = i.store_id
     where c.code = $1 and c.is_active and i.is_active and s.code = $2
     order by i.sort_order, i.label`,
    [categoryCode, storeCode]
  );
  return rows.map((r) => r.label);
}

/**
 * All stores × categories in one query.
 * Shape: { "store-1": { phone_brand: [...], ... }, ... }
 */
export async function repoListLookupsByStore(
  categoryCodes: string[]
): Promise<Record<string, Record<string, string[]>>> {
  const out: Record<string, Record<string, string[]>> = {};
  if (!categoryCodes.length) return out;

  const { rows } = await getPool().query<{
    store_code: string;
    code: string;
    label: string;
  }>(
    `select s.code as store_code, c.code, i.label
     from public.lookup_items i
     join public.lookup_categories c on c.id = i.category_id
     join public.stores s on s.id = i.store_id
     where c.code = any($1::text[]) and c.is_active and i.is_active and s.is_active
     order by s.code, c.code, i.sort_order, i.label`,
    [categoryCodes]
  );
  for (const row of rows) {
    if (!out[row.store_code]) out[row.store_code] = {};
    if (!out[row.store_code][row.code]) out[row.store_code][row.code] = [];
    out[row.store_code][row.code].push(row.label);
  }
  // Ensure every active store has empty arrays for requested categories
  const { rows: stores } = await getPool().query<{ code: string }>(
    `select code from public.stores where is_active = true order by code`
  );
  for (const st of stores) {
    if (!out[st.code]) out[st.code] = {};
    for (const cat of categoryCodes) {
      if (!out[st.code][cat]) out[st.code][cat] = [];
    }
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

/** Map lookup category → accessories column (for rename cascade). */
const LOOKUP_ACCESSORY_COLUMN: Record<string, string> = {
  accessory_category: "category",
  accessory_brand: "brand",
};

/** Software order text columns (global table — no store filter). */
const LOOKUP_SOFTWARE_TEXT_COLUMN: Record<string, string> = {
  software_customer: "customer_name",
  software_device: "device_name",
};

/** Software order money columns — cascade by numeric value parsed from label. */
const LOOKUP_SOFTWARE_MONEY_COLUMN: Record<string, string> = {
  software_quote: "quote",
  software_fee: "deposit",
};

/** Repair order text columns (global table — no store filter). */
const LOOKUP_REPAIR_TEXT_COLUMN: Record<string, string> = {
  repair_customer: "customer_name",
  repair_device: "device_name",
  repair_condition: "device_condition",
  repair_warranty: "warranty",
};

/** Repair order money columns — cascade by numeric value parsed from label. */
const LOOKUP_REPAIR_MONEY_COLUMN: Record<string, string> = {
  repair_quote: "quote",
  repair_fee: "deposit",
};

function parseLookupMoneyLabel(label: string): number | null {
  const n = Number(String(label ?? "").replace(/\D/g, "") || "");
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

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
 * Ensure label exists (active) in category for a store.
 * Reactivates inactive same code, or inserts. Scoped by store_id.
 * Chỉ dùng cho thao tác quản lý droplist (nút + / addLookup) — không gọi khi lưu máy/đơn.
 */
export async function repoEnsureLookupLabel(
  categoryCode: string,
  label: string,
  storeCode: string,
  client?: PoolClient
): Promise<string> {
  const trimmed = label.trim();
  if (!trimmed) return "";

  const run = async (c: PoolClient) => {
    const cat = await getLookupCategory(c, categoryCode);
    const storeUuid = await resolveStoreUuid(storeCode, c);

    const activeByLabel = await c.query<{ id: string; label: string }>(
      `select id, label from public.lookup_items
       where category_id = $1 and store_id = $2 and is_active and lower(label) = lower($3)
       limit 1`,
      [cat.id, storeUuid, trimmed]
    );
    if (activeByLabel.rows[0]) return activeByLabel.rows[0].label;

    const code = await slugifyLabel(c, trimmed);

    const inactive = await c.query<{ id: string }>(
      `select id from public.lookup_items
       where category_id = $1 and store_id = $2 and lower(code) = lower($3) and not is_active
       limit 1`,
      [cat.id, storeUuid, code]
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
       where category_id = $1 and store_id = $2 and lower(code) = lower($3) and is_active
       limit 1`,
      [cat.id, storeUuid, code]
    );
    if (activeByCode.rows[0]) {
      // Same slug, different label — keep existing option (explicit + only).
      return activeByCode.rows[0].label;
    }

    const maxSort = await c.query<{ m: number }>(
      `select coalesce(max(sort_order), 0)::int as m
       from public.lookup_items where category_id = $1 and store_id = $2`,
      [cat.id, storeUuid]
    );
    const sortOrder = (maxSort.rows[0]?.m ?? 0) + 10;

    const { rows } = await c.query<{ label: string }>(
      `insert into public.lookup_items (
         category_id, store_id, code, label, sort_order, is_system
       )
       values ($1, $2, $3, $4, $5, false)
       returning label`,
      [cat.id, storeUuid, code, trimmed, sortOrder]
    );
    return rows[0]?.label ?? trimmed;
  };

  if (client) return run(client);
  return withTransaction(run);
}

/** Add option (or reactivate) for a store. Throws if duplicate active label. */
export async function repoAddLookupLabel(
  categoryCode: string,
  label: string,
  storeCode: string,
  actorUsername?: string
): Promise<string> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Nhãn option không được để trống.");
  const actor = normalizeActorUsername(actorUsername);

  return withTransaction(async (client) => {
    const cat = await getLookupCategory(client, categoryCode);
    if (!cat.allow_user_add) throw new Error("lookup_add_not_allowed");
    const storeUuid = await resolveStoreUuid(storeCode, client);

    const exists = await client.query(
      `select 1 from public.lookup_items
       where category_id = $1 and store_id = $2 and is_active and lower(label) = lower($3)
       limit 1`,
      [cat.id, storeUuid, trimmed]
    );
    if (exists.rowCount) throw new Error(`Option "${trimmed}" đã có trong danh sách.`);

    const saved = await repoEnsureLookupLabel(categoryCode, trimmed, storeCode, client);
    if (actor) {
      await client.query(
        `update public.lookup_items
         set created_by = coalesce(created_by, $4),
             updated_by = $4,
             updated_at = now()
         where category_id = $1 and store_id = $2 and is_active and lower(label) = lower($3)`,
        [cat.id, storeUuid, trimmed, actor]
      );
    }
    return saved;
  });
}

/** Rename option by label for a store; cascade only phones of that store. */
export async function repoRenameLookupLabel(
  categoryCode: string,
  oldLabel: string,
  newLabel: string,
  storeCode: string,
  actorUsername?: string
): Promise<string> {
  const actor = normalizeActorUsername(actorUsername);
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
    const storeUuid = await resolveStoreUuid(storeCode, client);

    const { rows: found } = await client.query<{ id: string }>(
      `select id from public.lookup_items
       where category_id = $1 and store_id = $2 and is_active and lower(label) = lower($3)
       limit 1
       for update`,
      [cat.id, storeUuid, from]
    );
    if (!found[0]) throw new Error("lookup_item_not_found");

    const clash = await client.query(
      `select 1 from public.lookup_items
       where category_id = $1 and store_id = $2 and is_active and lower(label) = lower($3) and id <> $4
       limit 1`,
      [cat.id, storeUuid, to, found[0].id]
    );
    if (clash.rowCount) throw new Error(`Option "${to}" đã có trong danh sách.`);

    const { rows } = await client.query<{ label: string }>(
      `update public.lookup_items
       set label = $2,
           updated_by = coalesce($3, updated_by),
           updated_at = now()
       where id = $1
       returning label`,
      [found[0].id, to, actor]
    );

    if (from !== to) {
      const phoneCol = LOOKUP_PHONE_COLUMN[categoryCode];
      if (phoneCol) {
        // only allow known columns from map (not user input); scope to store
        await client.query(
          `update public.phones set ${phoneCol} = $1,
             updated_by = coalesce($4, updated_by), updated_at = now()
           where ${phoneCol} = $2 and store_id = $3`,
          [to, from, storeUuid, actor]
        );
      }

      const accessoryCol = LOOKUP_ACCESSORY_COLUMN[categoryCode];
      if (accessoryCol) {
        await client.query(
          `update public.accessories set ${accessoryCol} = $1,
             updated_by = coalesce($4, updated_by), updated_at = now()
           where ${accessoryCol} = $2 and store_id = $3`,
          [to, from, storeUuid, actor]
        );
      }

      const swTextCol = LOOKUP_SOFTWARE_TEXT_COLUMN[categoryCode];
      if (swTextCol) {
        await client.query(
          `update public.software_orders set ${swTextCol} = $1,
             updated_by = coalesce($3, updated_by), updated_at = now()
           where ${swTextCol} = $2`,
          [to, from, actor]
        );
      }

      const swMoneyCol = LOOKUP_SOFTWARE_MONEY_COLUMN[categoryCode];
      if (swMoneyCol) {
        const fromN = parseLookupMoneyLabel(from);
        const toN = parseLookupMoneyLabel(to);
        if (fromN != null && toN != null && fromN !== toN) {
          await client.query(
            `update public.software_orders set ${swMoneyCol} = $1,
               updated_by = coalesce($3, updated_by), updated_at = now()
             where ${swMoneyCol} = $2`,
            [toN, fromN, actor]
          );
        }
      }

      const rpTextCol = LOOKUP_REPAIR_TEXT_COLUMN[categoryCode];
      if (rpTextCol) {
        await client.query(
          `update public.repair_orders set ${rpTextCol} = $1,
             updated_by = coalesce($3, updated_by), updated_at = now()
           where ${rpTextCol} = $2`,
          [to, from, actor]
        );
      }

      const rpMoneyCol = LOOKUP_REPAIR_MONEY_COLUMN[categoryCode];
      if (rpMoneyCol) {
        const fromN = parseLookupMoneyLabel(from);
        const toN = parseLookupMoneyLabel(to);
        if (fromN != null && toN != null && fromN !== toN) {
          await client.query(
            `update public.repair_orders set ${rpMoneyCol} = $1,
               updated_by = coalesce($3, updated_by), updated_at = now()
             where ${rpMoneyCol} = $2`,
            [toN, fromN, actor]
          );
        }
      }
    }

    return rows[0]?.label ?? to;
  });
}

/** Soft-deactivate option by label for a store. */
export async function repoDeactivateLookupLabel(
  categoryCode: string,
  label: string,
  storeCode: string,
  actorUsername?: string
): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("lookup_item_not_found");
  const actor = normalizeActorUsername(actorUsername);

  await withTransaction(async (client) => {
    const cat = await getLookupCategory(client, categoryCode);
    const storeUuid = await resolveStoreUuid(storeCode, client);
    const { rowCount } = await client.query(
      `update public.lookup_items
       set is_active = false,
           updated_by = coalesce($4, updated_by),
           updated_at = now()
       where category_id = $1 and store_id = $2 and is_active and lower(label) = lower($3)`,
      [cat.id, storeUuid, trimmed, actor]
    );
    if (!rowCount) throw new Error("lookup_item_not_found");
  });
}

/** Parse storage label → MB for numeric sort (64GB, 1TB, 512…). */
function storageLabelToMb(label: string): number | null {
  const m = label.trim().match(/(\d+(?:[.,]\d+)?)\s*(tb|gb|mb|t|g)?/i);
  if (!m) return null;
  let n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] || "gb").toLowerCase();
  if (unit === "tb" || unit === "t") n *= 1024 * 1024;
  else if (unit === "gb" || unit === "g") n *= 1024;
  // mb or bare → treat as MB after gb default above; bare number defaults to GB
  return n;
}

/**
 * Battery capacity sort key (khớp migration SQL):
 * group 0 = % sức khỏe pin (cao → thấp), group 1 = mAh (thấp → cao), group 2 = khác.
 */
function batteryCapacitySortKey(label: string): { grp: number; rank: number } {
  const s = label.trim();
  const isMah = /mah/i.test(s);
  const isPct = /%|dưới|duoi/i.test(s);

  if (isMah) {
    const m = s.match(/(\d+(?:[.,]\d+)?)/);
    const n = m ? Number(m[1].replace(",", ".")) : 0;
    return { grp: 1, rank: Number.isFinite(n) ? n : 0 };
  }

  if (isPct) {
    // "90-100%" → midpoint; "Dưới 80%" → 79.5; "99%" → 99; negate so higher % first
    const range = s.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)/);
    if (range) {
      const a = Number(range[1].replace(",", "."));
      const b = Number(range[2].replace(",", "."));
      const mid = (a + b) / 2;
      return { grp: 0, rank: Number.isFinite(mid) ? -mid : 0 };
    }
    const m = s.match(/(\d+(?:[.,]\d+)?)/);
    let n = m ? Number(m[1].replace(",", ".")) : 0;
    if (!Number.isFinite(n)) n = 0;
    if (/dưới|duoi/i.test(s)) n -= 0.5;
    return { grp: 0, rank: -n };
  }

  // bare number: treat as mAh if large, else %
  const bare = s.match(/^(\d+(?:[.,]\d+)?)$/);
  if (bare) {
    const n = Number(bare[1].replace(",", "."));
    if (Number.isFinite(n) && n >= 500) return { grp: 1, rank: n };
    if (Number.isFinite(n)) return { grp: 0, rank: -n };
  }

  return { grp: 2, rank: 0 };
}

function compareLookupLabelsForSort(categoryCode: string, a: string, b: string): number {
  if (categoryCode === "phone_storage") {
    const ka = storageLabelToMb(a);
    const kb = storageLabelToMb(b);
    if (ka != null && kb != null && ka !== kb) return ka - kb;
    if (ka != null && kb == null) return -1;
    if (ka == null && kb != null) return 1;
  }
  if (categoryCode === "phone_battery_capacity") {
    const ka = batteryCapacitySortKey(a);
    const kb = batteryCapacitySortKey(b);
    if (ka.grp !== kb.grp) return ka.grp - kb.grp;
    if (ka.rank !== kb.rank) return ka.rank - kb.rank;
  }
  return a.localeCompare(b, "vi", { numeric: true, sensitivity: "base" });
}

/**
 * Re-rank active lookup_items for a category+store (updates sort_order permanently).
 * phone_storage: 64GB → 128GB → … → 1TB.
 * phone_battery_capacity: % (cao→thấp) rồi mAh (thấp→cao).
 * Other categories: vi numeric alpha.
 */
export async function repoSortLookupLabels(
  categoryCode: string,
  storeCode: string
): Promise<string[]> {
  return withTransaction(async (client) => {
    const cat = await getLookupCategory(client, categoryCode);
    const storeUuid = await resolveStoreUuid(storeCode, client);
    const { rows } = await client.query<{ id: string; label: string }>(
      `select id, label from public.lookup_items
       where category_id = $1 and store_id = $2 and is_active`,
      [cat.id, storeUuid]
    );

    const sorted = [...rows].sort((x, y) =>
      compareLookupLabelsForSort(categoryCode, x.label, y.label)
    );

    let order = 10;
    for (const row of sorted) {
      await client.query(
        `update public.lookup_items
         set sort_order = $1, updated_at = now()
         where id = $2`,
        [order, row.id]
      );
      order += 10;
    }

    return sorted.map((r) => r.label);
  });
}

/** Single round-trip bundle for inventory page bootstrap. */
export async function repoInventoryBootstrap(lookupCategoryCodes: string[]) {
  const [phones, accessories, lookupsByStore] = await Promise.all([
    repoListPhones(),
    repoListAccessories(),
    repoListLookupsByStore(lookupCategoryCodes),
  ]);
  return { phones, accessories, lookupsByStore };
}

/**
 * Gắn / tạo khách cho phiếu bán.
 * - Tên mặc định: Khách lẻ
 * - SĐT không bắt buộc
 * - Có SĐT → reuse theo phone; không SĐT + Khách lẻ → reuse 1 hồ sơ vãng lai
 */
async function ensureCustomerId(
  client: PoolClient,
  name?: string,
  phone?: string,
  address?: string,
  actor?: string | null
): Promise<string> {
  const n = (name || "Khách lẻ").trim() || "Khách lẻ";
  const p = (phone || "").trim();
  const addr = (address || "").trim();

  if (p) {
    const existing = await client.query<{ id: string }>(
      `select id from public.customers
       where is_active and phone = $1
       limit 1`,
      [p]
    );
    if (existing.rows[0]?.id) {
      await client.query(
        `update public.customers
         set name = $2,
             address = case when $3 = '' then address else $3 end,
             updated_by = coalesce($4, updated_by),
             updated_at = now()
         where id = $1`,
        [existing.rows[0].id, n, addr, actor ?? null]
      );
      return existing.rows[0].id;
    }
  } else if (n.toLowerCase() === "khách lẻ" || n.toLowerCase() === "khach le") {
    const walkIn = await client.query<{ id: string }>(
      `select id from public.customers
       where is_active
         and (phone is null or trim(phone) = '')
         and lower(trim(name)) in ('khách lẻ', 'khach le')
       order by created_at asc
       limit 1`
    );
    if (walkIn.rows[0]?.id) return walkIn.rows[0].id;
  }

  const { rows } = await client.query<{ id: string }>(
    `insert into public.customers (name, phone, address, note, created_by, updated_by)
     values ($1, $2, $3, '', $4, $4)
     returning id`,
    [n, p, addr, actor ?? null]
  );
  if (!rows[0]?.id) throw new Error("Không tạo được khách hàng.");
  return rows[0].id;
}

function normalizeSaleLines(input: CreateSaleInput): CreateSaleLineInput[] {
  if (Array.isArray(input.lines) && input.lines.length > 0) {
    return input.lines;
  }
  // Legacy 1 dòng
  if (input.itemType === "phone") {
    if (!input.phoneId) throw new Error("Thiếu máy cần bán.");
    return [
      {
        itemType: "phone",
        phoneId: input.phoneId,
        unitPrice: Number(input.unitPrice) || 0,
      },
    ];
  }
  if (input.itemType === "accessory") {
    if (!input.accessoryId) throw new Error("Thiếu phụ kiện cần bán.");
    const qty = Math.max(1, Math.round(Number(input.quantity) || 1));
    const totalShort = toShopMoney(Number(input.unitPrice) || 0);
    // Legacy: unitPrice = tổng dòng → chuyển về đơn giá cho multi-line handler
    const unitShort = qty > 0 ? Math.round(totalShort / qty) : totalShort;
    return [
      {
        itemType: "accessory",
        itemName: "",
        quantity: qty,
        unitPrice: unitShort,
        accessoryId: input.accessoryId,
      },
    ];
  }
  throw new Error("Phiếu bán cần ít nhất một dòng hàng.");
}

function paymentToUi(p: string): string {
  if (p === "cash") return "Tiền mặt";
  if (p === "transfer") return "Chuyển khoản";
  if (p === "card") return "Thẻ";
  if (p === "debt") return "NỢ DAI";
  if (p === "partial") return "Thanh toán 1 phần";
  return "Khác";
}

/**
 * Tạo phiếu bán completed (nhiều dòng) + cập nhật tồn máy / PK kho.
 * Phụ kiện free-text: không trừ tồn, vốn = 0.
 * total_amount / profit lưu **VND thật** (kho short × 1000).
 * Response UI (`CreatedSale` / `SaleDetail`) quy về **short shop** (÷ 1000) giống màn nhập kho.
 */
export async function repoCreateSale(input: CreateSaleInput): Promise<CreatedSale> {
  const { codeToId } = await loadStoreMaps();
  const storeUuid = codeToId.get(input.storeId);
  if (!storeUuid) throw new Error(`Không tìm thấy cửa hàng ${input.storeId}`);

  const lines = normalizeSaleLines(input);
  if (lines.length === 0) throw new Error("Phiếu bán cần ít nhất một dòng hàng.");

  const actor = normalizeActorUsername(input.actorUsername);
  const customerName = (input.customerName || "Khách lẻ").trim() || "Khách lẻ";

  return withTransaction(async (client) => {
    await skipStatusGuard(client);
    const customerId = await ensureCustomerId(
      client,
      customerName,
      input.customerPhone,
      input.customerAddress,
      actor
    );

    // soldAt từ UI = datetime-local giờ VN → ISO UTC; ngày lịch lấy theo VN từ ISO đó
    const soldAtIso = vnDateTimeLocalToIso(input.soldAt) ?? new Date().toISOString();
    const soldAtDate =
      toVnDate(soldAtIso) || toDateOnly(soldAtIso) || toVnDate(new Date()) || "";

    const { rows: saleRows } = await client.query(
      `insert into public.sales (
         store_id, customer_id, payment_method, status,
         total_amount, total_cost, total_profit, note,
         sold_at, sold_at_ts,
         created_by, updated_by
       ) values (
         $1, $2, $3::public.payment_method, 'completed',
         0, 0, 0, $4,
         $5::date, $6::timestamptz,
         $7, $7
       ) returning id, sold_at`,
      [storeUuid, customerId, input.payment, input.note ?? "", soldAtDate, soldAtIso, actor]
    );
    const saleId = String(saleRows[0].id);
    const soldAt = toDateOnly(saleRows[0].sold_at) ?? soldAtDate;

    let totalAmount = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let totalQty = 0;
    let phoneLines = 0;
    let accessoryLines = 0;
    const itemNames: string[] = [];
    const seenPhoneIds = new Set<string>();

    for (const line of lines) {
      if (line.itemType === "phone") {
        if (!line.phoneId) throw new Error("Thiếu máy cần bán.");
        if (seenPhoneIds.has(line.phoneId)) {
          throw new Error("Không thể bán trùng một máy trong cùng phiếu.");
        }
        seenPhoneIds.add(line.phoneId);

        const { rows: phoneRows } = await client.query(
          `select * from public.phones where id = $1 for update`,
          [line.phoneId]
        );
        const phone = phoneRows[0];
        if (!phone) throw new Error("Không tìm thấy máy.");
        if (phone.status !== "in_stock") throw new Error(`Máy ${phone.model_name || ""} không còn hàng.`);
        if (String(phone.store_id) !== storeUuid) {
          throw new Error("Máy không thuộc cửa hàng đã chọn.");
        }

        const unitPriceVnd = shopMoneyToVnd(toShopMoney(Number(line.unitPrice) || 0));
        if (unitPriceVnd <= 0) throw new Error("Giá bán máy không hợp lệ.");
        const unitCostVnd = shopMoneyToVnd(toShopMoney(Number(phone.cost)));
        const amount = unitPriceVnd;
        const profit = amount - unitCostVnd;
        const itemName = `${phone.brand} ${phone.model_name}`.trim();

        await client.query(
          `insert into public.sale_items (
             sale_id, sale_status, item_type, phone_id, item_name,
             quantity, unit_cost, unit_price, amount, profit,
             created_by, updated_by
           ) values (
             $1, 'completed', 'phone', $2, $3,
             1, $4, $5, $6, $7, $8, $8
           )`,
          [saleId, phone.id, itemName, unitCostVnd, unitPriceVnd, amount, profit, actor]
        );

        await client.query(
          `update public.phones
           set status = 'sold', sale_date = $2::date,
               updated_by = coalesce($3, updated_by), updated_at = now()
           where id = $1`,
          [phone.id, soldAt, actor]
        );

        totalAmount += amount;
        totalCost += unitCostVnd;
        totalProfit += profit;
        totalQty += 1;
        phoneLines += 1;
        itemNames.push(itemName);
      } else {
        const quantity = Math.max(1, Math.round(Number(line.quantity) || 1));
        // Giá bán 0 = phụ kiện tặng (vẫn ghi vốn → lãi âm). Chỉ chặn số âm.
        const rawAccPrice = Number(line.unitPrice);
        if (!Number.isFinite(rawAccPrice) || rawAccPrice < 0) {
          throw new Error("Giá phụ kiện không hợp lệ.");
        }
        const unitPriceShort = toShopMoney(rawAccPrice);
        const unitPriceVnd = shopMoneyToVnd(unitPriceShort);

        let itemName = String(line.itemName || "").trim();
        let unitCostVnd = 0;
        let accessoryId: string | null = line.accessoryId ? String(line.accessoryId) : null;

        if (accessoryId) {
          const { rows: accRows } = await client.query(
            `select * from public.accessories where id = $1 for update`,
            [accessoryId]
          );
          const acc = accRows[0];
          if (!acc || acc.status === "cancelled") throw new Error("Không tìm thấy phụ kiện.");
          if (String(acc.store_id) !== storeUuid) {
            throw new Error("Phụ kiện không thuộc cửa hàng đã chọn.");
          }
          const stock = Number(acc.quantity) || 0;
          if (stock < quantity) throw new Error(`Không đủ tồn: ${acc.name}`);
          if (!itemName) itemName = String(acc.name);
          unitCostVnd = shopMoneyToVnd(toShopMoney(Number(acc.cost)));

          const left = stock - quantity;
          await client.query(
            `update public.accessories
             set quantity = $2,
                 status = case when $2 <= 0 then 'out_of_stock'::public.accessory_status else status end,
                 updated_by = coalesce($3, updated_by),
                 updated_at = now()
             where id = $1`,
            [accessoryId, left, actor]
          );
        } else {
          // Free-text: không trừ kho; vốn từ unitCost short (tuỳ chọn)
          if (!itemName) throw new Error("Nhập tên phụ kiện.");
          accessoryId = null;
          const cat = String(line.category || "").trim();
          if (cat && !itemName.toLowerCase().startsWith(`${cat.toLowerCase()}:`)) {
            itemName = `${cat}: ${itemName}`;
          }
          unitCostVnd = shopMoneyToVnd(toShopMoney(Number(line.unitCost) || 0));
        }

        const amount = unitPriceVnd * quantity;
        const profit = amount - unitCostVnd * quantity;

        await client.query(
          `insert into public.sale_items (
             sale_id, sale_status, item_type, accessory_id, item_name,
             quantity, unit_cost, unit_price, amount, profit,
             created_by, updated_by
           ) values (
             $1, 'completed', 'accessory', $2, $3,
             $4, $5, $6, $7, $8, $9, $9
           )`,
          [
            saleId,
            accessoryId,
            itemName,
            quantity,
            unitCostVnd,
            unitPriceVnd,
            amount,
            profit,
            actor,
          ]
        );

        totalAmount += amount;
        totalCost += unitCostVnd * quantity;
        totalProfit += profit;
        totalQty += quantity;
        accessoryLines += 1;
        itemNames.push(quantity > 1 ? `${itemName} ×${quantity}` : itemName);
      }
    }

    if (totalAmount <= 0) throw new Error("Tổng tiền phiếu không hợp lệ.");

    await client.query(
      `update public.sales
       set total_amount = $2,
           total_cost = $3,
           total_profit = $4,
           updated_by = coalesce($5, updated_by),
           updated_at = now()
       where id = $1`,
      [saleId, totalAmount, totalCost, totalProfit, actor]
    );

    const itemType: "Máy" | "Phụ kiện" =
      phoneLines > 0 && accessoryLines === 0
        ? "Máy"
        : phoneLines === 0
          ? "Phụ kiện"
          : phoneLines >= accessoryLines
            ? "Máy"
            : "Phụ kiện";

    const itemName =
      itemNames.length <= 2
        ? itemNames.join(" + ")
        : `${itemNames[0]} + ${itemNames.length - 1} dòng khác`;

    return {
      id: saleId,
      soldAt,
      storeId: input.storeId,
      itemName: itemName || "Hàng",
      itemType,
      quantity: totalQty,
      amount: vndToShopMoney(totalAmount),
      profit: vndToShopMoney(totalProfit),
      payment: paymentToUi(input.payment),
      status: "Hoàn tất" as const,
      customerName,
      note: input.note ?? "",
      lineCount: lines.length,
    };
  });
}

export type SaleDetailLine =
  | {
      kind: "phone";
      phoneId?: string;
      name: string;
      imei?: string;
      brand?: string;
      color?: string;
      storage?: string;
      condition?: string;
      /** short shop */
      unitPrice: number;
      cost: number;
    }
  | {
      kind: "accessory";
      category?: string;
      name: string;
      quantity: number;
      unitPrice: number;
      cost: number;
      accessoryId?: string;
    };

export type SaleDetail = CreatedSale & {
  /** YYYY-MM-DDTHH:mm VN */
  soldAtLocal: string;
  customerId?: string;
  lines: SaleDetailLine[];
};

/** Chi tiết 1 phiếu + dòng hàng (để sửa / xem). */
export async function repoGetSale(saleId: string): Promise<SaleDetail> {
  const { idToCode } = await loadStoreMaps();
  const { rows: saleRows } = await getPool().query(
    `select s.*,
            coalesce(c.name, 'Khách lẻ') as customer_name,
            coalesce(c.phone, '') as customer_phone,
            coalesce(c.address, '') as customer_address
     from public.sales s
     left join public.customers c on c.id = s.customer_id
     where s.id = $1`,
    [saleId]
  );
  const sale = saleRows[0];
  if (!sale) throw new Error("Không tìm thấy phiếu bán.");

  const { rows: itemRows } = await getPool().query(
    `select si.*,
            p.imei as phone_imei,
            p.brand as phone_brand,
            p.model_name as phone_model,
            p.color as phone_color,
            p.storage as phone_storage,
            p.condition as phone_condition,
            p.cost as phone_cost
     from public.sale_items si
     left join public.phones p on p.id = si.phone_id
     where si.sale_id = $1
     order by si.created_at asc`,
    [saleId]
  );

  const lines: SaleDetailLine[] = itemRows.map((si) => {
    if (si.item_type === "phone") {
      const name =
        String(si.item_name || "").trim() ||
        `${si.phone_brand || ""} ${si.phone_model || ""}`.trim() ||
        "Máy";
      return {
        kind: "phone" as const,
        phoneId: si.phone_id ? String(si.phone_id) : undefined,
        name,
        imei: si.phone_imei ? String(si.phone_imei) : "",
        brand: si.phone_brand ? String(si.phone_brand) : undefined,
        color: si.phone_color ? String(si.phone_color) : undefined,
        storage: si.phone_storage ? String(si.phone_storage) : undefined,
        condition: si.phone_condition ? String(si.phone_condition) : undefined,
        unitPrice: toShopMoney(Number(si.unit_price) || 0),
        cost: toShopMoney(Number(si.unit_cost ?? si.phone_cost) || 0),
      };
    }
    const rawName = String(si.item_name || "").trim() || "Phụ kiện";
    const colon = rawName.indexOf(":");
    let category = "";
    let name = rawName;
    if (colon > 0) {
      category = rawName.slice(0, colon).trim();
      name = rawName.slice(colon + 1).trim() || rawName;
    }
    return {
      kind: "accessory" as const,
      category: category || "Khác",
      name,
      quantity: Math.max(1, Number(si.quantity) || 1),
      unitPrice: toShopMoney(Number(si.unit_price) || 0),
      cost: toShopMoney(Number(si.unit_cost) || 0),
      accessoryId: si.accessory_id ? String(si.accessory_id) : undefined,
    };
  });

  const phoneLines = lines.filter((l) => l.kind === "phone").length;
  const accLines = lines.filter((l) => l.kind === "accessory").length;
  const itemType: "Máy" | "Phụ kiện" =
    phoneLines > 0 && accLines === 0 ? "Máy" : phoneLines === 0 ? "Phụ kiện" : "Máy";
  const itemNames = lines.map((l) =>
    l.kind === "phone"
      ? l.name
      : l.quantity > 1
        ? `${l.category ? `${l.category}: ` : ""}${l.name} ×${l.quantity}`
        : `${l.category ? `${l.category}: ` : ""}${l.name}`
  );

  const soldAtLocal =
    toVnDateTimeLocal(sale.sold_at_ts || sale.sold_at) ||
    `${toDateOnly(sale.sold_at) ?? ""}T00:00`;

  return {
    id: String(sale.id),
    soldAt: toDateOnly(sale.sold_at) ?? "",
    soldAtLocal,
    storeId: idToCode.get(String(sale.store_id)) ?? "store-1",
    itemName:
      itemNames.length <= 2
        ? itemNames.join(" + ")
        : `${itemNames[0]} + ${itemNames.length - 1} dòng khác`,
    itemType,
    quantity: lines.reduce((s, l) => s + (l.kind === "phone" ? 1 : l.quantity), 0),
    amount: vndToShopMoney(Number(sale.total_amount) || 0),
    profit: vndToShopMoney(Number(sale.total_profit) || 0),
    payment: paymentToUi(String(sale.payment_method)),
    status: sale.status === "cancelled" ? ("Đã hủy" as const) : ("Hoàn tất" as const),
    customerId: sale.customer_id ? String(sale.customer_id) : undefined,
    customerName: String(sale.customer_name || "Khách lẻ"),
    customerPhone: String(sale.customer_phone || ""),
    customerAddress: String(sale.customer_address || ""),
    note: sale.note ? String(sale.note) : "",
    lineCount: lines.length,
    lines,
  };
}

/** Recent sales (completed + cancelled) for UI list. */
export async function repoListRecentSales(limit = 80): Promise<CreatedSale[]> {
  const { idToCode } = await loadStoreMaps();
  const { rows } = await getPool().query(
    `select s.id, s.sold_at, s.store_id, s.total_amount, s.total_profit, s.payment_method, s.status,
            coalesce(c.name, 'Khách lẻ') as customer_name,
            coalesce(c.phone, '') as customer_phone,
            coalesce(c.address, '') as customer_address,
            coalesce(
              (
                select string_agg(
                  case when si.quantity > 1 then si.item_name || ' ×' || si.quantity else si.item_name end,
                  ' + '
                  order by si.created_at
                )
                from public.sale_items si
                where si.sale_id = s.id
              ),
              'Hàng'
            ) as item_name,
            case
              when exists (
                select 1 from public.sale_items si
                where si.sale_id = s.id and si.item_type = 'phone'
              )
              and not exists (
                select 1 from public.sale_items si
                where si.sale_id = s.id and si.item_type = 'accessory'
              ) then 'phone'
              when exists (
                select 1 from public.sale_items si
                where si.sale_id = s.id and si.item_type = 'accessory'
              )
              and not exists (
                select 1 from public.sale_items si
                where si.sale_id = s.id and si.item_type = 'phone'
              ) then 'accessory'
              else 'phone'
            end as item_type,
            coalesce(
              (select sum(si.quantity)::int from public.sale_items si where si.sale_id = s.id),
              1
            ) as quantity,
            coalesce(
              (select count(*)::int from public.sale_items si where si.sale_id = s.id),
              1
            ) as line_count
     from public.sales s
     left join public.customers c on c.id = s.customer_id
     order by s.sold_at_ts desc
     limit $1`,
    [limit]
  );

  return rows.map((row) => ({
    id: String(row.id),
    soldAt: toDateOnly(row.sold_at) ?? "",
    storeId: idToCode.get(String(row.store_id)) ?? "store-1",
    itemName: String(row.item_name),
    itemType: row.item_type === "accessory" ? ("Phụ kiện" as const) : ("Máy" as const),
    quantity: Number(row.quantity) || 1,
    amount: vndToShopMoney(Number(row.total_amount) || 0),
    profit: vndToShopMoney(Number(row.total_profit) || 0),
    payment: paymentToUi(String(row.payment_method)),
    status: row.status === "cancelled" ? ("Đã hủy" as const) : ("Hoàn tất" as const),
    customerName: String(row.customer_name || "Khách lẻ"),
    customerPhone: String(row.customer_phone || ""),
    customerAddress: String(row.customer_address || ""),
    lineCount: Number(row.line_count) || 1,
  }));
}

/**
 * Hủy mềm phiếu bán: completed → cancelled, hoàn máy in_stock, hoàn SL PK (nếu có accessory_id).
 * Free-text PK (accessory_id null) không chạm tồn kho.
 */
export async function repoCancelSale(
  saleId: string,
  actorUsername?: string
): Promise<CreatedSale> {
  const actor = normalizeActorUsername(actorUsername);
  const { idToCode } = await loadStoreMaps();

  return withTransaction(async (client) => {
    await skipStatusGuard(client);
    const { rows: saleRows } = await client.query(
      `select * from public.sales where id = $1 for update`,
      [saleId]
    );
    const sale = saleRows[0];
    if (!sale) throw new Error("Không tìm thấy phiếu bán.");
    if (sale.status === "cancelled") throw new Error("Phiếu đã hủy.");

    const { rows: items } = await client.query(
      `select * from public.sale_items where sale_id = $1 and sale_status = 'completed' for update`,
      [saleId]
    );

    for (const item of items) {
      if (item.item_type === "phone" && item.phone_id) {
        await client.query(
          `update public.phones
           set status = 'in_stock', sale_date = null,
               updated_by = coalesce($2, updated_by), updated_at = now()
           where id = $1 and status = 'sold'`,
          [item.phone_id, actor]
        );
      } else if (item.item_type === "accessory" && item.accessory_id) {
        const qty = Number(item.quantity) || 0;
        await client.query(
          `update public.accessories
           set quantity = quantity + $2,
               status = case
                 when quantity + $2 > 0 then 'in_stock'::public.accessory_status
                 else status
               end,
               updated_by = coalesce($3, updated_by),
               updated_at = now()
           where id = $1 and status <> 'cancelled'`,
          [item.accessory_id, qty, actor]
        );
      }
      await client.query(
        `update public.sale_items
         set sale_status = 'cancelled',
             updated_by = coalesce($2, updated_by),
             updated_at = now()
         where id = $1`,
        [item.id, actor]
      );
    }

    await client.query(
      `update public.sales
       set status = 'cancelled',
           cancelled_at = now(),
           updated_by = coalesce($2, updated_by),
           updated_at = now()
       where id = $1`,
      [saleId, actor]
    );

    const storeId = idToCode.get(String(sale.store_id)) ?? "store-1";
    return {
      id: saleId,
      soldAt: toDateOnly(sale.sold_at) ?? "",
      storeId,
      itemName: "Hàng",
      itemType: "Máy" as const,
      quantity: 0,
      amount: vndToShopMoney(Number(sale.total_amount) || 0),
      profit: vndToShopMoney(Number(sale.total_profit) || 0),
      payment: paymentToUi(String(sale.payment_method)),
      status: "Đã hủy" as const,
      customerName: "",
      lineCount: items.length,
    };
  });
}

/** Dashboard KPIs: stock from phones/accessories + lifetime sales profit/revenue. */
export async function repoDashboardSummary(storeCode?: StoreId): Promise<{
  phonesInStock: number;
  accessoryQty: number;
  capitalShort: number;
  capitalVnd: number;
  profit: number;
  revenue: number;
}> {
  const pool = getPool();
  let storeId: string | null = null;
  if (storeCode && storeCode !== "all") {
    const { codeToId } = await loadStoreMaps();
    storeId = codeToId.get(storeCode) ?? null;
  }

  const [phonesRes, accRes, salesRes] = await Promise.all([
    pool.query<{ status: string; cost: string | number }>(
      `select status, cost from public.phones
       where ($1::uuid is null or store_id = $1)`,
      [storeId]
    ),
    pool.query<{ status: string; quantity: string | number; cost: string | number }>(
      `select status, quantity, cost from public.accessories
       where ($1::uuid is null or store_id = $1)`,
      [storeId]
    ),
    pool.query<{ profit: string | number; revenue: string | number }>(
      `select
         coalesce(sum(total_profit), 0)::bigint as profit,
         coalesce(sum(total_amount), 0)::bigint as revenue
       from public.sales
       where status = 'completed'
         and ($1::uuid is null or store_id = $1)`,
      [storeId]
    ),
  ]);

  let phonesInStock = 0;
  let capitalShort = 0;
  for (const row of phonesRes.rows) {
    if (row.status !== "in_stock") continue;
    phonesInStock += 1;
    capitalShort += toShopMoney(Number(row.cost));
  }

  let accessoryQty = 0;
  for (const row of accRes.rows) {
    if (row.status === "cancelled") continue;
    const qty = Math.max(0, Number(row.quantity) || 0);
    accessoryQty += qty;
    capitalShort += toShopMoney(Number(row.cost)) * qty;
  }

  const sales = salesRes.rows[0] ?? { profit: 0, revenue: 0 };
  return {
    phonesInStock,
    accessoryQty,
    capitalShort,
    capitalVnd: capitalShort * 1000,
    profit: Number(sales.profit ?? 0),
    revenue: Number(sales.revenue ?? 0),
  };
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
