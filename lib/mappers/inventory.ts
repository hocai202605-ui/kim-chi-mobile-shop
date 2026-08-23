import type { Accessory, AccessoryStatus, PhoneItem, ProductStatus, StoreId } from "@/types";
import { toShopMoney } from "@/lib/format";
import type { DbAccessory, DbAccessoryStatus, DbPhone } from "@/lib/supabase/types";

/** Mã enum cũ → nhãn UI (cột phones.status đã chuyển text tiếng Việt). */
const PHONE_STATUS_LEGACY_TO_UI: Record<string, ProductStatus> = {
  in_stock: "Còn hàng",
  sold: "Đã bán",
  pending: "Chưa xử lý",
  cancelled: "Đã hủy",
};

const LOCKED_PHONE_STATUS_LABELS = new Set<string>([
  "Còn hàng",
  "Đã bán",
  "Đã hủy",
  "Chưa xử lý",
]);

const ACCESSORY_STATUS_TO_UI: Record<DbAccessoryStatus, AccessoryStatus> = {
  in_stock: "Còn hàng",
  out_of_stock: "Hết hàng",
  cancelled: "Đã hủy",
};

const ACCESSORY_STATUS_TO_DB: Record<AccessoryStatus, DbAccessoryStatus> = {
  "Còn hàng": "in_stock",
  "Hết hàng": "out_of_stock",
  "Đã hủy": "cancelled",
};

export function phoneStatusToUi(status: string): ProductStatus {
  const t = String(status || "").trim();
  if (!t) return "Còn hàng";
  return (PHONE_STATUS_LEGACY_TO_UI[t] ?? t) as ProductStatus;
}

/** Lưu nhãn UI (kể cả status tự thêm). Mã enum cũ được chuẩn hóa. */
export function phoneStatusToDb(status: string): string {
  const t = String(status || "").trim();
  if (!t) return "Còn hàng";
  return PHONE_STATUS_LEGACY_TO_UI[t] ?? t;
}

export function isLockedPhoneStatusLabel(label: string): boolean {
  return LOCKED_PHONE_STATUS_LABELS.has(String(label || "").trim());
}

export function isPhoneInStockStatus(status: string): boolean {
  const ui = phoneStatusToUi(status);
  return ui === "Còn hàng";
}

export function isPhoneSoldStatus(status: string): boolean {
  return phoneStatusToUi(status) === "Đã bán";
}

export function isPhoneCancelledStatus(status: string): boolean {
  return phoneStatusToUi(status) === "Đã hủy";
}

export function isPhonePendingStatus(status: string): boolean {
  return phoneStatusToUi(status) === "Chưa xử lý";
}

export function accessoryStatusToUi(status: DbAccessoryStatus): AccessoryStatus {
  return ACCESSORY_STATUS_TO_UI[status] ?? "Còn hàng";
}

export function accessoryStatusToDb(status: AccessoryStatus): DbAccessoryStatus {
  return ACCESSORY_STATUS_TO_DB[status] ?? "in_stock";
}

/** Map DB phone row → UI PhoneItem (store uuid → store code). */
export function mapPhoneFromDb(
  row: DbPhone,
  storeCodeById: Map<string, Exclude<StoreId, "all">>
): PhoneItem {
  const storeId = storeCodeById.get(row.store_id) ?? "store-1";
  return {
    id: row.id,
    brand: row.brand,
    name: row.model_name,
    imei: row.imei,
    color: row.color ?? "",
    storage: row.storage ?? "",
    madeIn: row.made_in ?? "",
    networkVersion: row.network_version ?? "",
    batteryCondition: row.battery_condition ?? "",
    batteryCapacity: row.battery_capacity || undefined,
    condition: row.condition ?? "",
    note: row.note || undefined,
    importDate: row.import_date ?? undefined,
    saleDate: row.sale_date ?? undefined,
    storeId,
    cost: toShopMoney(Number(row.cost)),
    expectedPrice: toShopMoney(Number(row.expected_price)),
    status: phoneStatusToUi(row.status),
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
  };
}

export function mapAccessoryFromDb(
  row: DbAccessory,
  storeCodeById: Map<string, Exclude<StoreId, "all">>
): Accessory {
  const storeId = storeCodeById.get(row.store_id) ?? "store-1";
  return {
    id: row.id,
    category: row.category ?? "",
    brand: row.brand ?? "",
    code: row.code,
    name: row.name,
    storeId,
    quantity: Number(row.quantity),
    cost: toShopMoney(Number(row.cost)),
    price: toShopMoney(Number(row.price)),
    status: accessoryStatusToUi(row.status),
    note: row.note || undefined,
  };
}
