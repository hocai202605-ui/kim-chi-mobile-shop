import type { StoreId } from "@/types";

export const stores = [
  { id: "store-1" as const, name: "Cửa hàng 1" },
  { id: "store-2" as const, name: "Cửa hàng 2" },
  { id: "store-3" as const, name: "Cửa hàng 3" },
];

export function storeName(id: StoreId) {
  if (id === "all") return "Toàn hệ thống";
  return stores.find((store) => store.id === id)?.name ?? id;
}

export const PAYMENT_METHODS = ["Tiền mặt", "Chuyển khoản", "Thẻ", "Khác"] as const;
