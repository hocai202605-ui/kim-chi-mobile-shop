import type { StoreId } from "@/types";

export const stores = [
  { id: "store-1" as const, name: "Kim Chi Mobile" },
  { id: "store-2" as const, name: "Kiều Vy Mobile" },
  { id: "store-3" as const, name: "Cao Bắc Mobile" },
];

export function storeName(id: StoreId) {
  if (id === "all") return "Toàn hệ thống";
  return stores.find((store) => store.id === id)?.name ?? id;
}

export const PAYMENT_METHODS = ["Tiền mặt", "Chuyển khoản", "Thẻ", "Khác"] as const;

/** Sidebar page ids — sync with navItems + app_accounts.allowed_menus */
export const ALL_MENU_IDS = [
  "sales",
  "online-repairs",
  "inventory",
  "software",
  "parts",
  "inbound",
  "inventoryReports",
  "customers",
  "ledger",
  "logs",
  "accounts",
  "dashboard",
] as const;

export type MenuPageId = (typeof ALL_MENU_IDS)[number];
