/**
 * Domain types — Kim Chi Mobile Shop
 * Tách dần từ app/page.tsx khi refactor từng module.
 */

export type Role = "owner" | "staff";
export type StoreId = "all" | "store-1" | "store-2" | "store-3";
export type PaymentMethod = "Tiền mặt" | "Chuyển khoản" | "Thẻ" | "Khác";
export type ProductStatus = "Còn hàng" | "Đã bán" | "Đã hủy" | "Chưa xử lý";
export type AccessoryStatus = "Còn hàng" | "Hết hàng" | "Đã hủy";
export type RepairStatus = "Đang chờ" | "Đang sửa" | "Đã xong" | "Đã trả khách" | "Đã hủy";

/** Sidebar page ids — keep in sync with navItems / app_accounts.allowed_menus */
export type MenuId =
  | "sales"
  | "online-repairs"
  | "inventory"
  | "software"
  | "parts"
  | "inbound"
  | "inventoryReports"
  | "customers"
  | "ledger"
  | "logs"
  | "accounts"
  | "dashboard";

export type User = {
  id: string;
  name: string;
  /** Login username (admin, huyen, …) */
  username: string;
  email: string;
  role: Role;
  storeId: Exclude<StoreId, "all">;
  /** Menus được phép; owner được coi full quyền phía UI */
  allowedMenus: string[];
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  /** Địa chỉ (tuỳ chọn). */
  address: string;
  note: string;
};

export type PhoneItem = {
  id: string;
  brand: string;
  name: string;
  imei: string;
  color: string;
  storage: string;
  madeIn: string;
  networkVersion: string;
  batteryCondition: string;
  batteryCapacity?: string;
  condition: string;
  note?: string;
  importDate?: string;
  saleDate?: string;
  storeId: Exclude<StoreId, "all">;
  cost: number;
  expectedPrice: number;
  status: ProductStatus;
};

export type Accessory = {
  id: string;
  category: string;
  brand: string;
  code: string;
  name: string;
  storeId: Exclude<StoreId, "all">;
  quantity: number;
  cost: number;
  price: number;
  status: AccessoryStatus;
  note?: string;
};

export type Sale = {
  id: string;
  createdAt: string;
  customerId: string;
  customerName?: string;
  storeId: Exclude<StoreId, "all">;
  itemName: string;
  itemType: "Máy" | "Phụ kiện";
  quantity: number;
  amount: number;
  profit: number;
  payment: PaymentMethod;
  status: "Hoàn tất" | "Đã hủy";
};

export type Repair = {
  id: string;
  createdAt: string;
  customerId: string;
  storeId: Exclude<StoreId, "all">;
  deviceName: string;
  screenPassword: string;
  issue: string;
  intakeNote: string;
  quote: number;
  deposit: number;
  status: RepairStatus;
};

export type Ledger = {
  id: string;
  createdAt: string;
  storeId: Exclude<StoreId, "all">;
  type: "Thu" | "Chi";
  source: string;
  amount: number;
  payment: PaymentMethod;
  status: "Hiệu lực" | "Đã hủy";
};

export type AuditLog = {
  id: string;
  createdAt: string;
  user: string;
  storeId: Exclude<StoreId, "all">;
  action: string;
  target: string;
};

export type SoftwareService = {
  id: string;
  createdAt: string;
  customerName: string;
  deviceName: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  isPaid: boolean;
};

export type OnlineRepair = {
  id: string;
  createdAt: string;
  customerName: string;
  customerType: "Thân thiết" | "Vãng lai" | "Mới" | "Ưu tiên";
  deviceName: string;
  issue: string;
  quote: number;
  deposit: number;
  receiveDate: string;
  completeDate: string;
  paymentDate: string;
  paymentStatus: "Đã thanh toán" | "NỢ DAI";
  rewardPoints: number;
  isPaid: boolean;
};

/** Đơn sửa chữa cửa hàng (menu software) — DB repair_orders. */
export type ShopRepairOrder = OnlineRepair & {
  /** Tình trạng máy khi tiếp nhận / ghi nhận. */
  condition: string;
  /** Thời hạn / ghi chú bảo hành. */
  warranty: string;
  /** IMEI (tùy chọn). */
  imei: string;
  /** SĐT khách / mật khẩu máy (free text, tùy chọn). */
  phoneOrPass: string;
};
