import type { StoreId } from "@/types";
import { toVnDate } from "@/lib/datetime";
import { getPool } from "./pool";

export type PartInboundDto = {
  id: string;
  createdAt: string;
  storeId: Exclude<StoreId, "all">;
  distributor: string;
  partType: string;
  partName: string;
  /** Hãng — tùy chọn. */
  brand: string;
  /** Màu sắc — tùy chọn. */
  color: string;
  quantity: number;
};

export type PartInboundUpsertInput = {
  id?: string;
  storeId: Exclude<StoreId, "all">;
  distributor: string;
  partType: string;
  partName: string;
  brand?: string;
  color?: string;
  quantity: number;
  actorUsername?: string;
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
    idToCode.set(r.id, r.code as Exclude<StoreId, "all">);
  }
  return { codeToId, idToCode };
}

async function resolveStoreUuid(storeCode?: string | null): Promise<string | null> {
  const code = String(storeCode || "").trim();
  if (!code || code === "all") return null;
  const { rows } = await getPool().query<{ id: string }>(
    `select id from public.stores where code = $1 and is_active = true limit 1`,
    [code]
  );
  return rows[0]?.id ?? null;
}

type DbRow = {
  id: string;
  store_id: string;
  distributor: string;
  part_type: string;
  part_name: string;
  brand?: string | null;
  color?: string | null;
  quantity: number;
  created_at: Date | string;
};

function mapRow(
  row: DbRow,
  idToCode: Map<string, Exclude<StoreId, "all">>
): PartInboundDto {
  const created =
    row.created_at instanceof Date
      ? toVnDate(row.created_at)
      : String(row.created_at || "").slice(0, 10);
  return {
    id: String(row.id),
    createdAt: created || toVnDate(new Date()) || "",
    storeId: idToCode.get(String(row.store_id)) ?? "store-1",
    distributor: String(row.distributor ?? ""),
    partType: String(row.part_type ?? ""),
    partName: String(row.part_name ?? ""),
    brand: String(row.brand ?? ""),
    color: String(row.color ?? ""),
    quantity: Math.max(0, Number(row.quantity) || 0),
  };
}

/**
 * List phiếu nhập.
 * - store null/"all" → all (owner)
 * - store-1|2|3 → chỉ CH đó
 */
export async function repoListPartInbounds(
  storeCode?: string | null
): Promise<PartInboundDto[]> {
  const { idToCode } = await loadStoreMaps();
  const store =
    storeCode && storeCode !== "all" ? String(storeCode).trim() : null;

  // Sort chính trên UI; DB chỉ ưu tiên created_at (ổn định, tránh lỗi cột/nulls).
  if (!store) {
    const { rows } = await getPool().query<DbRow>(
      `select *
       from public.part_inbounds
       order by created_at desc, id desc
       limit 5000`
    );
    return rows.map((r) => mapRow(r, idToCode));
  }

  const storeUuid = await resolveStoreUuid(store);
  if (!storeUuid) return [];

  const { rows } = await getPool().query<DbRow>(
    `select *
     from public.part_inbounds
     where store_id = $1::uuid
     order by created_at desc, id desc
     limit 5000`,
    [storeUuid]
  );
  return rows.map((r) => mapRow(r, idToCode));
}

export async function repoUpsertPartInbound(
  input: PartInboundUpsertInput
): Promise<PartInboundDto> {
  const { codeToId, idToCode } = await loadStoreMaps();
  const storeCode = String(input.storeId || "").trim();
  const storeUuid = codeToId.get(storeCode);
  if (!storeUuid) {
    throw new Error("Cửa hàng không hợp lệ.");
  }

  const distributor = String(input.distributor || "").trim();
  const partType = String(input.partType || "").trim();
  const partName = String(input.partName || "").trim();
  const brand = String(input.brand || "").trim();
  const color = String(input.color || "").trim();
  const quantity = Math.max(0, Math.round(Number(input.quantity) || 0));
  const actor = normalizeActor(input.actorUsername);

  if (!distributor) throw new Error("Nhập nhà phân phối.");
  if (!partType) throw new Error("Nhập loại linh kiện.");
  if (!partName) throw new Error("Nhập tên linh kiện.");
  if (quantity <= 0) throw new Error("Số lượng phải lớn hơn 0.");

  if (input.id) {
    const { rows } = await getPool().query<DbRow>(
      `update public.part_inbounds set
         store_id = $1,
         distributor = $2,
         part_type = $3,
         part_name = $4,
         brand = $5,
         color = $6,
         quantity = $7,
         address = '',
         phone = '',
         updated_by = coalesce($8, updated_by),
         updated_at = now()
       where id = $9::uuid
       returning *`,
      [
        storeUuid,
        distributor,
        partType,
        partName,
        brand,
        color,
        quantity,
        actor,
        input.id,
      ]
    );
    if (!rows[0]) throw new Error("Không tìm thấy phiếu nhập để cập nhật.");
    return mapRow(rows[0], idToCode);
  }

  const { rows } = await getPool().query<DbRow>(
    `insert into public.part_inbounds (
       store_id, distributor, address, phone, part_type, part_name, brand, color, quantity,
       created_by, updated_by
     ) values ($1,$2,'','',$3,$4,$5,$6,$7,$8,$8)
     returning *`,
    [storeUuid, distributor, partType, partName, brand, color, quantity, actor]
  );
  return mapRow(rows[0], idToCode);
}

export async function repoDeletePartInbound(id: string): Promise<PartInboundDto> {
  const orderId = String(id || "").trim();
  if (!orderId) throw new Error("Thiếu mã phiếu nhập.");
  const { idToCode } = await loadStoreMaps();
  const { rows } = await getPool().query<DbRow>(
    `delete from public.part_inbounds where id = $1::uuid returning *`,
    [orderId]
  );
  if (!rows[0]) throw new Error("Không tìm thấy phiếu nhập để xóa.");
  return mapRow(rows[0], idToCode);
}
