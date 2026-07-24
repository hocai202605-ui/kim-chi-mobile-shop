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
};

export type PartCatalogCreateInput = {
  storeId: Exclude<StoreId, "all">;
  category: PartCatalogCategory;
  brandGroup?: string;
  name: string;
  note?: string;
  grades?: Record<string, PartGradeCell>;
  actorUsername?: string;
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
};

const CATEGORIES = new Set<PartCatalogCategory>(["man_android", "man_iphone", "pin"]);

function normalizeActor(value?: string | null): string | null {
  const t = String(value ?? "").trim();
  return t || null;
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

  try {
    const { rows } = await getPool().query<DbRow>(
      `insert into public.part_catalog_items (
         store_id, category, brand_group, name, note, grades, created_by, updated_by
       ) values ($1,$2,$3,$4,$5,$6::jsonb,$7,$7)
       returning *`,
      [storeUuid, category, brandGroup, name, note, JSON.stringify(grades), actor]
    );
    return mapRow(rows[0], idToCode);
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

  try {
    const { rows } = await getPool().query<DbRow>(
      `update public.part_catalog_items set
         name = $2,
         brand_group = $3,
         note = $4,
         grades = $5::jsonb,
         status = $6,
         updated_by = coalesce($7, updated_by),
         updated_at = now()
       where id = $1::uuid
       returning *`,
      [id, name, brandGroup, note, JSON.stringify(grades), status, actor]
    );
    if (!rows[0]) throw new Error("Không cập nhật được dòng linh kiện.");
    return mapRow(rows[0], idToCode);
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
