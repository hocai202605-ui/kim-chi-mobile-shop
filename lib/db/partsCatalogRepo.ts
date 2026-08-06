import type { StoreId } from "@/types";
import { getPool } from "./pool";

export type PartCatalogCategory = "man_android" | "man_iphone" | "pin";

export type PartGradeCell = {
  cost?: number | null;
  price?: number | null;
  qty?: number | null;
  sub?: string | null;
};

export type PartCatalogItemDto = {
  id: string;
  storeId: Exclude<StoreId, "all">;
  category: PartCatalogCategory;
  brandGroup: string;
  name: string;
  note: string;
  grades: Record<string, PartGradeCell>;
  status: "active" | "hidden";
  createdAt: string;
  updatedAt: string;
  brand: string;
  partType: string;
  deviceType: string;
  color: string;
  costPrice: number | null;
  retailPrice: number | null;
  quantity: number;
};

export type PartCatalogCreateInput = {
  storeId: Exclude<StoreId, "all">;
  category: PartCatalogCategory;
  brandGroup?: string;
  name: string;
  note?: string;
  grades?: Record<string, PartGradeCell>;
  actorUsername?: string;
  brand?: string;
  partType?: string;
  deviceType?: string;
  color?: string;
  costPrice?: number | null;
  retailPrice?: number | null;
  quantity?: number;
};

export type PartCatalogPatchInput = {
  id: string;
  name?: string;
  brandGroup?: string;
  note?: string;
  /** Merge deep into existing grades (partial per key). */
  grades?: Record<string, PartGradeCell | null>;
  status?: "active" | "hidden";
  actorUsername?: string;
  brand?: string;
  partType?: string;
  deviceType?: string;
  color?: string;
  costPrice?: number | null;
  retailPrice?: number | null;
  quantity?: number;
};

const CATEGORIES = new Set<PartCatalogCategory>(["man_android", "man_iphone", "pin"]);

function normalizeActor(value?: string | null): string | null {
  const t = String(value ?? "").trim();
  return t || null;
}

async function writeCatalogAudit(
  storeId: string,
  actor: string | null,
  action: string,
  target: string,
  meta: Record<string, unknown> = {}
) {
  await getPool().query(
    `insert into public.audit_logs (actor_name, store_id, action, target, meta)
     values ($1, $2::uuid, $3, $4, $5::jsonb)`,
    [actor ?? "", storeId, action, target, JSON.stringify(meta)]
  );
}

function asNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function normalizeCell(raw: unknown): PartGradeCell {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const cell: PartGradeCell = {};
  if ("cost" in o) cell.cost = asNum(o.cost);
  if ("price" in o) cell.price = asNum(o.price);
  if ("qty" in o) {
    const q = asNum(o.qty);
    cell.qty = q === null ? null : Math.max(0, Math.round(q));
  }
  if ("sub" in o) {
    const s = String(o.sub ?? "").trim();
    cell.sub = s || null;
  }
  return cell;
}

function normalizeGrades(raw: unknown): Record<string, PartGradeCell> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, PartGradeCell> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k || "").trim();
    if (!key) continue;
    out[key] = normalizeCell(v);
  }
  return out;
}

/** Deep-merge grades: null value for a grade key removes it; partial cell merges fields. */
export function mergeGrades(
  base: Record<string, PartGradeCell>,
  patch: Record<string, PartGradeCell | null>
): Record<string, PartGradeCell> {
  const next: Record<string, PartGradeCell> = { ...base };
  for (const [key, cell] of Object.entries(patch)) {
    const k = String(key || "").trim();
    if (!k) continue;
    if (cell === null) {
      delete next[k];
      continue;
    }
    const prev = next[k] || {};
    const n = normalizeCell(cell);
    next[k] = {
      ...prev,
      ...n,
    };
  }
  return next;
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
    idToCode.set(r.id, r.code as Exclude<StoreId, "all">);
  }
  return { codeToId, idToCode };
}

type DbRow = {
  id: string;
  store_id: string;
  category: string;
  brand_group: string;
  name: string;
  note: string;
  grades: unknown;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
  brand?: string | null;
  part_type?: string | null;
  device_type?: string | null;
  color?: string | null;
  cost_price?: number | string | null;
  retail_price?: number | string | null;
  quantity?: number | string | null;
};

function mapRow(
  row: DbRow,
  idToCode: Map<string, Exclude<StoreId, "all">>
): PartCatalogItemDto {
  const cat = String(row.category) as PartCatalogCategory;
  return {
    id: String(row.id),
    storeId: idToCode.get(String(row.store_id)) ?? "store-1",
    category: CATEGORIES.has(cat) ? cat : "man_android",
    brandGroup: String(row.brand_group ?? ""),
    name: String(row.name ?? ""),
    note: String(row.note ?? ""),
    grades: normalizeGrades(row.grades),
    status: row.status === "hidden" ? "hidden" : "active",
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at || ""),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at || ""),
    brand: String(row.brand ?? row.brand_group ?? ""),
    partType: String(row.part_type ?? ""),
    deviceType: String(row.device_type ?? row.name ?? ""),
    color: String(row.color ?? ""),
    costPrice: row.cost_price == null ? null : Number(row.cost_price),
    retailPrice: row.retail_price == null ? null : Number(row.retail_price),
    quantity: Math.max(0, Math.round(Number(row.quantity) || 0)),
  };
}

export async function repoListPartCatalog(opts: {
  storeCode?: string | null;
  category?: PartCatalogCategory | null;
  includeHidden?: boolean;
}): Promise<PartCatalogItemDto[]> {
  const { idToCode } = await loadStoreMaps();
  const store =
    opts.storeCode && opts.storeCode !== "all" ? String(opts.storeCode).trim() : null;
  const category = opts.category && CATEGORIES.has(opts.category) ? opts.category : null;
  const includeHidden = Boolean(opts.includeHidden);

  const params: unknown[] = [];
  const where: string[] = [];

  if (!includeHidden) {
    where.push(`status = 'active'`);
  }
  if (store) {
    params.push(store);
    where.push(`store_id = (select id from public.stores where code = $${params.length} and is_active = true limit 1)`);
  }
  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }

  const sql = `
    select *
    from public.part_catalog_items
    ${where.length ? `where ${where.join(" and ")}` : ""}
    order by category asc, brand_group asc, lower(name) asc, id asc
    limit 5000
  `;
  const { rows } = await getPool().query<DbRow>(sql, params);
  return rows.map((r) => mapRow(r, idToCode));
}

export async function repoCreatePartCatalog(
  input: PartCatalogCreateInput
): Promise<PartCatalogItemDto> {
  const { codeToId, idToCode } = await loadStoreMaps();
  const storeCode = String(input.storeId || "").trim();
  const storeUuid = codeToId.get(storeCode);
  if (!storeUuid) throw new Error("Cửa hàng không hợp lệ.");

  const category = input.category;
  if (!CATEGORIES.has(category)) throw new Error("Loại linh kiện không hợp lệ.");

  const name = String(input.name || "").trim();
  if (!name) throw new Error("Nhập tên model.");

  const brandGroup =
    category === "man_android"
      ? String(input.brandGroup || "").trim()
      : String(input.brandGroup || "").trim();
  if (category === "man_android" && !brandGroup) {
    throw new Error("Chọn hãng (Samsung / Oppo-Realme / Xiaomi).");
  }

  const grades = normalizeGrades(input.grades ?? emptyGradesFor(category));
  const note = String(input.note || "").trim();
  const actor = normalizeActor(input.actorUsername);
  const brand = String(input.brand ?? input.brandGroup ?? "").trim();
  const partType = String(input.partType ?? "").trim();
  const deviceType = String(input.deviceType ?? input.name ?? "").trim();
  const color = String(input.color ?? "").trim();
  const costPrice = input.costPrice == null ? null : Math.max(0, Number(input.costPrice));
  const retailPrice = input.retailPrice == null ? null : Math.max(0, Number(input.retailPrice));
  const quantity = Math.max(0, Math.round(Number(input.quantity) || 0));
  if (!brand) throw new Error("Nhập hãng linh kiện.");
  if (!partType) throw new Error("Nhập loại linh kiện.");
  if (!deviceType) throw new Error("Nhập loại máy.");

  try {
    const { rows } = await getPool().query<DbRow>(
      `insert into public.part_catalog_items (
         store_id, category, brand_group, name, note, grades, created_by, updated_by,
         brand, part_type, device_type, color, cost_price, retail_price, quantity
       ) values ($1,$2,$3,$4,$5,$6::jsonb,$7,$7,$8,$9,$10,$11,$12,$13,$14)
       returning *`,
      [storeUuid, category, brandGroup, name, note, JSON.stringify(grades), actor,
        brand, partType, deviceType, color, costPrice, retailPrice, quantity]
    );
    const saved = mapRow(rows[0], idToCode);
    await writeCatalogAudit(storeUuid, actor, "Thêm linh kiện", saved.deviceType, {
      id: saved.id,
      brand: saved.brand,
      partType: saved.partType,
      quantity: saved.quantity,
    });
    return saved;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) {
      throw new Error(`Model «${name}» đã có trong danh mục này.`);
    }
    throw err;
  }
}

export async function repoPatchPartCatalog(
  input: PartCatalogPatchInput
): Promise<PartCatalogItemDto> {
  const id = String(input.id || "").trim();
  if (!id) throw new Error("Thiếu id.");

  const { idToCode } = await loadStoreMaps();
  const { rows: existingRows } = await getPool().query<DbRow>(
    `select * from public.part_catalog_items where id = $1::uuid limit 1`,
    [id]
  );
  const existing = existingRows[0];
  if (!existing) throw new Error("Không tìm thấy dòng linh kiện.");

  const current = mapRow(existing, idToCode);
  const name =
    input.name !== undefined ? String(input.name || "").trim() : current.name;
  if (!name) throw new Error("Tên model không được trống.");

  const brandGroup =
    input.brandGroup !== undefined
      ? String(input.brandGroup || "").trim()
      : current.brandGroup;

  const note =
    input.note !== undefined ? String(input.note || "").trim() : current.note;

  const grades =
    input.grades !== undefined
      ? mergeGrades(current.grades, input.grades)
      : current.grades;

  const status =
    input.status === "hidden" || input.status === "active"
      ? input.status
      : current.status;

  const actor = normalizeActor(input.actorUsername);
  const brand = input.brand !== undefined ? String(input.brand || "").trim() : current.brand;
  const partType = input.partType !== undefined ? String(input.partType || "").trim() : current.partType;
  const deviceType = input.deviceType !== undefined ? String(input.deviceType || "").trim() : current.deviceType;
  const color = input.color !== undefined ? String(input.color || "").trim() : current.color;
  const costPrice = input.costPrice !== undefined
    ? (input.costPrice == null ? null : Math.max(0, Number(input.costPrice)))
    : current.costPrice;
  const retailPrice = input.retailPrice !== undefined
    ? (input.retailPrice == null ? null : Math.max(0, Number(input.retailPrice)))
    : current.retailPrice;
  const quantity = input.quantity !== undefined
    ? Math.max(0, Math.round(Number(input.quantity) || 0))
    : current.quantity;
  if (!brand || !partType || !deviceType) throw new Error("Hãng, loại linh kiện và loại máy là bắt buộc.");

  try {
    const { rows } = await getPool().query<DbRow>(
      `update public.part_catalog_items set
         name = $2,
         brand_group = $3,
         note = $4,
         grades = $5::jsonb,
         status = $6,
         updated_by = coalesce($7, updated_by),
         brand = $8,
         part_type = $9,
         device_type = $10,
         color = $11,
         cost_price = $12,
         retail_price = $13,
         quantity = $14,
         updated_at = now()
       where id = $1::uuid
       returning *`,
      [id, name, brandGroup, note, JSON.stringify(grades), status, actor,
        brand, partType, deviceType, color, costPrice, retailPrice, quantity]
    );
    if (!rows[0]) throw new Error("Không cập nhật được dòng linh kiện.");
    const saved = mapRow(rows[0], idToCode);
    await writeCatalogAudit(existing.store_id, actor, status !== current.status
      ? (status === "hidden" ? "Ẩn linh kiện" : "Khôi phục linh kiện")
      : "Sửa linh kiện", saved.deviceType, {
        id: saved.id,
        before: current,
        after: saved,
      });
    return saved;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) {
      throw new Error(`Model «${name}» đã có trong danh mục này.`);
    }
    throw err;
  }
}

export async function repoHidePartCatalog(
  id: string,
  actorUsername?: string
): Promise<PartCatalogItemDto> {
  return repoPatchPartCatalog({
    id,
    status: "hidden",
    actorUsername,
  });
}

/** Xóa hẳn một bản ghi catalog Linh kiện độc lập theo yêu cầu nghiệp vụ. */
export async function repoDeletePartCatalog(
  id: string,
  actorUsername?: string
): Promise<PartCatalogItemDto> {
  const catalogId = String(id || "").trim();
  if (!catalogId) throw new Error("Thiếu id.");
  const actor = normalizeActor(actorUsername);
  const { idToCode } = await loadStoreMaps();
  const { rows } = await getPool().query<DbRow>(
    `delete from public.part_catalog_items where id = $1::uuid returning *`,
    [catalogId]
  );
  if (!rows[0]) throw new Error("Không tìm thấy linh kiện để xóa.");
  const deleted = mapRow(rows[0], idToCode);
  await writeCatalogAudit(rows[0].store_id, actor, "Xóa linh kiện", deleted.deviceType, {
    deleted,
  });
  return deleted;
}

function emptyGradesFor(category: PartCatalogCategory): Record<string, PartGradeCell> {
  if (category === "man_android") {
    return { default: { cost: null, price: null, qty: 0 } };
  }
  if (category === "man_iphone") {
    return {
      zin: { price: null },
      lo: { price: null },
      lo_xin: { price: null },
      gx: { price: null },
    };
  }
  return {
    re: { price: null },
    dlc: { price: null },
    used: { price: null },
    used_dlc: { price: null },
  };
}
