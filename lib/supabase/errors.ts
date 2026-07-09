/** Map Supabase / RPC errors to short Vietnamese messages. */

const RPC_MESSAGES: Record<string, string> = {
  not_authenticated: "Chưa đăng nhập (Supabase Auth).",
  owner_only: "Chỉ chủ cửa hàng được thực hiện.",
  store_forbidden: "Không có quyền cửa hàng này.",
  phone_not_found: "Không tìm thấy máy.",
  phone_not_in_stock: "Máy không còn hàng.",
  phone_store_mismatch: "Máy không thuộc cửa hàng đã chọn.",
  accessory_not_found: "Không tìm thấy phụ kiện.",
  accessory_store_mismatch: "Phụ kiện không thuộc cửa hàng đã chọn.",
  insufficient_stock: "Không đủ tồn phụ kiện.",
  accessory_code_conflict: "Mã phụ kiện đã tồn tại (active) ở cửa hàng này.",
  phone_status_insert_via_rpc_only: "Không được tạo máy với trạng thái này trực tiếp.",
  phone_status_change_via_rpc_only: "Đổi trạng thái máy phải qua RPC (bán/hủy).",
  accessory_cancel_via_rpc_only: "Hủy phụ kiện phải qua thao tác hủy.",
  accessory_restore_via_rpc_only: "Khôi phục phụ kiện phải qua thao tác khôi phục.",
  lookup_category_not_found: "Không tìm thấy danh mục.",
  lookup_add_not_allowed: "Không được thêm option vào danh mục này.",
  lookup_item_not_found: "Không tìm thấy option.",
  lookup_item_update_forbidden: "Không được sửa option này.",
  profile_privileged_fields: "Không được đổi role/cửa hàng.",
  customer_inactive: "Khách hàng không hợp lệ.",
  sale_not_found: "Không tìm thấy phiếu bán.",
  sale_already_cancelled: "Phiếu bán đã hủy.",
  cancel_sale_phone_inconsistent: "Không hoàn tồn máy (trạng thái không khớp).",
  invalid_unit_price: "Giá bán không hợp lệ.",
  invalid_quantity: "Số lượng không hợp lệ.",
};

export class InventoryServiceError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "InventoryServiceError";
    this.code = code;
  }
}

export function toInventoryError(err: unknown): InventoryServiceError {
  if (err instanceof InventoryServiceError) return err;

  const anyErr = err as { message?: string; code?: string; details?: string; hint?: string };
  const raw = [anyErr?.message, anyErr?.details, anyErr?.hint].filter(Boolean).join(" ");

  if (!raw) {
    return new InventoryServiceError("Lỗi không xác định khi gọi Supabase.");
  }

  for (const [key, vi] of Object.entries(RPC_MESSAGES)) {
    if (raw.includes(key)) {
      return new InventoryServiceError(vi, key);
    }
  }

  if (raw.includes("duplicate key") && raw.toLowerCase().includes("imei")) {
    return new InventoryServiceError("IMEI đã tồn tại trong hệ thống.", "duplicate_imei");
  }
  if (raw.includes("duplicate key") && raw.includes("accessories")) {
    return new InventoryServiceError("Mã phụ kiện đã tồn tại ở cửa hàng này.", "duplicate_code");
  }
  if (raw.includes("JWT") || raw.includes("not authenticated") || raw.includes("Auth session")) {
    return new InventoryServiceError("Phiên đăng nhập Supabase không hợp lệ. Đăng nhập lại.", "auth");
  }

  return new InventoryServiceError(raw);
}
