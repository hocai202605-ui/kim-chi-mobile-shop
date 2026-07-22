"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowUpDown,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  CopyPlus,
  CreditCard,
  Edit3,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Cpu,
  Minus,
  NotebookPen,
  PackagePlus,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Store,
  Terminal,
  Trash2,
  UserCog,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  deleteAccessory as apiDeleteAccessory,
  deletePhone as apiDeletePhone,
  loadInventoryBootstrap as apiLoadInventoryBootstrap,
  upsertAccessory as apiUpsertAccessory,
  upsertPhone as apiUpsertPhone,
} from "@/services/inventoryService";
import {
  reportDashboardSummary,
  reportInventoryMonthly,
  reportInventoryYearly,
  toYearlyChartRows,
  type DashboardSummary,
} from "@/services/inventoryReportService";
import {
  ACCESSORY_LOOKUP_CATEGORIES,
  PART_LOOKUP_CATEGORIES,
  PHONE_LOOKUP_CATEGORIES,
  REPAIR_LOOKUP_CATEGORIES,
  SALE_LOOKUP_CATEGORIES,
  SOFTWARE_LOOKUP_CATEGORIES,
  addLookupItem as apiAddLookupItem,
  deactivateLookupItem as apiDeactivateLookupItem,
  sortLookupItems as apiSortLookupItems,
  updateLookupItem as apiUpdateLookupItem,
} from "@/services/lookupService";
import {
  deleteSoftwareOrder as apiDeleteSoftwareOrder,
  listSoftwareOrders as apiListSoftwareOrders,
  markSoftwareOrdersPaid as apiMarkSoftwareOrdersPaid,
  upsertSoftwareOrder as apiUpsertSoftwareOrder,
} from "@/services/softwareService";
import {
  deleteRepairOrder as apiDeleteRepairOrder,
  listRepairOrders as apiListRepairOrders,
  markRepairOrdersPaid as apiMarkRepairOrdersPaid,
  upsertRepairOrder as apiUpsertRepairOrder,
} from "@/services/repairService";
import {
  deletePartInbound as apiDeletePartInbound,
  listPartInbounds as apiListPartInbounds,
  upsertPartInbound as apiUpsertPartInbound,
} from "@/services/partsService";
import {
  cancelManualDebt as apiCancelManualDebt,
  listDebts as apiListDebts,
  markDebtsPaid as apiMarkDebtsPaid,
  upsertManualDebt as apiUpsertManualDebt,
  type DebtItem,
} from "@/services/debtsService";
import {
  cancelSale as apiCancelSale,
  createSale as apiCreateSale,
  getSale as apiGetSale,
  listRecentSales as apiListRecentSales,
  type SaleChannel,
} from "@/services/salesService";
import {
  listCustomers as apiListCustomers,
  saveCustomer as apiSaveCustomer,
} from "@/services/customersService";
import {
  apiListAccounts,
  apiListLoginUsers,
  apiLogin,
  apiUpdateAccount,
  apiUpdateAccountMenus,
  type AccountUser,
  type LoginUserOption,
} from "@/services/accountsService";
import { ALL_MENU_IDS } from "@/lib/constants";
import { downloadPhonesExcel } from "@/lib/exportPhonesExcel";
import {
  formatVnDateTime,
  toVnDate,
  vnNowDate,
  vnNowDateTimeLocal,
  vnNowMonth,
  vnNowYear,
} from "@/lib/datetime";

/** Chuẩn hóa về YYYY-MM-DD để khớp bộ lọc kỳ báo cáo. */
function toReportDateKey(raw: string | undefined | null): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  // ISO / datetime-local / "YYYY-MM-DD HH:mm"
  const mIso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (mIso) return mIso[1];
  // vi-VN: DD/MM/YYYY ...
  const mVi = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mVi) {
    return `${mVi[3]}-${mVi[2].padStart(2, "0")}-${mVi[1].padStart(2, "0")}`;
  }
  return toVnDate(s) || "";
}

function toUiError(err: unknown): string {
  return err instanceof Error ? err.message : "Lỗi không xác định";
}

const SESSION_KEY = "kimchi.session";
/** Tự đăng xuất sau 8 giờ không thao tác (idle). Có dùng thì gia hạn lại. */
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
/** Không ghi sessionStorage quá dày khi user click liên tục. */
const SESSION_TOUCH_THROTTLE_MS = 60_000;
let lastSessionTouchAt = 0;

type Role = "owner" | "staff";
type StoreId = "all" | "store-1" | "store-2" | "store-3";
type PaymentMethod =
  | "Tiền mặt"
  | "Chuyển khoản"
  | "Thẻ"
  | "Khác"
  | "NỢ DAI"
  | "Nợ"
  | "Thanh toán 1 phần";
/** Hình thức thanh toán (kênh thu). */
type SalePayMethod = "Tiền mặt" | "Chuyển khoản";
const SALE_PAY_METHOD_OPTIONS: SalePayMethod[] = ["Tiền mặt", "Chuyển khoản"];
/** Trạng thái TT (mặc định NỢ DAI) — copy giống phần mềm. */
type SalePayStatus = "NỢ DAI" | "Đã thanh toán" | "Thanh toán 1 phần";
const SALE_PAY_STATUS_OPTIONS: SalePayStatus[] = ["NỢ DAI", "Đã thanh toán", "Thanh toán 1 phần"];

/** Ghép status + method → giá trị payment lưu grid / map API. */
function resolveSalePaymentValue(status: SalePayStatus, method: SalePayMethod): PaymentMethod {
  if (status === "NỢ DAI") return "NỢ DAI";
  if (status === "Thanh toán 1 phần") return "Thanh toán 1 phần";
  return method;
}

function parseSalePaymentFields(pay: string): { status: SalePayStatus; method: SalePayMethod } {
  const p = pay.trim();
  if (p === "NỢ DAI" || p === "Nợ" || p.toLowerCase() === "nợ") {
    return { status: "NỢ DAI", method: "Tiền mặt" };
  }
  if (p === "Thanh toán 1 phần") return { status: "Thanh toán 1 phần", method: "Tiền mặt" };
  if (p === "Chuyển khoản") return { status: "Đã thanh toán", method: "Chuyển khoản" };
  return { status: "Đã thanh toán", method: "Tiền mặt" };
}

/** Badge TT grid/form — icon giống phần mềm. */
function salePayStatusLabel(payment: string, saleStatus?: string): { text: string; className: string } {
  if (saleStatus === "Đã hủy") {
    return {
      text: "Đã hủy",
      className: "bg-slate-50 text-slate-600 border border-line",
    };
  }
  if (payment === "NỢ DAI" || payment === "Nợ") {
    return {
      text: "❌ NỢ DAI",
      className: "bg-red-50 text-red-600 border border-line",
    };
  }
  if (payment === "Thanh toán 1 phần") {
    return {
      text: "⚠️ Thanh toán 1 phần",
      className: "bg-amber-50 text-amber-800 border border-line",
    };
  }
  return {
    text: "✅ Đã thanh toán",
    className: "bg-emerald-50 text-emerald-600 border border-line",
  };
}
type ProductStatus = "Còn hàng" | "Đã bán" | "Đã hủy" | "Chưa xử lý";
type AccessoryStatus = "Còn hàng" | "Hết hàng" | "Đã hủy";
type RepairStatus = "Đang chờ" | "Đang sửa" | "Đã xong" | "Đã trả khách" | "Đã hủy";

type User = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  storeId: Exclude<StoreId, "all">;
  allowedMenus: string[];
};

/** Chỉ lưu user + mốc hết hạn — không bao giờ lưu password. */
type SessionPayload = {
  user: User;
  loggedInAt: number;
  expiresAt: number;
};

type Customer = {
  id: string;
  name: string;
  phone: string;
  /** Địa chỉ (tuỳ chọn). */
  address: string;
  note: string;
};

/** Dòng giỏ phiếu bán (client). */
type SaleCartLine =
  | {
      key: string;
      kind: "phone";
      phoneId: string;
      name: string;
      imei: string;
      brand?: string;
      color?: string;
      storage?: string;
      condition?: string;
      /** Đơn giá short shop */
      unitPrice: number;
      cost: number;
    }
  | {
      key: string;
      kind: "accessory";
      name: string;
      quantity: number;
      /** Giá bán short shop (1 cái) */
      unitPrice: number;
      /** Giá nhập short (1 cái), mặc định 0 */
      cost: number;
    };

const SALE_ACC_NAME_SEED = [
  "Ốp trong suốt",
  "Ốp chống sốc",
  "Cáp sạc Type-C",
  "Cáp Lightning",
  "Củ sạc 20W",
  "Củ sạc 65W",
  "Tai nghe Bluetooth",
  "Kính cường lực",
  "Sạc dự phòng 10000mAh",
];

type PhoneItem = {
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

type Accessory = {
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

/** Snapshot dòng hàng trên phiếu (UI mock — chốt UX). */
type SaleLineSnapshot =
  | {
      kind: "phone";
      phoneId?: string;
      name: string;
      imei?: string;
      brand?: string;
      color?: string;
      storage?: string;
      condition?: string;
      /** Đơn giá short shop */
      unitPrice: number;
      cost: number;
    }
  | {
      kind: "accessory";
      name: string;
      quantity: number;
      unitPrice: number;
      cost?: number;
      category?: string;
    };

type Sale = {
  id: string;
  createdAt: string;
  customerId: string;
  /** Tên khách từ API (khi không map được customerId local). */
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerNote?: string;
  /** Ghi chú phiếu (vd: bảo hành bán máy). */
  note?: string;
  storeId: Exclude<StoreId, "all">;
  itemName: string;
  itemType: "Máy" | "Phụ kiện";
  quantity: number;
  /** Short shop — cùng đơn vị giá kho (nhập 150 → hiện 150). */
  amount: number;
  /** Short shop — giá nhập / vốn phiếu. */
  cost?: number;
  /** Short shop. */
  profit: number;
  payment: PaymentMethod;
  status: "Hoàn tất" | "Đã hủy";
  /** Chi tiết dòng (UI mock). Seed cũ có thể không có. */
  lines?: SaleLineSnapshot[];
};

type SoftwareService = {
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

type OnlineRepair = {
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
  isPaid: boolean; // Kept for legacy compatibility / simple checks
};

type Repair = {
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

type Ledger = {
  id: string;
  createdAt: string;
  storeId: Exclude<StoreId, "all">;
  type: "Thu" | "Chi";
  source: string;
  amount: number;
  payment: PaymentMethod;
  status: "Hiệu lực" | "Đã hủy";
};

type AuditLog = {
  id: string;
  createdAt: string;
  user: string;
  storeId: Exclude<StoreId, "all">;
  action: string;
  target: string;
};

const stores = [
  { id: "store-1", name: "Kim Chi Mobile" },
  { id: "store-2", name: "Kiều Vy Mobile" },
  { id: "store-3", name: "Cao Bắc Mobile" },
] as const;

const customersSeed: Customer[] = [
  { id: "c1", name: "Anh Minh", phone: "0901 234 567", address: "Q.1, TP.HCM", note: "Hay mua iPhone cũ" },
  { id: "c2", name: "Chị Lan", phone: "0918 222 333", address: "Thủ Đức", note: "Khách sửa máy" },
  { id: "c3", name: "Bạn Huy", phone: "0987 111 222", address: "", note: "Quan tâm phụ kiện" },
];

/** Seed demo — đơn vị short shop (giống kho). */
const salesSeed: Sale[] = [
  { id: "s1", createdAt: "2026-07-05", customerId: "c1", storeId: "store-1", itemName: "iPhone 14 128GB", itemType: "Máy", quantity: 1, amount: 14500, profit: 1500, payment: "Chuyển khoản", status: "Hoàn tất" },
  { id: "s2", createdAt: "2026-07-06", customerId: "c3", storeId: "store-3", itemName: "Kính cường lực Kingkong", itemType: "Phụ kiện", quantity: 2, amount: 140, profit: 104, payment: "Tiền mặt", status: "Hoàn tất" },
  { id: "s3", createdAt: "2026-07-06", customerId: "c2", storeId: "store-1", itemName: "iPhone 13 128GB Hồng", itemType: "Máy", quantity: 1, amount: 11800, profit: 1300, payment: "Thẻ", status: "Hoàn tất" },
  { id: "s4", createdAt: "2026-07-05", customerId: "c1", storeId: "store-2", itemName: "Ốp lưng chống sốc iPhone 14", itemType: "Phụ kiện", quantity: 1, amount: 110, profit: 70, payment: "Tiền mặt", status: "Hoàn tất" },
  { id: "s5", createdAt: "2026-07-04", customerId: "c2", storeId: "store-1", itemName: "Cáp sạc nhanh 20W Apple", itemType: "Phụ kiện", quantity: 1, amount: 120, profit: 65, payment: "Chuyển khoản", status: "Hoàn tất" },
  { id: "s6", createdAt: "2026-07-03", customerId: "c3", storeId: "store-3", itemName: "Củ sạc GaN 65W Baseus", itemType: "Phụ kiện", quantity: 1, amount: 550, profit: 230, payment: "Tiền mặt", status: "Hoàn tất" },
  { id: "s7", createdAt: "2026-01-15", customerId: "c1", storeId: "store-1", itemName: "iPhone 15 Pro Max", itemType: "Máy", quantity: 2, amount: 62000, profit: 5000, payment: "Chuyển khoản", status: "Hoàn tất" },
  { id: "s8", createdAt: "2026-02-10", customerId: "c2", storeId: "store-2", itemName: "Samsung S22 Ultra", itemType: "Máy", quantity: 1, amount: 14000, profit: 1200, payment: "Tiền mặt", status: "Hoàn tất" },
  { id: "s9", createdAt: "2026-03-20", customerId: "c3", storeId: "store-3", itemName: "iPhone 11 64GB", itemType: "Máy", quantity: 3, amount: 19500, profit: 3000, payment: "Thẻ", status: "Hoàn tất" },
  { id: "s10", createdAt: "2026-04-05", customerId: "c1", storeId: "store-1", itemName: "Oppo Reno 8", itemType: "Máy", quantity: 1, amount: 8500, profit: 1500, payment: "Chuyển khoản", status: "Hoàn tất" },
  { id: "s11", createdAt: "2026-05-12", customerId: "c2", storeId: "store-2", itemName: "Xiaomi Redmi Note 12", itemType: "Máy", quantity: 4, amount: 16800, profit: 2800, payment: "Tiền mặt", status: "Hoàn tất" },
  { id: "s12", createdAt: "2026-06-25", customerId: "c3", storeId: "store-3", itemName: "iPhone 14 Pro Max", itemType: "Máy", quantity: 1, amount: 23200, profit: 1700, payment: "Chuyển khoản", status: "Hoàn tất" },
  { id: "s13", createdAt: "2026-02-28", customerId: "c1", storeId: "store-1", itemName: "Z Fold 5", itemType: "Máy", quantity: 1, amount: 28000, profit: 3000, payment: "Thẻ", status: "Hoàn tất" },
  { id: "s14", createdAt: "2026-04-18", customerId: "c2", storeId: "store-2", itemName: "iPhone XS Max", itemType: "Máy", quantity: 2, amount: 11000, profit: 2000, payment: "Tiền mặt", status: "Hoàn tất" },
  { id: "s15", createdAt: "2026-01-05", customerId: "c3", storeId: "store-3", itemName: "Sạc dự phòng 10000mAh", itemType: "Phụ kiện", quantity: 5, amount: 2000, profit: 750, payment: "Chuyển khoản", status: "Hoàn tất" },
  { id: "s16", createdAt: "2026-03-10", customerId: "c1", storeId: "store-1", itemName: "Tai nghe AirPods Pro 2", itemType: "Phụ kiện", quantity: 2, amount: 1100, profit: 400, payment: "Tiền mặt", status: "Hoàn tất" },
  { id: "s17", createdAt: "2026-05-22", customerId: "c2", storeId: "store-2", itemName: "Giá đỡ điện thoại ô tô", itemType: "Phụ kiện", quantity: 3, amount: 450, profit: 240, payment: "Thẻ", status: "Hoàn tất" },
  { id: "s18", createdAt: "2026-06-15", customerId: "c3", storeId: "store-3", itemName: "Dây đeo Apple Watch", itemType: "Phụ kiện", quantity: 4, amount: 480, profit: 300, payment: "Chuyển khoản", status: "Hoàn tất" },
];

const softwareServiceSeed: SoftwareService[] = [
  { id: "sw1", createdAt: "2026-07-07 16:18", customerName: "Anh Đức FB", deviceName: "Bypass iCloud", quantity: 1, revenue: 200000, cost: 0, profit: 200000, isPaid: true },
  { id: "sw2", createdAt: "2026-07-07 16:18", customerName: "Quân Thảo", deviceName: "A53s", quantity: 1, revenue: 100000, cost: 0, profit: 100000, isPaid: false },
  { id: "sw3", createdAt: "2026-07-07 23:47", customerName: "Dũng Mobi", deviceName: "Unlock mạng", quantity: 1, revenue: 5000000, cost: 3500000, profit: 1500000, isPaid: true },
];

/** Phiếu nhập hàng (menu NHẬP HÀNG / id `parts`) — Postgres part_inbounds. */
type PartInbound = {
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

function uniquePartLabels(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = String(raw || "").trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out.sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }));
}

/**
 * UI Sửa chữa (menu `software`) — load/ghi Postgres qua /api/repairs.
 * Shape = OnlineRepair + tình trạng / bảo hành.
 * imei / phoneOrPass: legacy DB — UI form/grid/chi tiết đã bỏ.
 */
type ShopRepairOrder = OnlineRepair & {
  /** Tình trạng máy khi tiếp nhận / ghi nhận. */
  condition: string;
  /** Thời hạn / ghi chú bảo hành. */
  warranty: string;
  /** Legacy — UI không còn nhập. */
  imei: string;
  /** Legacy — UI không còn nhập. */
  phoneOrPass: string;
  /** Hình thức TT: Tiền mặt | Chuyển khoản. */
  paymentMethod?: "Tiền mặt" | "Chuyển khoản";
};

const repairsSeed: Repair[] = [
  { id: "r1", createdAt: "2026-07-06", customerId: "c2", storeId: "store-2", deviceName: "iPhone XS", screenPassword: "2580", issue: "Thay pin", intakeNote: "Màn trầy nhẹ, camera bình thường", quote: 650000, deposit: 200000, status: "Đang sửa" },
  { id: "r2", createdAt: "2026-07-05", customerId: "c1", storeId: "store-1", deviceName: "Samsung A52", screenPassword: "Không có", issue: "Lỗi sạc", intakeNote: "Máy móp góc dưới", quote: 450000, deposit: 0, status: "Đang chờ" },
  { id: "r3", createdAt: "2026-07-06", customerId: "c3", storeId: "store-1", deviceName: "iPhone 11 Pro Max", screenPassword: "111", issue: "Ép kính", intakeNote: "Kính nứt nhiều, màn hình hiển thị tốt", quote: 900000, deposit: 300000, status: "Đang sửa" },
  { id: "r4", createdAt: "2026-07-04", customerId: "c2", storeId: "store-3", deviceName: "Oppo Reno 5", screenPassword: "Vẽ tay", issue: "Thay loa trong", intakeNote: "Nghe gọi rè nhỏ", quote: 350000, deposit: 100000, status: "Đã xong" },
  { id: "r5", createdAt: "2026-07-03", customerId: "c1", storeId: "store-2", deviceName: "iPad Air 4", screenPassword: "000000", issue: "Thay pin", intakeNote: "Pin phồng nhẹ mặt lưng", quote: 1200000, deposit: 500000, status: "Đã trả khách" },
];

const ledgerSeed: Ledger[] = [
  { id: "l1", createdAt: "2026-07-05", storeId: "store-1", type: "Thu", source: "Phiếu bán s1", amount: 14500000, payment: "Chuyển khoản", status: "Hiệu lực" },
  { id: "l2", createdAt: "2026-07-06", storeId: "store-3", type: "Thu", source: "Phiếu bán s2", amount: 140000, payment: "Tiền mặt", status: "Hiệu lực" },
  { id: "l3", createdAt: "2026-07-06", storeId: "store-1", type: "Thu", source: "Phiếu bán s3", amount: 11800000, payment: "Thẻ", status: "Hiệu lực" },
  { id: "l4", createdAt: "2026-07-05", storeId: "store-2", type: "Thu", source: "Phiếu bán s4", amount: 110000, payment: "Tiền mặt", status: "Hiệu lực" },
  { id: "l5", createdAt: "2026-07-06", storeId: "store-2", type: "Thu", source: "Cọc sửa r1", amount: 200000, payment: "Tiền mặt", status: "Hiệu lực" },
  { id: "l6", createdAt: "2026-07-06", storeId: "store-1", type: "Chi", source: "Tiền mặt bằng Tháng 7", amount: 30000000, payment: "Chuyển khoản", status: "Hiệu lực" },
  { id: "l7", createdAt: "2026-07-06", storeId: "store-1", type: "Chi", source: "Tiền điện nước", amount: 2500000, payment: "Chuyển khoản", status: "Hiệu lực" },
  { id: "l8", createdAt: "2026-07-05", storeId: "store-3", type: "Chi", source: "Nhập phụ kiện", amount: 5000000, payment: "Chuyển khoản", status: "Hiệu lực" },
  { id: "l9", createdAt: "2026-07-04", storeId: "store-2", type: "Thu", source: "Thanh toán sửa r5", amount: 700000, payment: "Chuyển khoản", status: "Hiệu lực" },
  { id: "l10", createdAt: "2026-07-06", storeId: "store-1", type: "Thu", source: "Cọc sửa r3", amount: 300000, payment: "Chuyển khoản", status: "Hiệu lực" },
];

/** Bỏ dấu tiếng Việt để map màu ổn định (Cam / cam / CAM). */
function normalizeColorKey(colorName: string): string {
  return colorName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function getColorCode(colorName: string): string {
  if (!colorName?.trim()) return "#94a3b8";
  const name = normalizeColorKey(colorName);

  // Exact match trước (tránh nhầm / ưu tiên Cam = cam)
  const exact: Record<string, string> = {
    cam: "#f97316",
    orange: "#f97316",
    do: "#ef4444",
    red: "#ef4444",
    den: "#1e293b",
    black: "#1e293b",
    midnight: "#1e293b",
    trang: "#ffffff",
    white: "#ffffff",
    starlight: "#ffffff",
    bac: "#cbd5e1",
    silver: "#cbd5e1",
    xam: "#64748b",
    gray: "#64748b",
    grey: "#64748b",
    vang: "#eab308",
    gold: "#eab308",
    tim: "#a855f7",
    purple: "#a855f7",
    hong: "#ec4899",
    pink: "#ec4899",
    titan: "#a8a29e",
    titanium: "#a8a29e",
    "xanh duong": "#3b82f6",
    "xanh bien": "#3b82f6",
    blue: "#3b82f6",
    "xanh la": "#22c55e",
    "xanh ngoc": "#22c55e",
    "xanh reu": "#4d7c0f",
    green: "#22c55e",
    xanh: "#22c55e",
  };
  if (exact[name]) return exact[name];

  // Partial match — Cam trước để không bị nhầm / rơi về xám nhạt (trông như trắng)
  if (name.includes("cam") || name.includes("orange")) return "#f97316";
  if ((name.includes("do") && !name.includes("duong")) || name.includes("red")) return "#ef4444";
  if (name.includes("xanh duong") || name.includes("xanh bien") || name.includes("blue")) return "#3b82f6";
  if (name.includes("xanh la") || name.includes("xanh ngoc") || name.includes("xanh reu") || name.includes("green")) return "#22c55e";
  if (name.includes("vang") || name.includes("gold")) return "#eab308";
  if (name.includes("den") || name.includes("black") || name.includes("midnight")) return "#1e293b";
  if (name.includes("trang") || name.includes("white") || name.includes("starlight")) return "#ffffff";
  if (name.includes("bac") || name.includes("silver")) return "#cbd5e1";
  if (name.includes("xam") || name.includes("gray") || name.includes("grey")) return "#64748b";
  if (name.includes("tim") || name.includes("purple")) return "#a855f7";
  if (name.includes("hong") || name.includes("pink")) return "#ec4899";
  if (name.includes("titan")) return "#a8a29e";
  return "#94a3b8";
}

function ColorDot({ color, size = "md" }: { color: string; size?: "sm" | "md" }) {
  const hex = getColorCode(color);
  const light = ["#ffffff", "#cbd5e1", "#e2e8f0", "#f8fafc", "#94a3b8"].includes(hex.toLowerCase())
    || hex.toLowerCase() === "#ffffff";
  const dim = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <span
      title={color || "—"}
      className={`${dim} shrink-0 rounded-full border shadow-sm ${light ? "border-slate-400" : "border-black/15"}`}
      style={{ backgroundColor: hex }}
    />
  );
}

const logSeed: AuditLog[] = [
  { id: "g1", createdAt: "2026-07-06 09:15", user: "Chủ cửa hàng", storeId: "store-1", action: "Tạo phiếu bán", target: "s1" },
  { id: "g2", createdAt: "2026-07-06 10:20", user: "Nhân viên CH2", storeId: "store-2", action: "Tạo phiếu sửa", target: "r1" },
];

const navItems = [
  { id: "sales", label: "BÁN HÀNG", icon: ReceiptText },
  { id: "online-repairs", label: "PHẦN MỀM", icon: Terminal },
  { id: "inventory", label: "KHO HÀNG", icon: Boxes },
  { id: "software", label: "SỬA CHỮA", icon: Wrench },
  { id: "parts", label: "NHẬP HÀNG", icon: PackagePlus },
  { id: "inbound", label: "LINH KIỆN", icon: Cpu },
  { id: "customers", label: "KHÁCH HÀNG", icon: Users },
  { id: "ledger", label: "CÔNG NỢ", icon: CreditCard },
  { id: "debt-notes", label: "GHI NỢ", icon: NotebookPen },
  { id: "logs", label: "NHẬT KÝ", icon: ClipboardList },
  { id: "accounts", label: "TÀI KHOẢN", icon: UserCog },
  { id: "dashboard", label: "BÁO CÁO / THỐNG KÊ", icon: LayoutDashboard },
] as const;

type PageId = (typeof navItems)[number]["id"];

/** Tab hub Báo cáo / Thống kê (Sprint 1+). */
type ReportHubTab =
  | "overview"
  | "sales"
  | "inventory"
  | "banGa"
  | "software"
  | "repair"
  | "transfer";
type ReportPeriod = "day" | "month" | "year";

const REPORT_HUB_TABS: { id: ReportHubTab; label: string }[] = [
  { id: "overview", label: "Tổng quan" },
  { id: "sales", label: "Bán hàng" },
  { id: "inventory", label: "Kho hàng" },
  { id: "banGa", label: "Bán Gà" },
  { id: "software", label: "Phần mềm" },
  { id: "repair", label: "Sửa chữa" },
  { id: "transfer", label: "Chuyển Khoản" },
];

const MENU_LABELS: Record<string, string> = {
  ...Object.fromEntries(navItems.map((item) => [item.id, item.label])),
  /** Menu cũ — gộp vào dashboard; giữ label cho màn Tài khoản. */
  inventoryReports: "BÁO CÁO / THỐNG KÊ",
};

function canAccessMenu(user: User, pageId: string): boolean {
  if (user.role === "owner") return true;
  if (user.allowedMenus.includes(pageId)) return true;
  // Menu cũ «Báo cáo kho» → hub mới
  if (pageId === "dashboard" && user.allowedMenus.includes("inventoryReports")) return true;
  return false;
}

function accountToUser(a: AccountUser): User {
  return {
    id: a.id,
    name: a.name,
    username: a.username,
    email: a.email,
    role: a.role,
    storeId: a.storeId,
    allowedMenus: a.role === "owner" ? [...ALL_MENU_IDS] : a.allowedMenus,
  };
}

/** Filter cửa hàng mặc định sau login / restore session. */
function defaultStoreFilterForUser(user: User): StoreId {
  if (user.role === "staff") return user.storeId;
  // Owner quynhbupbe: mặc định Kim Chi (store-1), không “Toàn hệ thống”
  if (user.username.trim().toLowerCase() === "quynhbupbe") {
    return "store-1";
  }
  return "all";
}

function saveSession(user: User) {
  try {
    const now = Date.now();
    const payload: SessionPayload = {
      user,
      loggedInAt: now,
      expiresAt: now + SESSION_TTL_MS,
    };
    // Chỉ user + thời hạn — tuyệt đối không ghi password
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    lastSessionTouchAt = now;
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

/**
 * Gia hạn phiên khi user còn thao tác (sliding idle timeout).
 * Không đụng user payload; không gia hạn nếu đã hết hạn.
 */
function touchSession(force = false) {
  try {
    const now = Date.now();
    if (!force && now - lastSessionTouchAt < SESSION_TOUCH_THROTTLE_MS) return;
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const payload = JSON.parse(raw) as SessionPayload;
    if (!payload?.user?.id || !payload.user?.username) return;
    if (typeof payload.expiresAt !== "number") return;
    if (now >= payload.expiresAt) return;
    payload.expiresAt = now + SESSION_TTL_MS;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    lastSessionTouchAt = now;
  } catch {
    /* ignore */
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  lastSessionTouchAt = 0;
}

function loadSession(): { user: User; expiresAt: number } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionPayload | User;
    // Hỗ trợ session cũ (chỉ User) — coi là hết hạn, bắt login lại
    if (!parsed || typeof parsed !== "object") return null;
    if (!("expiresAt" in parsed) || !("user" in parsed)) {
      clearSession();
      return null;
    }
    const payload = parsed as SessionPayload;
    if (!payload.user?.id || !payload.user?.username) {
      clearSession();
      return null;
    }
    if (Date.now() >= payload.expiresAt) {
      clearSession();
      return null;
    }
    // Đảm bảo không dính field password nếu từng bị ghi nhầm
    const { user } = payload;
    return {
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        storeId: user.storeId,
        allowedMenus: Array.isArray(user.allowedMenus) ? user.allowedMenus : [],
      },
      expiresAt: payload.expiresAt,
    };
  } catch {
    return null;
  }
}

function storeName(id: StoreId) {
  if (id === "all") return "Toàn hệ thống";
  return stores.find((store) => store.id === id)?.name ?? id;
}

function formatMoney(value: number) {
  return value.toLocaleString("vi-VN");
}

/** `YYYY-MM-DD` → `d/m/yyyy` (vi), không new Date() mơ hồ. */
function formatDateVi(iso?: string | null): string {
  if (!iso) return "";
  const m = String(iso).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso);
  return `${Number(m[3])}/${Number(m[2])}/${m[1]}`;
}

/** Droplist tiền (báo giá / phí DV): sort số tăng dần. */
function sortMoneyLabelsAsc(labels: string[]): string[] {
  return [...labels].sort((a, b) => {
    const na = Number(String(a).replace(/\D/g, "") || 0);
    const nb = Number(String(b).replace(/\D/g, "") || 0);
    if (na !== nb) return na - nb;
    return String(a).localeCompare(String(b), "vi");
  });
}

function formatInputMoney(value?: number | string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("vi-VN") : "";
}

function parseInputMoney(value: FormDataEntryValue | null | string) {
  return Number(String(value ?? "").replace(/\D/g, "") || 0);
}

/**
 * Giá kho đơn vị short (bớt 3 số 0): 16.900 lưu = 16.900.000 ₫ thật.
 * Nếu lỡ nhập full (≥ 1tr) thì chia 1000 về short.
 */
function parseShopMoney(value: FormDataEntryValue | null | string) {
  const n = parseInputMoney(value as FormDataEntryValue | null);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const r = Math.round(n);
  if (r >= 1_000_000) return Math.round(r / 1000);
  return r;
}

/** Short shop → VND thật để lọc khoảng giá. */
function shopMoneyToVnd(short: number): number {
  if (!Number.isFinite(short) || short <= 0) return 0;
  return Math.round(short) * 1000;
}

/** VND thật (sales DB) → short shop UI. */
function vndToShopMoney(vnd: number): number {
  if (!Number.isFinite(vnd)) return 0;
  return Math.round(vnd / 1000);
}

/**
 * Quy về triệu ₫ (M) để trục biểu đồ.
 * - Số ≥ 1.000.000: coi là VND đầy đủ → /1e6
 * - Còn lại: short shop (×1000 = VND) → /1000
 */
function toMillionVnd(value: number): number {
  const n = Number(value) || 0;
  if (!Number.isFinite(n) || n === 0) return 0;
  if (Math.abs(n) >= 1_000_000) return n / 1_000_000;
  return n / 1000;
}

/** Mốc trục Y: 0, 5, 10, 15, 20, 30, 40, … đủ phủ maxM. */
function buildMillionAxisTicks(maxM: number): number[] {
  const base = [0, 5, 10, 15, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 750, 1000];
  const ceiling = Math.max(5, maxM);
  let ticks = base.filter((t) => t <= ceiling);
  const top =
    base.find((t) => t >= ceiling) ??
    Math.ceil(ceiling / 10) * 10;
  if (!ticks.includes(top)) ticks = [...ticks, top];
  if (ticks[ticks.length - 1]! < ceiling) {
    ticks.push(Math.ceil(ceiling / 5) * 5);
  }
  return ticks;
}

/**
 * Inventory grid price buckets on **real VND** (after ×1000 from short).
 * Boundaries non-overlapping.
 */
function priceMatchesInventoryRange(realVnd: number, range: string): boolean {
  if (range === "all") return true;
  if (!Number.isFinite(realVnd)) return false;
  switch (range) {
    case "u1m":
      return realVnd < 1_000_000;
    case "1m-2m":
      return realVnd >= 1_000_000 && realVnd < 2_000_000;
    case "2m-4m":
      return realVnd >= 2_000_000 && realVnd < 4_000_000;
    case "4m-6m":
      return realVnd >= 4_000_000 && realVnd < 6_000_000;
    case "6m-10m":
      return realVnd >= 6_000_000 && realVnd <= 10_000_000;
    case "o10m":
      return realVnd > 10_000_000;
    default:
      return true;
  }
}

/** Khi đang tìm kiếm: tên A→Z, rồi giá cao → thấp. */
function compareSearchInventory(
  a: { name: string; price: number },
  b: { name: string; price: number }
): number {
  const byName = a.name.localeCompare(b.name, "vi", { sensitivity: "base" });
  if (byName !== 0) return byName;
  return b.price - a.price;
}

function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" | "danger" }) {
  const toneClass = {
    neutral: "bg-slate-100 text-slate-700",
    ok: "bg-emerald-100 text-emerald-800",
    warn: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
  }[tone];

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${toneClass}`}>{children}</span>;
}

function Field({
  label,
  children,
  className = "",
  required = false,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className="text-base font-black text-slate-950">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function StatCard({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex min-h-[96px] flex-col justify-between gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-muted">{label}</span>
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand">{icon}</span>
        </div>
        <div>
          <strong className="block text-2xl">{value}</strong>
          <span className="text-xs font-semibold text-muted">{hint}</span>
        </div>
      </div>
    </section>
  );
}

/** Ô module Tổng quan (gọn) — mỗi module 1 palette màu.
 *  hideMoney: chỉ ẩn DT / vốn / lãi — dòng đếm (máy, phiếu, HĐ…) vẫn hiện. */
function OverviewModuleCard({
  title,
  icon,
  theme,
  lines,
  revenue,
  capital,
  profit,
  revenueLabel = "Tổng doanh thu",
  capitalLabel = "Chi phí vốn",
  profitLabel = "Tổng lợi nhuận",
  hideMoney,
}: {
  title: string;
  icon: ReactNode;
  /** border + nền nhẹ + icon + title */
  theme: {
    card: string;
    icon: string;
    title: string;
  };
  lines?: string[];
  revenue: string;
  capital: string;
  profit: string;
  revenueLabel?: string;
  capitalLabel?: string;
  profitLabel?: string;
  /** true = che DT, vốn, lãi */
  hideMoney?: boolean;
}) {
  return (
    <section className={`rounded-lg border p-3 shadow-sm ${theme.card}`}>
      <div className="mb-2 flex items-center justify-between gap-1.5">
        <h3 className={`text-sm font-black uppercase tracking-wide ${theme.title}`}>{title}</h3>
        <span className={`grid h-8 w-8 place-items-center rounded-md ${theme.icon}`}>{icon}</span>
      </div>
      {lines && lines.length > 0 ? (
        <ul className="mb-2 space-y-0.5">
          {lines.map((line) => (
            <li key={line} className="text-xs font-bold leading-snug text-slate-700">
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid gap-1.5 border-t border-black/5 pt-2">
        <div className="flex items-baseline justify-between gap-1.5">
          <span className="text-xs font-bold text-slate-500">{revenueLabel}</span>
          <strong className="text-base font-black tabular-nums text-amber-800">
            {hideMoney ? "***" : revenue}
          </strong>
        </div>
        <div className="flex items-baseline justify-between gap-1.5">
          <span className="text-xs font-bold text-slate-500">{capitalLabel}</span>
          <strong className="text-base font-black tabular-nums text-slate-700">
            {hideMoney ? "***" : capital}
          </strong>
        </div>
        <div className="flex items-baseline justify-between gap-1.5">
          <span className="text-xs font-bold text-slate-500">{profitLabel}</span>
          <strong className="text-base font-black tabular-nums text-emerald-700">
            {hideMoney ? "***" : profit}
          </strong>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isLoginPasswordVisible, setIsLoginPasswordVisible] = useState(false);
  const [loginUsers, setLoginUsers] = useState<LoginUserOption[]>([]);
  const [loginUsersLoading, setLoginUsersLoading] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [accountsList, setAccountsList] = useState<AccountUser[]>([]);
  const [accountsDraft, setAccountsDraft] = useState<Record<string, string[]>>({});
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState("");
  const [accountsSavingId, setAccountsSavingId] = useState<string | null>(null);
  const [isStatsHidden, setIsStatsHidden] = useState(false);
  const [reportYear, setReportYear] = useState(() => vnNowYear().toString());
  const [hideReportSold, setHideReportSold] = useState(false);
  const [hideReportRevenue, setHideReportRevenue] = useState(false);
  const [hideReportProfit, setHideReportProfit] = useState(false);
  /** Hub Báo cáo / Thống kê */
  const [reportHubTab, setReportHubTab] = useState<ReportHubTab>("overview");
  /** Mặc định xem theo ngày hiện tại (VN). */
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("day");
  const [reportDay, setReportDay] = useState(() => vnNowDate());
  const [activePage, setActivePage] = useState<PageId>("inventory");
  /** Tab hub Sửa chữa: repair | Bán Gà (clone bán hàng, channel ban_ga). */
  const [softwareHubTab, setSoftwareHubTab] = useState<"repair" | "ban-ga">("repair");
  const [storeFilter, setStoreFilter] = useState<StoreId>("all");
  const [query, setQuery] = useState("");
  const [inventoryTab, setInventoryTab] = useState<"phones" | "accessories">("phones");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryReportMonth, setInventoryReportMonth] = useState(() => vnNowMonth());
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState("all");
  const [inventoryBrandFilter, setInventoryBrandFilter] = useState("all");
  const [inventoryNameFilter, setInventoryNameFilter] = useState("");
  const [inventoryPriceRange, setInventoryPriceRange] = useState("all");
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState("Còn hàng");
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  /** Prefill form khi clone máy (mode thêm mới, không phải sửa). */
  const [clonePhoneDraft, setClonePhoneDraft] = useState<PhoneItem | null>(null);
  const [cloneFormKey, setCloneFormKey] = useState(0);
  const [viewingPhoneId, setViewingPhoneId] = useState<string | null>(null);
  /** Popup xóa cứng máy chưa bán — bắt buộc gõ YES. */
  const [phoneHardDeleteTarget, setPhoneHardDeleteTarget] = useState<{
    id: string;
    label: string;
    imeiHint: string;
    storeId: Exclude<StoreId, "all">;
  } | null>(null);
  const [phoneHardDeleteYes, setPhoneHardDeleteYes] = useState("");
  const [phoneHardDeleting, setPhoneHardDeleting] = useState(false);
  const [editingAccessoryId, setEditingAccessoryId] = useState<string | null>(null);
  /** Prefill form khi clone phụ kiện (mode thêm mới, không phải sửa). */
  const [cloneAccessoryDraft, setCloneAccessoryDraft] = useState<Accessory | null>(null);
  const [cloneAccessoryFormKey, setCloneAccessoryFormKey] = useState(0);
  const [viewingAccessoryId, setViewingAccessoryId] = useState<string | null>(null);
  /** Ẩn giá nhập + lợi nhuận trên grid/chi tiết phụ kiện. */
  const [isAccessorySensitiveHidden, setIsAccessorySensitiveHidden] = useState(false);
  const [editingOnlineRepairId, setEditingOnlineRepairId] = useState<string | null>(null);
  /** Prefill form khi clone đơn phần mềm (mode tạo mới, không phải sửa). */
  const [cloneOnlineRepairDraft, setCloneOnlineRepairDraft] = useState<OnlineRepair | null>(null);
  const [cloneOnlineRepairFormKey, setCloneOnlineRepairFormKey] = useState(0);
  const [viewingOnlineRepairId, setViewingOnlineRepairId] = useState<string | null>(null);
  const [isOnlineRepairModalOpen, setIsOnlineRepairModalOpen] = useState(false);
  const [isOnlineRepairSensitiveHidden, setIsOnlineRepairSensitiveHidden] = useState(false);
  const [onlineRepairFilter, setOnlineRepairFilter] = useState("all");
  const [onlineRepairMonth, setOnlineRepairMonth] = useState(() => vnNowMonth());
  /** Grid phần mềm: mặc định lọc ngày hôm nay (VN); user có thể đổi hoặc xóa để xem cả tháng. */
  const [onlineRepairDate, setOnlineRepairDate] = useState(() => vnNowDate());
  /** Chọn nhiều đơn NỢ DAI để thanh toán hàng loạt. */
  const [selectedSoftwareIds, setSelectedSoftwareIds] = useState<string[]>([]);
  const [softwarePaying, setSoftwarePaying] = useState(false);

  // Sửa chữa (menu software) — Postgres qua /api/repairs
  const [shopRepairs, setShopRepairs] = useState<ShopRepairOrder[]>([]);
  const [editingShopRepairId, setEditingShopRepairId] = useState<string | null>(null);
  const [cloneShopRepairDraft, setCloneShopRepairDraft] = useState<ShopRepairOrder | null>(null);
  const [cloneShopRepairFormKey, setCloneShopRepairFormKey] = useState(0);
  const [viewingShopRepairId, setViewingShopRepairId] = useState<string | null>(null);
  const [isShopRepairModalOpen, setIsShopRepairModalOpen] = useState(false);
  const [isShopRepairSensitiveHidden, setIsShopRepairSensitiveHidden] = useState(false);
  const [shopRepairFilter, setShopRepairFilter] = useState("all");
  const [shopRepairMonth, setShopRepairMonth] = useState(() => vnNowMonth());
  const [shopRepairDate, setShopRepairDate] = useState(() => vnNowDate());
  /** Tìm grid sửa chữa: 1 ô free text (khách, tên máy, tình trạng, BH, …). */
  const [shopRepairSearch, setShopRepairSearch] = useState("");
  const [selectedShopRepairIds, setSelectedShopRepairIds] = useState<string[]>([]);
  const [shopRepairSaving, setShopRepairSaving] = useState(false);
  const [shopRepairLoading, setShopRepairLoading] = useState(false);
  const [shopRepairBackendError, setShopRepairBackendError] = useState("");
  const [shopRepairPaying, setShopRepairPaying] = useState(false);

  /** Nhập hàng — phiếu nhập (DB part_inbounds, page id `parts`). */
  const [partInbounds, setPartInbounds] = useState<PartInbound[]>([]);
  const [partLoading, setPartLoading] = useState(false);
  const [partSaving, setPartSaving] = useState(false);
  const [partBackendError, setPartBackendError] = useState("");
  const [partFormKey, setPartFormKey] = useState(0);
  /** Remount loại / màu khi cascade theo NPP. */
  const [partCascadeKey, setPartCascadeKey] = useState(0);
  const [partSearch, setPartSearch] = useState("");
  /** Lọc grid theo NPP (`all` = mọi NPP). */
  const [partDistributorFilter, setPartDistributorFilter] = useState("all");
  /** Lọc grid theo loại linh kiện (`all` = mọi loại). */
  const [partTypeFilter, setPartTypeFilter] = useState("all");
  /** Phân trang danh sách nhập hàng. */
  const [partPage, setPartPage] = useState(1);
  const partPageSize = 10;
  /** Chọn nhiều phiếu nhập để xóa hàng loạt. */
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>([]);
  /** Form chỉ hiện khi bấm «Nhập hàng» / «Sửa». */
  const [isPartFormOpen, setIsPartFormOpen] = useState(false);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [partDistributor, setPartDistributor] = useState("");
  const [partType, setPartType] = useState("");
  const [partBrand, setPartBrand] = useState("");
  const [partColor, setPartColor] = useState("");
  /** Dòng linh kiện (tên + SL) — tạo mới nhiều dòng; sửa = 1 dòng. */
  type PartLineDraft = { key: string; name: string; quantity: string };
  const emptyPartLine = (): PartLineDraft => ({
    key: "pl-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    name: "",
    quantity: "1",
  });
  const [partLines, setPartLines] = useState<PartLineDraft[]>(() => [emptyPartLine()]);

  const [customers, setCustomers] = useState(customersSeed);
  const [phones, setPhones] = useState<PhoneItem[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  /** Không seed multi-store — chỉ load từ DB (lọc CH ở UI). */
  const [sales, setSales] = useState<Sale[]>([]);
  /** Snapshot retail cho card Báo cáo Bán hàng (không phụ thuộc màn Bán Gà). */
  const [salesRetail, setSalesRetail] = useState<Sale[]>([]);
  /** Phiếu channel ban_ga — luôn load để card Báo cáo Bán Gà + Vợ (không phụ thuộc màn đang mở). */
  const [salesBanGa, setSalesBanGa] = useState<Sale[]>([]);
  /** Form bán hàng */
  const [saleStoreId, setSaleStoreId] = useState<Exclude<StoreId, "all">>("store-1");
  const [salePayMethod, setSalePayMethod] = useState<SalePayMethod>("Tiền mặt");
  const [salePayStatus, setSalePayStatus] = useState<SalePayStatus>("Đã thanh toán");
  /** Ngày giờ bán — mặc định VN now (datetime-local). */
  const [saleSoldAt, setSaleSoldAt] = useState(() => vnNowDateTimeLocal());
  const [saleCustomerId, setSaleCustomerId] = useState<string | null>(null);
  const [saleCustomerName, setSaleCustomerName] = useState("Khách lẻ");
  const [saleCustomerPhone, setSaleCustomerPhone] = useState("");
  const [saleCustomerAddress, setSaleCustomerAddress] = useState("");
  const [saleCustomerSuggestOpen, setSaleCustomerSuggestOpen] = useState(false);
  /** Bảo hành bán máy — lưu vào sales.note. */
  const [saleWarranty, setSaleWarranty] = useState("");
  const [saleWarrantyKey, setSaleWarrantyKey] = useState(0);
  const [saleCart, setSaleCart] = useState<SaleCartLine[]>([]);
  const [salePhoneSearch, setSalePhoneSearch] = useState("");
  /** List máy còn hàng: mặc định đóng, bấm mới sổ. */
  const [salePhoneListOpen, setSalePhoneListOpen] = useState(false);
  /** Tab form bán: phụ kiện (mặc định) | máy. */
  const [saleModalTab, setSaleModalTab] = useState<"accessory" | "phone">("accessory");
  const [saleAccQty, setSaleAccQty] = useState(1);
  /** Key remount ManageableSelect (tên / giá bán / giá nhập) khi mở phiếu mới hoặc Thêm PK. */
  const [saleAccFormKey, setSaleAccFormKey] = useState(0);
  /** Prefill droplist tên khi sửa phiếu. */
  const [saleAccDefaultName, setSaleAccDefaultName] = useState("");
  /** Options local fallback khi lookup store trống. */
  const [saleAccNameLocal, setSaleAccNameLocal] = useState<string[]>(SALE_ACC_NAME_SEED);
  /** Tặng PK (tab Bán Máy): remount tên + ô giá. */
  const [saleGiftFormKey, setSaleGiftFormKey] = useState(0);
  const [saleGiftCost, setSaleGiftCost] = useState("");
  const [saleSaving, setSaleSaving] = useState(false);
  /** Popup tạo/sửa phiếu bán — màn sales mặc định chỉ grid. */
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  /** true = mở form giống sửa nhưng chỉ xem (disable hết, không lưu). */
  const [isSaleReadOnly, setIsSaleReadOnly] = useState(false);
  const [viewingSaleId, setViewingSaleId] = useState<string | null>(null);
  /** Bộ lọc grid bán hàng (giống phần mềm). */
  const [saleMonth, setSaleMonth] = useState(() => vnNowMonth());
  const [saleDate, setSaleDate] = useState(() => vnNowDate());
  /** Mặc định chỉ phiếu hoàn tất — xóa (hủy mềm) biến mất khỏi grid. */
  const [saleStatusFilter, setSaleStatusFilter] = useState<"all" | "Hoàn tất" | "Đã hủy">("Hoàn tất");
  /** Lọc TT: đã thu | 1 phần | nợ */
  const [salePaymentFilter, setSalePaymentFilter] = useState<
    "all" | "paid" | "partial" | "debt"
  >("all");
  const [saleTypeFilter, setSaleTypeFilter] = useState<"all" | "Máy" | "Phụ kiện">("all");
  const [saleSearch, setSaleSearch] = useState("");
  const [isSaleSensitiveHidden, setIsSaleSensitiveHidden] = useState(false);
  const [onlineRepairs, setOnlineRepairs] = useState<OnlineRepair[]>([]);
  const [softwareLoading, setSoftwareLoading] = useState(false);
  const [softwareBackendError, setSoftwareBackendError] = useState("");
  /** Đang gọi API lưu đơn phần mềm — mờ popup + chặn thao tác. */
  const [softwareSaving, setSoftwareSaving] = useState(false);
  const [repairs, setRepairs] = useState(repairsSeed);
  const [ledger, setLedger] = useState(ledgerSeed);
  /** Công nợ (API): PM + nợ tay. */
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [debtsLoading, setDebtsLoading] = useState(false);
  const [debtsError, setDebtsError] = useState("");
  const [debtsSaving, setDebtsSaving] = useState(false);
  /** Tab sổ nợ: Phần mềm | Bán hàng | Sửa chữa | Nợ khác */
  const [debtTab, setDebtTab] = useState<"software" | "sale" | "repair" | "manual">("software");
  const [debtStatusFilter, setDebtStatusFilter] = useState<"all" | "open" | "paid" | "cancelled">("open");
  /** Tìm khách nợ: gõ tay + chọn droplist tên khách. */
  const [debtCustomerQuery, setDebtCustomerQuery] = useState("");
  const [selectedDebtIds, setSelectedDebtIds] = useState<string[]>([]);
  const [isDebtSensitiveHidden, setIsDebtSensitiveHidden] = useState(false);
  const [editingManualDebtId, setEditingManualDebtId] = useState<string | null>(null);
  /** Prefill form khi clone nợ tay (mode thêm mới). */
  const [cloneManualDebtDraft, setCloneManualDebtDraft] = useState<DebtItem | null>(null);
  const [cloneManualDebtFormKey, setCloneManualDebtFormKey] = useState(0);
  const [isManualDebtModalOpen, setIsManualDebtModalOpen] = useState(false);
  const [logs, setLogs] = useState(logSeed);
  /** Droplist theo cửa hàng: storeCode → categoryCode → labels */
  const [lookupsByStore, setLookupsByStore] = useState<Record<string, Record<string, string[]>>>({});
  /** Cửa hàng đang gắn form máy (quyết định droplist +/sửa/xóa). */
  const [phoneFormStoreId, setPhoneFormStoreId] = useState<Exclude<StoreId, "all">>("store-1");
  /** Cửa hàng đang gắn form phụ kiện (droplist +/sửa/xóa theo store). */
  const [accessoryFormStoreId, setAccessoryFormStoreId] = useState<Exclude<StoreId, "all">>("store-1");
  const [inventoryBackendError, setInventoryBackendError] = useState("");
  /** Toast sau lưu/sửa (hiện cả khi popup đã đóng) — dùng chung kho hàng + phần mềm. */
  const [uiToast, setUiToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const uiToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Đang gọi API lưu kho — mờ popup + chặn thao tác. */
  const [inventorySaving, setInventorySaving] = useState(false);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [supabaseReportMonthly, setSupabaseReportMonthly] = useState<{ soldPhones: number; revenue: number; profit: number } | null>(null);
  const [supabaseYearlyChart, setSupabaseYearlyChart] = useState<{ month: string; revenue: number; profit: number; sold: number }[] | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [dashboardSummaryError, setDashboardSummaryError] = useState("");
  const [dashboardSummaryLoading, setDashboardSummaryLoading] = useState(false);
  const canCancel = currentUser?.role === "owner";

  const isBanGaContext =
    activePage === "software" && softwareHubTab === "ban-ga";
  const saleChannel: SaleChannel = isBanGaContext ? "ban_ga" : "retail";
  const showSalesUi = activePage === "sales" || isBanGaContext;
  const salesPageTitle = isBanGaContext ? "Bán Gà" : "Bán hàng";

  const refreshDashboardSummary = useCallback(async () => {
    try {
      const summary = await reportDashboardSummary(storeFilter);
      setDashboardSummary(summary);
      setDashboardSummaryError("");
    } catch (err) {
      setDashboardSummaryError(toUiError(err));
    }
  }, [storeFilter]);

  /** Kho hàng: 1 request bootstrap (phones + accessories + lookups theo store) — bớt storm kết nối. */
  const reloadInventoryFromDb = useCallback(async () => {
    setInventoryLoading(true);
    setInventoryBackendError("");
    try {
      const data = await apiLoadInventoryBootstrap();
      setPhones(data.phones);
      setAccessories(data.accessories);
      setLookupsByStore(data.lookupsByStore ?? {});
      void refreshDashboardSummary();
    } catch (err) {
      setPhones([]);
      setAccessories([]);
      setLookupsByStore({});
      setInventoryBackendError(toUiError(err));
    } finally {
      setInventoryLoading(false);
    }
  }, [refreshDashboardSummary]);

  /** Phạm vi CH khi tải PM/Sửa: staff luôn store gán; owner theo filter header. */
  const dataScopeStore = useMemo((): StoreId | "all" => {
    if (!currentUser) return "all";
    if (currentUser.role === "staff") return currentUser.storeId;
    return storeFilter;
  }, [currentUser, storeFilter]);

  /** Phần mềm: load theo CH + actor (server khóa staff). */
  const reloadSoftwareFromDb = useCallback(async () => {
    if (!currentUser) {
      setOnlineRepairs([]);
      return;
    }
    // Xóa list cũ ngay — tránh giữ data Kim Chi khi đổi sang caobac/kieuvy
    setOnlineRepairs([]);
    setSoftwareLoading(true);
    setSoftwareBackendError("");
    try {
      // Staff: bắt buộc storeId gán; thiếu storeId → không gọi full list
      const scope =
        currentUser.role === "staff"
          ? currentUser.storeId || null
          : dataScopeStore === "all"
            ? null
            : dataScopeStore;
      if (currentUser.role === "staff" && !scope) {
        setOnlineRepairs([]);
        setSoftwareBackendError("Tài khoản staff thiếu cửa hàng gán.");
        return;
      }
      const rows = await apiListSoftwareOrders(scope, currentUser.username);
      setOnlineRepairs(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setOnlineRepairs([]);
      setSoftwareBackendError(toUiError(err));
    } finally {
      setSoftwareLoading(false);
    }
  }, [currentUser, dataScopeStore]);

  /** Sửa chữa: load theo CH + actor (server khóa staff). */
  const reloadShopRepairsFromDb = useCallback(async () => {
    if (!currentUser) {
      setShopRepairs([]);
      return;
    }
    // Xóa list cũ ngay — không để data CH khác còn trên UI khi reload
    setShopRepairs([]);
    setShopRepairLoading(true);
    setShopRepairBackendError("");
    try {
      const scope =
        currentUser.role === "staff"
          ? currentUser.storeId || null
          : dataScopeStore === "all"
            ? null
            : dataScopeStore;
      if (currentUser.role === "staff" && !scope) {
        setShopRepairs([]);
        setShopRepairBackendError("Tài khoản staff thiếu cửa hàng gán.");
        return;
      }
      const rows = await apiListRepairOrders(scope, currentUser.username);
      setShopRepairs(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setShopRepairs([]);
      setShopRepairBackendError(toUiError(err));
    } finally {
      setShopRepairLoading(false);
    }
  }, [currentUser, dataScopeStore]);

  /** Nhập hàng: load part_inbounds theo CH + actor. */
  const reloadPartsFromDb = useCallback(async () => {
    if (!currentUser) {
      setPartInbounds([]);
      return;
    }
    setPartLoading(true);
    setPartBackendError("");
    try {
      const scope =
        currentUser.role === "staff"
          ? currentUser.storeId || null
          : dataScopeStore === "all"
            ? null
            : dataScopeStore;
      if (currentUser.role === "staff" && !scope) {
        setPartInbounds([]);
        setPartBackendError("Tài khoản staff thiếu cửa hàng gán.");
        return;
      }
      const rows = await apiListPartInbounds(scope, currentUser.username);
      const list = Array.isArray(rows) ? rows : [];
      setPartInbounds(list);
      setPartPage(1);
      setSelectedPartIds((prev) => prev.filter((id) => list.some((p) => p.id === id)));
    } catch (err) {
      // Giữ list cũ nếu đang có — tránh grid trống sau khi lưu thành công nhưng reload fail.
      setPartBackendError(toUiError(err));
    } finally {
      setPartLoading(false);
    }
  }, [currentUser, dataScopeStore]);

  const reloadSalesFromDb = useCallback(async (channel: SaleChannel = "retail") => {
    try {
      const rows = await apiListRecentSales(channel);
      const mapped = (Array.isArray(rows) ? rows : []).map((r) => ({
        id: r.id,
        createdAt: r.soldAt,
        customerId: "db" as const,
        customerName: r.customerName || "Khách lẻ",
        customerPhone: r.customerPhone || "",
        customerAddress: r.customerAddress || "",
        storeId: r.storeId,
        itemName: r.itemName,
        itemType: r.itemType,
        quantity: r.quantity,
        amount: r.amount,
        cost:
          r.cost != null
            ? r.cost
            : Math.max(0, Math.round((Number(r.amount) || 0) - (Number(r.profit) || 0))),
        profit: r.profit,
        payment: ((r.payment === "Nợ" ? "NỢ DAI" : r.payment) as PaymentMethod) || "Tiền mặt",
        status: r.status,
      }));
      setSales(mapped);
      if (channel === "retail") setSalesRetail(mapped);
    } catch (err) {
      console.warn("load sales", err);
    }
  }, []);


  const mapSaleRowsFromApi = (rows: Awaited<ReturnType<typeof apiListRecentSales>>): Sale[] =>
    rows.map((r) => ({
      id: r.id,
      createdAt: r.soldAt,
      customerId: "db",
      customerName: r.customerName || "Khách lẻ",
      customerPhone: r.customerPhone || "",
      customerAddress: r.customerAddress || "",
      storeId: r.storeId,
      itemName: r.itemName,
      itemType: r.itemType,
      quantity: r.quantity,
      amount: r.amount,
      cost:
        r.cost != null
          ? r.cost
          : Math.max(0, Math.round((Number(r.amount) || 0) - (Number(r.profit) || 0))),
      profit: r.profit,
      payment: ((r.payment === "Nợ" ? "NỢ DAI" : r.payment) as PaymentMethod) || "Tiền mặt",
      status: r.status,
    }));

  const reloadSalesRetailSnapshot = useCallback(async () => {
    try {
      const rows = await apiListRecentSales("retail");
      setSalesRetail(mapSaleRowsFromApi(Array.isArray(rows) ? rows : []));
    } catch (err) {
      console.warn("load retail sales snapshot", err);
    }
  }, []);

  const reloadBanGaSalesFromDb = useCallback(async () => {
    try {
      const rows = await apiListRecentSales("ban_ga");
      setSalesBanGa(mapSaleRowsFromApi(Array.isArray(rows) ? rows : []));
    } catch (err) {
      console.warn("load ban_ga sales", err);
    }
  }, []);

  const reloadCustomersFromDb = useCallback(async () => {
    try {
      const rows = await apiListCustomers();
      if (rows.length) {
        setCustomers(
          rows.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            address: c.address || "",
            note: c.note || "",
          }))
        );
      }
    } catch (err) {
      console.warn("load customers", err);
    }
  }, []);

  // Khi vào BÁN HÀNG hoặc tab Bán Gà — load đúng channel (không trộn phiếu).
  useEffect(() => {
    if (!currentUser) return;
    if (activePage === "sales" || (activePage === "software" && softwareHubTab === "ban-ga")) {
      void reloadSalesFromDb(saleChannel);
      void reloadBanGaSalesFromDb();
    }
  }, [currentUser, activePage, softwareHubTab, saleChannel, reloadSalesFromDb, reloadBanGaSalesFromDb]);

  // Báo cáo → tab Sửa chữa / Phần mềm / Bán Gà / Tổng quan: đảm bảo có data thống kê.
  useEffect(() => {
    if (!currentUser || activePage !== "dashboard") return;
    if (
      reportHubTab === "repair" ||
      reportHubTab === "overview" ||
      reportHubTab === "transfer"
    ) {
      void reloadShopRepairsFromDb();
    }
    if (
      reportHubTab === "software" ||
      reportHubTab === "overview"
    ) {
      void reloadSoftwareFromDb();
    }
    if (
      reportHubTab === "banGa" ||
      reportHubTab === "overview" ||
      reportHubTab === "transfer"
    ) {
      void reloadBanGaSalesFromDb();
    }
  }, [
    currentUser,
    activePage,
    reportHubTab,
    reloadShopRepairsFromDb,
    reloadSoftwareFromDb,
    reloadBanGaSalesFromDb,
  ]);

  useEffect(() => {
    if (!currentUser) return;
    // Sequential: inventory first, then software/repairs/parts — fewer concurrent DB slots
    // dataScopeStore đổi (owner đổi CH) → tải lại theo cửa hàng
    void (async () => {
      await reloadInventoryFromDb();
      await reloadSoftwareFromDb();
      await reloadShopRepairsFromDb();
      await reloadPartsFromDb();
      await reloadSalesFromDb(saleChannel);
      await reloadSalesRetailSnapshot();
      await reloadBanGaSalesFromDb();
      await reloadCustomersFromDb();
    })();
  }, [
    currentUser,
    dataScopeStore,
    saleChannel,
    reloadInventoryFromDb,
    reloadSoftwareFromDb,
    reloadShopRepairsFromDb,
    reloadPartsFromDb,
    reloadSalesFromDb,
    reloadSalesRetailSnapshot,
    reloadBanGaSalesFromDb,
    reloadCustomersFromDb,
  ]);

  // Vào menu Nhập hàng → tải lại (tránh grid trống nếu boot fail / timeout).
  useEffect(() => {
    if (!currentUser || activePage !== "parts") return;
    void reloadPartsFromDb();
  }, [currentUser, activePage, reloadPartsFromDb]);

  useEffect(() => {
    return () => {
      if (uiToastTimerRef.current) clearTimeout(uiToastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setSupabaseReportMonthly(null);
      setSupabaseYearlyChart(null);
      setDashboardSummary(null);
      setDashboardSummaryError("");
      return;
    }
    let cancelled = false;
    (async () => {
      setDashboardSummaryLoading(true);
      setDashboardSummaryError("");
      try {
        // Sequential reports to avoid connection spikes
        const summary = await reportDashboardSummary(storeFilter);
        if (cancelled) return;
        setDashboardSummary(summary);
        const monthly = await reportInventoryMonthly(inventoryReportMonth, storeFilter);
        if (cancelled) return;
        setSupabaseReportMonthly(monthly);
        const yearly = await reportInventoryYearly(Number(reportYear), storeFilter);
        if (cancelled) return;
        setSupabaseYearlyChart(toYearlyChartRows(yearly));
      } catch (err) {
        if (!cancelled) {
          setDashboardSummary(null);
          setDashboardSummaryError(toUiError(err));
          setSupabaseReportMonthly(null);
          setSupabaseYearlyChart(null);
        }
      } finally {
        if (!cancelled) setDashboardSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser, inventoryReportMonth, reportYear, storeFilter]);

  const phoneTypeOptions = Array.from(new Set(phones.map((item) => item.name.split(" ")[0]).filter(Boolean)));
  const inventoryTypeOptions = phoneTypeOptions;

  /** Lọc phụ kiện: danh mục / hãng (từ lookup + dữ liệu thực tế). */
  const accessoryFilterCategoryOptions = useMemo(() => {
    const set = new Set<string>();
    const storeCodes =
      storeFilter !== "all" ? [storeFilter] : (["store-1", "store-2", "store-3"] as const);
    for (const sid of storeCodes) {
      for (const c of lookupsByStore[sid]?.[ACCESSORY_LOOKUP_CATEGORIES.category] ?? []) {
        if (c.trim()) set.add(c);
      }
    }
    for (const a of accessories) {
      if ((storeFilter === "all" || a.storeId === storeFilter) && a.category?.trim()) {
        set.add(a.category.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [accessories, lookupsByStore, storeFilter]);

  const hasInventorySearch = query.trim().length > 0;

  const filteredPhones = phones
    .filter((item) => {
      const matchesStore = storeFilter === "all" || item.storeId === storeFilter;
      const q = query.toLowerCase();
      const name = inventoryNameFilter.toLowerCase();
      const matchesQuickSearch = [item.name, item.imei, item.condition, item.color, item.storage].join(" ").toLowerCase().includes(q);
      const matchesName = item.name.toLowerCase().includes(name);
      const matchesBrand = inventoryBrandFilter === "all" || item.brand === inventoryBrandFilter;
      const matchesType = inventoryTypeFilter === "all" || item.name.toLowerCase().startsWith(inventoryTypeFilter.toLowerCase());
      const matchesPrice = priceMatchesInventoryRange(shopMoneyToVnd(item.expectedPrice), inventoryPriceRange);
      const matchesStatus = inventoryStatusFilter === "all" || item.status === inventoryStatusFilter;
      return matchesStore && matchesQuickSearch && matchesName && matchesBrand && matchesType && matchesPrice && matchesStatus;
    })
    .sort((a, b) => {
      if (!hasInventorySearch) return 0;
      return compareSearchInventory(
        { name: a.name, price: a.expectedPrice },
        { name: b.name, price: b.expectedPrice }
      );
    });

  const filteredAccessories = accessories
    .filter((item) => {
      const matchesStore = storeFilter === "all" || item.storeId === storeFilter;
      const codeQ = query.trim().toLowerCase();
      const nameQ = inventoryNameFilter.trim().toLowerCase();
      const matchesCode = !codeQ || item.code.toLowerCase().includes(codeQ);
      const matchesName = !nameQ || item.name.toLowerCase().includes(nameQ);
      const matchesCategory =
        inventoryTypeFilter === "all" || item.category === inventoryTypeFilter;
      // Phụ kiện: chỉ lọc mã / tên / danh mục (không hãng, mức giá, trạng thái)
      return matchesStore && matchesCode && matchesName && matchesCategory;
    })
    .sort((a, b) => {
      if (!query.trim() && !inventoryNameFilter.trim()) return 0;
      return compareSearchInventory({ name: a.name, price: a.price }, { name: b.name, price: b.price });
    });

  const filteredLedger = ledger.filter((item) => storeFilter === "all" || item.storeId === storeFilter);
  /** Grid bán hàng: CH header + tháng/ngày + trạng thái + TT + loại + search. */
  const filteredSales = useMemo(() => {
    const q = saleSearch.trim().toLowerCase();
    return sales.filter((item) => {
      if (storeFilter !== "all" && item.storeId !== storeFilter) return false;
      if (saleStatusFilter !== "all" && item.status !== saleStatusFilter) return false;
      if (
        salePaymentFilter === "debt" &&
        item.payment !== "NỢ DAI" &&
        item.payment !== "Nợ"
      ) {
        return false;
      }
      if (salePaymentFilter === "partial" && item.payment !== "Thanh toán 1 phần") return false;
      if (
        salePaymentFilter === "paid" &&
        (item.payment === "NỢ DAI" ||
          item.payment === "Nợ" ||
          item.payment === "Thanh toán 1 phần")
      ) {
        return false;
      }
      if (saleTypeFilter !== "all" && item.itemType !== saleTypeFilter) return false;
      const day = (item.createdAt || "").slice(0, 10);
      if (saleDate) {
        if (!day.includes(saleDate)) return false;
      } else if (saleMonth && !day.startsWith(saleMonth)) {
        return false;
      }
      if (q) {
        const cust =
          item.customerName ||
          customers.find((c) => c.id === item.customerId)?.name ||
          "";
        const hay = `${cust} ${item.itemName} ${item.customerPhone || ""} ${item.payment}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    sales,
    storeFilter,
    saleStatusFilter,
    salePaymentFilter,
    saleTypeFilter,
    saleDate,
    saleMonth,
    saleSearch,
    customers,
  ]);

  const saleStats = useMemo(() => {
    const displayDate = saleDate || vnNowDate();
    const inStore = (s: Sale) => storeFilter === "all" || s.storeId === storeFilter;
    const active = (s: Sale) => s.status === "Hoàn tất";
    const monthly = sales.filter(
      (s) => inStore(s) && active(s) && (s.createdAt || "").startsWith(saleMonth)
    );
    const daily = sales.filter(
      (s) => inStore(s) && active(s) && (s.createdAt || "").includes(displayDate)
    );
    const sum = (rows: Sale[], key: "amount" | "profit") =>
      rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
    return {
      displayDate,
      monthlyCount: monthly.length,
      monthlyRevenue: sum(monthly, "amount"),
      monthlyProfit: sum(monthly, "profit"),
      dailyCount: daily.length,
      dailyRevenue: sum(daily, "amount"),
      dailyProfit: sum(daily, "profit"),
    };
  }, [sales, storeFilter, saleMonth, saleDate]);

  /** Tổng tiền ngoài grid — TM / CK / Nợ (không hiện TT 1 phần). */
  const salePayTotals = useMemo(() => {
    const buckets = {
      cash: { count: 0, amount: 0, profit: 0 },
      transfer: { count: 0, amount: 0, profit: 0 },
      debt: { count: 0, amount: 0, profit: 0 },
    };
    let totalCount = 0;
    let totalAmount = 0;
    let totalProfit = 0;
    for (const s of filteredSales) {
      if (s.status === "Đã hủy") continue;
      const amt = Number(s.amount) || 0;
      const prof = Number(s.profit) || 0;
      totalCount += 1;
      totalAmount += amt;
      totalProfit += prof;
      if (s.payment === "NỢ DAI" || s.payment === "Nợ") {
        buckets.debt.count += 1;
        buckets.debt.amount += amt;
        buckets.debt.profit += prof;
      } else if (s.payment === "Chuyển khoản") {
        buckets.transfer.count += 1;
        buckets.transfer.amount += amt;
        buckets.transfer.profit += prof;
      } else if (s.payment === "Tiền mặt") {
        buckets.cash.count += 1;
        buckets.cash.amount += amt;
        buckets.cash.profit += prof;
      }
      // Thanh toán 1 phần: chỉ cộng vào tổng, không tách ô
    }
    return { ...buckets, totalCount, totalAmount, totalProfit };
  }, [filteredSales]);



  /** Máy trong phiếu đang sửa — vẫn cho chọn lại dù Đã bán. */
  const editingSalePhoneIds = useMemo(() => {
    if (!editingSaleId) return new Set<string>();
    const sale = sales.find((s) => s.id === editingSaleId);
    const ids = new Set<string>();
    sale?.lines?.forEach((l) => {
      if (l.kind === "phone" && l.phoneId) ids.add(l.phoneId);
    });
    return ids;
  }, [editingSaleId, sales]);

  /** Máy còn hàng theo CH phiếu bán + tìm kiếm, loại máy đã trong giỏ. */
  const saleAvailablePhones = useMemo(() => {
    const cartPhoneIds = new Set(
      saleCart.filter((l): l is Extract<SaleCartLine, { kind: "phone" }> => l.kind === "phone").map((l) => l.phoneId)
    );
    const q = salePhoneSearch.trim().toLowerCase();
    return phones.filter((p) => {
      const inStockOrEditing =
        p.status === "Còn hàng" || editingSalePhoneIds.has(p.id);
      if (!inStockOrEditing) return false;
      if (p.storeId !== saleStoreId) return false;
      if (cartPhoneIds.has(p.id)) return false;
      if (!q) return true;
      const hay = `${p.brand} ${p.name} ${p.imei} ${p.color} ${p.storage}`.toLowerCase();
      return hay.includes(q);
    });
  }, [phones, saleCart, salePhoneSearch, saleStoreId, editingSalePhoneIds]);

  /**
   * Droplist khách cũ:
   * - Mặc định "Khách lẻ" → ẩn list
   * - Xóa trống tên → load toàn bộ khách cũ
   * - Gõ free-text / SĐT → lọc theo tên, SĐT, địa chỉ
   */
  const saleCustomerSuggestions = useMemo(() => {
    const nameQ = saleCustomerName.trim().toLowerCase();
    const phoneQ = saleCustomerPhone.replace(/\s/g, "").toLowerCase();
    const isWalkInDefault = nameQ === "khách lẻ" || nameQ === "khach le";

    // Đang mặc định vãng lai + chưa gõ SĐT → không sổ
    if (isWalkInDefault && phoneQ.length < 2) return [] as Customer[];

    // Ô tên trống (đã xóa "Khách lẻ") → hiện list khách cũ; gõ tiếp thì lọc
    const filtered = customers.filter((c) => {
      if (!nameQ && phoneQ.length < 2) return true; // list full khi trống
      const cPhone = c.phone.replace(/\s/g, "").toLowerCase();
      const cName = c.name.toLowerCase();
      const cAddr = (c.address || "").toLowerCase();
      const matchName = nameQ.length >= 1 && cName.includes(nameQ);
      const matchPhone = phoneQ.length >= 2 && cPhone.includes(phoneQ);
      const matchAddr = nameQ.length >= 1 && cAddr.includes(nameQ);
      if (phoneQ.length >= 2 && nameQ) return matchPhone || matchName || matchAddr;
      if (phoneQ.length >= 2) return matchPhone;
      return matchName || matchAddr;
    });

    return filtered.slice(0, 12);
  }, [customers, saleCustomerName, saleCustomerPhone]);

  const saleCartTotals = useMemo(() => {
    let amountShort = 0;
    let costShort = 0;
    for (const line of saleCart) {
      if (line.kind === "phone") {
        amountShort += line.unitPrice;
        costShort += line.cost;
      } else {
        amountShort += line.unitPrice * line.quantity;
        costShort += (line.cost || 0) * line.quantity;
      }
    }
    return {
      amountShort,
      costShort,
      profitShort: amountShort - costShort,
      amountVnd: shopMoneyToVnd(amountShort),
      profitVnd: shopMoneyToVnd(amountShort) - shopMoneyToVnd(costShort),
    };
  }, [saleCart]);

  const inventoryPageSize = 10;
  const inventoryRowsCount = inventoryTab === "phones" ? filteredPhones.length : filteredAccessories.length;
  const inventoryTotalPages = Math.max(1, Math.ceil(inventoryRowsCount / inventoryPageSize));
  const safeInventoryPage = Math.min(inventoryPage, inventoryTotalPages);
  const inventoryStart = (safeInventoryPage - 1) * inventoryPageSize;
  const paginatedPhones = filteredPhones.slice(inventoryStart, inventoryStart + inventoryPageSize);
  const paginatedAccessories = filteredAccessories.slice(inventoryStart, inventoryStart + inventoryPageSize);
  const editingPhone = editingPhoneId ? phones.find((item) => item.id === editingPhoneId) : null;
  /** Defaults form máy: sửa theo id, hoặc draft clone khi thêm mới. */
  const phoneFormDefaults = editingPhone ?? clonePhoneDraft;

  /** Options form máy theo cửa hàng đang chọn trên form. */
  const formLookups = lookupsByStore[phoneFormStoreId] ?? {};
  const brandOptions = formLookups[PHONE_LOOKUP_CATEGORIES.brand] ?? [];
  const nameOptions = formLookups[PHONE_LOOKUP_CATEGORIES.modelName] ?? [];
  const colorOptions = formLookups[PHONE_LOOKUP_CATEGORIES.color] ?? [];
  const storageOptions = formLookups[PHONE_LOOKUP_CATEGORIES.storage] ?? [];
  const madeInOptions = formLookups[PHONE_LOOKUP_CATEGORIES.madeIn] ?? [];
  const conditionOptions = formLookups[PHONE_LOOKUP_CATEGORIES.condition] ?? [];
  const batteryOptions = formLookups[PHONE_LOOKUP_CATEGORIES.batteryCondition] ?? [];
  const batteryCapacityOptions = formLookups[PHONE_LOOKUP_CATEGORIES.batteryCapacity] ?? [];

  /** Options form phụ kiện theo cửa hàng đang chọn trên form. */
  const accessoryFormLookups = lookupsByStore[accessoryFormStoreId] ?? {};
  const accessoryCategoryOptions = accessoryFormLookups[ACCESSORY_LOOKUP_CATEGORIES.category] ?? [];
  const accessoryBrandOptions = accessoryFormLookups[ACCESSORY_LOOKUP_CATEGORIES.brand] ?? [];
  const accessoryCodeOptions = accessoryFormLookups[ACCESSORY_LOOKUP_CATEGORIES.code] ?? [];
  const accessoryNameOptions = accessoryFormLookups[ACCESSORY_LOOKUP_CATEGORIES.name] ?? [];
  const accessoryPriceOptions = sortMoneyLabelsAsc(
    accessoryFormLookups[ACCESSORY_LOOKUP_CATEGORIES.price] ?? []
  );
  const accessoryCostOptions = sortMoneyLabelsAsc(
    accessoryFormLookups[ACCESSORY_LOOKUP_CATEGORIES.cost] ?? []
  );

  /** Droplist phần mềm theo cửa hàng (staff = store gán; owner = filter / store-1). */
  const softwareLookupStoreId: Exclude<StoreId, "all"> =
    currentUser?.role === "staff"
      ? currentUser.storeId
      : storeFilter !== "all"
        ? storeFilter
        : currentUser?.storeId ?? "store-1";
  const softwareLookups = lookupsByStore[softwareLookupStoreId] ?? {};
  const softwareCustomerOptions = softwareLookups[SOFTWARE_LOOKUP_CATEGORIES.customer] ?? [];
  const softwareDeviceOptions = softwareLookups[SOFTWARE_LOOKUP_CATEGORIES.device] ?? [];
  /** Label tiền = digits; droplist báo giá / phí DV sort bé → lớn. */
  const softwareQuoteOptions = sortMoneyLabelsAsc(
    softwareLookups[SOFTWARE_LOOKUP_CATEGORIES.quote] ?? []
  );
  const softwareFeeOptions = sortMoneyLabelsAsc(
    softwareLookups[SOFTWARE_LOOKUP_CATEGORIES.fee] ?? []
  );

  /** Droplist sửa chữa — cùng store rule với phần mềm. */
  const repairLookupStoreId = softwareLookupStoreId;
  const repairLookups = lookupsByStore[repairLookupStoreId] ?? {};
  const shopRepairCustomerOptions = repairLookups[REPAIR_LOOKUP_CATEGORIES.customer] ?? [];
  const shopRepairDeviceOptions = repairLookups[REPAIR_LOOKUP_CATEGORIES.device] ?? [];
  const shopRepairConditionOptions = repairLookups[REPAIR_LOOKUP_CATEGORIES.condition] ?? [];
  const shopRepairWarrantyOptions = repairLookups[REPAIR_LOOKUP_CATEGORIES.warranty] ?? [];
  const shopRepairQuoteOptions = sortMoneyLabelsAsc(
    repairLookups[REPAIR_LOOKUP_CATEGORIES.quote] ?? []
  );
  const shopRepairFeeOptions = sortMoneyLabelsAsc(
    repairLookups[REPAIR_LOOKUP_CATEGORIES.fee] ?? []
  );

  const setFormLookupOptions = useCallback(
    (categoryCode: string, storeKey?: string) => (next: string[]) => {
      const sid = storeKey ?? phoneFormStoreId;
      // Chuẩn hóa option tiền (PM + phụ kiện + sửa chữa) → digits (ổn định parse + DB), sort bé → lớn
      const isMoney =
        categoryCode === SOFTWARE_LOOKUP_CATEGORIES.quote ||
        categoryCode === SOFTWARE_LOOKUP_CATEGORIES.fee ||
        categoryCode === REPAIR_LOOKUP_CATEGORIES.quote ||
        categoryCode === REPAIR_LOOKUP_CATEGORIES.fee ||
        categoryCode === ACCESSORY_LOOKUP_CATEGORIES.price ||
        categoryCode === ACCESSORY_LOOKUP_CATEGORIES.cost;
      const normalized = isMoney
        ? sortMoneyLabelsAsc(
            next
              .map((x) => String(x).replace(/\D/g, ""))
              .filter(Boolean)
          )
        : next;
      setLookupsByStore((prev) => ({
        ...prev,
        [sid]: {
          ...(prev[sid] ?? {}),
          [categoryCode]: normalized,
        },
      }));
    },
    [phoneFormStoreId]
  );

  /** Droplist form NHẬP HÀNG — theo CH header (hoặc CH user khi «Tất cả»). */
  const partsLookupStoreId = useMemo((): Exclude<StoreId, "all"> => {
    if (storeFilter !== "all") return storeFilter;
    return currentUser?.storeId ?? "store-1";
  }, [storeFilter, currentUser]);
  const partFormLookups = lookupsByStore[partsLookupStoreId] ?? {};
  const partDistributorOptions =
    partFormLookups[PART_LOOKUP_CATEGORIES.distributor] ?? [];
  const partTypeOptions = partFormLookups[PART_LOOKUP_CATEGORIES.partType] ?? [];
  const partBrandOptions = partFormLookups[PART_LOOKUP_CATEGORIES.brand] ?? [];
  const partColorOptions = partFormLookups[PART_LOOKUP_CATEGORIES.color] ?? [];
  const setPartDistributorOptions = useCallback(
    (next: string[]) => {
      setFormLookupOptions(
        PART_LOOKUP_CATEGORIES.distributor,
        partsLookupStoreId
      )(next);
    },
    [partsLookupStoreId, setFormLookupOptions]
  );
  const setPartTypeOptions = useCallback(
    (next: string[]) => {
      setFormLookupOptions(PART_LOOKUP_CATEGORIES.partType, partsLookupStoreId)(
        next
      );
    },
    [partsLookupStoreId, setFormLookupOptions]
  );
  const setPartBrandOptions = useCallback(
    (next: string[]) => {
      setFormLookupOptions(PART_LOOKUP_CATEGORIES.brand, partsLookupStoreId)(next);
    },
    [partsLookupStoreId, setFormLookupOptions]
  );
  const setPartColorOptions = useCallback(
    (next: string[]) => {
      setFormLookupOptions(PART_LOOKUP_CATEGORIES.color, partsLookupStoreId)(next);
    },
    [partsLookupStoreId, setFormLookupOptions]
  );
  const reloadPartLookupsAndRows = useCallback(async () => {
    await reloadInventoryFromDb();
    await reloadPartsFromDb();
  }, [reloadInventoryFromDb, reloadPartsFromDb]);

  /**
   * Tên PK form bán: luôn lấy lookup store (persist DB).
   * Seed local chỉ hiển thị khi store chưa có option — không dùng để ghi tạm (tránh F5 mất).
   */
  const saleAccNameOptions = useMemo(() => {
    const fromDb = lookupsByStore[saleStoreId]?.[ACCESSORY_LOOKUP_CATEGORIES.name] ?? [];
    if (fromDb.length > 0) return fromDb;
    return saleAccNameLocal;
  }, [lookupsByStore, saleStoreId, saleAccNameLocal]);

  /** Giá bán / giá nhập PK form bán — cùng lookup store với form kho phụ kiện. */
  const saleAccPriceOptions = useMemo(
    () =>
      sortMoneyLabelsAsc(
        lookupsByStore[saleStoreId]?.[ACCESSORY_LOOKUP_CATEGORIES.price] ?? []
      ),
    [lookupsByStore, saleStoreId]
  );
  const saleAccCostOptions = useMemo(
    () =>
      sortMoneyLabelsAsc(
        lookupsByStore[saleStoreId]?.[ACCESSORY_LOOKUP_CATEGORIES.cost] ?? []
      ),
    [lookupsByStore, saleStoreId]
  );

  /** Luôn ghi vào lookupsByStore — ManageableSelect gọi API khi có categoryCode. */
  const setSaleAccNameOptions = useCallback(
    (next: string[]) => {
      setFormLookupOptions(ACCESSORY_LOOKUP_CATEGORIES.name, saleStoreId)(next);
    },
    [saleStoreId, setFormLookupOptions]
  );
  const setSaleAccPriceOptions = useCallback(
    (next: string[]) => {
      setFormLookupOptions(ACCESSORY_LOOKUP_CATEGORIES.price, saleStoreId)(next);
    },
    [saleStoreId, setFormLookupOptions]
  );
  const setSaleAccCostOptions = useCallback(
    (next: string[]) => {
      setFormLookupOptions(ACCESSORY_LOOKUP_CATEGORIES.cost, saleStoreId)(next);
    },
    [saleStoreId, setFormLookupOptions]
  );

  /** Bảo hành bán máy — lookup store. */
  const saleWarrantyOptions = useMemo(
    () => lookupsByStore[saleStoreId]?.[SALE_LOOKUP_CATEGORIES.warranty] ?? [],
    [lookupsByStore, saleStoreId]
  );
  const setSaleWarrantyOptions = useCallback(
    (next: string[]) => {
      setFormLookupOptions(SALE_LOOKUP_CATEGORIES.warranty, saleStoreId)(next);
    },
    [saleStoreId, setFormLookupOptions]
  );

  /** Filter hãng: 1 cửa hàng → droplist store đó; Toàn hệ thống → union 3 store. */
  const filterBrandOptions = useMemo(() => {
    if (storeFilter !== "all") {
      return lookupsByStore[storeFilter]?.[PHONE_LOOKUP_CATEGORIES.brand] ?? [];
    }
    const set = new Set<string>();
    for (const storeMap of Object.values(lookupsByStore)) {
      for (const b of storeMap[PHONE_LOOKUP_CATEGORIES.brand] ?? []) set.add(b);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [lookupsByStore, storeFilter]);

  const editingAccessory = editingAccessoryId ? accessories.find((item) => item.id === editingAccessoryId) : null;
  /** Defaults form phụ kiện: sửa theo id, hoặc draft clone khi thêm mới. */
  const accessoryFormDefaults = editingAccessory ?? cloneAccessoryDraft;
  const viewingPhone = viewingPhoneId ? phones.find((item) => item.id === viewingPhoneId) : null;
  const viewingAccessory = viewingAccessoryId
    ? accessories.find((item) => item.id === viewingAccessoryId)
    : null;
  const viewingOnlineRepair = viewingOnlineRepairId
    ? onlineRepairs.find((item) => item.id === viewingOnlineRepairId)
    : null;
  const viewingShopRepair = viewingShopRepairId
    ? shopRepairs.find((item) => item.id === viewingShopRepairId)
    : null;
  const inventoryMonthlyReport = useMemo(() => {
    if (supabaseReportMonthly) return supabaseReportMonthly;

    const monthlySales = sales.filter((item) => {
      const matchesStore = storeFilter === "all" || item.storeId === storeFilter;
      return matchesStore && item.status === "Hoàn tất" && item.createdAt.startsWith(inventoryReportMonth);
    });

    return {
      soldPhones: monthlySales
        .filter((item) => item.itemType === "Máy")
        .reduce((sum, item) => sum + item.quantity, 0),
      revenue: monthlySales.reduce((sum, item) => sum + item.amount, 0),
      profit: monthlySales.reduce((sum, item) => sum + item.profit, 0),
    };
  }, [inventoryReportMonth, sales, storeFilter, supabaseReportMonthly]);

  const dashboard = useMemo(() => {
    // Fallback local from bootstrap when summary API not ready
    const activePhones = phones.filter((item) => item.status === "Còn hàng" && (storeFilter === "all" || item.storeId === storeFilter));
    const soldPhonesLocal = phones.filter(
      (item) => item.status === "Đã bán" && (storeFilter === "all" || item.storeId === storeFilter)
    );
    const pendingPhonesLocal = phones.filter(
      (item) => item.status === "Chưa xử lý" && (storeFilter === "all" || item.storeId === storeFilter)
    );
    const activeAccessories = accessories.filter((item) => item.status !== "Đã hủy" && (storeFilter === "all" || item.storeId === storeFilter));
    const localCapitalShort =
      activePhones.reduce((sum, item) => sum + item.cost, 0) +
      activeAccessories.reduce((sum, item) => sum + item.cost * item.quantity, 0);
    const localProvRevenue =
      activePhones.reduce((sum, item) => sum + item.expectedPrice, 0) +
      activeAccessories.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const localProvProfit =
      activePhones.reduce((sum, item) => sum + (item.expectedPrice - item.cost), 0) +
      activeAccessories.reduce(
        (sum, item) => sum + (item.price - item.cost) * item.quantity,
        0
      );
    const activeLedger = ledger.filter((item) => item.status === "Hiệu lực" && (storeFilter === "all" || item.storeId === storeFilter));
    const mockRepairsActive = repairs.filter(
      (item) => item.status !== "Đã trả khách" && item.status !== "Đã hủy" && (storeFilter === "all" || item.storeId === storeFilter)
    ).length;
    // Online repair tickets still open (chưa thanh toán xong)
    const onlineRepairsActive = onlineRepairs.filter((item) => !item.isPaid || item.paymentStatus === "NỢ DAI").length;

    const phonesCount = dashboardSummary?.phonesInStock ?? activePhones.length;
    const phonesSold = dashboardSummary?.phonesSold ?? soldPhonesLocal.length;
    const phonesPending = dashboardSummary?.phonesPending ?? pendingPhonesLocal.length;
    const accessoryQty = dashboardSummary?.accessoryQty ?? activeAccessories.reduce((sum, item) => sum + item.quantity, 0);
    const capitalShort =
      dashboardSummary?.capitalShort ?? localCapitalShort;
    const capitalVnd = dashboardSummary?.capitalVnd ?? shopMoneyToVnd(localCapitalShort);
    const provisionalRevenueShort =
      dashboardSummary?.provisionalRevenueShort ?? localProvRevenue;
    const provisionalProfitShort =
      dashboardSummary?.provisionalProfitShort ?? localProvProfit;
    const profit = dashboardSummary?.profit ?? 0;
    const revenue = dashboardSummary?.revenue ?? 0;

    return {
      phones: phonesCount,
      phonesSold,
      phonesPending,
      accessories: accessoryQty,
      capitalShort,
      capital: capitalVnd,
      provisionalRevenueShort,
      provisionalProfitShort,
      profit,
      revenue,
      income: activeLedger.filter((item) => item.type === "Thu").reduce((sum, item) => sum + item.amount, 0),
      expense: activeLedger.filter((item) => item.type === "Chi").reduce((sum, item) => sum + item.amount, 0),
      repairs: onlineRepairs.length > 0 ? onlineRepairsActive : mockRepairsActive,
      fromDb: Boolean(dashboardSummary),
    };
  }, [accessories, dashboardSummary, ledger, onlineRepairs, phones, repairs, storeFilter]);

  const yearlyReportData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: `Tháng ${i + 1}`,
      revenue: 0,
      profit: 0,
      sold: 0,
    }));

    salesRetail.forEach((sale) => {
      if (sale.status === "Hoàn tất" && (storeFilter === "all" || sale.storeId === storeFilter)) {
        if (sale.createdAt.startsWith(reportYear)) {
          const monthIndex = parseInt(sale.createdAt.split("-")[1], 10) - 1;
          if (monthIndex >= 0 && monthIndex < 12) {
            months[monthIndex].revenue += sale.amount;
            months[monthIndex].profit += sale.profit;
            if (sale.itemType === "Máy") {
              months[monthIndex].sold += sale.quantity;
            }
          }
        }
      }
    });

    return months;
  }, [salesRetail, reportYear, storeFilter]);

  const chartYearlyData = supabaseYearlyChart ?? yearlyReportData;

  /** Khớp ngày/tháng/năm trên hub báo cáo. */
  const matchesReportPeriod = useCallback(
    (raw: string | undefined | null) => {
      const d = toReportDateKey(raw);
      if (!d) return false;
      if (reportPeriod === "day") return d === reportDay;
      if (reportPeriod === "month") return d.startsWith(inventoryReportMonth);
      return d.startsWith(reportYear);
    },
    [reportPeriod, reportDay, inventoryReportMonth, reportYear]
  );

  /** KPI bán theo kỳ (short shop) — Tổng quan / tab Bán hàng. */
  const reportPeriodSales = useMemo(() => {
    const completed = salesRetail.filter(
      (s) => s.status === "Hoàn tất" && (storeFilter === "all" || s.storeId === storeFilter)
    );
    if (reportPeriod === "day") {
      const rows = completed.filter((s) => String(s.createdAt).slice(0, 10) === reportDay);
      return {
        soldPhones: rows
          .filter((s) => s.itemType === "Máy")
          .reduce((sum, s) => sum + s.quantity, 0),
        revenue: rows.reduce((sum, s) => sum + s.amount, 0),
        profit: rows.reduce((sum, s) => sum + s.profit, 0),
        saleCount: rows.length,
        source: "day" as const,
      };
    }
    if (reportPeriod === "month") {
      // API monthly trả VND → short; fallback local short.
      if (supabaseReportMonthly) {
        return {
          soldPhones: supabaseReportMonthly.soldPhones,
          revenue: vndToShopMoney(supabaseReportMonthly.revenue),
          profit: vndToShopMoney(supabaseReportMonthly.profit),
          saleCount: null as number | null,
          source: "month-db" as const,
        };
      }
      return {
        soldPhones: inventoryMonthlyReport.soldPhones,
        revenue: inventoryMonthlyReport.revenue,
        profit: inventoryMonthlyReport.profit,
        saleCount: null as number | null,
        source: "month-local" as const,
      };
    }
    // year — chart/API yearly VND
    const yearRows = chartYearlyData;
    const revenueVnd = yearRows.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
    const profitVnd = yearRows.reduce((s, r) => s + (Number(r.profit) || 0), 0);
    const sold = yearRows.reduce((s, r) => s + (Number(r.sold) || 0), 0);
    // yearlyReportData local is short; supabase chart is VND. Detect by magnitude.
    const looksVnd = revenueVnd >= 1_000_000 || profitVnd >= 1_000_000;
    return {
      soldPhones: sold,
      revenue: looksVnd ? vndToShopMoney(revenueVnd) : revenueVnd,
      profit: looksVnd ? vndToShopMoney(profitVnd) : profitVnd,
      saleCount: null as number | null,
      source: "year" as const,
    };
  }, [
    salesRetail,
    storeFilter,
    reportPeriod,
    reportDay,
    supabaseReportMonthly,
    inventoryMonthlyReport,
    chartYearlyData,
  ]);

  /** KPI 4 module Tổng quan. */
  const overviewModules = useMemo(() => {
    const softwareInPeriod = onlineRepairs.filter((r) =>
      matchesReportPeriod(r.receiveDate || r.createdAt)
    );
    const repairInPeriod = shopRepairs.filter((r) =>
      matchesReportPeriod(r.receiveDate || r.createdAt)
    );
    const salesInPeriod = salesRetail.filter(
      (s) =>
        s.status === "Hoàn tất" &&
        (storeFilter === "all" || s.storeId === storeFilter) &&
        matchesReportPeriod(s.createdAt)
    );
    // Bán hàng: vốn ≈ DT − lãi (cùng đơn vị short)
    const banHangCapital = Math.max(
      0,
      Math.round(reportPeriodSales.revenue - reportPeriodSales.profit)
    );
    const soldPhones = salesInPeriod
      .filter((s) => s.itemType === "Máy")
      .reduce((sum, s) => sum + Math.max(1, s.quantity || 0), 0);
    // Phụ kiện: quantity trên dòng PK; phiếu hỗn hợp đếm theo quantity dòng (UI 1 dòng tóm tắt)
    const soldAccessories = salesInPeriod
      .filter((s) => s.itemType === "Phụ kiện")
      .reduce((sum, s) => sum + Math.max(1, s.quantity || 0), 0);
    // Phiếu «Máy» có thể kèm tặng PK — vẫn đếm máy ở trên; phụ kiện pure ở itemType PK
    const saleCount = salesInPeriod.length;

    const pmRevenue = softwareInPeriod.reduce((sum, r) => sum + (Number(r.quote) || 0), 0);
    const pmCapital = softwareInPeriod.reduce((sum, r) => sum + (Number(r.deposit) || 0), 0);
    const pmPaid = softwareInPeriod.filter(
      (r) => r.paymentStatus === "Đã thanh toán" || r.isPaid
    ).length;
    const pmDebt = softwareInPeriod.filter(
      (r) => r.paymentStatus === "NỢ DAI" || (!r.isPaid && r.paymentStatus !== "Đã thanh toán")
    ).length;

    const scRevenue = repairInPeriod.reduce((sum, r) => sum + (Number(r.quote) || 0), 0);
    const scCapital = repairInPeriod.reduce((sum, r) => sum + (Number(r.deposit) || 0), 0);
    const scPaid = repairInPeriod.filter(
      (r) => r.paymentStatus === "Đã thanh toán" || r.isPaid
    ).length;
    const scDebt = repairInPeriod.filter(
      (r) => r.paymentStatus === "NỢ DAI" || (!r.isPaid && r.paymentStatus !== "Đã thanh toán")
    ).length;


    const banGaInPeriod = salesBanGa.filter(
      (s) =>
        s.status === "Hoàn tất" &&
        (storeFilter === "all" || s.storeId === storeFilter) &&
        matchesReportPeriod(s.createdAt)
    );
    const banGaRevenue = banGaInPeriod.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const banGaProfit = banGaInPeriod.reduce((sum, s) => sum + (Number(s.profit) || 0), 0);
    const banGaCapital = Math.max(0, Math.round(banGaRevenue - banGaProfit));
    const banGaSoldPhones = banGaInPeriod
      .filter((s) => s.itemType === "Máy")
      .reduce((sum, s) => sum + Math.max(1, s.quantity || 0), 0);
    const banGaSoldAccessories = banGaInPeriod
      .filter((s) => s.itemType === "Phụ kiện")
      .reduce((sum, s) => sum + Math.max(1, s.quantity || 0), 0);
    const banGaSaleCount = banGaInPeriod.length;

    return {
      kho: {
        phonesSold: dashboard.phonesSold,
        phonesInStock: dashboard.phones,
        phonesPending: dashboard.phonesPending,
        revenue: dashboard.provisionalRevenueShort,
        capital: dashboard.capitalShort,
        profit: dashboard.provisionalProfitShort,
      },
      banHang: {
        revenue: reportPeriodSales.revenue,
        capital: banHangCapital,
        profit: reportPeriodSales.profit,
        soldPhones,
        soldAccessories,
        saleCount,
      },
      phanMem: {
        revenue: pmRevenue,
        capital: pmCapital,
        profit: pmRevenue - pmCapital,
        paidCount: pmPaid,
        debtCount: pmDebt,
        orderCount: softwareInPeriod.length,
      },
      suaChua: {
        revenue: scRevenue,
        capital: scCapital,
        profit: scRevenue - scCapital,
        paidCount: scPaid,
        debtCount: scDebt,
        orderCount: repairInPeriod.length,
      },
      banGa: {
        revenue: banGaRevenue,
        capital: banGaCapital,
        profit: banGaProfit,
        soldPhones: banGaSoldPhones,
        soldAccessories: banGaSoldAccessories,
        saleCount: banGaSaleCount,
      },
    };
  }, [
    onlineRepairs,
    shopRepairs,
    salesRetail,
    salesBanGa,
    storeFilter,
    matchesReportPeriod,
    dashboard.phonesSold,
    dashboard.phones,
    dashboard.phonesPending,
    dashboard.provisionalRevenueShort,
    dashboard.provisionalProfitShort,
    dashboard.capitalShort,
    reportPeriodSales,
  ]);

  /**
   * Biểu đồ cột Tổng quan (Chồng vs Vợ):
   * - Chồng = Phần mềm
   * - Vợ = Sửa chữa + Bán hàng + Bán Gà
   * Cảnh báo: % thấp → cố gắng; % cao hơn hẳn → vinh danh.
   */
  const overviewCoupleCharts = useMemo(() => {
    const chongRevenue = overviewModules.phanMem.revenue;
    const chongProfit = overviewModules.phanMem.profit;
    const voRevenue =
      overviewModules.suaChua.revenue +
      overviewModules.banHang.revenue +
      overviewModules.banGa.revenue;
    const voProfit =
      overviewModules.suaChua.profit +
      overviewModules.banHang.profit +
      overviewModules.banGa.profit;

    /** % thấp hơn ngưỡng này → «Cần cố gắng hơn nữa» */
    const LOW_PCT = 40;
    /** % cao hơn hẳn → «Vinh Danh trụ cột kinh tế gia đình» */
    const HIGH_PCT = 60;

    const toBars = (chong: number, vo: number) => {
      const c = Math.max(0, Number(chong) || 0);
      const v = Math.max(0, Number(vo) || 0);
      const total = c + v;
      const chongPct = total > 0 ? (c / total) * 100 : 0;
      const voPct = total > 0 ? (v / total) * 100 : 0;
      return {
        rows: [
          {
            key: "chong",
            name: "Chồng",
            short: "Phần mềm",
            value: c,
            pct: chongPct,
            fill: "#0ea5e9",
          },
          {
            key: "vo",
            name: "Vợ",
            short: "Sửa + Bán + Gà",
            value: v,
            pct: voPct,
            fill: "#10b981",
          },
        ],
        total,
        chongPct,
        voPct,
        /** Banner dưới chart */
        banners: [
          ...(total > 0 && chongPct < LOW_PCT
            ? [{ tone: "warn" as const, text: "Chồng: Cần cố gắng hơn nữa" }]
            : []),
          ...(total > 0 && voPct < LOW_PCT
            ? [{ tone: "warn" as const, text: "Vợ: Cần cố gắng hơn nữa" }]
            : []),
          ...(total > 0 && chongPct >= HIGH_PCT
            ? [
                {
                  tone: "honor" as const,
                  text: "Chồng: Vinh danh trụ cột kinh tế gia đình",
                },
              ]
            : []),
          ...(total > 0 && voPct >= HIGH_PCT
            ? [
                {
                  tone: "honor" as const,
                  text: "Vợ: Vinh danh trụ cột kinh tế gia đình",
                },
              ]
            : []),
        ],
      };
    };

    return {
      revenue: toBars(chongRevenue, voRevenue),
      profit: toBars(chongProfit, voProfit),
    };
  }, [overviewModules]);

  /**
   * Tab Chuyển Khoản: gộp phiếu bán CK + đơn sửa đã TT bằng CK.
   * Phase 1 client-only; repair chưa store_id → không lọc CH cho sửa.
   */
  const transferReport = useMemo(() => {
    type TransferRow = {
      id: string;
      source: "sale" | "repair";
      sourceLabel: string;
      title: string;
      amount: number;
      paidAt: string;
    };

    const saleRows: TransferRow[] = sales
      .filter(
        (s) =>
          s.status === "Hoàn tất" &&
          s.payment === "Chuyển khoản" &&
          (storeFilter === "all" || s.storeId === storeFilter)
      )
      .map((s) => ({
        id: `sale:${s.id}`,
        source: "sale" as const,
        sourceLabel: "Bán hàng",
        title: s.itemName || "Phiếu bán",
        amount: Number(s.amount) || 0,
        paidAt: String(s.createdAt || "").slice(0, 10),
      }));

    const repairRows: TransferRow[] = shopRepairs
      .filter(
        (r) =>
          (r.paymentStatus === "Đã thanh toán" || r.isPaid) &&
          (r.paymentMethod || "Tiền mặt") === "Chuyển khoản"
      )
      .map((r) => {
        const paidAt = String(r.paymentDate || r.receiveDate || r.createdAt || "").slice(0, 10);
        const title = [r.customerName, r.deviceName].filter(Boolean).join(" · ") || "Đơn sửa";
        return {
          id: `repair:${r.id}`,
          source: "repair" as const,
          sourceLabel: "Sửa chữa",
          title,
          amount: Number(r.quote) || 0,
          paidAt,
        };
      });

    const rows = [...saleRows, ...repairRows]
      .filter((row) => matchesReportPeriod(row.paidAt))
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.id.localeCompare(a.id));

    const saleInPeriod = rows.filter((r) => r.source === "sale");
    const repairInPeriod = rows.filter((r) => r.source === "repair");
    const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);
    const saleAmount = saleInPeriod.reduce((sum, r) => sum + r.amount, 0);
    const repairAmount = repairInPeriod.reduce((sum, r) => sum + r.amount, 0);

    return {
      rows,
      totalAmount,
      totalCount: rows.length,
      saleCount: saleInPeriod.length,
      repairCount: repairInPeriod.length,
      saleAmount,
      repairAmount,
    };
  }, [sales, shopRepairs, storeFilter, matchesReportPeriod]);

  /** Tab Bán Gà — KPI + chart năm (channel ban_ga, đơn vị short shop). */
  const banGaReportStats = useMemo(() => {
    const completed = salesBanGa.filter(
      (s) =>
        s.status === "Hoàn tất" &&
        (storeFilter === "all" || s.storeId === storeFilter)
    );
    const inPeriod = completed.filter((s) => matchesReportPeriod(s.createdAt));
    const revenue = inPeriod.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const profit = inPeriod.reduce((sum, s) => sum + (Number(s.profit) || 0), 0);
    const capital = Math.max(0, Math.round(revenue - profit));
    const soldPhones = inPeriod
      .filter((s) => s.itemType === "Máy")
      .reduce((sum, s) => sum + Math.max(1, s.quantity || 0), 0);
    const soldAccessories = inPeriod
      .filter((s) => s.itemType === "Phụ kiện")
      .reduce((sum, s) => sum + Math.max(1, s.quantity || 0), 0);
    const debtCount = inPeriod.filter(
      (s) => s.payment === "NỢ DAI" || s.payment === "Nợ"
    ).length;
    const transferCount = inPeriod.filter((s) => s.payment === "Chuyển khoản").length;
    const cashCount = inPeriod.filter((s) => s.payment === "Tiền mặt").length;

    const yearRows = Array.from({ length: 12 }, (_, i) => ({
      month: `Tháng ${i + 1}`,
      revenue: 0,
      profit: 0,
      sold: 0,
    }));
    for (const s of completed) {
      const d = String(s.createdAt || "").slice(0, 10);
      if (!d.startsWith(reportYear)) continue;
      const m = Number(d.slice(5, 7)) - 1;
      if (m < 0 || m > 11) continue;
      yearRows[m].revenue += Number(s.amount) || 0;
      yearRows[m].profit += Number(s.profit) || 0;
      if (s.itemType === "Máy") yearRows[m].sold += Math.max(1, s.quantity || 0);
    }

    return {
      revenue,
      profit,
      capital,
      soldPhones,
      soldAccessories,
      saleCount: inPeriod.length,
      debtCount,
      transferCount,
      cashCount,
      yearRows,
    };
  }, [salesBanGa, storeFilter, matchesReportPeriod, reportYear]);

  /** Tab Sửa chữa — KPI + danh sách kỳ + chart năm (báo giá / phí DV / lãi). */
  const repairReportStats = useMemo(() => {
    // shopRepairs đã scope theo CH khi load (owner filter / staff gán).
    const orderDate = (r: (typeof shopRepairs)[number]) =>
      toReportDateKey(r.receiveDate) || toReportDateKey(r.createdAt) || toReportDateKey(r.paymentDate);

    const inPeriod = shopRepairs
      .filter((r) => matchesReportPeriod(orderDate(r)))
      .slice()
      .sort((a, b) => orderDate(b).localeCompare(orderDate(a)));

    const revenue = inPeriod.reduce((sum, r) => sum + (Number(r.quote) || 0), 0);
    const capital = inPeriod.reduce((sum, r) => sum + (Number(r.deposit) || 0), 0);
    const profit = revenue - capital;
    const paidRows = inPeriod.filter(
      (r) => r.paymentStatus === "Đã thanh toán" || r.isPaid
    );
    const debtRows = inPeriod.filter(
      (r) => r.paymentStatus === "NỢ DAI" || (!r.isPaid && r.paymentStatus !== "Đã thanh toán")
    );
    const paidCount = paidRows.length;
    const debtCount = debtRows.length;
    const debtAmount = debtRows.reduce((sum, r) => sum + (Number(r.quote) || 0), 0);
    const paidAmount = paidRows.reduce((sum, r) => sum + (Number(r.quote) || 0), 0);
    const transferRows = paidRows.filter(
      (r) => (r.paymentMethod || "Tiền mặt") === "Chuyển khoản"
    );
    const cashRows = paidRows.filter(
      (r) => (r.paymentMethod || "Tiền mặt") === "Tiền mặt"
    );
    const transferAmount = transferRows.reduce((sum, r) => sum + (Number(r.quote) || 0), 0);
    const cashAmount = cashRows.reduce((sum, r) => sum + (Number(r.quote) || 0), 0);

    const yearRows = Array.from({ length: 12 }, (_, i) => ({
      month: `Tháng ${i + 1}`,
      revenue: 0,
      profit: 0,
      orders: 0,
    }));
    for (const r of shopRepairs) {
      const d = orderDate(r);
      if (!d.startsWith(reportYear)) continue;
      const m = Number(d.slice(5, 7)) - 1;
      if (m < 0 || m > 11) continue;
      const q = Number(r.quote) || 0;
      const dep = Number(r.deposit) || 0;
      yearRows[m].revenue += q;
      yearRows[m].profit += q - dep;
      yearRows[m].orders += 1;
    }

    const rows = inPeriod.map((r) => {
      const quote = Number(r.quote) || 0;
      const deposit = Number(r.deposit) || 0;
      return {
        id: r.id,
        customerName: r.customerName || "Khách lẻ",
        deviceName: r.deviceName || "Máy",
        condition: r.condition || "",
        quote,
        deposit,
        profit: quote - deposit,
        paymentStatus: r.paymentStatus,
        paymentMethod: r.paymentMethod || "Tiền mặt",
        receiveDate: orderDate(r),
      };
    });

    return {
      revenue,
      capital,
      profit,
      paidCount,
      paidAmount,
      debtCount,
      debtAmount,
      orderCount: inPeriod.length,
      totalLoaded: shopRepairs.length,
      transferCount: transferRows.length,
      transferAmount,
      cashCount: cashRows.length,
      cashAmount,
      yearRows,
      rows,
    };
  }, [shopRepairs, matchesReportPeriod, reportYear]);

  /** Tab Phần mềm — KPI + danh sách kỳ + chart năm (cùng mô hình Sửa chữa). */
  const softwareReportStats = useMemo(() => {
    const orderDate = (r: (typeof onlineRepairs)[number]) =>
      toReportDateKey(r.receiveDate) ||
      toReportDateKey(r.createdAt) ||
      toReportDateKey(r.paymentDate);

    const inPeriod = onlineRepairs
      .filter((r) => matchesReportPeriod(orderDate(r)))
      .slice()
      .sort((a, b) => orderDate(b).localeCompare(orderDate(a)));

    const revenue = inPeriod.reduce((sum, r) => sum + (Number(r.quote) || 0), 0);
    const capital = inPeriod.reduce((sum, r) => sum + (Number(r.deposit) || 0), 0);
    const profit = revenue - capital;
    const paidRows = inPeriod.filter(
      (r) => r.paymentStatus === "Đã thanh toán" || r.isPaid
    );
    const debtRows = inPeriod.filter(
      (r) =>
        r.paymentStatus === "NỢ DAI" ||
        (!r.isPaid && r.paymentStatus !== "Đã thanh toán")
    );
    const paidCount = paidRows.length;
    const debtCount = debtRows.length;
    const debtAmount = debtRows.reduce((sum, r) => sum + (Number(r.quote) || 0), 0);
    const paidAmount = paidRows.reduce((sum, r) => sum + (Number(r.quote) || 0), 0);

    const yearRows = Array.from({ length: 12 }, (_, i) => ({
      month: `Tháng ${i + 1}`,
      revenue: 0,
      profit: 0,
      orders: 0,
    }));
    for (const r of onlineRepairs) {
      const d = orderDate(r);
      if (!d.startsWith(reportYear)) continue;
      const m = Number(d.slice(5, 7)) - 1;
      if (m < 0 || m > 11) continue;
      const q = Number(r.quote) || 0;
      const dep = Number(r.deposit) || 0;
      yearRows[m].revenue += q;
      yearRows[m].profit += q - dep;
      yearRows[m].orders += 1;
    }

    const rows = inPeriod.map((r) => {
      const quote = Number(r.quote) || 0;
      const deposit = Number(r.deposit) || 0;
      return {
        id: r.id,
        customerName: r.customerName || "Khách lẻ",
        deviceName: r.deviceName || "Dịch vụ",
        issue: r.issue || "",
        quote,
        deposit,
        profit: quote - deposit,
        paymentStatus: r.paymentStatus,
        receiveDate: orderDate(r),
      };
    });

    return {
      revenue,
      capital,
      profit,
      paidCount,
      paidAmount,
      debtCount,
      debtAmount,
      orderCount: inPeriod.length,
      totalLoaded: onlineRepairs.length,
      yearRows,
      rows,
    };
  }, [onlineRepairs, matchesReportPeriod, reportYear]);

  function pushLog(action: string, target: string, storeId: Exclude<StoreId, "all">) {
    setLogs((prev) => [
      {
        id: `g${Date.now()}`,
        createdAt: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
        user: currentUser?.name ?? "Demo",
        storeId,
        action,
        target,
      },
      ...prev,
    ]);
  }

  function resolvePartsStoreId(): Exclude<StoreId, "all"> {
    if (storeFilter !== "all") return storeFilter;
    return currentUser?.storeId ?? "store-1";
  }

  function clearPartInboundFields() {
    setPartDistributor("");
    setPartType("");
    setPartBrand("");
    setPartColor("");
    setPartLines([emptyPartLine()]);
    setPartFormKey((k) => k + 1);
    setPartCascadeKey((k) => k + 1);
  }

  function closePartInboundForm() {
    setIsPartFormOpen(false);
    setEditingPartId(null);
    clearPartInboundFields();
  }

  function openNewPartInboundForm() {
    setEditingPartId(null);
    clearPartInboundFields();
    setIsPartFormOpen(true);
  }

  function openEditPartInboundForm(id: string) {
    const row = partInbounds.find((p) => p.id === id);
    if (!row) return;
    setEditingPartId(row.id);
    setPartDistributor(row.distributor);
    setPartType(row.partType);
    setPartBrand(row.brand || "");
    setPartColor(row.color || "");
    setPartLines([
      {
        key: emptyPartLine().key,
        name: row.partName,
        quantity: String(row.quantity > 0 ? row.quantity : 1),
      },
    ]);
    setPartFormKey((k) => k + 1);
    setPartCascadeKey((k) => k + 1);
    setIsPartFormOpen(true);
  }

  /** Nhân bản: form điền sẵn, lưu = phiếu mới. */
  function openClonePartInboundForm(id: string) {
    const row = partInbounds.find((p) => p.id === id);
    if (!row) return;
    const ok = window.confirm(
      "Nhân bản phiếu «" + row.partName + "»?\n\nForm sẽ điền sẵn thông tin. Lưu = tạo phiếu nhập mới (có thể thêm nhiều dòng tên + SL)."
    );
    if (!ok) return;
    setEditingPartId(null);
    setPartDistributor(row.distributor);
    setPartType(row.partType);
    setPartBrand(row.brand || "");
    setPartColor(row.color || "");
    setPartLines([
      {
        key: emptyPartLine().key,
        name: row.partName,
        quantity: String(row.quantity > 0 ? row.quantity : 1),
      },
    ]);
    setPartFormKey((k) => k + 1);
    setPartCascadeKey((k) => k + 1);
    setIsPartFormOpen(true);
  }

  function applyPartDistributorCascade(name: string) {
    setPartDistributor(name);
  }

  function addPartLine() {
    setPartLines((prev) => [...prev, emptyPartLine()]);
  }

  function removePartLine(key: string) {
    setPartLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  function updatePartLine(
    key: string,
    patch: Partial<Pick<PartLineDraft, "name" | "quantity">>
  ) {
    setPartLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function bumpPartLineQty(key: string, delta: number) {
    setPartLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const current = Math.max(0, Number(String(l.quantity).replace(/[^\d]/g, "")) || 0);
        return { ...l, quantity: String(Math.max(1, current + delta)) };
      })
    );
  }

  async function handleSavePartInbound(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (partSaving || !currentUser) return;
    const form = new FormData(e.currentTarget);
    const distributor = String(form.get("distributor") || partDistributor || "").trim();
    const partTypeVal = String(form.get("partType") || partType || "").trim();
    const brandVal = String(form.get("brand") || partBrand || "").trim();
    const colorVal = String(form.get("color") || partColor || "").trim();

    if (!distributor) {
      window.alert("Nhập nhà phân phối.");
      return;
    }
    if (!partTypeVal) {
      window.alert("Nhập loại linh kiện.");
      return;
    }

    const linesToSave = partLines
      .map((l) => ({
        name: l.name.trim(),
        quantity: Math.max(0, Number(String(l.quantity).replace(/[^\d]/g, "")) || 0),
      }))
      .filter((l) => l.name.length > 0);

    if (!linesToSave.length) {
      window.alert("Nhập ít nhất một tên linh kiện.");
      return;
    }
    const badQty = linesToSave.find((l) => l.quantity <= 0);
    if (badQty) {
      window.alert("Số lượng «" + badQty.name + "» phải lớn hơn 0.");
      return;
    }

    const storeId = resolvePartsStoreId();
    const isEdit = Boolean(editingPartId);
    const existing = isEdit ? partInbounds.find((p) => p.id === editingPartId) : null;

    if (isEdit && existing) {
      const only = linesToSave[0];
      setPartSaving(true);
      setPartBackendError("");
      try {
        const saved = await apiUpsertPartInbound({
          id: existing.id,
          storeId: existing.storeId,
          distributor,
          partType: partTypeVal,
          partName: only.name,
          brand: brandVal,
          color: colorVal,
          quantity: only.quantity,
          actorUsername: currentUser.username,
        });
        const next: PartInbound = {
          id: saved.id,
          createdAt: saved.createdAt,
          storeId: saved.storeId,
          distributor: saved.distributor,
          partType: saved.partType,
          partName: saved.partName,
          brand: saved.brand || "",
          color: saved.color || "",
          quantity: saved.quantity,
        };
        setPartInbounds((prev) => prev.map((p) => (p.id === next.id ? next : p)));
        pushLog(
          "Sửa phiếu nhập hàng",
          `${saved.partType} — ${saved.brand ? `${saved.brand} · ` : ""}${saved.partName}${saved.color ? ` · ${saved.color}` : ""} ×${saved.quantity} (${saved.distributor})`,
          saved.storeId
        );
        showUiToast("success", "Đã cập nhật phiếu «" + saved.partName + "».");
        closePartInboundForm();
        void reloadPartsFromDb();
      } catch (err) {
        const msg = toUiError(err);
        setPartBackendError(msg);
        showUiToast("error", "Lưu phiếu nhập thất bại: " + msg);
      } finally {
        setPartSaving(false);
      }
      return;
    }

    setPartSaving(true);
    setPartBackendError("");
    const savedRows: PartInbound[] = [];
    const failed: string[] = [];
    try {
      for (const line of linesToSave) {
        try {
          const saved = await apiUpsertPartInbound({
            storeId,
            distributor,
            partType: partTypeVal,
            partName: line.name,
            brand: brandVal,
            color: colorVal,
            quantity: line.quantity,
            actorUsername: currentUser.username,
          });
          savedRows.push({
            id: saved.id,
            createdAt: saved.createdAt,
            storeId: saved.storeId,
            distributor: saved.distributor,
            partType: saved.partType,
            partName: saved.partName,
            brand: saved.brand || "",
            color: saved.color || "",
            quantity: saved.quantity,
          });
        } catch (err) {
          failed.push(line.name);
          console.warn("save part line", line.name, err);
        }
      }
      if (savedRows.length) {
        setPartInbounds((prev) => {
          const ids = new Set(savedRows.map((r) => r.id));
          return [...savedRows, ...prev.filter((p) => !ids.has(p.id))];
        });
        setPartPage(1);
        pushLog(
          "Nhập hàng",
          savedRows.length + " phiếu · " + partTypeVal + " · " + distributor,
          storeId
        );
      }
      if (failed.length === 0) {
        showUiToast(
          "success",
          savedRows.length === 1
            ? "Đã lưu phiếu nhập «" + savedRows[0].partName + "»."
            : "Đã lưu " + savedRows.length + " phiếu nhập (tách từng tên + SL)."
        );
        closePartInboundForm();
      } else if (savedRows.length === 0) {
        showUiToast("error", "Lưu thất bại: " + failed.slice(0, 3).join(", "));
        setPartBackendError("Lưu thất bại " + failed.length + " dòng.");
      } else {
        showUiToast(
          "error",
          "Đã lưu " + savedRows.length + "; lỗi " + failed.length + ": " + failed.slice(0, 2).join(", ")
        );
        setPartBackendError("Một số dòng lỗi: " + failed.join(", "));
        closePartInboundForm();
      }
      void reloadPartsFromDb();
    } finally {
      setPartSaving(false);
    }
  }

  async function deletePartInbound(id: string) {
    const row = partInbounds.find((p) => p.id === id);
    if (!row || partSaving) return;
    if (
      !window.confirm(
        `Xóa phiếu nhập «${row.partName}»?\n\nThao tác này xóa hẳn khỏi danh sách / hệ thống, không hoàn tác.`
      )
    ) {
      return;
    }
    if (editingPartId === id) closePartInboundForm();
    setPartSaving(true);
    setPartBackendError("");
    try {
      await apiDeletePartInbound(id);
      setPartInbounds((prev) => prev.filter((p) => p.id !== id));
      setSelectedPartIds((prev) => prev.filter((x) => x !== id));
      pushLog(
        "Xóa phiếu nhập hàng",
        `${row.partType} — ${row.partName} ×${row.quantity}`,
        row.storeId
      );
      showUiToast("success", `Đã xóa phiếu «${row.partName}».`);
      void reloadPartsFromDb();
    } catch (err) {
      const msg = toUiError(err);
      setPartBackendError(msg);
      showUiToast("error", `Xóa phiếu nhập thất bại: ${msg}`);
    } finally {
      setPartSaving(false);
    }
  }

  /** Xóa hàng loạt phiếu nhập đã chọn — bắt buộc confirm. */
  async function deleteSelectedPartInbounds() {
    if (partSaving || !currentUser) return;
    const selectedSet = new Set(selectedPartIds);
    const toDelete = partInbounds.filter((p) => selectedSet.has(p.id));
    if (!toDelete.length) {
      showUiToast("error", "Chưa chọn phiếu nhập nào để xóa.");
      return;
    }
    const preview = toDelete
      .slice(0, 5)
      .map((p) => `• ${p.partName} ×${p.quantity}`)
      .join("\n");
    const more =
      toDelete.length > 5 ? `\n… và ${toDelete.length - 5} phiếu khác` : "";
    if (
      !window.confirm(
        `Xóa ${toDelete.length} phiếu nhập đã chọn?\n\n${preview}${more}\n\nThao tác xóa hẳn, không hoàn tác.`
      )
    ) {
      return;
    }
    if (editingPartId && selectedSet.has(editingPartId)) {
      closePartInboundForm();
    }
    setPartSaving(true);
    setPartBackendError("");
    const successIds: string[] = [];
    const failedNames: string[] = [];
    try {
      // Tuần tự — pool DB max=1
      for (const row of toDelete) {
        try {
          await apiDeletePartInbound(row.id);
          successIds.push(row.id);
        } catch (err) {
          failedNames.push(row.partName || row.id);
          console.warn("delete part", row.id, err);
        }
      }
      if (successIds.length) {
        const gone = new Set(successIds);
        setPartInbounds((prev) => prev.filter((p) => !gone.has(p.id)));
        setSelectedPartIds((prev) => prev.filter((id) => !gone.has(id)));
        pushLog(
          "Xóa hàng loạt phiếu nhập",
          `${successIds.length} phiếu`,
          storeFilter === "all" ? currentUser.storeId : storeFilter
        );
      }
      if (failedNames.length === 0) {
        showUiToast("success", `Đã xóa ${successIds.length} phiếu nhập.`);
      } else if (successIds.length === 0) {
        showUiToast("error", `Xóa thất bại: ${failedNames.slice(0, 3).join(", ")}`);
        setPartBackendError(`Xóa thất bại ${failedNames.length} phiếu.`);
      } else {
        showUiToast(
          "error",
          `Đã xóa ${successIds.length}; lỗi ${failedNames.length}: ${failedNames.slice(0, 2).join(", ")}`
        );
      }
      void reloadPartsFromDb();
    } finally {
      setPartSaving(false);
    }
  }

  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setCurrentUser(saved.user);
      setStoreFilter(defaultStoreFilterForUser(saved.user));
      const first = navItems.find((item) => canAccessMenu(saved.user, item.id));
      if (first) setActivePage(first.id);
    }
    setSessionReady(true);
  }, []);

  /** Load droplist tài khoản cho màn login (public API). */
  useEffect(() => {
    if (!sessionReady || currentUser) return;
    let cancelled = false;
    setLoginUsersLoading(true);
    void (async () => {
      try {
        const rows = await apiListLoginUsers();
        if (cancelled) return;
        setLoginUsers(rows);
        setLoginUsername((prev) => {
          if (prev && rows.some((r) => r.username === prev)) return prev;
          const preferred =
            rows.find((r) => r.username.toLowerCase() === "quynhbupbe") ||
            rows.find((r) => r.username.toLowerCase() === "admin") ||
            rows[0];
          return preferred?.username ?? "";
        });
      } catch (err) {
        if (!cancelled) {
          setLoginUsers([]);
          setLoginError(toUiError(err));
        }
      } finally {
        if (!cancelled) setLoginUsersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionReady, currentUser]);

  // Idle 8h không thao tác → logout; còn dùng thì touchSession gia hạn
  useEffect(() => {
    if (!currentUser) return;

    const forceLogoutIfExpired = () => {
      const s = loadSession();
      if (!s) {
        setLoginError(
          "Phiên đăng nhập đã hết (8 giờ không thao tác). Vui lòng đăng nhập lại."
        );
        handleLogout();
        return true;
      }
      return false;
    };

    if (forceLogoutIfExpired()) return;

    // Lần đầu mount: coi như đang dùng, gia hạn mốc idle
    touchSession(true);

    const onActivity = () => {
      touchSession(false);
    };

    const activityOpts: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener("pointerdown", onActivity, activityOpts);
    window.addEventListener("keydown", onActivity, activityOpts);
    window.addEventListener("scroll", onActivity, activityOpts);
    window.addEventListener("touchstart", onActivity, activityOpts);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (!forceLogoutIfExpired()) touchSession(false);
      }
    };
    const onFocus = () => {
      if (!forceLogoutIfExpired()) touchSession(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    // Poll đủ dày để logout gần đúng mốc 8h idle (không phụ thuộc 1 setTimeout cố định)
    const poll = window.setInterval(() => {
      forceLogoutIfExpired();
    }, 60_000);

    return () => {
      window.clearInterval(poll);
      window.removeEventListener("pointerdown", onActivity, activityOpts);
      window.removeEventListener("keydown", onActivity, activityOpts);
      window.removeEventListener("scroll", onActivity, activityOpts);
      window.removeEventListener("touchstart", onActivity, activityOpts);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
    // handleLogout ổn định trong component; chỉ re-bind khi user đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Staff luôn bị khóa filter = cửa hàng gán; owner giữ lựa chọn.
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === "staff" && storeFilter !== currentUser.storeId) {
      setStoreFilter(currentUser.storeId);
    }
  }, [currentUser, storeFilter]);

  // Mặc định cửa hàng phiếu bán theo cửa hàng gán của user.
  useEffect(() => {
    if (!currentUser) return;
    setSaleStoreId(currentUser.storeId);
  }, [currentUser?.id, currentUser?.storeId]);

  useEffect(() => {
    if (!currentUser) return;
    // Menu cũ «Báo cáo kho» đã gộp → hub Báo cáo / Thống kê
    if ((activePage as string) === "inventoryReports") {
      setActivePage("dashboard");
      setReportHubTab("sales");
      return;
    }
    const pageExists = navItems.some((item) => item.id === activePage);
    if (!pageExists || !canAccessMenu(currentUser, activePage)) {
      const first = navItems.find((item) => canAccessMenu(currentUser, item.id));
      setActivePage(first?.id ?? "inventory");
    }
  }, [currentUser, activePage]);

  const loadAccounts = useCallback(async () => {
    if (!currentUser || currentUser.role !== "owner") return;
    setAccountsLoading(true);
    setAccountsError("");
    try {
      const rows = await apiListAccounts(currentUser.username);
      setAccountsList(rows);
      const draft: Record<string, string[]> = {};
      for (const row of rows) {
        draft[row.id] =
          row.role === "owner" ? [...ALL_MENU_IDS] : [...row.allowedMenus];
      }
      setAccountsDraft(draft);
    } catch (err) {
      setAccountsError(toUiError(err));
      setAccountsList([]);
    } finally {
      setAccountsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (activePage === "accounts" && currentUser?.role === "owner") {
      void loadAccounts();
    }
  }, [activePage, currentUser, loadAccounts]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const username = String(form.get("username") || "").trim();
    const password = String(form.get("password") || "");
    if (!username) {
      setLoginError("Vui lòng chọn tài khoản.");
      return;
    }
    if (!password) {
      setLoginError("Vui lòng nhập mật khẩu.");
      return;
    }

    setLoginBusy(true);
    setLoginError("");
    setInventoryBackendError("");
    try {
      const account = await apiLogin(username, password);
      const user = accountToUser(account);
      // Xóa password khỏi form ngay sau khi gửi (không giữ trên DOM / autocomplete)
      try {
        const passInput = formEl.querySelector<HTMLInputElement>('input[name="password"]');
        if (passInput) passInput.value = "";
        formEl.reset();
      } catch {
        /* ignore */
      }
      // Xóa data CH cũ trước khi gán user mới (tránh caobac/kieuvy còn list Kim Chi)
      setOnlineRepairs([]);
      setShopRepairs([]);
      setSales([]);
      setPhones([]);
      setAccessories([]);
      setCurrentUser(user);
      saveSession(user);
      setStoreFilter(defaultStoreFilterForUser(user));
      const first = navItems.find((item) => canAccessMenu(user, item.id));
      if (first) setActivePage(first.id);
    } catch (err) {
      setLoginError(toUiError(err));
      try {
        const passInput = formEl.querySelector<HTMLInputElement>('input[name="password"]');
        if (passInput) passInput.value = "";
      } catch {
        /* ignore */
      }
    } finally {
      setLoginBusy(false);
    }
  }

  function handleLogout() {
    setInventoryBackendError("");
    setPhones([]);
    setAccessories([]);
    setSales([]);
    setOnlineRepairs([]);
    setShopRepairs([]);
    setPartInbounds([]);
    setAccountsList([]);
    setAccountsDraft({});
    clearSession();
    setCurrentUser(null);
  }

  function applyAccountRow(updated: AccountUser) {
    setAccountsList((prev) =>
      prev.map((row) => (row.id === updated.id ? updated : row))
    );
    setAccountsDraft((prev) => ({
      ...prev,
      [updated.id]:
        updated.role === "owner" ? [...ALL_MENU_IDS] : [...updated.allowedMenus],
    }));
  }

  async function saveAccountMenus(accountId: string) {
    if (!currentUser || currentUser.role !== "owner") return;
    const menus = accountsDraft[accountId] ?? [];
    setAccountsSavingId(accountId);
    setAccountsError("");
    try {
      const updated = await apiUpdateAccountMenus(
        accountId,
        menus,
        currentUser.username
      );
      applyAccountRow(updated);
    } catch (err) {
      setAccountsError(toUiError(err));
    } finally {
      setAccountsSavingId(null);
    }
  }

  async function toggleAccountActive(accountId: string, nextActive: boolean) {
    if (!currentUser || currentUser.role !== "owner") return;
    if (accountId === currentUser.id && !nextActive) {
      setAccountsError("Không thể tự vô hiệu hóa tài khoản đang đăng nhập.");
      return;
    }
    setAccountsSavingId(accountId);
    setAccountsError("");
    try {
      const updated = await apiUpdateAccount(accountId, currentUser.username, {
        isActive: nextActive,
      });
      applyAccountRow(updated);
    } catch (err) {
      setAccountsError(toUiError(err));
    } finally {
      setAccountsSavingId(null);
    }
  }

  async function changeAccountPassword(accountId: string, username: string) {
    if (!currentUser || currentUser.role !== "owner") return;
    const next = window.prompt(
      `Đặt mật khẩu mới cho "${username}" (tối thiểu 6 ký tự):`
    );
    if (next == null) return;
    const password = next.trim();
    if (password.length < 6) {
      setAccountsError("Mật khẩu tối thiểu 6 ký tự.");
      return;
    }
    setAccountsSavingId(accountId);
    setAccountsError("");
    try {
      const updated = await apiUpdateAccount(accountId, currentUser.username, {
        password,
      });
      applyAccountRow(updated);
      window.alert(`Đã đổi mật khẩu cho ${username}.`);
    } catch (err) {
      setAccountsError(toUiError(err));
    } finally {
      setAccountsSavingId(null);
    }
  }

  function toggleAccountMenu(accountId: string, menuId: string, checked: boolean) {
    setAccountsDraft((prev) => {
      const cur = new Set(prev[accountId] ?? []);
      if (checked) cur.add(menuId);
      else cur.delete(menuId);
      return { ...prev, [accountId]: Array.from(cur) };
    });
  }

  function resolvePhoneFormStore(
    preferred?: string | null
  ): Exclude<StoreId, "all"> {
    if (currentUser?.role === "staff") return currentUser.storeId;
    if (preferred === "store-1" || preferred === "store-2" || preferred === "store-3") {
      return preferred;
    }
    if (storeFilter !== "all") return storeFilter;
    return currentUser?.storeId ?? "store-1";
  }

  function openInventoryCreateModal(tab: "phones" | "accessories" = inventoryTab) {
    setInventoryTab(tab);
    setEditingPhoneId(null);
    setClonePhoneDraft(null);
    setEditingAccessoryId(null);
    setCloneAccessoryDraft(null);
    const sid = resolvePhoneFormStore();
    setPhoneFormStoreId(sid);
    setAccessoryFormStoreId(sid);
    setIsInventoryModalOpen(true);
  }

  function openPhoneEditModal(id: string) {
    const phone = phones.find((item) => item.id === id);
    if (phone?.status === "Đã bán") {
      showUiToast("error", "Máy đã bán — không sửa được.");
      return;
    }
    setInventoryTab("phones");
    setEditingPhoneId(id);
    setClonePhoneDraft(null);
    setEditingAccessoryId(null);
    setCloneAccessoryDraft(null);
    setPhoneFormStoreId(resolvePhoneFormStore(phone?.storeId));
    setIsInventoryModalOpen(true);
  }

  /** Clone máy → popup xác nhận → mở form thêm mới (prefill full, mọi ô vẫn sửa được). */
  function openPhoneCloneModal(id: string) {
    const source = phones.find((item) => item.id === id);
    if (!source) return;
    if (source.status === "Đã bán") {
      showUiToast("error", "Máy đã bán — không nhân bản được.");
      return;
    }

    const label = `${source.brand} ${source.name}`.trim();
    const imeiHint = source.imei ? ` (…${source.imei.slice(-5)})` : "";
    const ok = window.confirm(
      `Nhân bản máy "${label}"${imeiHint}?\n\nForm sẽ điền sẵn toàn bộ thông tin. Bạn có thể sửa bất kỳ ô nào rồi lưu thành máy mới.\nLưu ý: IMEI phải khác máy gốc (IMEI không được trùng).`
    );
    if (!ok) return;

    setInventoryTab("phones");
    setEditingPhoneId(null);
    setEditingAccessoryId(null);
    setCloneAccessoryDraft(null);
    // Copy full; id rỗng = mode thêm mới. Mọi field form đều editable.
    setClonePhoneDraft({
      ...source,
      id: "",
    });
    setPhoneFormStoreId(resolvePhoneFormStore(source.storeId));
    setCloneFormKey((k) => k + 1);
    setIsInventoryModalOpen(true);
  }

  function openAccessoryEditModal(id: string) {
    const accessory = accessories.find((item) => item.id === id);
    setInventoryTab("accessories");
    setEditingAccessoryId(id);
    setCloneAccessoryDraft(null);
    setEditingPhoneId(null);
    setClonePhoneDraft(null);
    setViewingAccessoryId(null);
    setAccessoryFormStoreId(resolvePhoneFormStore(accessory?.storeId));
    setIsInventoryModalOpen(true);
  }

  /** Clone phụ kiện → confirm → form thêm mới (prefill full, mọi ô vẫn sửa được). */
  function openAccessoryCloneModal(id: string) {
    const source = accessories.find((item) => item.id === id);
    if (!source) return;

    const ok = window.confirm(
      `Nhân bản phụ kiện "${source.name}" (${source.code})?\n\nForm sẽ điền sẵn toàn bộ thông tin. Bạn có thể sửa bất kỳ ô nào rồi lưu thành phụ kiện mới.`
    );
    if (!ok) return;

    setInventoryTab("accessories");
    setEditingAccessoryId(null);
    setEditingPhoneId(null);
    setClonePhoneDraft(null);
    setViewingAccessoryId(null);
    setCloneAccessoryDraft({
      ...source,
      id: "",
    });
    setAccessoryFormStoreId(resolvePhoneFormStore(source.storeId));
    setCloneAccessoryFormKey((k) => k + 1);
    setIsInventoryModalOpen(true);
  }

  /** Xóa cứng phụ kiện khỏi DB/grid — confirm trước. */
  async function deleteAccessoryItem(id: string) {
    const source = accessories.find((item) => item.id === id);
    if (!source) return;
    const ok = window.confirm(
      `Xóa phụ kiện "${source.name}" (${source.code})?\n\nThao tác này xóa hẳn khỏi danh sách / hệ thống, không hoàn tác.`
    );
    if (!ok) return;
    try {
      await apiDeleteAccessory(id);
      pushLog("Xóa phụ kiện", `${source.code} — ${source.name}`, source.storeId);
      // Cập nhật grid ngay (và reload DB)
      setAccessories((prev) => prev.filter((a) => a.id !== id));
      if (viewingAccessoryId === id) setViewingAccessoryId(null);
      if (editingAccessoryId === id) {
        setIsInventoryModalOpen(false);
        setEditingAccessoryId(null);
        setCloneAccessoryDraft(null);
      }
      await reloadInventoryFromDb();
      showUiToast("success", `Đã xóa phụ kiện ${source.name}.`);
    } catch (err) {
      showUiToast("error", `Xóa phụ kiện thất bại: ${toUiError(err)}`);
    }
  }

  /** Mở popup xóa cứng máy chưa bán (bắt buộc gõ YES). */
  function openUnsoldPhoneHardDelete(id: string) {
    const source = phones.find((item) => item.id === id);
    if (!source) return;
    if (source.status === "Đã bán") {
      void deleteSoldPhoneItem(id);
      return;
    }
    const label = `${source.brand} ${source.name}`.trim();
    const imeiHint = source.imei ? ` (…${source.imei.slice(-5)})` : "";
    setPhoneHardDeleteYes("");
    setPhoneHardDeleteTarget({
      id: source.id,
      label,
      imeiHint,
      storeId: source.storeId,
    });
  }

  function closePhoneHardDeleteModal() {
    if (phoneHardDeleting) return;
    setPhoneHardDeleteTarget(null);
    setPhoneHardDeleteYes("");
  }

  /** Xóa cứng máy chưa bán sau khi gõ YES trong popup. */
  async function confirmUnsoldPhoneHardDelete() {
    if (!phoneHardDeleteTarget) return;
    if (phoneHardDeleteYes !== "YES") {
      showUiToast("error", 'Vui lòng gõ chính xác "YES" để xác nhận xóa.');
      return;
    }
    const { id, label, imeiHint, storeId } = phoneHardDeleteTarget;
    setPhoneHardDeleting(true);
    try {
      await apiDeletePhone(id);
      pushLog("Xóa máy", `${label}${imeiHint}`, storeId);
      setPhones((prev) => prev.filter((p) => p.id !== id));
      if (viewingPhoneId === id) setViewingPhoneId(null);
      if (editingPhoneId === id) {
        setIsInventoryModalOpen(false);
        setEditingPhoneId(null);
        setClonePhoneDraft(null);
      }
      setPhoneHardDeleteTarget(null);
      setPhoneHardDeleteYes("");
      await reloadInventoryFromDb();
      void reloadSalesFromDb(saleChannel);
      void reloadBanGaSalesFromDb();
      showUiToast("success", `Đã xóa máy ${label}.`);
    } catch (err) {
      showUiToast("error", `Xóa máy thất bại: ${toUiError(err)}`);
    } finally {
      setPhoneHardDeleting(false);
    }
  }

  /** Xóa cứng máy đã bán (grid: máy đã bán chỉ còn Chi tiết + Xóa). */
  async function deleteSoldPhoneItem(id: string) {
    const source = phones.find((item) => item.id === id);
    if (!source) return;
    const label = `${source.brand} ${source.name}`.trim();
    const imeiHint = source.imei ? ` (…${source.imei.slice(-5)})` : "";
    const ok = window.confirm(
      `Xóa máy "${label}"${imeiHint}?\n\nThao tác này xóa hẳn khỏi danh sách / hệ thống (kèm dòng bán gắn máy nếu có), không hoàn tác.`
    );
    if (!ok) return;
    try {
      await apiDeletePhone(id);
      pushLog("Xóa máy", `${label}${imeiHint}`, source.storeId);
      setPhones((prev) => prev.filter((p) => p.id !== id));
      if (viewingPhoneId === id) setViewingPhoneId(null);
      if (editingPhoneId === id) {
        setIsInventoryModalOpen(false);
        setEditingPhoneId(null);
        setClonePhoneDraft(null);
      }
      await reloadInventoryFromDb();
      void reloadSalesFromDb(saleChannel);
      void reloadBanGaSalesFromDb();
      showUiToast("success", `Đã xóa máy ${label}.`);
    } catch (err) {
      showUiToast("error", `Xóa máy thất bại: ${toUiError(err)}`);
    }
  }

  function closeInventoryModal() {
    if (inventorySaving) return;
    setIsInventoryModalOpen(false);
    setEditingPhoneId(null);
    setClonePhoneDraft(null);
    setEditingAccessoryId(null);
    setCloneAccessoryDraft(null);
    setInventoryBackendError("");
    setInventorySaving(false);
  }

  function showUiToast(type: "success" | "error", message: string) {
    if (uiToastTimerRef.current) {
      clearTimeout(uiToastTimerRef.current);
      uiToastTimerRef.current = null;
    }
    setUiToast({ type, message });
    uiToastTimerRef.current = setTimeout(() => {
      setUiToast(null);
      uiToastTimerRef.current = null;
    }, 3500);
  }

  function closeOnlineRepairModal() {
    if (softwareSaving) return;
    setIsOnlineRepairModalOpen(false);
    setEditingOnlineRepairId(null);
    setCloneOnlineRepairDraft(null);
    setSoftwareBackendError("");
    setSoftwareSaving(false);
  }

  /** Clone đơn phần mềm → confirm → form tạo mới (prefill, mọi ô vẫn sửa được). */
  function openOnlineRepairCloneModal(id: string) {
    const source = onlineRepairs.find((item) => item.id === id);
    if (!source) return;

    const ok = window.confirm(
      `Nhân bản đơn "${source.customerName} — ${source.deviceName}"?\n\nForm sẽ điền sẵn thông tin. Bạn có thể sửa bất kỳ ô nào rồi lưu thành đơn mới.\nGiờ nhận mặc định = hiện tại; trạng thái thanh toán = NỢ DAI.`
    );
    if (!ok) return;

    setEditingOnlineRepairId(null);
    setCloneOnlineRepairDraft({
      ...source,
      id: "",
      receiveDate: vnNowDateTimeLocal(),
      completeDate: "",
      paymentDate: "",
      paymentStatus: "NỢ DAI",
      isPaid: false,
      rewardPoints: 0,
    });
    setCloneOnlineRepairFormKey((k) => k + 1);
    setIsOnlineRepairModalOpen(true);
  }

  /** Xóa đơn phần mềm — bắt buộc confirm trước khi gọi API. */
  async function deleteOnlineRepair(id: string) {
    const source = onlineRepairs.find((item) => item.id === id);
    if (!source) return;

    const ok = window.confirm(
      `Xóa đơn "${source.customerName} — ${source.deviceName}"?\n\nThao tác này không hoàn tác được.`
    );
    if (!ok) return;

    setSoftwareBackendError("");
    try {
      await apiDeleteSoftwareOrder(id);
      pushLog(
        "Xóa đơn phần mềm",
        `${source.customerName} — ${source.deviceName}`,
        softwareLookupStoreId
      );
      if (editingOnlineRepairId === id) closeOnlineRepairModal();
      if (viewingOnlineRepairId === id) setViewingOnlineRepairId(null);
      setSelectedSoftwareIds((prev) => prev.filter((x) => x !== id));
      await reloadSoftwareFromDb();
      showUiToast(
        "success",
        `Đã xóa đơn ${source.customerName} — ${source.deviceName}.`
      );
    } catch (err) {
      const msg = toUiError(err);
      setSoftwareBackendError(msg);
      showUiToast("error", `Xóa đơn phần mềm thất bại: ${msg}`);
    }
  }

  /** Thanh toán hàng loạt: selected NỢ DAI → Đã thanh toán. */
  async function markSelectedSoftwarePaid(debtCandidates: OnlineRepair[]) {
    const selectedSet = new Set(selectedSoftwareIds);
    const toPay = debtCandidates.filter(
      (r) => selectedSet.has(r.id) && r.paymentStatus === "NỢ DAI"
    );
    if (!toPay.length) {
      showUiToast("error", "Chưa chọn đơn NỢ DAI nào để thanh toán.");
      return;
    }
    const ok = window.confirm(
      `Đánh dấu ${toPay.length} đơn NỢ DAI → Đã thanh toán?\n\nChỉ các đơn đang nợ được chọn mới được cập nhật.`
    );
    if (!ok) return;

    setSoftwarePaying(true);
    setSoftwareBackendError("");
    try {
      const updated = await apiMarkSoftwareOrdersPaid(
        toPay.map((r) => r.id),
        currentUser?.username
      );
      pushLog(
        "Thanh toán hàng loạt phần mềm",
        `${updated.length} đơn`,
        softwareLookupStoreId
      );
      setSelectedSoftwareIds([]);
      await reloadSoftwareFromDb();
      showUiToast(
        "success",
        updated.length
          ? `Đã thanh toán ${updated.length} đơn phần mềm.`
          : "Không có đơn NỢ DAI nào được cập nhật."
      );
    } catch (err) {
      const msg = toUiError(err);
      setSoftwareBackendError(msg);
      showUiToast("error", `Thanh toán hàng loạt thất bại: ${msg}`);
    } finally {
      setSoftwarePaying(false);
    }
  }

  // ——— Sửa chữa handlers (API/DB) ———
  function closeShopRepairModal() {
    if (shopRepairSaving) return;
    setIsShopRepairModalOpen(false);
    setEditingShopRepairId(null);
    setCloneShopRepairDraft(null);
    setShopRepairSaving(false);
    setShopRepairBackendError("");
  }

  function openShopRepairCloneModal(id: string) {
    const source = shopRepairs.find((item) => item.id === id);
    if (!source) return;
    const ok = window.confirm(
      `Nhân bản đơn sửa "${source.customerName} — ${source.deviceName}"?\n\nForm sẽ điền sẵn. Giờ nhận = hiện tại; thanh toán = Đã thanh toán.`
    );
    if (!ok) return;
    setEditingShopRepairId(null);
    setCloneShopRepairDraft({
      ...source,
      id: "",
      receiveDate: vnNowDateTimeLocal(),
      completeDate: "",
      paymentDate: vnNowDateTimeLocal(),
      paymentStatus: "Đã thanh toán",
      isPaid: true,
      rewardPoints: 0,
    });
    setCloneShopRepairFormKey((k) => k + 1);
    setIsShopRepairModalOpen(true);
  }

  async function deleteShopRepair(id: string) {
    const source = shopRepairs.find((item) => item.id === id);
    if (!source) return;
    const ok = window.confirm(
      `Xóa đơn sửa "${source.customerName} — ${source.deviceName}"?\n\nThao tác này không hoàn tác được.`
    );
    if (!ok) return;
    setShopRepairBackendError("");
    try {
      await apiDeleteRepairOrder(id);
      pushLog(
        "Xóa đơn sửa chữa",
        `${source.customerName} — ${source.deviceName}`,
        repairLookupStoreId
      );
      if (editingShopRepairId === id) closeShopRepairModal();
      if (viewingShopRepairId === id) setViewingShopRepairId(null);
      setSelectedShopRepairIds((prev) => prev.filter((x) => x !== id));
      await reloadShopRepairsFromDb();
      showUiToast(
        "success",
        `Đã xóa đơn ${source.customerName} — ${source.deviceName}.`
      );
    } catch (err) {
      const msg = toUiError(err);
      setShopRepairBackendError(msg);
      showUiToast("error", `Xóa đơn sửa chữa thất bại: ${msg}`);
    }
  }

  async function markSelectedShopRepairsPaid(debtCandidates: ShopRepairOrder[]) {
    const selectedSet = new Set(selectedShopRepairIds);
    const toPay = debtCandidates.filter(
      (r) => selectedSet.has(r.id) && r.paymentStatus === "NỢ DAI"
    );
    if (!toPay.length) {
      showUiToast("error", "Chưa chọn đơn NỢ DAI nào để thanh toán.");
      return;
    }
    const ok = window.confirm(
      `Đánh dấu ${toPay.length} đơn NỢ DAI → Đã thanh toán?\n\nChỉ các đơn đang nợ được chọn mới được cập nhật.`
    );
    if (!ok) return;
    setShopRepairPaying(true);
    setShopRepairBackendError("");
    try {
      const updated = await apiMarkRepairOrdersPaid(
        toPay.map((r) => r.id),
        currentUser?.username
      );
      pushLog(
        "Thanh toán hàng loạt sửa chữa",
        `${updated.length} đơn`,
        repairLookupStoreId
      );
      setSelectedShopRepairIds([]);
      await reloadShopRepairsFromDb();
      showUiToast(
        "success",
        updated.length
          ? `Đã thanh toán ${updated.length} đơn sửa chữa.`
          : "Không có đơn NỢ DAI nào được cập nhật."
      );
    } catch (err) {
      const msg = toUiError(err);
      setShopRepairBackendError(msg);
      showUiToast("error", `Thanh toán hàng loạt thất bại: ${msg}`);
    } finally {
      setShopRepairPaying(false);
    }
  }

  async function saveShopRepairFromForm(form: FormData) {
    if (!currentUser) return;
    const quote = parseInputMoney(form.get("quote"));
    const depositRaw = String(form.get("deposit") ?? "").trim();
    if (!depositRaw.replace(/\D/g, "")) {
      showUiToast("error", "Nhập phí dịch vụ.");
      return;
    }
    const deposit = parseInputMoney(depositRaw);
    const pStatus = String(form.get("paymentStatus")) as ShopRepairOrder["paymentStatus"];
    const payMethodRaw = String(form.get("paymentMethod") || "").trim();
    const paymentMethod: NonNullable<ShopRepairOrder["paymentMethod"]> =
      payMethodRaw === "Chuyển khoản" ? "Chuyển khoản" : "Tiền mặt";
    const isEdit = Boolean(editingShopRepairId);
    const isClone = !isEdit && Boolean(cloneShopRepairDraft);
    const existing = editingShopRepairId
      ? shopRepairs.find((r) => r.id === editingShopRepairId)
      : null;
    const draft = isClone ? cloneShopRepairDraft : null;

    const d = String(form.get("receiveDatePart") || "").trim();
    const h = String(form.get("receiveHour") || "").trim().padStart(2, "0");
    const m = String(form.get("receiveMinute") || "").trim().padStart(2, "0");
    const t =
      h && m && /^\d{2}$/.test(h) && /^\d{2}$/.test(m)
        ? `${h}:${m}`
        : String(form.get("receiveTimePart") || "").trim();
    const receiveDate = d && t ? `${d}T${t}` : d || String(form.get("receiveDate") || "");

    const payload = {
      id: isEdit && existing ? existing.id : undefined,
      customerName: String(form.get("customerName") || "").trim() || "Khách lẻ",
      customerType: (form.get("customerType")
        ? String(form.get("customerType"))
        : existing?.customerType || draft?.customerType || "Vãng lai") as ShopRepairOrder["customerType"],
      deviceName: String(form.get("deviceName") || "").trim() || "Máy",
      condition: String(form.get("condition") || "").trim(),
      warranty: String(form.get("warranty") || "").trim(),
      // UI đã bỏ IMEI / SĐT-Pass — đơn mới để trống; sửa đơn giữ giá trị cũ nếu có.
      imei: isEdit && existing ? existing.imei || "" : "",
      phoneOrPass: isEdit && existing ? existing.phoneOrPass || "" : "",
      issue: existing?.issue ?? draft?.issue ?? "",
      quote,
      deposit,
      receiveDate,
      completeDate: existing?.completeDate ?? "",
      paymentDate:
        pStatus === "Đã thanh toán"
          ? existing?.paymentDate || vnNowDateTimeLocal()
          : existing?.paymentDate ?? "",
      paymentStatus: pStatus,
      paymentMethod,
      rewardPoints: existing?.rewardPoints ?? 0,
      isPaid: pStatus === "Đã thanh toán",
      actorUsername: currentUser.username,
      storeId:
        currentUser.role === "staff"
          ? currentUser.storeId
          : dataScopeStore !== "all"
            ? dataScopeStore
            : currentUser.storeId,
    };

    setShopRepairSaving(true);
    setShopRepairBackendError("");
    try {
      const saved = await apiUpsertRepairOrder(payload);
      pushLog(
        isEdit
          ? "Sửa đơn sửa chữa"
          : isClone
            ? "Nhân bản đơn sửa chữa"
            : "Tạo đơn sửa chữa",
        `${saved.customerName} — ${saved.deviceName}`,
        repairLookupStoreId
      );
      await reloadShopRepairsFromDb();
      showUiToast(
        "success",
        isEdit
          ? `Đã sửa đơn ${saved.customerName} — ${saved.deviceName}.`
          : isClone
            ? `Đã nhân bản đơn ${saved.customerName} — ${saved.deviceName}.`
            : `Đã tạo đơn ${saved.customerName} — ${saved.deviceName}.`
      );
      setShopRepairSaving(false);
      closeShopRepairModal();
    } catch (err) {
      const msg = toUiError(err);
      setShopRepairBackendError(msg);
      showUiToast("error", `Lưu đơn sửa chữa thất bại: ${msg}`);
      setShopRepairSaving(false);
    }
  }

  async function savePhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inventorySaving) return;
    const form = new FormData(event.currentTarget);
    // Staff: luôn ghi cửa hàng gắn tài khoản. Owner: form storeId / máy đang sửa / filter.
    const formStoreRaw = String(form.get("storeId") || "").trim();
    const formStore =
      formStoreRaw === "store-1" || formStoreRaw === "store-2" || formStoreRaw === "store-3"
        ? (formStoreRaw as Exclude<StoreId, "all">)
        : undefined;
    const storeId: Exclude<StoreId, "all"> =
      currentUser?.role === "staff"
        ? currentUser.storeId
        : formStore ||
          (editingPhone?.storeId as Exclude<StoreId, "all"> | undefined) ||
          (clonePhoneDraft?.storeId as Exclude<StoreId, "all"> | undefined) ||
          (storeFilter !== "all" ? storeFilter : undefined) ||
          currentUser?.storeId ||
          "store-1";
    const isEdit = Boolean(editingPhoneId);
    const isClone = !isEdit && Boolean(clonePhoneDraft);
    const payload: PhoneItem = {
      id: editingPhoneId ?? `p${Date.now()}`,
      brand: String(form.get("brand")),
      name: String(form.get("name")),
      imei: String(form.get("imei")),
      color: String(form.get("color")),
      storage: String(form.get("storage")),
      madeIn: String(form.get("madeIn")),
      networkVersion: editingPhone?.networkVersion || clonePhoneDraft?.networkVersion || "",
      batteryCondition: String(form.get("batteryCondition")),
      batteryCapacity: String(form.get("batteryCapacity") || ""),
      condition: String(form.get("condition")),
      note: String(form.get("note") || ""),
      importDate: String(form.get("importDate") || vnNowDate()),
      saleDate: String(form.get("saleDate") || ""),
      storeId,
      cost: parseShopMoney(form.get("cost")),
      expectedPrice: parseShopMoney(form.get("expectedPrice")),
      status: String(form.get("status")) as ProductStatus,
    };

    setInventorySaving(true);
    setInventoryBackendError("");
    try {
      const saved = await apiUpsertPhone({
        ...payload,
        id: editingPhoneId ?? undefined,
        actorUsername: currentUser?.username,
      });
      pushLog(
        isEdit ? "Sửa máy trong kho" : isClone ? "Nhân bản máy vào kho" : "Thêm máy vào kho",
        saved.imei,
        storeId
      );
      // Reload grid từ DB. Droplist chỉ đổi khi bấm + (không auto-ensure khi lưu máy).
      await reloadInventoryFromDb();
      const successMsg = isEdit
        ? `Đã sửa máy ${saved.brand} ${saved.name} (IMEI …${saved.imei.slice(-5)}) thành công.`
        : isClone
          ? `Đã nhân bản máy ${saved.brand} ${saved.name} thành công.`
          : `Đã thêm máy ${saved.brand} ${saved.name} thành công.`;
      showUiToast("success", successMsg);
      setInventorySaving(false);
      setIsInventoryModalOpen(false);
      setEditingPhoneId(null);
      setClonePhoneDraft(null);
      setEditingAccessoryId(null);
      setCloneAccessoryDraft(null);
      setInventoryPage(1);
    } catch (err) {
      const msg = toUiError(err);
      setInventoryBackendError(msg);
      showUiToast("error", `Lưu máy thất bại: ${msg}`);
      setInventorySaving(false);
    }
  }

  async function saveAccessory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inventorySaving) return;
    const form = new FormData(event.currentTarget);
    // Staff: luôn ghi cửa hàng gắn tài khoản. Owner: form storeId / phụ kiện đang sửa / filter.
    const formStoreRaw = String(form.get("storeId") || "").trim();
    const formStore =
      formStoreRaw === "store-1" || formStoreRaw === "store-2" || formStoreRaw === "store-3"
        ? (formStoreRaw as Exclude<StoreId, "all">)
        : undefined;
    const storeId: Exclude<StoreId, "all"> =
      currentUser?.role === "staff"
        ? currentUser.storeId
        : formStore ||
          (editingAccessory?.storeId as Exclude<StoreId, "all"> | undefined) ||
          (cloneAccessoryDraft?.storeId as Exclude<StoreId, "all"> | undefined) ||
          (storeFilter !== "all" ? storeFilter : undefined) ||
          currentUser?.storeId ||
          "store-1";
    const isEdit = Boolean(editingAccessoryId);
    const isClone = !isEdit && Boolean(cloneAccessoryDraft);
    const qtyRaw = String(form.get("quantity") ?? "").trim();
    if (!qtyRaw) {
      showUiToast("error", "Vui lòng nhập số lượng.");
      return;
    }
    if (!/^\d+$/.test(qtyRaw)) {
      showUiToast("error", "Số lượng phải là số nguyên dương.");
      return;
    }
    const quantity = Number(qtyRaw);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      showUiToast("error", "Số lượng phải lớn hơn 0.");
      return;
    }
    const price = parseShopMoney(form.get("price"));
    const cost = parseShopMoney(form.get("cost"));
    if (!String(form.get("price") ?? "").replace(/\D/g, "")) {
      showUiToast("error", "Vui lòng nhập giá bán.");
      return;
    }
    if (!String(form.get("cost") ?? "").replace(/\D/g, "")) {
      showUiToast("error", "Vui lòng nhập giá nhập.");
      return;
    }
    const payload: Accessory = {
      id: editingAccessoryId ?? `a${Date.now()}`,
      category: String(form.get("category") || ""),
      brand: String(form.get("brand") || ""),
      code: String(form.get("code")),
      name: String(form.get("name")),
      storeId,
      quantity,
      cost,
      price,
      status: String(form.get("status") || (quantity > 0 ? "Còn hàng" : "Hết hàng")) as AccessoryStatus,
      note: String(form.get("note") || ""),
    };

    setInventorySaving(true);
    setInventoryBackendError("");
    try {
      const saved = await apiUpsertAccessory({
        ...payload,
        id: editingAccessoryId ?? undefined,
        actorUsername: currentUser?.username,
      });
      pushLog(
        isEdit
          ? "Sửa phụ kiện trong kho"
          : isClone
            ? "Nhân bản phụ kiện vào kho"
            : "Thêm phụ kiện vào kho",
        saved.code,
        storeId
      );
      // Reload grid từ DB. Droplist chỉ đổi khi bấm + (không auto-ensure khi lưu phụ kiện).
      await reloadInventoryFromDb();
      showUiToast(
        "success",
        isEdit
          ? `Đã sửa phụ kiện ${saved.name} thành công.`
          : isClone
            ? `Đã nhân bản phụ kiện ${saved.name} thành công.`
            : `Đã thêm phụ kiện ${saved.name} thành công.`
      );
      setInventorySaving(false);
      setIsInventoryModalOpen(false);
      setEditingPhoneId(null);
      setClonePhoneDraft(null);
      setEditingAccessoryId(null);
      setCloneAccessoryDraft(null);
      setInventoryPage(1);
    } catch (err) {
      const msg = toUiError(err);
      setInventoryBackendError(msg);
      showUiToast("error", `Lưu phụ kiện thất bại: ${msg}`);
      setInventorySaving(false);
    }
  }

  function resetSaleCustomerToWalkIn() {
    setSaleCustomerId(null);
    setSaleCustomerName("Khách lẻ");
    setSaleCustomerPhone("");
    setSaleCustomerAddress("");
    setSaleCustomerSuggestOpen(false);
  }

  function resetSaleFormDraft() {
    resetSaleCustomerToWalkIn();
    setSaleWarranty("");
    setSaleWarrantyKey((k) => k + 1);
    setSaleCart([]);
    setSalePhoneSearch("");
    setSalePhoneListOpen(false);
    setSaleModalTab("accessory");
    setSaleAccQty(1);
    setSaleAccFormKey((k) => k + 1);
    setSaleAccDefaultName("");
    setSaleGiftFormKey((k) => k + 1);
    setSaleGiftCost("");
    setSalePayMethod("Tiền mặt");
    setSalePayStatus("Đã thanh toán");
    setSaleSoldAt(vnNowDateTimeLocal());
    setEditingSaleId(null);
    setIsSaleReadOnly(false);
    setViewingSaleId(null);
    if (currentUser?.storeId) setSaleStoreId(currentUser.storeId);
  }

  function openSaleModal() {
    resetSaleFormDraft();
    setIsSaleModalOpen(true);
  }

  function closeSaleModal() {
    if (saleSaving) return;
    setIsSaleModalOpen(false);
    resetSaleFormDraft();
  }

  /** Load phiếu vào form bán (giống layout sửa). mode view = chỉ xem, disable hết. */
  async function loadSaleIntoForm(id: string, mode: "edit" | "view") {
    const local = sales.find((s) => s.id === id);
    if (mode === "edit" && local?.status === "Đã hủy") {
      window.alert("Không sửa phiếu đã hủy.");
      return;
    }

    setSaleSaving(true);
    setViewingSaleId(null);
    try {
      let detail: Awaited<ReturnType<typeof apiGetSale>> | null = null;
      try {
        detail = await apiGetSale(id);
      } catch {
        detail = null;
      }

      if (mode === "edit" && detail?.status === "Đã hủy") {
        window.alert("Không sửa phiếu đã hủy.");
        return;
      }

      const sale = detail ?? local;
      if (!sale) {
        window.alert("Không tìm thấy phiếu bán.");
        return;
      }

      setIsSaleReadOnly(mode === "view");
      setEditingSaleId(mode === "edit" ? sale.id : null);
      setViewingSaleId(mode === "view" ? sale.id : null);
      setSaleCustomerId(
        detail?.customerId ||
          (local?.customerId && !local.customerId.startsWith("db") ? local.customerId : null)
      );
      setSaleCustomerName(sale.customerName || "Khách lẻ");
      setSaleCustomerPhone(sale.customerPhone || "");
      setSaleCustomerAddress(sale.customerAddress || "");
      setSaleCustomerSuggestOpen(false);
      {
        const rawNote = String(detail?.note ?? local?.note ?? "").trim();
        // note có thể là "Bảo hành: 6 tháng" hoặc chỉ "6 tháng"
        const warranty = rawNote.replace(/^bảo\s*hành\s*:\s*/i, "").trim();
        setSaleWarranty(warranty);
        setSaleWarrantyKey((k) => k + 1);
      }
      setSaleGiftCost("");
      setSaleGiftFormKey((k) => k + 1);
      setSaleStoreId(sale.storeId);
      const parsedPay = parseSalePaymentFields(sale.payment);
      setSalePayStatus(parsedPay.status);
      setSalePayMethod(parsedPay.method);

      const soldLocal =
        detail?.soldAtLocal ||
        (() => {
          const rawAt = String(detail?.soldAt || local?.createdAt || "").trim();
          if (rawAt.length >= 16) return rawAt.slice(0, 16).replace(" ", "T");
          if (rawAt) return `${rawAt.slice(0, 10)}T${vnNowDateTimeLocal().slice(11, 16)}`;
          return vnNowDateTimeLocal();
        })();
      setSaleSoldAt(soldLocal);

      setSalePhoneSearch("");
      setSalePhoneListOpen(false);
      setSaleAccQty(1);

      const lines = detail?.lines?.length
        ? detail.lines
        : local?.lines?.length
          ? local.lines
          : null;

      if (lines && lines.length > 0) {
        const hasPhone = lines.some((l) => l.kind === "phone");
        // View: chỉ xem giỏ. Edit: tab Máy nếu phiếu có máy, không thì tab PK.
        setSaleModalTab(mode === "edit" && hasPhone ? "phone" : "accessory");
        setSaleCart(
          lines.map((line, idx) =>
            line.kind === "phone"
              ? {
                  key: `phone-${line.phoneId || idx}-${sale.id}`,
                  kind: "phone" as const,
                  phoneId: line.phoneId || `legacy-phone-${idx}`,
                  name: line.name,
                  imei: line.imei || "",
                  brand: line.brand,
                  color: line.color,
                  storage: line.storage,
                  condition: line.condition,
                  unitPrice: line.unitPrice,
                  cost: line.cost,
                }
              : {
                  key: `acc-${idx}-${sale.id}`,
                  kind: "accessory" as const,
                  name:
                    line.unitPrice === 0 && line.category === "Tặng"
                      ? line.name
                      : line.category && line.category !== "Khác"
                        ? `${line.category}: ${line.name}`
                        : line.name,
                  quantity: line.quantity,
                  unitPrice: line.unitPrice,
                  cost: line.cost || 0,
                }
          )
        );
        const firstAcc = lines.find((l) => l.kind === "accessory");
        if (firstAcc && firstAcc.kind === "accessory") {
          setSaleAccDefaultName(firstAcc.name || "");
        } else {
          setSaleAccDefaultName("");
        }
      } else {
        const rawAmt = Number(sale.amount) || 0;
        const amountShort = rawAmt >= 1_000_000 ? Math.round(rawAmt / 1000) : rawAmt;
        const unitShort = Math.max(0, Math.round(amountShort / Math.max(1, sale.quantity)));
        setSaleModalTab(mode === "edit" && sale.itemType === "Máy" ? "phone" : "accessory");
        setSaleCart([
          {
            key: `legacy-${sale.id}`,
            kind: "accessory",
            name: sale.itemName,
            quantity: Math.max(1, sale.quantity),
            unitPrice: unitShort,
            cost: 0,
          },
        ]);
        setSaleAccDefaultName(sale.itemName);
      }

      setSaleAccFormKey((k) => k + 1);
      setIsSaleModalOpen(true);
    } catch (err) {
      window.alert(toUiError(err));
    } finally {
      setSaleSaving(false);
    }
  }

  function openSaleView(id: string) {
    void loadSaleIntoForm(id, "view");
  }

  async function openSaleEditModal(id: string) {
    await loadSaleIntoForm(id, "edit");
  }

  function selectSaleCustomer(c: Customer) {
    setSaleCustomerId(c.id);
    setSaleCustomerName(c.name);
    setSaleCustomerPhone(c.phone);
    setSaleCustomerAddress(c.address || "");
    setSaleCustomerSuggestOpen(false);
  }

  async function handleSaveSaleCustomer() {
    const name = saleCustomerName.trim();
    if (!name) {
      window.alert("Tên khách bắt buộc.");
      return;
    }
    const phone = saleCustomerPhone.trim();
    const address = saleCustomerAddress.trim();
    try {
      const saved = await apiSaveCustomer({
        id: saleCustomerId || undefined,
        name,
        phone,
        address,
        actorUsername: currentUser?.username,
      });
      setCustomers((prev) => {
        const next = prev.filter((c) => c.id !== saved.id);
        return [
          {
            id: saved.id,
            name: saved.name,
            phone: saved.phone,
            address: saved.address || "",
            note: saved.note || "",
          },
          ...next,
        ];
      });
      setSaleCustomerId(saved.id);
      setSaleCustomerName(saved.name);
      setSaleCustomerPhone(saved.phone);
      setSaleCustomerAddress(saved.address || "");
      setSaleCustomerSuggestOpen(false);
      showUiToast("success", `Đã lưu khách: ${saved.name}`);
      pushLog("Lưu khách hàng", saved.id, saleStoreId);
    } catch (err) {
      window.alert(toUiError(err));
    }
  }

  function addPhoneToSaleCart(phone: PhoneItem) {
    if (saleCart.some((l) => l.kind === "phone" && l.phoneId === phone.id)) {
      window.alert("Máy đã có trong giỏ.");
      return;
    }
    if (phone.storeId !== saleStoreId) {
      window.alert("Máy không thuộc cửa hàng đang chọn trên phiếu.");
      return;
    }
    setSaleCart((prev) => [
      ...prev,
      {
        key: `phone-${phone.id}`,
        kind: "phone",
        phoneId: phone.id,
        name: `${phone.brand} ${phone.name}`.trim(),
        imei: phone.imei,
        brand: phone.brand,
        color: phone.color,
        storage: phone.storage,
        condition: phone.condition,
        unitPrice: phone.expectedPrice > 0 ? phone.expectedPrice : 0,
        cost: phone.cost,
      },
    ]);
  }

  function addAccessoryToSaleCart() {
    const formEl = document.getElementById("sale-create-form") as HTMLFormElement | null;
    const fd = formEl ? new FormData(formEl) : null;
    const name = String(fd?.get("saleAccName") ?? "").trim();
    if (!name) {
      window.alert("Chọn hoặc nhập tên phụ kiện.");
      return;
    }
    const quantity = Math.max(1, Math.round(Number(saleAccQty) || 1));
    // Giá bán / giá nhập từ ManageableSelect (FormData).
    const saleAccPriceRaw = String(fd?.get("saleAccPrice") ?? "").trim();
    const saleAccCostRaw = String(fd?.get("saleAccCost") ?? "").trim();
    const priceDigits = saleAccPriceRaw.replace(/\D/g, "");
    if (!priceDigits) {
      window.alert("Chọn hoặc nhập giá bán phụ kiện.");
      return;
    }
    const unitPrice = parseShopMoney(saleAccPriceRaw); // "0" → 0
    if (unitPrice < 0) {
      window.alert("Giá bán phụ kiện không hợp lệ.");
      return;
    }
    const cost = parseShopMoney(saleAccCostRaw); // 0 nếu trống
    setSaleCart((prev) => [
      ...prev,
      {
        key: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: "accessory",
        name,
        quantity,
        unitPrice,
        cost,
      },
    ]);
    setSaleAccQty(1);
    setSaleAccDefaultName("");
    // Remount tên + giá bán + giá nhập (xóa giá trị đã chọn)
    setSaleAccFormKey((k) => k + 1);
  }

  /** Tặng PK kèm máy: giá bán 0, giá (vốn) trừ vào lãi phiếu. */
  function addGiftAccessoryToSaleCart() {
    const formEl = document.getElementById("sale-create-form") as HTMLFormElement | null;
    const fd = formEl ? new FormData(formEl) : null;
    const name = String(fd?.get("saleGiftName") ?? "").trim();
    if (!name) {
      window.alert("Chọn hoặc nhập tên PK tặng.");
      return;
    }
    const cost = parseShopMoney(saleGiftCost); // 0 nếu trống
    if (cost < 0) {
      window.alert("Giá PK tặng không hợp lệ.");
      return;
    }
    setSaleCart((prev) => [
      ...prev,
      {
        key: `gift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: "accessory",
        name,
        quantity: 1,
        unitPrice: 0,
        cost,
      },
    ]);
    setSaleGiftCost("");
    setSaleGiftFormKey((k) => k + 1);
    if (cost > 0) {
      showUiToast(
        "success",
        `Đã thêm tặng: ${name} (trừ lãi ${formatMoney(cost)}).`
      );
    }
  }

  function removeSaleCartLine(key: string) {
    setSaleCart((prev) => prev.filter((l) => l.key !== key));
  }

  function updateSaleCartUnitPrice(key: string, unitPrice: number) {
    setSaleCart((prev) =>
      prev.map((l) => (l.key === key ? { ...l, unitPrice: Math.max(0, Math.round(unitPrice) || 0) } : l))
    );
  }

  function updateSaleCartCost(key: string, cost: number) {
    setSaleCart((prev) =>
      prev.map((l) =>
        l.key === key
          ? { ...l, cost: Math.max(0, Math.round(cost) || 0) }
          : l
      )
    );
  }

  async function createSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaleReadOnly) return;
    // Đọc FormData TRƯỚC mọi await — event.currentTarget mất sau async.
    const formEl = event.currentTarget;
    const fd = new FormData(formEl);
    const warrantyFromForm = String(fd.get("saleWarranty") || "").trim();
    // Ưu tiên form (đang mở tab Máy); fallback state (đã sync onValueChange / đổi tab).
    const warrantyNote = (warrantyFromForm || saleWarranty).trim();
    const saleNote = warrantyNote
      ? /^bảo\s*hành/i.test(warrantyNote)
        ? warrantyNote
        : `Bảo hành: ${warrantyNote}`
      : "";

    const hasPhone = saleCart.some((l) => l.kind === "phone");
    const customerName = (saleCustomerName.trim() || (hasPhone ? "" : "Khách lẻ")).trim();
    if (hasPhone && !customerName) {
      window.alert("Tên khách bắt buộc khi bán máy.");
      return;
    }
    if (saleCart.length === 0) {
      window.alert("Thêm ít nhất một dòng hàng (máy hoặc phụ kiện).");
      return;
    }
    for (const line of saleCart) {
      // Máy: bắt buộc giá bán > 0. Phụ kiện: cho phép 0 (tặng kèm), chặn số âm.
      if (line.kind === "phone") {
        if (line.unitPrice <= 0) {
          window.alert(`Nhập giá bán cho: ${line.name}`);
          return;
        }
        if (line.phoneId.startsWith("legacy-phone-")) {
          window.alert("Dòng máy không hợp lệ — chọn lại máy từ kho.");
          return;
        }
      } else if (line.unitPrice < 0) {
        window.alert(`Giá bán không hợp lệ: ${line.name}`);
        return;
      }
    }

    setSaleSaving(true);
    try {
      const paymentValue = resolveSalePaymentValue(salePayStatus, salePayMethod);
      // Sửa = hủy mềm phiếu cũ + tạo phiếu mới (đồng bộ tồn kho).
      if (editingSaleId) {
        try {
          await apiCancelSale(editingSaleId, currentUser?.username);
        } catch (cancelErr) {
          // Phiếu seed mock không có trên DB — bỏ qua
          const msg = toUiError(cancelErr);
          if (!msg.includes("Không tìm thấy") && !msg.includes("đã hủy")) {
            throw cancelErr;
          }
        }
      }

      const saved = await apiCreateSale({
        storeId: saleStoreId,
        payment: paymentValue,
        customerName: customerName || "Khách lẻ",
        customerPhone: saleCustomerPhone.trim(),
        customerAddress: saleCustomerAddress.trim(),
        soldAt: saleSoldAt || vnNowDateTimeLocal(),
        note: saleNote || undefined,
        actorUsername: currentUser?.username,
        channel: saleChannel,
        lines: saleCart.map((line) =>
          line.kind === "phone"
            ? {
                itemType: "Máy" as const,
                phoneId: line.phoneId,
                unitPrice: line.unitPrice,
              }
            : {
                itemType: "Phụ kiện" as const,
                itemName:
                  line.unitPrice === 0 && !line.name.toLowerCase().startsWith("tặng")
                    ? `Tặng: ${line.name}`
                    : line.name,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                unitCost: line.cost || 0,
              }
        ),
      });

      const sale: Sale = {
        id: saved.id,
        createdAt: saved.soldAt,
        customerId: saleCustomerId || "db",
        customerName: saved.customerName || customerName || "Khách lẻ",
        customerPhone: saleCustomerPhone.trim(),
        customerAddress: saleCustomerAddress.trim(),
        note: saleNote || saved.note || "",
        storeId: saved.storeId,
        itemName: saved.itemName,
        itemType: saved.itemType,
        quantity: saved.quantity,
        amount: saved.amount,
        cost:
          saved.cost != null
            ? saved.cost
            : Math.max(
                0,
                Math.round((Number(saved.amount) || 0) - (Number(saved.profit) || 0))
              ),
        profit: saved.profit,
        payment: (saved.payment as PaymentMethod) || paymentValue,
        status: "Hoàn tất",
      };

      setSales((prev) => [sale, ...prev.filter((s) => s.id !== sale.id)]);
      setLedger((prev) => [
        {
          id: `l${Date.now()}`,
          createdAt: sale.createdAt,
          storeId: saleStoreId,
          type: "Thu",
          source: `Phiếu bán ${sale.id}`,
          amount: sale.amount,
          payment: paymentValue,
          status: "Hiệu lực",
        },
        ...prev,
      ]);
      pushLog(editingSaleId ? `Sửa phiếu ${salesPageTitle}` : `Tạo phiếu ${salesPageTitle}`, sale.id, saleStoreId);

      await reloadInventoryFromDb();
      await reloadSalesFromDb(saleChannel);
      await reloadBanGaSalesFromDb();
      void reloadCustomersFromDb();
      try {
        const monthly = await reportInventoryMonthly(inventoryReportMonth, storeFilter);
        setSupabaseReportMonthly(monthly);
        const yearly = await reportInventoryYearly(Number(reportYear), storeFilter);
        setSupabaseYearlyChart(toYearlyChartRows(yearly));
      } catch {
        /* report best-effort */
      }
      void refreshDashboardSummary();

      const wasEdit = Boolean(editingSaleId);
      resetSaleFormDraft();
      setIsSaleModalOpen(false);
      showUiToast(
        "success",
        wasEdit
          ? `Đã cập nhật phiếu: ${sale.itemName} · ${formatMoney(sale.amount)}`
          : `Đã tạo phiếu: ${sale.itemName} · ${formatMoney(sale.amount)} · lãi ${formatMoney(sale.profit)}`
      );
    } catch (err) {
      window.alert(toUiError(err));
    } finally {
      setSaleSaving(false);
    }
  }

  const reloadDebts = useCallback(async () => {
    if (!currentUser) return;
    setDebtsLoading(true);
    setDebtsError("");
    try {
      // Load đủ nguồn API (PM + nợ tay); tab sale/repair ghép client-side.
      const rows = await apiListDebts({
        storeId: storeFilter,
        source: "all",
        status: debtStatusFilter,
      });
      setDebts(rows);
      setSelectedDebtIds((prev) => prev.filter((id) => rows.some((r) => r.id === id && r.status === "open")));
    } catch (err) {
      setDebtsError(toUiError(err));
    } finally {
      setDebtsLoading(false);
    }
  }, [currentUser, storeFilter, debtStatusFilter]);

  useEffect(() => {
    if (!currentUser || activePage !== "ledger") return;
    void reloadDebts();
    // Đồng bộ sale/repair để tab Công nợ có data chọn + thu nợ
    void reloadShopRepairsFromDb();
    void reloadSalesFromDb("retail");
    void reloadBanGaSalesFromDb();
    void reloadSoftwareFromDb();
  }, [
    currentUser,
    activePage,
    reloadDebts,
    reloadShopRepairsFromDb,
    reloadSalesFromDb,
    reloadBanGaSalesFromDb,
    reloadSoftwareFromDb,
  ]);

  async function saveManualDebt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (debtsSaving || !currentUser) return;
    const form = new FormData(event.currentTarget);
    const formStoreRaw = String(form.get("storeId") || "").trim();
    const storeId: Exclude<StoreId, "all"> =
      currentUser.role === "staff"
        ? currentUser.storeId
        : formStoreRaw === "store-1" || formStoreRaw === "store-2" || formStoreRaw === "store-3"
          ? formStoreRaw
          : currentUser.storeId;

    setDebtsSaving(true);
    setDebtsError("");
    try {
      const saved = await apiUpsertManualDebt({
        id: editingManualDebtId ?? undefined,
        storeId,
        customerName: String(form.get("customerName") || ""),
        customerPhone: String(form.get("customerPhone") || ""),
        title: String(form.get("title") || ""),
        amount: parseInputMoney(form.get("amount")),
        debtDate: String(form.get("debtDate") || vnNowDate()),
        note: String(form.get("note") || ""),
        actorUsername: currentUser.username,
      });
      pushLog(
        editingManualDebtId
          ? "Sửa nợ tay"
          : cloneManualDebtDraft
            ? "Nhân bản nợ tay"
            : "Tạo nợ tay",
        `${saved.customerName} — ${saved.title}`,
        storeId
      );
      const isClone = !editingManualDebtId && Boolean(cloneManualDebtDraft);
      showUiToast(
        "success",
        editingManualDebtId
          ? "Đã cập nhật nợ tay."
          : isClone
            ? "Đã nhân bản nợ tay."
            : "Đã thêm nợ tay."
      );
      setEditingManualDebtId(null);
      setCloneManualDebtDraft(null);
      setIsManualDebtModalOpen(false);
      event.currentTarget.reset();
      await reloadDebts();
      await reloadSoftwareFromDb();
    } catch (err) {
      const msg = toUiError(err);
      setDebtsError(msg);
      showUiToast("error", msg);
    } finally {
      setDebtsSaving(false);
    }
  }

  function openManualDebtCreateModal() {
    setEditingManualDebtId(null);
    setCloneManualDebtDraft(null);
    setCloneManualDebtFormKey((k) => k + 1);
    setIsManualDebtModalOpen(true);
  }

  function openManualDebtEditModal(sourceId: string) {
    setCloneManualDebtDraft(null);
    setEditingManualDebtId(sourceId);
    setCloneManualDebtFormKey((k) => k + 1);
    setIsManualDebtModalOpen(true);
  }

  function openManualDebtCloneModal(sourceId: string) {
    const source = debts.find((d) => d.source === "manual" && d.sourceId === sourceId);
    if (!source) return;
    const ok = window.confirm(
      `Nhân bản nợ tay "${source.title}" — ${source.customerName}?\n\nForm sẽ điền sẵn thông tin. Bạn có thể sửa rồi lưu thành khoản nợ mới.`
    );
    if (!ok) return;
    setEditingManualDebtId(null);
    setCloneManualDebtDraft(source);
    setCloneManualDebtFormKey((k) => k + 1);
    setIsManualDebtModalOpen(true);
  }

  function closeManualDebtModal() {
    if (debtsSaving) return;
    setIsManualDebtModalOpen(false);
    setEditingManualDebtId(null);
    setCloneManualDebtDraft(null);
  }

  async function cancelManualDebtItem(sourceId: string) {
    if (!currentUser || currentUser.role !== "owner") {
      showUiToast("error", "Chỉ chủ cửa hàng được hủy nợ tay.");
      return;
    }
    const row = debts.find((d) => d.source === "manual" && d.sourceId === sourceId);
    if (!row) return;
    if (!window.confirm(`Hủy nợ tay "${row.title}" — ${row.customerName}?`)) return;
    setDebtsSaving(true);
    try {
      await apiCancelManualDebt(sourceId, currentUser.username);
      pushLog("Hủy nợ tay", `${row.customerName} — ${row.title}`, row.storeId);
      showUiToast("success", "Đã hủy nợ tay.");
      if (editingManualDebtId === sourceId) {
        setEditingManualDebtId(null);
        setIsManualDebtModalOpen(false);
      }
      await reloadDebts();
    } catch (err) {
      showUiToast("error", toUiError(err));
    } finally {
      setDebtsSaving(false);
    }
  }

  async function markSelectedDebtsPaid() {
    const selectedSet = new Set(selectedDebtIds);

    // API debts (software + manual) đang open
    const fromApi = debts.filter((d) => selectedSet.has(d.id) && d.status === "open");

    // Sửa chữa / bán hàng: id ghép client-side (repair:uuid / sale:uuid)
    const fromRepair = shopRepairs
      .filter(
        (r) =>
          r.paymentStatus === "NỢ DAI" &&
          selectedSet.has(`repair:${r.id}`)
      )
      .map((r) => ({
        source: "repair" as const,
        sourceId: r.id,
        id: `repair:${r.id}`,
      }));

    const salePool = [...salesRetail, ...salesBanGa];
    const fromSale = salePool
      .filter(
        (s) =>
          s.status === "Hoàn tất" &&
          (s.payment === "NỢ DAI" || s.payment === "Nợ") &&
          selectedSet.has(`sale:${s.id}`)
      )
      .map((s) => ({
        source: "sale" as const,
        sourceId: s.id,
        id: `sale:${s.id}`,
      }));

    // Gộp refs — dedupe theo source:sourceId
    const refMap = new Map<string, { source: DebtItem["source"]; sourceId: string }>();
    for (const d of fromApi) {
      refMap.set(`${d.source}:${d.sourceId}`, { source: d.source, sourceId: d.sourceId });
    }
    for (const d of fromRepair) {
      refMap.set(`${d.source}:${d.sourceId}`, d);
    }
    for (const d of fromSale) {
      refMap.set(`${d.source}:${d.sourceId}`, d);
    }
    const refs = Array.from(refMap.values());

    if (!refs.length) {
      showUiToast("error", "Chưa chọn khoản nợ đang mở.");
      return;
    }
    if (
      !window.confirm(
        `Thu nợ ${refs.length} khoản đã chọn?\n\nPM / Sửa chữa → Đã thanh toán.\nNợ tay → Đã TT.\nBán hàng → Tiền mặt.`
      )
    ) {
      return;
    }
    setDebtsSaving(true);
    try {
      const result = await apiMarkDebtsPaid(refs, currentUser?.username);
      pushLog(
        "Thu công nợ hàng loạt",
        `${result.updated} khoản`,
        storeFilter === "all" ? currentUser?.storeId ?? "store-1" : storeFilter
      );

      // Optimistic UI: gỡ / đánh dấu đã TT ngay (không chờ reload).
      const paidKeys = new Set(result.items.map((i) => `${i.source}:${i.sourceId}`));
      const paidSoftwareIds = new Set(
        result.items.filter((i) => i.source === "software").map((i) => i.sourceId)
      );
      const paidRepairIds = new Set(
        result.items.filter((i) => i.source === "repair").map((i) => i.sourceId)
      );
      const paidSaleIds = new Set(
        result.items.filter((i) => i.source === "sale").map((i) => i.sourceId)
      );

      if (paidKeys.size > 0) {
        setDebts((prev) =>
          prev
            .map((d) => {
              const key = `${d.source}:${d.sourceId}`;
              if (!paidKeys.has(key)) return d;
              return { ...d, status: "paid" as const };
            })
            .filter((d) => debtStatusFilter !== "open" || d.status === "open")
        );
      }
      if (paidSoftwareIds.size > 0) {
        setOnlineRepairs((prev) =>
          prev.map((r) =>
            paidSoftwareIds.has(r.id)
              ? { ...r, paymentStatus: "Đã thanh toán" as const, isPaid: true }
              : r
          )
        );
      }
      if (paidRepairIds.size > 0) {
        setShopRepairs((prev) =>
          prev.map((r) =>
            paidRepairIds.has(r.id)
              ? { ...r, paymentStatus: "Đã thanh toán" as const, isPaid: true }
              : r
          )
        );
      }
      if (paidSaleIds.size > 0) {
        const markSalePaid = (list: Sale[]) =>
          list.map((s) =>
            paidSaleIds.has(s.id) ? { ...s, payment: "Tiền mặt" as PaymentMethod } : s
          );
        setSales((prev) => markSalePaid(prev));
        setSalesRetail((prev) => markSalePaid(prev));
        setSalesBanGa((prev) => markSalePaid(prev));
      }

      setSelectedDebtIds([]);
      showUiToast(
        "success",
        result.updated ? `Đã thu ${result.updated} khoản công nợ.` : "Không có khoản nào được cập nhật."
      );

      // Reload tuần tự (pool max=1) — tránh timeout khi Promise.all tranh connection
      await reloadDebts();
      if (paidSoftwareIds.size) await reloadSoftwareFromDb();
      if (paidRepairIds.size) await reloadShopRepairsFromDb();
      if (paidSaleIds.size) {
        await reloadSalesFromDb("retail");
        await reloadBanGaSalesFromDb();
      }
    } catch (err) {
      showUiToast("error", toUiError(err));
    } finally {
      setDebtsSaving(false);
    }
  }

  async function cancelSale(id: string) {
    const sale = sales.find((item) => item.id === id);
    if (!sale || !canCancel || saleSaving) return;
    if (
      !window.confirm(
        `Xóa phiếu bán «${sale.itemName}»?\n\nPhiếu sẽ bị hủy (hoàn tồn kho) và biến mất khỏi danh sách.`
      )
    ) {
      return;
    }
    setSaleSaving(true);
    try {
      await apiCancelSale(id, currentUser?.username);
      // Gỡ khỏi grid ngay (optimistic), rồi load lại từ DB.
      setSales((prev) => prev.filter((item) => item.id !== id));
      setLedger((prev) =>
        prev.map((item) => (item.source.includes(id) ? { ...item, status: "Đã hủy" } : item))
      );
      if (viewingSaleId === id) setViewingSaleId(null);
      if (editingSaleId === id) {
        setEditingSaleId(null);
        setIsSaleModalOpen(false);
      }
      pushLog(`Xóa phiếu ${salesPageTitle}`, id, sale.storeId);
      await reloadInventoryFromDb();
      await reloadSalesFromDb(saleChannel);
      await reloadBanGaSalesFromDb();
      void refreshDashboardSummary();
      showUiToast("success", "Đã xóa phiếu bán.");
    } catch (err) {
      window.alert(toUiError(err));
      // Khôi phục list nếu API lỗi sau khi đã gỡ local
      await reloadSalesFromDb(saleChannel);
      await reloadBanGaSalesFromDb();
    } finally {
      setSaleSaving(false);
    }
  }

  if (!sessionReady) {
    return (
      <main className="phone-pattern flex min-h-screen items-center justify-center p-4">
        <div className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-3 text-sm font-bold text-muted shadow-panel">
          <Loader2 size={18} className="animate-spin text-brand" />
          Đang tải phiên…
        </div>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="phone-pattern flex min-h-screen items-center justify-center p-4">
        <section className="w-full max-w-[460px] rounded-lg border border-white/40 bg-white/95 px-6 py-8 shadow-[0_24px_70px_rgba(15,35,27,0.28)] backdrop-blur sm:px-10">
          <div className="mb-8 flex justify-center">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-brand text-lg font-black text-white">KC</div>
          </div>
          <div className="mb-8 text-center">
            <strong className="block text-xl">Kim Chi Mobile Shop</strong>
            <h1 className="mt-6 text-3xl font-black">Đăng nhập quản trị</h1>
            <p className="mt-3 text-base font-semibold text-brand">Chào mừng ông Chủ Quỵnh Đẹp Zai</p>
          </div>
          <form
            onSubmit={handleLogin}
            className="grid gap-4"
            autoComplete="off"
            data-form-type="other"
          >
            <Field label="Tài khoản">
              <select
                name="username"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                disabled={loginBusy || loginUsersLoading || loginUsers.length === 0}
                className="h-11 w-full rounded-lg border border-line bg-white px-3 font-semibold disabled:bg-slate-50 disabled:text-muted"
              >
                {loginUsersLoading ? (
                  <option value="">Đang tải tài khoản…</option>
                ) : loginUsers.length === 0 ? (
                  <option value="">Không có tài khoản active</option>
                ) : (
                  <>
                    <option value="" disabled>
                      Chọn tài khoản
                    </option>
                    {loginUsers.map((u) => (
                      <option key={u.username} value={u.username}>
                        {u.name?.trim() || u.username}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </Field>
            <Field label="Mật khẩu">
              <div className={`flex h-11 items-center rounded-lg border bg-white transition focus-within:border-brand ${loginError ? "border-red-300 bg-red-50" : "border-line"}`}>
                <input
                  name="password"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="min-w-0 flex-1 bg-transparent px-3 outline-none"
                  placeholder="Nhập mật khẩu"
                  type={isLoginPasswordVisible ? "text" : "password"}
                  disabled={loginBusy}
                />
                <button
                  type="button"
                  onClick={() => setIsLoginPasswordVisible((visible) => !visible)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-r-lg text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                  title={isLoginPasswordVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  aria-label={isLoginPasswordVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {isLoginPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            {loginError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{loginError}</p>}
            <button
              type="submit"
              disabled={loginBusy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {loginBusy ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
              {loginBusy ? "Đang đăng nhập…" : "Vào hệ thống"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  const visibleNavItems = navItems.filter((item) => canAccessMenu(currentUser, item.id));

  return (
    <main className="grid min-h-screen grid-cols-1 bg-canvas text-ink lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="bg-gradient-to-b from-[#12352a] via-[#14231d] to-[#0d1713] p-4 text-white lg:sticky lg:top-0 lg:h-screen">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-brand font-black">KC</div>
          <div>
            <strong className="block">Kim Chi Mobile</strong>
            <span className="text-xs font-semibold text-slate-300">{currentUser.role === "owner" ? "Chủ cửa hàng" : "Nhân viên"}</span>
          </div>
        </div>
        <nav className="grid gap-2">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            // BÁN HÀNG / PHẦN MỀM: màu riêng; menu còn lại = brand xanh.
            const isSales = item.id === "sales";
            const isSoftwarePm = item.id === "online-repairs";
            const btnClass = isSales
              ? isActive
                ? "border-sky-300/50 bg-sky-600 text-white shadow-[0_10px_24px_rgba(2,132,199,0.35)]"
                : "border-sky-400/25 bg-sky-500/15 text-sky-100 hover:border-sky-300/40 hover:bg-sky-500/25 hover:text-white"
              : isSoftwarePm
                ? isActive
                  ? "border-yellow-300/60 bg-violet-700 text-yellow-300 shadow-[0_10px_24px_rgba(109,40,217,0.4)]"
                  : "border-violet-400/40 bg-violet-700/90 text-yellow-300 hover:border-yellow-300/50 hover:bg-violet-600 hover:text-yellow-200"
                : isActive
                  ? "border-emerald-300/40 bg-brand text-white shadow-[0_10px_24px_rgba(15,139,98,0.32)]"
                  : "border-white/5 bg-white/[0.04] text-slate-300 hover:border-emerald-300/25 hover:bg-white/[0.09] hover:text-white";
            const iconWrapClass = isSales
              ? isActive
                ? "bg-white/20 text-white"
                : "bg-sky-400/20 text-sky-100 group-hover:bg-sky-400/30"
              : isSoftwarePm
                ? isActive
                  ? "bg-yellow-300/20 text-yellow-300"
                  : "bg-yellow-300/15 text-yellow-300 group-hover:bg-yellow-300/25"
                : isActive
                  ? "bg-white/18 text-white"
                  : "bg-white/[0.06] text-emerald-100 group-hover:bg-white/[0.12]";
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`group flex h-11 items-center gap-3 rounded-lg border px-3 text-left text-sm font-black uppercase tracking-wide transition ${btnClass}`}
              >
                <span className={`grid h-7 w-7 place-items-center rounded-md transition ${iconWrapClass}`}>
                  <Icon size={17} />
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="min-w-0 p-4 sm:p-6">
        {uiToast ? (
          <div
            role="status"
            className={`fixed left-1/2 top-6 z-[80] flex w-[min(92vw,36rem)] -translate-x-1/2 items-start gap-4 rounded-2xl border px-6 py-5 shadow-[0_20px_48px_rgba(15,23,42,0.18)] ${
              uiToast.type === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                : "border-red-200 bg-red-50 text-danger"
            }`}
          >
            {uiToast.type === "success" ? (
              <CheckCircle2 size={36} className="mt-0.5 shrink-0 text-emerald-600" />
            ) : (
              <CircleAlert size={22} className="mt-0.5 shrink-0 text-danger" />
            )}
            <div
              className={`min-w-0 flex-1 font-black leading-snug ${
                uiToast.type === "success" ? "text-lg sm:text-xl" : "text-sm font-bold"
              }`}
            >
              {uiToast.message}
            </div>
            <button
              type="button"
              onClick={() => setUiToast(null)}
              className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-white/70 hover:text-slate-800"
              title="Đóng"
            >
              <X size={uiToast.type === "success" ? 22 : 16} />
            </button>
          </div>
        ) : null}
        <header className={`mb-5 flex flex-col gap-4 lg:flex-row lg:items-center ${activePage === "online-repairs" ? "justify-end" : "lg:justify-between"}`}>
          <div className={activePage === "online-repairs" ? "hidden" : "block"}>
            <h1 className="text-2xl font-black sm:text-3xl">{navItems.find((item) => item.id === activePage)?.label}</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Xin chào, {currentUser.name}. Chúc bạn một ngày làm việc hiệu quả!</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={currentUser.role === "staff" ? currentUser.storeId : storeFilter}
              onChange={(event) => {
                if (currentUser.role === "staff") return;
                setStoreFilter(event.target.value as StoreId);
              }}
              disabled={currentUser.role === "staff"}
              title={currentUser.role === "staff" ? "Nhân viên chỉ xem cửa hàng được gán" : "Lọc theo cửa hàng"}
              className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-bold disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600"
            >
              {currentUser.role === "owner" ? <option value="all">Toàn hệ thống</option> : null}
              {stores
                .filter((store) => currentUser.role === "owner" || store.id === currentUser.storeId)
                .map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
            </select>
            <button
              onClick={handleLogout}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-bold"
            >
              <LogOut size={17} />
              Đăng xuất
            </button>
          </div>
        </header>

        {(inventoryBackendError || (inventoryLoading)) && (
          <div className={`mb-4 rounded-lg border p-3 text-sm font-semibold ${inventoryBackendError ? "border-red-200 bg-red-50 text-danger" : "border-line bg-white text-muted"}`}>
            {inventoryBackendError || "Đang tải kho từ Supabase…"}
            {!inventoryLoading && inventoryBackendError ? (
              <button type="button" className="ml-3 font-black text-brand underline" onClick={() => void reloadInventoryFromDb()}>
                Thử lại
              </button>
            ) : null}
          </div>
        )}

        {activePage === "dashboard" && (
          <div className="grid gap-4">
            {/* Tabs hub */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-slate-100/80 p-1">
                {REPORT_HUB_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setReportHubTab(tab.id)}
                    className={`h-10 rounded-lg px-3 text-sm font-black transition sm:px-4 ${
                      reportHubTab === tab.id
                        ? "bg-brand text-white shadow-sm"
                        : "bg-transparent text-slate-600 hover:bg-white hover:text-brand"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setIsStatsHidden((v) => !v)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                {isStatsHidden ? <EyeOff size={17} /> : <Eye size={17} />}
                {isStatsHidden ? "Hiện số" : "Ẩn số"}
              </button>
            </div>

            {/* Thanh thời gian — Tổng quan / Bán hàng / Bán Gà / Phần mềm / Sửa chữa / Chuyển khoản */}
            {(reportHubTab === "overview" ||
              reportHubTab === "sales" ||
              reportHubTab === "banGa" ||
              reportHubTab === "software" ||
              reportHubTab === "repair" ||
              reportHubTab === "transfer") && (
              <div className="flex flex-col gap-2 rounded-xl border border-line bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
                <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-slate-50 p-1">
                  {(
                    [
                      { id: "day" as const, label: "Ngày" },
                      { id: "month" as const, label: "Tháng" },
                      { id: "year" as const, label: "Năm" },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setReportPeriod(p.id)}
                      className={`h-9 rounded-md px-3 text-sm font-bold transition ${
                        reportPeriod === p.id
                          ? "bg-white text-brand shadow-sm ring-1 ring-brand/20"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {reportPeriod === "day" ? (
                  <label className="grid gap-0.5">
                    <span className="text-xs font-bold text-muted">Chọn ngày</span>
                    <input
                      type="date"
                      value={reportDay}
                      onChange={(e) => setReportDay(e.target.value)}
                      className="h-10 rounded-lg border border-line px-3 text-sm font-bold"
                    />
                  </label>
                ) : null}
                {reportPeriod === "month" ? (
                  <label className="grid gap-0.5">
                    <span className="text-xs font-bold text-muted">Chọn tháng</span>
                    <input
                      type="month"
                      value={inventoryReportMonth}
                      onChange={(e) => setInventoryReportMonth(e.target.value)}
                      className="h-10 rounded-lg border border-line px-3 text-sm font-bold"
                    />
                  </label>
                ) : null}
                {reportPeriod === "year" ? (
                  <label className="grid gap-0.5">
                    <span className="text-xs font-bold text-muted">Chọn năm</span>
                    <select
                      value={reportYear}
                      onChange={(e) => setReportYear(e.target.value)}
                      className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-bold"
                    >
                      <option value="2024">2024</option>
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                    </select>
                  </label>
                ) : null}
                <p className="text-xs font-semibold text-muted sm:ml-auto sm:self-center">
                  {storeName(storeFilter)}
                  {reportPeriod === "day"
                    ? ` · ${reportDay}`
                    : reportPeriod === "month"
                      ? ` · ${inventoryReportMonth}`
                      : ` · ${reportYear}`}
                </p>
              </div>
            )}

            {reportHubTab === "overview" && (
              <div className="grid gap-4">
                <div className="rounded-lg border border-brand/30 bg-brand-soft/60 p-3 text-sm font-semibold text-ink">
                  {dashboardSummaryLoading
                    ? "Đang đồng bộ báo cáo từ DB…"
                    : `Tổng quan · ${storeName(storeFilter)} · ${
                        reportPeriod === "day"
                          ? reportDay
                          : reportPeriod === "month"
                            ? inventoryReportMonth
                            : reportYear
                      }. Kho = snapshot tồn; Bán/Bán Gà/PM/Sửa = theo kỳ đã chọn.`}
                </div>

                <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-5">
                  <OverviewModuleCard
                    title="Kho hàng"
                    icon={<Boxes size={16} />}
                    theme={{
                      card: "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/80",
                      icon: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
                      title: "text-amber-900",
                    }}
                    lines={[
                      `Tổng ĐT đã bán: ${overviewModules.kho.phonesSold}`,
                      `Tổng ĐT còn: ${overviewModules.kho.phonesInStock}`,
                      `Tổng ĐT chưa xử lý: ${overviewModules.kho.phonesPending}`,
                    ]}
                    revenue={formatMoney(overviewModules.kho.revenue)}
                    capital={formatMoney(overviewModules.kho.capital)}
                    profit={formatMoney(overviewModules.kho.profit)}
                    revenueLabel="Doanh thu tạm tính"
                    capitalLabel="Chi phí vốn"
                    profitLabel="Lãi tạm tính"
                    hideMoney={isStatsHidden}
                  />
                  <OverviewModuleCard
                    title="Bán hàng"
                    icon={<ReceiptText size={16} />}
                    theme={{
                      card: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/80",
                      icon: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
                      title: "text-emerald-900",
                    }}
                    lines={[
                      `Máy bán kỳ: ${overviewModules.banHang.soldPhones}`,
                      `Phụ kiện bán kỳ: ${overviewModules.banHang.soldAccessories}`,
                      `Tổng phiếu: ${overviewModules.banHang.saleCount}`,
                    ]}
                    revenue={formatMoney(overviewModules.banHang.revenue)}
                    capital={formatMoney(overviewModules.banHang.capital)}
                    profit={formatMoney(overviewModules.banHang.profit)}
                    hideMoney={isStatsHidden}
                  />
                  <OverviewModuleCard
                    title="Bán Gà"
                    icon={<ShoppingCart size={16} />}
                    theme={{
                      card: "border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-pink-50/80",
                      icon: "bg-fuchsia-100 text-fuchsia-800 ring-1 ring-fuchsia-200",
                      title: "text-fuchsia-900",
                    }}
                    lines={[
                      `Máy bán kỳ: ${overviewModules.banGa.soldPhones}`,
                      `Phụ kiện bán kỳ: ${overviewModules.banGa.soldAccessories}`,
                      `Tổng phiếu: ${overviewModules.banGa.saleCount}`,
                    ]}
                    revenue={formatMoney(overviewModules.banGa.revenue)}
                    capital={formatMoney(overviewModules.banGa.capital)}
                    profit={formatMoney(overviewModules.banGa.profit)}
                    hideMoney={isStatsHidden}
                  />
                  <OverviewModuleCard
                    title="Phần mềm"
                    icon={<Terminal size={16} />}
                    theme={{
                      card: "border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50/80",
                      icon: "bg-sky-100 text-sky-800 ring-1 ring-sky-200",
                      title: "text-sky-900",
                    }}
                    lines={[
                      `HĐ đã thanh toán: ${overviewModules.phanMem.paidCount}`,
                      `HĐ còn nợ: ${overviewModules.phanMem.debtCount}`,
                    ]}
                    revenue={formatMoney(overviewModules.phanMem.revenue)}
                    capital={formatMoney(overviewModules.phanMem.capital)}
                    profit={formatMoney(overviewModules.phanMem.profit)}
                    hideMoney={isStatsHidden}
                  />
                  <OverviewModuleCard
                    title="Sửa chữa"
                    icon={<Wrench size={16} />}
                    theme={{
                      card: "border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50/80",
                      icon: "bg-violet-100 text-violet-800 ring-1 ring-violet-200",
                      title: "text-violet-900",
                    }}
                    lines={[
                      `HĐ đã thanh toán: ${overviewModules.suaChua.paidCount}`,
                      `HĐ còn nợ: ${overviewModules.suaChua.debtCount}`,
                    ]}
                    revenue={formatMoney(overviewModules.suaChua.revenue)}
                    capital={formatMoney(overviewModules.suaChua.capital)}
                    profit={formatMoney(overviewModules.suaChua.profit)}
                    hideMoney={isStatsHidden}
                  />
                </div>

                {/* Biểu đồ cột: Chồng (PM) vs Vợ (Sửa + Bán + Gà) + cảnh báo / vinh danh */}
                <section className="rounded-xl border border-line bg-white p-4 shadow-panel">
                  <div className="mb-4">
                    <h2 className="text-lg font-black text-ink">Chia sẻ doanh thu & lợi nhuận</h2>
                    <p className="text-sm font-semibold text-muted">
                      Chồng = Phần mềm · Vợ = Sửa chữa + Bán hàng + Bán Gà
                      {reportPeriod === "day"
                        ? ` · ${reportDay}`
                        : reportPeriod === "month"
                          ? ` · ${inventoryReportMonth}`
                          : ` · ${reportYear}`}
                      {" · "}
                      <span className="text-slate-500">
                        &lt;40% cố gắng · ≥60% vinh danh trụ cột
                      </span>
                    </p>
                  </div>
                  <div className="grid gap-6 lg:grid-cols-2">
                    {(
                      [
                        {
                          id: "revenue",
                          title: "Doanh thu",
                          pack: overviewCoupleCharts.revenue,
                          colorChong: "#0ea5e9",
                          colorVo: "#10b981",
                        },
                        {
                          id: "profit",
                          title: "Lợi nhuận",
                          pack: overviewCoupleCharts.profit,
                          colorChong: "#6366f1",
                          colorVo: "#f59e0b",
                        },
                      ] as const
                    ).map((chart) => {
                      const rows = chart.pack.rows.map((r) => {
                        const valueM = toMillionVnd(r.value);
                        return {
                          ...r,
                          /** Giá trị trục Y (triệu ₫) */
                          valueM,
                          fill: r.key === "chong" ? chart.colorChong : chart.colorVo,
                        };
                      });
                      const maxM = Math.max(0, ...rows.map((r) => r.valueM));
                      const yTicks = buildMillionAxisTicks(maxM);
                      const yMax = yTicks[yTicks.length - 1] ?? 5;
                      const hasData = chart.pack.total > 0;
                      return (
                        <div
                          key={chart.id}
                          className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <h3 className="text-base font-black text-ink">{chart.title}</h3>
                            <span className="text-sm font-bold text-muted">
                              Tổng:{" "}
                              <strong className="text-base text-ink">
                                {isStatsHidden
                                  ? "***"
                                  : formatMoney(chart.pack.total)}
                              </strong>
                            </span>
                          </div>
                          {!hasData ? (
                            <p className="flex h-[220px] items-center justify-center text-sm font-semibold text-muted">
                              Chưa có dữ liệu trong kỳ
                            </p>
                          ) : (
                            <>
                              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-2">
                                <div className="min-h-[240px] flex-[2] sm:min-h-[280px]">
                                  <ResponsiveContainer width="100%" height={260}>
                                    <BarChart
                                      data={rows}
                                      margin={{ top: 12, right: 8, left: 4, bottom: 4 }}
                                      barCategoryGap="28%"
                                    >
                                      <CartesianGrid
                                        strokeDasharray="3 3"
                                        vertical={false}
                                        stroke="#e2e8f0"
                                      />
                                      <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{
                                          fill: "#334155",
                                          fontSize: 13,
                                          fontWeight: 800,
                                        }}
                                      />
                                      <YAxis
                                        domain={[0, yMax]}
                                        ticks={yTicks}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={(v) =>
                                          isStatsHidden
                                            ? "***"
                                            : Number(v) === 0
                                              ? "0"
                                              : `${Number(v)}M`
                                        }
                                        tick={{
                                          fill: "#64748b",
                                          fontSize: 11,
                                          fontWeight: 700,
                                        }}
                                        width={44}
                                      />
                                      <Tooltip
                                        formatter={(_value, _name, item) => {
                                          const payload = item?.payload as {
                                            pct?: number;
                                            value?: number;
                                            valueM?: number;
                                          };
                                          const pct = Number(payload?.pct ?? 0);
                                          const raw = Number(payload?.value ?? 0);
                                          const m = Number(payload?.valueM ?? 0);
                                          return [
                                            isStatsHidden
                                              ? `*** (${pct.toFixed(0)}%)`
                                              : `${formatMoney(raw)} · ${m.toFixed(m >= 10 ? 0 : 1)}M · ${pct.toFixed(0)}%`,
                                            chart.title,
                                          ];
                                        }}
                                        contentStyle={{
                                          borderRadius: "8px",
                                          border: "1px solid #e2e8f0",
                                          fontWeight: 700,
                                          fontSize: 12,
                                        }}
                                      />
                                      <Bar dataKey="valueM" radius={[8, 8, 0, 0]} maxBarSize={72}>
                                        {rows.map((entry) => (
                                          <Cell key={entry.key} fill={entry.fill} />
                                        ))}
                                      </Bar>
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                                <div className="flex flex-[1] flex-col justify-center gap-2 sm:max-w-[34%]">
                                  {rows.map((row) => (
                                    <div
                                      key={row.key}
                                      className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 shadow-sm"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                                          style={{ backgroundColor: row.fill }}
                                        />
                                        <span className="text-sm font-black text-slate-800">
                                          {row.name}
                                        </span>
                                        <span className="ml-auto text-sm font-black tabular-nums text-brand">
                                          {row.pct.toFixed(0)}%
                                        </span>
                                      </div>
                                      <p className="mt-0.5 text-xs font-semibold text-muted">
                                        {row.short}
                                      </p>
                                      <p className="text-base font-black tabular-nums text-ink">
                                        {isStatsHidden
                                          ? "***"
                                          : formatMoney(row.value)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {chart.pack.banners.length > 0 ? (
                                <div className="mt-3 grid gap-1.5">
                                  {chart.pack.banners.map((b) => (
                                    <div
                                      key={b.text}
                                      className={`rounded-lg px-3 py-2 text-sm font-bold ${
                                        b.tone === "honor"
                                          ? "border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-900"
                                          : "border border-orange-200 bg-orange-50 text-orange-900"
                                      }`}
                                    >
                                      {b.tone === "honor" ? "🏆 " : "⚠️ "}
                                      {b.text}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}

            {reportHubTab === "sales" && (
              <section className="grid gap-4">
                <div className="rounded-lg border border-sky-100 bg-sky-50/80 p-3 text-sm font-semibold text-sky-900">
                  Tab <strong>Bán hàng</strong> — Sprint 2 sẽ bổ sung chart theo ngày & breakdown
                  TM/CK/nợ. Hiện dùng lại báo cáo tháng/năm từ phiếu bán (DB).
                </div>

                <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-black">Theo tháng</h2>
                      <p className="text-sm font-semibold text-muted">
                        Phiếu bán hoàn tất · {inventoryReportMonth}
                      </p>
                    </div>
                  </div>
                  {supabaseReportMonthly &&
                  inventoryMonthlyReport.revenue === 0 &&
                  inventoryMonthlyReport.soldPhones === 0 ? (
                    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                      Chưa có phiếu bán trong tháng {inventoryReportMonth}. Vào{" "}
                      <strong>Bán hàng</strong> tạo phiếu rồi quay lại.
                    </div>
                  ) : null}
                  <div className="grid gap-4 md:grid-cols-3">
                    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                      <p className="text-sm font-bold text-muted">Máy bán</p>
                      <div className="mt-4 flex items-center justify-between">
                        <strong className="text-3xl text-sky-800">
                          {isStatsHidden || hideReportSold
                            ? "***"
                            : `${reportPeriodSales.soldPhones} con`}
                        </strong>
                        <button
                          type="button"
                          onClick={() => setHideReportSold(!hideReportSold)}
                          className="grid h-11 w-11 place-items-center rounded-lg bg-sky-50 text-sky-700 transition hover:bg-sky-100"
                        >
                          <Smartphone size={20} />
                        </button>
                      </div>
                    </section>
                    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                      <p className="text-sm font-bold text-muted">Doanh thu</p>
                      <div className="mt-4 flex items-center justify-between">
                        <strong className="text-3xl text-amber-700">
                          {isStatsHidden || hideReportRevenue
                            ? "***"
                            : formatMoney(reportPeriodSales.revenue)}
                        </strong>
                        <button
                          type="button"
                          onClick={() => setHideReportRevenue(!hideReportRevenue)}
                          className="grid h-11 w-11 place-items-center rounded-lg bg-amber-50 text-amber-700 transition hover:bg-amber-100"
                        >
                          <ReceiptText size={20} />
                        </button>
                      </div>
                    </section>
                    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                      <p className="text-sm font-bold text-muted">Lợi nhuận</p>
                      <div className="mt-4 flex items-center justify-between">
                        <strong className="text-3xl text-emerald-700">
                          {isStatsHidden || hideReportProfit
                            ? "***"
                            : formatMoney(reportPeriodSales.profit)}
                        </strong>
                        <button
                          type="button"
                          onClick={() => setHideReportProfit(!hideReportProfit)}
                          className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <Activity size={20} />
                        </button>
                      </div>
                    </section>
                  </div>
                </section>

                <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
                  <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-xl font-black">Biểu đồ năm {reportYear}</h2>
                      <p className="text-sm font-semibold text-muted">
                        Doanh thu, lợi nhuận và số máy bán theo tháng
                      </p>
                    </div>
                  </div>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartYearlyData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="month"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                          dy={10}
                        />
                        <YAxis
                          yAxisId="left"
                          orientation="left"
                          stroke="#1e293b"
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(val) => `${val / 1000000}M`}
                          tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                          dx={-10}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#0ea5e9"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                          dx={10}
                        />
                        <Tooltip
                          cursor={{ fill: "#f1f5f9" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            fontWeight: "bold",
                          }}
                          formatter={(value: any, name: any) => {
                            if (name === "Doanh thu" || name === "Lợi nhuận")
                              return [formatMoney(value as number), name];
                            return [value, name];
                          }}
                        />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{ paddingTop: "20px", fontWeight: "bold" }}
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="revenue"
                          name="Doanh thu"
                          fill="#14b8a6"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="profit"
                          name="Lợi nhuận"
                          fill="#f59e0b"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="sold"
                          name="Máy bán"
                          fill="#0ea5e9"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </section>
            )}

            {reportHubTab === "inventory" && (
              <div className="grid gap-4">
                <div className="rounded-lg border border-amber-100 bg-amber-50/80 p-3 text-sm font-semibold text-amber-950">
                  Tab <strong>Kho hàng</strong> — snapshot tồn · {storeName(storeFilter)}. DT/lãi
                  tạm tính = nếu bán hết tồn theo giá bán dự kiến (đơn vị shop).
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <StatCard
                    label="Máy còn hàng"
                    value={isStatsHidden || dashboardSummaryLoading ? "***" : `${dashboard.phones}`}
                    hint="Đang in_stock"
                    icon={<Smartphone size={20} />}
                  />
                  <StatCard
                    label="Máy đã bán (tổng)"
                    value={
                      isStatsHidden || dashboardSummaryLoading
                        ? "***"
                        : `${dashboard.phonesSold}`
                    }
                    hint="Lifetime thái Đã bán · lifetime"
                    icon={<ReceiptText size={20} />}
                  />
                  <StatCard
                    label="Phụ kiện tồn (SL)"
                    value={
                      isStatsHidden || dashboardSummaryLoading ? "***" : `${dashboard.accessories}`
                    }
                    hint="Tổng số lượng"
                    icon={<PackagePlus size={20} />}
                  />
                  <StatCard
                    label="Vốn đầu tư"
                    value={
                      isStatsHidden || dashboardSummaryLoading
                        ? "***"
                        : formatMoney(dashboard.capitalShort)
                    }
                    hint="Σ giá nhập tồn máy + PK"
                    icon={<Store size={20} />}
                  />
                  <StatCard
                    label="Doanh thu tạm tính"
                    value={
                      isStatsHidden || dashboardSummaryLoading
                        ? "***"
                        : formatMoney(dashboard.provisionalRevenueShort)
                    }
                    hint="Σ giá bán dự kiến tồn"
                    icon={<Activity size={20} />}
                  />
                  <StatCard
                    label="Lãi tạm tính"
                    value={
                      isStatsHidden || dashboardSummaryLoading
                        ? "***"
                        : formatMoney(dashboard.provisionalProfitShort)
                    }
                    hint="DT tạm − vốn đầu tư"
                    icon={<FileText size={20} />}
                  />
                </div>
              </div>
            )}

            {reportHubTab === "banGa" && (
              <section className="grid gap-4">
                <div className="rounded-lg border border-fuchsia-100 bg-fuchsia-50/80 p-3 text-sm font-semibold text-fuchsia-950">
                  Tab <strong>Bán Gà</strong> — phiếu channel Bán Gà · {storeName(storeFilter)}
                  {reportPeriod === "day"
                    ? ` · ${reportDay}`
                    : reportPeriod === "month"
                      ? ` · ${inventoryReportMonth}`
                      : ` · ${reportYear}`}
                  . Đơn vị shop (short) giống màn Bán Gà.
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                    <p className="text-sm font-bold text-muted">Doanh thu</p>
                    <strong className="mt-3 block text-3xl font-black text-amber-700">
                      {isStatsHidden ? "***" : formatMoney(banGaReportStats.revenue)}
                    </strong>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      {banGaReportStats.saleCount} phiếu · TM {banGaReportStats.cashCount} · CK{" "}
                      {banGaReportStats.transferCount} · Nợ {banGaReportStats.debtCount}
                    </p>
                  </section>
                  <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                    <p className="text-sm font-bold text-muted">Vốn / Lợi nhuận</p>
                    <strong className="mt-3 block text-3xl font-black text-emerald-700">
                      {isStatsHidden ? "***" : formatMoney(banGaReportStats.profit)}
                    </strong>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      Vốn{" "}
                      {isStatsHidden ? "***" : formatMoney(banGaReportStats.capital)} · lãi =
                      DT − vốn
                    </p>
                  </section>
                  <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                    <p className="text-sm font-bold text-muted">Hàng bán trong kỳ</p>
                    <strong className="mt-3 block text-3xl font-black text-fuchsia-800">
                      {isStatsHidden
                        ? "***"
                        : `${banGaReportStats.soldPhones} máy`}
                    </strong>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      PK:{" "}
                      {isStatsHidden ? "***" : banGaReportStats.soldAccessories} · Tổng phiếu:{" "}
                      {banGaReportStats.saleCount}
                    </p>
                  </section>
                </div>

                <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
                  <div className="mb-6">
                    <h2 className="text-xl font-black">Biểu đồ năm {reportYear} — Bán Gà</h2>
                    <p className="text-sm font-semibold text-muted">
                      Doanh thu, lợi nhuận và số máy bán theo tháng
                    </p>
                  </div>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={banGaReportStats.yearRows}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="month"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                          dy={10}
                        />
                        <YAxis
                          yAxisId="left"
                          orientation="left"
                          stroke="#1e293b"
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(val) => `${Number(val) / 1000}k`}
                          tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                          dx={-10}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#c026d3"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                          dx={10}
                        />
                        <Tooltip
                          cursor={{ fill: "#f1f5f9" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            fontWeight: "bold",
                          }}
                          formatter={(value: any, name: any) => {
                            if (name === "Doanh thu" || name === "Lợi nhuận")
                              return [formatMoney(value as number), name];
                            return [value, name];
                          }}
                        />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{ paddingTop: "20px", fontWeight: "bold" }}
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="revenue"
                          name="Doanh thu"
                          fill="#d946ef"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="profit"
                          name="Lợi nhuận"
                          fill="#f59e0b"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="sold"
                          name="Máy bán"
                          fill="#0ea5e9"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </section>
            )}

            {reportHubTab === "repair" && (
              <section className="grid gap-4">
                <div className="rounded-lg border border-violet-100 bg-violet-50/80 p-3 text-sm font-semibold text-violet-950">
                  Tab <strong>Sửa chữa</strong> — thống kê đơn sửa theo kỳ · {storeName(storeFilter)}
                  {reportPeriod === "day"
                    ? ` · ${reportDay}`
                    : reportPeriod === "month"
                      ? ` · ${inventoryReportMonth}`
                      : ` · ${reportYear}`}
                  . Doanh thu = báo giá · Vốn = phí DV · Lãi = báo giá − phí.
                  {shopRepairLoading ? " · Đang tải đơn…" : ` · Đã tải ${repairReportStats.totalLoaded} đơn`}
                  {shopRepairBackendError ? (
                    <span className="ml-1 text-danger"> · Lỗi: {shopRepairBackendError}</span>
                  ) : null}
                </div>

                {repairReportStats.totalLoaded === 0 && !shopRepairLoading ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                    Chưa có đơn sửa chữa trong phạm vi cửa hàng đang chọn. Vào menu{" "}
                    <strong>Sửa chữa</strong> tạo đơn rồi quay lại.
                    <button
                      type="button"
                      onClick={() => void reloadShopRepairsFromDb()}
                      className="ml-2 font-black text-brand underline"
                    >
                      Tải lại
                    </button>
                  </div>
                ) : null}

                {repairReportStats.totalLoaded > 0 && repairReportStats.orderCount === 0 ? (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900">
                    Có {repairReportStats.totalLoaded} đơn đã tải nhưng{" "}
                    <strong>không có đơn trong kỳ</strong> đang chọn
                    {reportPeriod === "day"
                      ? ` (ngày ${reportDay})`
                      : reportPeriod === "month"
                        ? ` (tháng ${inventoryReportMonth})`
                        : ` (năm ${reportYear})`}
                    . Đổi Ngày / Tháng / Năm phía trên để xem thống kê.
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                    <p className="text-sm font-bold text-muted">Doanh thu (báo giá)</p>
                    <strong className="mt-3 block text-3xl font-black text-amber-700">
                      {isStatsHidden || shopRepairLoading
                        ? "***"
                        : formatMoney(repairReportStats.revenue)}
                    </strong>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      {repairReportStats.orderCount} đơn trong kỳ
                    </p>
                  </section>
                  <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                    <p className="text-sm font-bold text-muted">Phí dịch vụ (vốn)</p>
                    <strong className="mt-3 block text-3xl font-black text-slate-700">
                      {isStatsHidden || shopRepairLoading
                        ? "***"
                        : formatMoney(repairReportStats.capital)}
                    </strong>
                  </section>
                  <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                    <p className="text-sm font-bold text-muted">Lợi nhuận</p>
                    <strong className="mt-3 block text-3xl font-black text-emerald-700">
                      {isStatsHidden || shopRepairLoading
                        ? "***"
                        : formatMoney(repairReportStats.profit)}
                    </strong>
                    <p className="mt-1 text-xs font-semibold text-muted">Báo giá − phí DV</p>
                  </section>
                  <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                    <p className="text-sm font-bold text-muted">Thanh toán</p>
                    <strong className="mt-3 block text-2xl font-black text-violet-800">
                      {isStatsHidden || shopRepairLoading
                        ? "***"
                        : `${repairReportStats.paidCount} TT · ${repairReportStats.debtCount} nợ`}
                    </strong>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      Đã TT:{" "}
                      {isStatsHidden ? "***" : formatMoney(repairReportStats.paidAmount)}
                      {" · "}
                      Dư nợ:{" "}
                      {isStatsHidden ? "***" : formatMoney(repairReportStats.debtAmount)}
                    </p>
                  </section>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                    <p className="text-sm font-bold text-muted">Tiền mặt (đã TT)</p>
                    <strong className="mt-2 block text-2xl font-black text-emerald-700">
                      {isStatsHidden || shopRepairLoading
                        ? "***"
                        : formatMoney(repairReportStats.cashAmount)}
                    </strong>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      {repairReportStats.cashCount} đơn
                    </p>
                  </section>
                  <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                    <p className="text-sm font-bold text-muted">Chuyển khoản (đã TT)</p>
                    <strong className="mt-2 block text-2xl font-black text-sky-700">
                      {isStatsHidden || shopRepairLoading
                        ? "***"
                        : formatMoney(repairReportStats.transferAmount)}
                    </strong>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      {repairReportStats.transferCount} đơn
                    </p>
                  </section>
                </div>

                <section className="overflow-hidden rounded-xl border border-line bg-white shadow-panel">
                  <div className="border-b border-line px-4 py-3">
                    <h2 className="text-lg font-black text-ink">Danh sách đơn trong kỳ</h2>
                    <p className="text-xs font-semibold text-muted">
                      {repairReportStats.orderCount} đơn · Báo giá · Phí · Lãi · TT
                    </p>
                  </div>
                  <div className="max-h-[min(50vh,24rem)] overflow-auto">
                    <table className="min-w-full border-collapse text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-50">
                        <tr className="border-b border-line text-xs font-black uppercase tracking-wide text-muted">
                          <th className="whitespace-nowrap px-3 py-2.5">Ngày</th>
                          <th className="min-w-[8rem] px-3 py-2.5">Khách · Máy</th>
                          <th className="whitespace-nowrap px-3 py-2.5">Báo giá</th>
                          <th className="whitespace-nowrap px-3 py-2.5">Phí DV</th>
                          <th className="whitespace-nowrap px-3 py-2.5">Lãi</th>
                          <th className="whitespace-nowrap px-3 py-2.5">TT</th>
                          <th className="whitespace-nowrap px-3 py-2.5">HT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {repairReportStats.rows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-4 py-10 text-center text-sm font-semibold text-muted"
                            >
                              Không có đơn sửa chữa trong kỳ đã chọn.
                            </td>
                          </tr>
                        ) : (
                          repairReportStats.rows.map((row) => (
                            <tr
                              key={row.id}
                              className="border-b border-line/80 hover:bg-slate-50/80"
                            >
                              <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">
                                {row.receiveDate || "—"}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="block font-bold text-brand">
                                  {row.customerName}
                                </span>
                                <span className="block text-xs font-semibold text-muted">
                                  {row.deviceName}
                                  {row.condition ? ` · ${row.condition}` : ""}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 font-bold tabular-nums text-ink">
                                {isStatsHidden ? "***" : formatMoney(row.quote)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums text-slate-700">
                                {isStatsHidden ? "***" : formatMoney(row.deposit)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 font-black tabular-nums text-amber-700">
                                {isStatsHidden ? "***" : formatMoney(row.profit)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                                    row.paymentStatus === "Đã thanh toán"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-red-50 text-red-600"
                                  }`}
                                >
                                  {row.paymentStatus === "Đã thanh toán" ? "Đã TT" : "Nợ"}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-xs font-bold text-slate-600">
                                {row.paymentMethod === "Chuyển khoản" ? "CK" : "TM"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
                  <div className="mb-6">
                    <h2 className="text-xl font-black">Biểu đồ năm {reportYear} — Sửa chữa</h2>
                    <p className="text-sm font-semibold text-muted">
                      Doanh thu (báo giá), lợi nhuận và số đơn theo tháng (cả năm, không phụ thuộc
                      bộ lọc Ngày/Tháng)
                    </p>
                  </div>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={repairReportStats.yearRows}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="month"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                          dy={10}
                        />
                        <YAxis
                          yAxisId="left"
                          orientation="left"
                          stroke="#1e293b"
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(val) =>
                            Number(val) >= 1_000_000
                              ? `${Number(val) / 1_000_000}M`
                              : `${Number(val) / 1000}k`
                          }
                          tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                          dx={-10}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#7c3aed"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                          dx={10}
                        />
                        <Tooltip
                          cursor={{ fill: "#f1f5f9" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            fontWeight: "bold",
                          }}
                          formatter={(value: any, name: any) => {
                            if (name === "Doanh thu" || name === "Lợi nhuận")
                              return [formatMoney(value as number), name];
                            return [value, name];
                          }}
                        />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{ paddingTop: "20px", fontWeight: "bold" }}
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="revenue"
                          name="Doanh thu"
                          fill="#8b5cf6"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="profit"
                          name="Lợi nhuận"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="orders"
                          name="Số đơn"
                          fill="#f59e0b"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </section>
            )}

            {reportHubTab === "software" && (
              <section className="grid gap-4">
                <div className="rounded-lg border border-sky-100 bg-sky-50/80 p-3 text-sm font-semibold text-sky-950">
                  Tab <strong>Phần mềm</strong> — thống kê đơn PM theo kỳ · {storeName(storeFilter)}
                  {reportPeriod === "day"
                    ? ` · ${reportDay}`
                    : reportPeriod === "month"
                      ? ` · ${inventoryReportMonth}`
                      : ` · ${reportYear}`}
                  . Doanh thu = báo giá · Vốn = phí DV · Lãi = báo giá − phí.
                  {softwareLoading
                    ? " · Đang tải đơn…"
                    : ` · Đã tải ${softwareReportStats.totalLoaded} đơn`}
                  {softwareBackendError ? (
                    <span className="ml-1 text-danger"> · Lỗi: {softwareBackendError}</span>
                  ) : null}
                </div>

                {softwareReportStats.totalLoaded === 0 && !softwareLoading ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                    Chưa có đơn phần mềm trong phạm vi cửa hàng đang chọn. Vào menu{" "}
                    <strong>Phần mềm</strong> tạo đơn rồi quay lại.
                    <button
                      type="button"
                      onClick={() => void reloadSoftwareFromDb()}
                      className="ml-2 font-black text-brand underline"
                    >
                      Tải lại
                    </button>
                  </div>
                ) : null}

                {softwareReportStats.totalLoaded > 0 && softwareReportStats.orderCount === 0 ? (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900">
                    Có {softwareReportStats.totalLoaded} đơn đã tải nhưng{" "}
                    <strong>không có đơn trong kỳ</strong> đang chọn
                    {reportPeriod === "day"
                      ? ` (ngày ${reportDay})`
                      : reportPeriod === "month"
                        ? ` (tháng ${inventoryReportMonth})`
                        : ` (năm ${reportYear})`}
                    . Đổi Ngày / Tháng / Năm phía trên để xem thống kê.
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                    <p className="text-sm font-bold text-muted">Doanh thu (báo giá)</p>
                    <strong className="mt-3 block text-3xl font-black text-amber-700">
                      {isStatsHidden || softwareLoading
                        ? "***"
                        : formatMoney(softwareReportStats.revenue)}
                    </strong>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      {softwareReportStats.orderCount} đơn trong kỳ
                    </p>
                  </section>
                  <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                    <p className="text-sm font-bold text-muted">Phí dịch vụ (vốn)</p>
                    <strong className="mt-3 block text-3xl font-black text-slate-700">
                      {isStatsHidden || softwareLoading
                        ? "***"
                        : formatMoney(softwareReportStats.capital)}
                    </strong>
                  </section>
                  <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                    <p className="text-sm font-bold text-muted">Lợi nhuận</p>
                    <strong className="mt-3 block text-3xl font-black text-emerald-700">
                      {isStatsHidden || softwareLoading
                        ? "***"
                        : formatMoney(softwareReportStats.profit)}
                    </strong>
                    <p className="mt-1 text-xs font-semibold text-muted">Báo giá − phí DV</p>
                  </section>
                  <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                    <p className="text-sm font-bold text-muted">Thanh toán</p>
                    <strong className="mt-3 block text-2xl font-black text-sky-800">
                      {isStatsHidden || softwareLoading
                        ? "***"
                        : `${softwareReportStats.paidCount} TT · ${softwareReportStats.debtCount} nợ`}
                    </strong>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      Đã TT:{" "}
                      {isStatsHidden ? "***" : formatMoney(softwareReportStats.paidAmount)}
                      {" · "}
                      Dư nợ:{" "}
                      {isStatsHidden ? "***" : formatMoney(softwareReportStats.debtAmount)}
                    </p>
                  </section>
                </div>

                <section className="overflow-hidden rounded-xl border border-line bg-white shadow-panel">
                  <div className="border-b border-line px-4 py-3">
                    <h2 className="text-lg font-black text-ink">Danh sách đơn trong kỳ</h2>
                    <p className="text-xs font-semibold text-muted">
                      {softwareReportStats.orderCount} đơn · Báo giá · Phí · Lãi · TT
                    </p>
                  </div>
                  <div className="max-h-[min(50vh,24rem)] overflow-auto">
                    <table className="min-w-full border-collapse text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-50">
                        <tr className="border-b border-line text-xs font-black uppercase tracking-wide text-muted">
                          <th className="whitespace-nowrap px-3 py-2.5">Ngày</th>
                          <th className="min-w-[8rem] px-3 py-2.5">Khách · Dịch vụ</th>
                          <th className="whitespace-nowrap px-3 py-2.5">Báo giá</th>
                          <th className="whitespace-nowrap px-3 py-2.5">Phí DV</th>
                          <th className="whitespace-nowrap px-3 py-2.5">Lãi</th>
                          <th className="whitespace-nowrap px-3 py-2.5">TT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {softwareReportStats.rows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-4 py-10 text-center text-sm font-semibold text-muted"
                            >
                              Không có đơn phần mềm trong kỳ đã chọn.
                            </td>
                          </tr>
                        ) : (
                          softwareReportStats.rows.map((row) => (
                            <tr
                              key={row.id}
                              className="border-b border-line/80 hover:bg-slate-50/80"
                            >
                              <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">
                                {row.receiveDate || "—"}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="block font-bold text-sky-700">
                                  {row.customerName}
                                </span>
                                <span className="block text-xs font-semibold text-muted">
                                  {row.deviceName}
                                  {row.issue ? ` · ${row.issue}` : ""}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 font-bold tabular-nums text-ink">
                                {isStatsHidden ? "***" : formatMoney(row.quote)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums text-slate-700">
                                {isStatsHidden ? "***" : formatMoney(row.deposit)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 font-black tabular-nums text-amber-700">
                                {isStatsHidden ? "***" : formatMoney(row.profit)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                                    row.paymentStatus === "Đã thanh toán"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-red-50 text-red-600"
                                  }`}
                                >
                                  {row.paymentStatus === "Đã thanh toán" ? "Đã TT" : "Nợ"}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
                  <div className="mb-6">
                    <h2 className="text-xl font-black">Biểu đồ năm {reportYear} — Phần mềm</h2>
                    <p className="text-sm font-semibold text-muted">
                      Doanh thu (báo giá), lợi nhuận và số đơn theo tháng (cả năm, không phụ thuộc
                      bộ lọc Ngày/Tháng)
                    </p>
                  </div>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={softwareReportStats.yearRows}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="month"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                          dy={10}
                        />
                        <YAxis
                          yAxisId="left"
                          orientation="left"
                          stroke="#1e293b"
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(val) =>
                            Number(val) >= 1_000_000
                              ? `${Number(val) / 1_000_000}M`
                              : `${Number(val) / 1000}k`
                          }
                          tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                          dx={-10}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#0284c7"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                          dx={10}
                        />
                        <Tooltip
                          cursor={{ fill: "#f1f5f9" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            fontWeight: "bold",
                          }}
                          formatter={(value: any, name: any) => {
                            if (name === "Doanh thu" || name === "Lợi nhuận")
                              return [formatMoney(value as number), name];
                            return [value, name];
                          }}
                        />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{ paddingTop: "20px", fontWeight: "bold" }}
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="revenue"
                          name="Doanh thu"
                          fill="#0ea5e9"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="profit"
                          name="Lợi nhuận"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="orders"
                          name="Số đơn"
                          fill="#f59e0b"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </section>
            )}

            {reportHubTab === "transfer" && (
              <div className="grid gap-4">
                <div className="rounded-lg border border-brand/30 bg-brand-soft/60 p-3 text-sm font-semibold text-ink">
                  Giao dịch <strong>Chuyển khoản</strong> từ Bán hàng + Sửa chữa đã thanh toán ·{" "}
                  {storeName(storeFilter)}
                  {reportPeriod === "day"
                    ? ` · ${reportDay}`
                    : reportPeriod === "month"
                      ? ` · ${inventoryReportMonth}`
                      : ` · ${reportYear}`}
                  . Đơn sửa chưa gắn cửa hàng — luôn hiển thị khi khớp kỳ.
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                    <p className="text-sm font-bold text-muted">Tổng tiền CK</p>
                    <strong className="mt-3 block text-3xl font-black text-brand">
                      {isStatsHidden ? "***" : formatMoney(transferReport.totalAmount)}
                    </strong>
                    <p className="mt-1 text-xs font-semibold text-muted">Đơn vị shop (bán) / như form (sửa)</p>
                  </section>
                  <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                    <p className="text-sm font-bold text-muted">Số giao dịch</p>
                    <strong className="mt-3 block text-3xl font-black text-ink">
                      {isStatsHidden ? "***" : transferReport.totalCount}
                    </strong>
                    <p className="mt-1 text-xs font-semibold text-muted">Bán + Sửa trong kỳ</p>
                  </section>
                  <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                    <p className="text-sm font-bold text-muted">Từ bán hàng</p>
                    <strong className="mt-3 block text-2xl font-black text-sky-800">
                      {isStatsHidden
                        ? "***"
                        : `${formatMoney(transferReport.saleAmount)} · ${transferReport.saleCount} GD`}
                    </strong>
                  </section>
                  <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                    <p className="text-sm font-bold text-muted">Từ sửa chữa</p>
                    <strong className="mt-3 block text-2xl font-black text-amber-800">
                      {isStatsHidden
                        ? "***"
                        : `${formatMoney(transferReport.repairAmount)} · ${transferReport.repairCount} GD`}
                    </strong>
                  </section>
                </div>

                <section className="overflow-hidden rounded-xl border border-line bg-white shadow-panel">
                  <div className="border-b border-line px-4 py-3">
                    <h2 className="text-lg font-black text-ink">Danh sách chuyển khoản</h2>
                    <p className="text-xs font-semibold text-muted">
                      Số tiền · Nguồn thanh toán · Ngày thanh toán (mới → cũ)
                    </p>
                  </div>
                  <div className="max-h-[min(60vh,28rem)] overflow-auto">
                    <table className="min-w-full border-collapse text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-50">
                        <tr className="border-b border-line text-xs font-black uppercase tracking-wide text-muted">
                          <th className="whitespace-nowrap px-4 py-3">Số tiền</th>
                          <th className="min-w-[12rem] px-4 py-3">Nguồn thanh toán</th>
                          <th className="whitespace-nowrap px-4 py-3">Ngày thanh toán</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transferReport.rows.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-10 text-center text-sm font-semibold text-muted">
                              Không có giao dịch chuyển khoản trong kỳ đã chọn.
                            </td>
                          </tr>
                        ) : (
                          transferReport.rows.map((row) => (
                            <tr
                              key={row.id}
                              className="border-b border-line/80 last:border-0 hover:bg-slate-50/80"
                            >
                              <td className="whitespace-nowrap px-4 py-3 font-black text-ink">
                                {isStatsHidden ? "***" : formatMoney(row.amount)}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                                    row.source === "sale"
                                      ? "bg-sky-50 text-sky-800"
                                      : "bg-amber-50 text-amber-900"
                                  }`}
                                >
                                  {row.sourceLabel}
                                </span>
                                <span className="font-semibold text-slate-700">{row.title}</span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                                {formatDateVi(row.paidAt) || "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}

        {activePage === "parts" && (() => {
          const storeIdForForm = resolvePartsStoreId();
          const q = partSearch.trim().toLowerCase();
          const baseByStore = partInbounds.filter(
            (p) => storeFilter === "all" || p.storeId === storeFilter
          );
          const distributorFilterOptions = uniquePartLabels(
            baseByStore.map((p) => p.distributor)
          );
          const afterDistributor = baseByStore.filter((p) => {
            if (partDistributorFilter === "all") return true;
            return (
              p.distributor.trim().toLowerCase() ===
              partDistributorFilter.trim().toLowerCase()
            );
          });
          const typeFilterOptions = uniquePartLabels(
            afterDistributor.map((p) => p.partType)
          );
          const effectiveTypeFilter =
            partTypeFilter !== "all" &&
            !typeFilterOptions.some(
              (t) =>
                t.trim().toLowerCase() === partTypeFilter.trim().toLowerCase()
            )
              ? "all"
              : partTypeFilter;
          const list = afterDistributor
            .filter((p) => {
              if (effectiveTypeFilter === "all") return true;
              return (
                p.partType.trim().toLowerCase() ===
                effectiveTypeFilter.trim().toLowerCase()
              );
            })
            .filter((p) => {
              if (!q) return true;
              const hay = [
                p.distributor,
                p.partType,
                p.brand,
                p.partName,
                p.color,
                String(p.quantity),
              ]
                .join(" ")
                .toLowerCase();
              return hay.includes(q);
            })
            .sort((a, b) => {
              // Grid: createdAt → nhà phân phối → loại → hãng
              const byDate = b.createdAt.localeCompare(a.createdAt);
              if (byDate !== 0) return byDate;
              const byDist = a.distributor.localeCompare(b.distributor, "vi", {
                sensitivity: "base",
              });
              if (byDist !== 0) return byDist;
              const byType = a.partType.localeCompare(b.partType, "vi", {
                sensitivity: "base",
              });
              if (byType !== 0) return byType;
              const byBrand = (a.brand || "").localeCompare(b.brand || "", "vi", {
                sensitivity: "base",
              });
              if (byBrand !== 0) return byBrand;
              return b.id.localeCompare(a.id);
            });
          const activeCount = list.length;
          const totalQty = list.reduce((s, p) => s + p.quantity, 0);
          const partTotalPages = Math.max(1, Math.ceil(activeCount / partPageSize));
          const safePartPage = Math.min(partPage, partTotalPages);
          const partStart = (safePartPage - 1) * partPageSize;
          const pagedList = list.slice(partStart, partStart + partPageSize);
          const pageIds = pagedList.map((r) => r.id);
          const allPageSelected =
            pageIds.length > 0 && pageIds.every((id) => selectedPartIds.includes(id));
          const selectedVisibleCount = list.filter((r) =>
            selectedPartIds.includes(r.id)
          ).length;
          const isEditMode = Boolean(editingPartId);

          return (
            <section className="grid gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                    <PackagePlus size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-ink">Nhập hàng</h2>
                    <p className="text-sm font-semibold text-muted">
                      {storeName(storeFilter)} · {activeCount.toLocaleString("vi-VN")} phiếu /{" "}
                      {totalQty.toLocaleString("vi-VN")} cái
                      {partInbounds.length > 0 && activeCount === 0
                        ? " · (lọc đang ẩn hết — chọn Tất cả NPP/loại)"
                        : ""}
                      {partLoading ? " · Đang tải…" : ""}
                      {!partLoading && partInbounds.length === 0 && !partBackendError
                        ? " · Chưa có dữ liệu"
                        : ""}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openNewPartInboundForm}
                  disabled={partSaving}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-white shadow-sm hover:bg-brand-dark disabled:opacity-50"
                >
                  <Plus size={18} />
                  Nhập hàng
                </button>
              </div>

              {partBackendError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-danger">
                  {partBackendError}{" "}
                  <button
                    type="button"
                    className="ml-2 font-black text-brand underline"
                    onClick={() => void reloadPartsFromDb()}
                  >
                    Thử lại
                  </button>
                </div>
              ) : null}

              {isPartFormOpen ? (
                <div
                  className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-md"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="part-inbound-modal-title"
                  onClick={closePartInboundForm}
                >
                  <section
                    className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl border border-white/20 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.4)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-line bg-gradient-to-r from-brand/10 to-transparent p-4 sm:p-5">
                      <div>
                        <h3
                          id="part-inbound-modal-title"
                          className="text-lg font-black text-ink sm:text-xl"
                        >
                          {isEditMode ? "Sửa phiếu nhập" : "Nhập hàng"}
                        </h3>
                        <p className="mt-0.5 text-xs font-semibold text-muted sm:text-sm">
                          Lưu vào cửa hàng:{" "}
                          <strong className="text-brand">{storeName(storeIdForForm)}</strong>
                          {storeFilter === "all" ? " (header «Tất cả» → CH mặc định user)" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={closePartInboundForm}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-muted transition hover:bg-slate-50 hover:text-ink"
                        title="Đóng"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <form
                      key={partFormKey}
                      onSubmit={handleSavePartInbound}
                      className="grid gap-4 p-4 sm:p-5"
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <ManageableSelect
                          key={`part-distributor-${partsLookupStoreId}`}
                          label="Nhà phân phối"
                          name="distributor"
                          options={partDistributorOptions}
                          setOptions={setPartDistributorOptions}
                          defaultValue={partDistributor}
                          required
                          allowFreeText
                          allowManage
                          categoryCode={PART_LOOKUP_CATEGORIES.distributor}
                          storeId={partsLookupStoreId}
                          onRenameCascade={reloadPartLookupsAndRows}
                          actorUsername={currentUser?.username ?? ""}
                          onValueChange={applyPartDistributorCascade}
                          onManageNotify={(type, message) => showUiToast(type, message)}
                        />
                        <ManageableSelect
                          key={`part-type-${partCascadeKey}-${partsLookupStoreId}`}
                          label="Loại linh kiện"
                          name="partType"
                          options={partTypeOptions}
                          setOptions={setPartTypeOptions}
                          defaultValue={partType}
                          required
                          allowFreeText
                          allowManage
                          categoryCode={PART_LOOKUP_CATEGORIES.partType}
                          storeId={partsLookupStoreId}
                          onRenameCascade={reloadPartLookupsAndRows}
                          actorUsername={currentUser?.username ?? ""}
                          onValueChange={setPartType}
                          onManageNotify={(type, message) => showUiToast(type, message)}
                        />
                        <ManageableSelect
                          key={`part-brand-${partCascadeKey}-${partsLookupStoreId}`}
                          label="Hãng"
                          name="brand"
                          options={partBrandOptions}
                          setOptions={setPartBrandOptions}
                          defaultValue={partBrand}
                          required={false}
                          allowFreeText
                          allowManage
                          categoryCode={PART_LOOKUP_CATEGORIES.brand}
                          storeId={partsLookupStoreId}
                          onRenameCascade={reloadPartLookupsAndRows}
                          actorUsername={currentUser?.username ?? ""}
                          onValueChange={setPartBrand}
                          onManageNotify={(type, message) => showUiToast(type, message)}
                        />
                        <ManageableSelect
                          key={`part-color-${partCascadeKey}-${partsLookupStoreId}`}
                          label="Màu sắc"
                          name="color"
                          options={partColorOptions}
                          setOptions={setPartColorOptions}
                          defaultValue={partColor}
                          required={false}
                          allowFreeText
                          allowManage
                          categoryCode={PART_LOOKUP_CATEGORIES.color}
                          storeId={partsLookupStoreId}
                          onRenameCascade={reloadPartLookupsAndRows}
                          actorUsername={currentUser?.username ?? ""}
                          onValueChange={setPartColor}
                          onManageNotify={(type, message) => showUiToast(type, message)}
                        />
                      </div>

                      <div className="rounded-xl border border-line bg-slate-50/80 p-3 sm:p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-black text-ink">Linh kiện</p>
                            <p className="text-xs font-semibold text-muted">
                              {isEditMode
                                ? "Sửa 1 phiếu: chỉ 1 dòng tên + SL"
                                : "Cùng NPP/loại/hãng/màu — mỗi dòng tên + SL lưu thành 1 phiếu riêng trên grid"}
                            </p>
                          </div>
                          {!isEditMode ? (
                            <button
                              type="button"
                              onClick={addPartLine}
                              disabled={partSaving || partLines.length >= 20}
                              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50"
                            >
                              <Plus size={16} />
                              Thêm linh kiện
                            </button>
                          ) : null}
                        </div>
                        <div className="grid gap-3">
                          {partLines.map((line, idx) => (
                            <div
                              key={line.key}
                              className="grid gap-2 rounded-lg border border-line bg-white p-3 sm:grid-cols-[minmax(0,1fr)_7.5rem_auto] sm:items-end"
                            >
                              <Field label={`Tên linh kiện #${idx + 1}`} required>
                                <input
                                  value={line.name}
                                  onChange={(e) =>
                                    updatePartLine(line.key, { name: e.target.value })
                                  }
                                  autoComplete="off"
                                  placeholder="Tên / model linh kiện"
                                  className="h-11 w-full rounded-lg border border-line px-3 text-sm font-semibold outline-none ring-brand/30 focus:ring-2"
                                />
                              </Field>
                              <Field label="SL" required>
                                <div className="flex h-11 w-full overflow-hidden rounded-lg border border-line bg-white focus-within:ring-2 focus-within:ring-brand/30">
                                  <input
                                    value={line.quantity}
                                    onChange={(e) =>
                                      updatePartLine(line.key, {
                                        quantity: e.target.value.replace(/[^\d]/g, ""),
                                      })
                                    }
                                    onBlur={() => {
                                      const n = Number(
                                        String(line.quantity || "").replace(/[^\d]/g, "")
                                      );
                                      if (!n || n < 1) {
                                        updatePartLine(line.key, { quantity: "1" });
                                      }
                                    }}
                                    autoComplete="off"
                                    inputMode="numeric"
                                    placeholder="1"
                                    className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-center text-sm font-black tabular-nums text-ink outline-none"
                                  />
                                  <div className="flex w-9 shrink-0 flex-col border-l border-line">
                                    <button
                                      type="button"
                                      onClick={() => bumpPartLineQty(line.key, 1)}
                                      disabled={partSaving}
                                      title="Tăng 1"
                                      className="inline-flex h-1/2 w-full items-center justify-center border-b border-line bg-slate-50 text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                                    >
                                      <Plus size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => bumpPartLineQty(line.key, -1)}
                                      disabled={partSaving}
                                      title="Giảm 1"
                                      className="inline-flex h-1/2 w-full items-center justify-center bg-slate-50 text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                                    >
                                      <Minus size={14} />
                                    </button>
                                  </div>
                                </div>
                              </Field>
                              {!isEditMode && partLines.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => removePartLine(line.key)}
                                  disabled={partSaving}
                                  title="Xóa dòng"
                                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-red-50 text-danger hover:bg-red-100 disabled:opacity-50 sm:mb-0"
                                >
                                  <Trash2 size={16} />
                                </button>
                              ) : (
                                <span className="hidden sm:block" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <p className="text-xs font-semibold text-muted">
                        Chọn hoặc nhập NPP / loại / hãng / màu một lần. Bấm «Thêm linh kiện»
                        để thêm dòng tên + SL. Hãng và màu không bắt buộc.
                      </p>
                      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
                        <button
                          type="button"
                          onClick={closePartInboundForm}
                          disabled={partSaving}
                          className="inline-flex h-11 items-center rounded-lg border border-line bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Hủy
                        </button>
                        <button
                          type="submit"
                          disabled={partSaving}
                          className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50"
                        >
                          {partSaving ? (
                            <>
                              <Loader2 size={18} className="animate-spin" />
                              Đang lưu…
                            </>
                          ) : isEditMode ? (
                            <>
                              <Edit3 size={18} />
                              Cập nhật phiếu
                            </>
                          ) : (
                            <>
                              <Plus size={18} />
                              {partLines.filter((l) => l.name.trim()).length > 1
                                ? "Lưu " + partLines.filter((l) => l.name.trim()).length + " phiếu"
                                : "Lưu phiếu nhập"}
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </section>
                </div>
              ) : null}

              <section className="overflow-hidden rounded-xl border border-line bg-white shadow-panel">
                <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-black text-ink">Danh sách nhập</h3>
                    <p className="text-xs font-semibold text-muted">
                      Sắp xếp ngày → NPP → loại → hãng · {activeCount.toLocaleString("vi-VN")} bản ghi
                      · trang {safePartPage}/{partTotalPages}
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
                    <label className="grid gap-0.5 sm:min-w-[11rem]">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
                        Nhà phân phối
                      </span>
                      <select
                        value={partDistributorFilter}
                        onChange={(e) => {
                          setPartDistributorFilter(e.target.value);
                          setPartTypeFilter("all");
                          setPartPage(1);
                          setSelectedPartIds([]);
                        }}
                        className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-bold outline-none ring-brand/30 focus:ring-2"
                      >
                        <option value="all">Tất cả NPP</option>
                        {distributorFilterOptions.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-0.5 sm:min-w-[11rem]">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
                        Loại
                      </span>
                      <select
                        value={effectiveTypeFilter}
                        onChange={(e) => {
                          setPartTypeFilter(e.target.value);
                          setPartPage(1);
                          setSelectedPartIds([]);
                        }}
                        className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-bold outline-none ring-brand/30 focus:ring-2"
                      >
                        <option value="all">Tất cả loại</option>
                        {typeFilterOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="relative min-w-0 flex-1 sm:min-w-[14rem]">
                      <Search
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                      />
                      <input
                        value={partSearch}
                        onChange={(e) => {
                          setPartSearch(e.target.value);
                          setPartPage(1);
                          setSelectedPartIds([]);
                        }}
                        placeholder="Tìm loại, hãng, tên, màu…"
                        className="h-10 w-full rounded-lg border border-line bg-slate-50 py-2 pl-9 pr-3 text-sm font-semibold outline-none ring-brand/30 focus:bg-white focus:ring-2"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={partSaving || selectedPartIds.length === 0}
                      onClick={() => void deleteSelectedPartInbounds()}
                      className="inline-flex h-10 shrink-0 items-center gap-2 self-end rounded-lg bg-red-50 px-3 text-sm font-bold text-danger ring-1 ring-red-200 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {partSaving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                      Xóa đã chọn
                      {selectedPartIds.length > 0 ? ` (${selectedPartIds.length})` : ""}
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr className="border-b border-line text-xs font-black uppercase tracking-wide text-muted">
                        <th className="w-10 px-2 py-3 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-brand"
                            checked={allPageSelected}
                            disabled={pageIds.length === 0 || partSaving}
                            title="Chọn tất cả trên trang"
                            onChange={(e) => {
                              const on = e.target.checked;
                              setSelectedPartIds((prev) => {
                                if (on) {
                                  const set = new Set(prev);
                                  pageIds.forEach((id) => set.add(id));
                                  return Array.from(set);
                                }
                                return prev.filter((id) => !pageIds.includes(id));
                              });
                            }}
                          />
                        </th>
                        <th className="whitespace-nowrap px-3 py-3">Ngày</th>
                        <th className="whitespace-nowrap px-3 py-3">CH</th>
                        <th className="min-w-[9rem] px-3 py-3">Nhà phân phối</th>
                        <th className="whitespace-nowrap px-3 py-3">Loại</th>
                        <th className="whitespace-nowrap px-3 py-3">Hãng</th>
                        <th className="min-w-[9rem] px-3 py-3">Tên LK</th>
                        <th className="whitespace-nowrap px-3 py-3">Màu</th>
                        <th className="whitespace-nowrap px-3 py-3 text-right">SL</th>
                        <th className="whitespace-nowrap px-3 py-3 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCount === 0 ? (
                        <tr>
                          <td
                            colSpan={10}
                            className="px-4 py-10 text-center text-sm font-semibold text-muted"
                          >
                            Chưa có phiếu nhập phù hợp.
                          </td>
                        </tr>
                      ) : (
                        pagedList.map((row) => {
                          const checked = selectedPartIds.includes(row.id);
                          return (
                          <tr
                            key={row.id}
                            className={`border-b border-line/80 last:border-0 hover:bg-slate-50/80 ${
                              editingPartId === row.id
                                ? "bg-brand-soft/40"
                                : checked
                                  ? "bg-amber-50/70"
                                  : ""
                            }`}
                          >
                            <td className="px-2 py-2.5 text-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 cursor-pointer accent-brand"
                                checked={checked}
                                disabled={partSaving}
                                title="Chọn để xóa"
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  setSelectedPartIds((prev) =>
                                    on
                                      ? prev.includes(row.id)
                                        ? prev
                                        : [...prev, row.id]
                                      : prev.filter((x) => x !== row.id)
                                  );
                                }}
                              />
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">
                              {formatDateVi(row.createdAt)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-xs font-bold text-muted">
                              {storeName(row.storeId)}
                            </td>
                            <td className="px-3 py-2.5 font-bold text-ink">{row.distributor}</td>
                            <td className="px-3 py-2.5">
                              <span className="inline-flex rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-dark">
                                {row.partType}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">
                              {row.brand?.trim() ? row.brand : "—"}
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-ink">{row.partName}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">
                              {row.color?.trim() ? row.color : "—"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right font-black text-ink">
                              {row.quantity.toLocaleString("vi-VN")}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-nowrap items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditPartInboundForm(row.id)}
                                  title="Sửa"
                                  disabled={partSaving}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand transition hover:bg-brand/20 disabled:opacity-45"
                                >
                                  <Edit3 size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openClonePartInboundForm(row.id)}
                                  title="Nhân bản"
                                  disabled={partSaving}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-700 transition hover:bg-sky-100 disabled:opacity-45"
                                >
                                  <CopyPlus size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deletePartInbound(row.id)}
                                  title="Xóa"
                                  disabled={partSaving}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-danger transition hover:bg-red-100 disabled:opacity-45"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col gap-3 border-t border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <span className="text-sm font-semibold text-muted">
                      Hiển thị{" "}
                      <strong className="text-ink">
                        {activeCount === 0 ? 0 : partStart + 1}–
                        {Math.min(partStart + partPageSize, activeCount)}
                      </strong>{" "}
                      / tổng{" "}
                      <strong className="text-ink">{activeCount.toLocaleString("vi-VN")}</strong>{" "}
                      bản ghi
                      {activeCount > 0 ? (
                        <span className="ml-1 text-muted">
                          (trang {safePartPage}/{partTotalPages})
                        </span>
                      ) : null}
                    </span>
                    {activeCount > 0 ? (
                      <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand"
                          checked={
                            list.length > 0 &&
                            list.every((r) => selectedPartIds.includes(r.id))
                          }
                          disabled={partSaving}
                          onChange={(e) => {
                            const on = e.target.checked;
                            const allIds = list.map((r) => r.id);
                            setSelectedPartIds((prev) => {
                              if (on) {
                                const set = new Set(prev);
                                allIds.forEach((id) => set.add(id));
                                return Array.from(set);
                              }
                              return prev.filter((id) => !allIds.includes(id));
                            });
                          }}
                        />
                        Chọn tất cả theo lọc ({activeCount})
                        {selectedVisibleCount > 0 ? (
                          <span className="font-semibold text-muted">
                            · đã chọn {selectedPartIds.length}
                          </span>
                        ) : null}
                      </label>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={safePartPage <= 1}
                      onClick={() => setPartPage((p) => Math.max(1, p - 1))}
                      className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-white px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <ChevronLeft size={16} />
                      Trước
                    </button>
                    <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">
                      {safePartPage}
                    </span>
                    <button
                      type="button"
                      disabled={safePartPage >= partTotalPages}
                      onClick={() => setPartPage((p) => Math.min(partTotalPages, p + 1))}
                      className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-white px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Sau
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </section>
            </section>
          );
        })()}

        {activePage === "inbound" && (
          <section className="grid gap-4">
            <div className="rounded-xl border border-line bg-white p-8 shadow-panel">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Cpu size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-ink">Linh kiện</h2>
                  <p className="mt-2 text-sm font-semibold text-muted">
                    Menu đã sẵn sàng. Tính năng quản lý linh kiện sẽ được phát triển sau.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {activePage === "inventory" && (
          <section className="grid gap-4">
            <section className="rounded-lg border border-line bg-white shadow-panel">
              <div className="border-b border-line p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-black">Danh sách kho hàng</h2>
                    <p className="text-sm font-semibold text-muted">Tìm kiếm nâng cao theo loại, tên máy, khoảng giá. Gõ tìm nhanh sẽ sắp xếp theo tên rồi giá.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex w-fit rounded-lg border border-line bg-slate-100 p-1">
                      <button
                        onClick={() => {
                          setInventoryTab("phones");
                          setInventoryTypeFilter("all");
                          setInventoryBrandFilter("all");
                          setInventoryPage(1);
                        }}
                        className={`rounded-md px-3 py-2 text-sm font-bold ${inventoryTab === "phones" ? "bg-white text-brand shadow-sm" : "text-muted"}`}
                      >
                        Điện thoại
                      </button>
                      <button
                        onClick={() => {
                          setInventoryTab("accessories");
                          setInventoryTypeFilter("all");
                          setInventoryBrandFilter("all");
                          setInventoryPage(1);
                        }}
                        className={`rounded-md px-3 py-2 text-sm font-bold ${inventoryTab === "accessories" ? "bg-white text-brand shadow-sm" : "text-muted"}`}
                      >
                        Phụ kiện
                      </button>
                    </div>
                    {inventoryTab === "accessories" ? (
                      <button
                        type="button"
                        onClick={() => setIsAccessorySensitiveHidden((v) => !v)}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
                        title={
                          isAccessorySensitiveHidden
                            ? "Hiện giá nhập và lợi nhuận"
                            : "Ẩn giá nhập và lợi nhuận"
                        }
                      >
                        {isAccessorySensitiveHidden ? <EyeOff size={18} /> : <Eye size={18} />}
                        {isAccessorySensitiveHidden ? "Hiện" : "Ẩn"}
                      </button>
                    ) : null}
                    {inventoryTab === "phones" ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!filteredPhones.length) {
                            showUiToast("error", "Không có máy để xuất Excel.");
                            return;
                          }
                          try {
                            const { fileName, count } = downloadPhonesExcel(filteredPhones);
                            showUiToast("success", `Đã xuất ${count} máy → ${fileName}`);
                          } catch (err) {
                            showUiToast("error", `Xuất Excel thất bại: ${toUiError(err)}`);
                          }
                        }}
                        disabled={!filteredPhones.length}
                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-black text-ink shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Xuất danh sách máy (theo bộ lọc hiện tại) ra Excel"
                      >
                        <FileSpreadsheet size={17} className="text-brand" />
                        Xuất Excel
                      </button>
                    ) : null}
                    <button onClick={() => openInventoryCreateModal(inventoryTab)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-black text-white hover:bg-brand-dark">
                      <Plus size={17} />
                      Thêm vào kho
                    </button>
                  </div>
                </div>
                {inventoryTab === "accessories" ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(11rem,auto)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
                    <div className="flex h-10 items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3">
                      <span className="min-w-0 truncate text-sm font-bold text-emerald-700">Số lượng đã bán</span>
                      <strong className="shrink-0 text-lg font-black tabular-nums text-emerald-700">
                        {isStatsHidden
                          ? "***"
                          : sales
                              .filter(
                                (s) =>
                                  s.itemType === "Phụ kiện" &&
                                  s.status === "Hoàn tất" &&
                                  (storeFilter === "all" || s.storeId === storeFilter)
                              )
                              .reduce((sum, s) => sum + s.quantity, 0)}
                      </strong>
                    </div>
                    <input
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setInventoryPage(1);
                      }}
                      className="h-10 rounded-lg border border-line bg-white px-3 font-semibold outline-none focus:border-brand"
                      placeholder="Mã hàng..."
                      autoComplete="off"
                    />
                    <input
                      value={inventoryNameFilter}
                      onChange={(event) => {
                        setInventoryNameFilter(event.target.value);
                        setInventoryPage(1);
                      }}
                      className="h-10 rounded-lg border border-line bg-white px-3 font-semibold outline-none focus:border-brand"
                      placeholder="Tên phụ kiện..."
                      autoComplete="off"
                    />
                    <select
                      value={inventoryTypeFilter}
                      onChange={(event) => {
                        setInventoryTypeFilter(event.target.value);
                        setInventoryPage(1);
                      }}
                      className="h-10 rounded-lg border border-line bg-white px-3 font-semibold"
                    >
                      <option value="all">Tất cả danh mục</option>
                      {accessoryFilterCategoryOptions.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_repeat(5,minmax(0,1fr))]">
                    <label className="relative">
                      <Search className="pointer-events-none absolute left-3 top-2.5 text-muted" size={18} />
                      <input
                        value={query}
                        onChange={(event) => {
                          setQuery(event.target.value);
                          setInventoryPage(1);
                        }}
                        className="h-10 w-full rounded-lg border border-line bg-slate-50 pl-10 pr-3 font-semibold outline-none transition focus:border-brand focus:bg-white"
                        placeholder="Tìm nhanh IMEI, mã hàng..."
                      />
                    </label>
                    <input
                      value={inventoryNameFilter}
                      onChange={(event) => {
                        setInventoryNameFilter(event.target.value);
                        setInventoryPage(1);
                      }}
                      className="h-10 rounded-lg border border-line bg-white px-3 font-semibold outline-none focus:border-brand"
                      placeholder="Tên máy..."
                    />
                    <select
                      value={inventoryBrandFilter}
                      onChange={(event) => {
                        setInventoryBrandFilter(event.target.value);
                        setInventoryPage(1);
                      }}
                      className="h-10 rounded-lg border border-line bg-white px-3 font-semibold"
                    >
                      <option value="all">Tất cả hãng</option>
                      {filterBrandOptions.map((brand) => (
                        <option key={brand} value={brand}>
                          {brand}
                        </option>
                      ))}
                    </select>
                    <select
                      value={inventoryTypeFilter}
                      onChange={(event) => {
                        setInventoryTypeFilter(event.target.value);
                        setInventoryPage(1);
                      }}
                      className="h-10 rounded-lg border border-line bg-white px-3 font-semibold"
                    >
                      <option value="all">Tất cả loại máy</option>
                      {inventoryTypeOptions.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <select
                      value={inventoryPriceRange}
                      onChange={(event) => {
                        setInventoryPriceRange(event.target.value);
                        setInventoryPage(1);
                      }}
                      className="h-10 rounded-lg border border-line bg-white px-3 font-semibold"
                    >
                      <option value="all">Mọi mức giá</option>
                      <option value="u1m">Dưới 1 triệu</option>
                      <option value="1m-2m">1 - 2 triệu</option>
                      <option value="2m-4m">2 - 4 triệu</option>
                      <option value="4m-6m">4 - 6 triệu</option>
                      <option value="6m-10m">6 - 10 triệu</option>
                      <option value="o10m">Trên 10 triệu</option>
                    </select>
                    <select
                      value={inventoryStatusFilter}
                      onChange={(event) => {
                        setInventoryStatusFilter(event.target.value);
                        setInventoryPage(1);
                      }}
                      className="h-10 rounded-lg border border-line bg-white px-3 font-semibold"
                    >
                      <option value="all">Tất cả trạng thái</option>
                      <option value="Còn hàng">Còn hàng</option>
                      <option value="Đã bán">Đã bán</option>
                      <option value="Chưa xử lý">Chưa xử lý</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 p-4">
                {inventoryTab === "phones" ? (
                  <aside className="grid gap-2 sm:grid-cols-3">
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                      <span className="min-w-0 text-sm font-bold text-emerald-700">Số lượng đã bán</span>
                      <strong className="shrink-0 text-xl font-black tabular-nums text-emerald-700">
                        {isStatsHidden
                          ? "***"
                          : phones.filter(
                              (p) => p.status === "Đã bán" && (storeFilter === "all" || p.storeId === storeFilter)
                            ).length}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5">
                      <span className="min-w-0 text-sm font-bold text-sky-700">Số lượng còn hàng</span>
                      <strong className="shrink-0 text-xl font-black tabular-nums text-sky-700">
                        {isStatsHidden
                          ? "***"
                          : phones.filter(
                              (p) => p.status === "Còn hàng" && (storeFilter === "all" || p.storeId === storeFilter)
                            ).length}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                      <span className="min-w-0 text-sm font-bold text-amber-700">Số lượng chưa xử lý</span>
                      <strong className="shrink-0 text-xl font-black tabular-nums text-amber-700">
                        {isStatsHidden
                          ? "***"
                          : phones.filter(
                              (p) => p.status === "Chưa xử lý" && (storeFilter === "all" || p.storeId === storeFilter)
                            ).length}
                      </strong>
                    </div>
                  </aside>
                ) : null}

                <div className="min-w-0">
              {inventoryTab === "phones" ? (
                <DataTable
                  compact
                  headers={["Tên máy", "Dung lượng", "IMEI", "Giá bán", "Màu sắc", "Dung lượng pin", "Pin", "Thao tác"]}
                  rows={paginatedPhones.map((item) => [
                    <div key={`name-${item.id}`} className="flex flex-col items-center gap-1.5">
                      <div className="flex items-center justify-center gap-2 text-lg font-black text-brand">{item.name}</div>
                      <span className="text-sm font-semibold text-slate-500">{item.brand} • <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-600">{item.condition}</span></span>
                    </div>,
                    <span className="text-base font-bold text-slate-800" key={`storage-${item.id}`}>{item.storage}</span>,
                    <span className="font-mono text-xl font-black tracking-wide text-red-600" key={`imei-${item.id}`}>{item.imei.slice(-5)}</span>,
                    <span className="text-lg font-black text-emerald-600" key={`price-${item.id}`}>{formatMoney(item.expectedPrice)}</span>,
                    <div key={`color-${item.id}`} className="flex items-center justify-center gap-2">
                      <ColorDot color={item.color} />
                      <span className="text-base font-medium text-slate-700">{item.color}</span>
                    </div>,
                    <span className="text-base font-bold text-slate-700" key={`batcap-${item.id}`}>{item.batteryCapacity || "—"}</span>,
                    <div className="flex items-center justify-center gap-1.5 text-base font-bold text-amber-600" key={`bat-${item.id}`}>{item.batteryCondition}</div>,
                    <div key={item.id} className="flex flex-nowrap justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setViewingPhoneId(item.id)}
                        title="Chi tiết"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
                      >
                        <Eye size={18} />
                      </button>
                      {item.status === "Đã bán" ? (
                        <button
                          type="button"
                          onClick={() => void deleteSoldPhoneItem(item.id)}
                          title="Xóa máy (xóa hẳn)"
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-danger transition hover:bg-red-100"
                        >
                          <Trash2 size={18} />
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => openPhoneEditModal(item.id)}
                            title="Sửa"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand transition hover:bg-brand/20"
                          >
                            <Edit3 size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openPhoneCloneModal(item.id)}
                            title="Nhân bản thêm mới"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 transition hover:bg-sky-100"
                          >
                            <CopyPlus size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openUnsoldPhoneHardDelete(item.id)}
                            title="Xóa cứng máy chưa bán"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-danger transition hover:bg-red-100"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>,
                  ])}
                />
              ) : (
                <DataTable
                  compact
                  headers={[
                    "Mã",
                    "Danh mục",
                    "Hãng",
                    "Tên phụ kiện",
                    "SL",
                    "Giá bán",
                    "Giá nhập",
                    "Lợi nhuận",
                    "Thao tác",
                  ]}
                  rows={paginatedAccessories.map((item) => [
                    <span className="font-mono text-sm font-medium text-slate-500" key={`code-${item.id}`}>{item.code}</span>,
                    <span className="text-sm font-semibold text-slate-700" key={`cat-${item.id}`}>{item.category || "—"}</span>,
                    <span className="text-sm font-semibold text-slate-700" key={`brand-${item.id}`}>{item.brand || "—"}</span>,
                    <div key={`name-${item.id}`} className="flex flex-col items-center gap-0.5">
                      <span className="text-lg font-black text-brand">{item.name}</span>
                      {item.note ? (
                        <span className="max-w-[12rem] truncate text-xs font-semibold text-muted" title={item.note}>
                          {item.note}
                        </span>
                      ) : null}
                    </div>,
                    <span className="text-base font-bold text-slate-800" key={`qty-${item.id}`}>{item.quantity}</span>,
                    <span className="text-lg font-black text-emerald-600" key={`price-${item.id}`}>{formatMoney(item.price)}</span>,
                    <span className="text-base font-medium text-slate-600" key={`cost-${item.id}`}>
                      {isAccessorySensitiveHidden ? "***" : formatMoney(item.cost)}
                    </span>,
                    <span className="text-base font-bold text-amber-600" key={`profit-${item.id}`}>
                      {isAccessorySensitiveHidden ? "***" : formatMoney(item.price - item.cost)}
                    </span>,
                    <div key={item.id} className="flex flex-nowrap justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setViewingAccessoryId(item.id)}
                        title="Chi tiết"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openAccessoryEditModal(item.id)}
                        title="Sửa"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand transition hover:bg-brand/20"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openAccessoryCloneModal(item.id)}
                        title="Nhân bản thêm mới"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 transition hover:bg-sky-100"
                      >
                        <CopyPlus size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteAccessoryItem(item.id)}
                        title="Xóa phụ kiện"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-danger transition hover:bg-red-100"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>,
                  ])}
                />
              )}

              <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-semibold text-muted">
                  Hiển thị {inventoryRowsCount === 0 ? 0 : inventoryStart + 1}-{Math.min(inventoryStart + inventoryPageSize, inventoryRowsCount)} / {inventoryRowsCount}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={safeInventoryPage === 1}
                    onClick={() => setInventoryPage((page) => Math.max(1, page - 1))}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-white px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <ChevronLeft size={16} />
                    Trước
                  </button>
                  <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">{safeInventoryPage}</span>
                  <button
                    disabled={safeInventoryPage === inventoryTotalPages}
                    onClick={() => setInventoryPage((page) => Math.min(inventoryTotalPages, page + 1))}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-white px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Sau
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
                </div>
              </div>
            </section>

            {isInventoryModalOpen && (
              <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-md">
                <section
                  className={`relative max-h-[92vh] w-full overflow-auto rounded-2xl border border-white/20 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.4)] backdrop-blur-xl ${
                    inventoryTab === "accessories" ? "max-w-[768px]" : "max-w-[860px]"
                  }`}
                >
                  {inventorySaving ? (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/55 backdrop-blur-sm">
                      <Loader2 size={40} className="animate-spin text-brand" />
                      <p className="text-base font-black text-ink">Đang lưu…</p>
                    </div>
                  ) : null}
                  <div
                    className={`sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200/60 bg-white/80 backdrop-blur-md ${
                      inventoryTab === "accessories" ? "p-3 sm:p-4" : "items-start gap-4 p-5"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <h2
                        className={`font-black text-slate-800 ${
                          inventoryTab === "accessories" ? "text-lg sm:text-xl" : "text-2xl"
                        }`}
                      >
                        {inventoryTab === "phones"
                          ? editingPhone
                            ? "Sửa máy trong kho"
                            : clonePhoneDraft
                              ? "Thêm máy (nhân bản)"
                              : "Thêm máy vào kho"
                          : editingAccessory
                            ? "Sửa phụ kiện"
                            : cloneAccessoryDraft
                              ? "Thêm phụ kiện (nhân bản)"
                              : "Thêm phụ kiện"}
                      </h2>
                      {inventoryTab === "phones" && !editingPhone && clonePhoneDraft ? (
                        <p className="mt-1 text-sm font-semibold text-sky-700">
                          Đã copy đầy đủ thông tin máy mẫu — sửa bất kỳ ô nào nếu cần, rồi lưu máy mới (IMEI không được trùng).
                        </p>
                      ) : null}
                      {inventoryTab === "accessories" && !editingAccessory && cloneAccessoryDraft ? (
                        <p className="mt-1 text-sm font-semibold text-sky-700">
                          Đã copy đầy đủ thông tin phụ kiện mẫu — sửa bất kỳ ô nào nếu cần, rồi lưu thành phụ kiện mới.
                        </p>
                      ) : null}
                    </div>
                    {inventoryTab === "accessories" ? (
                      <div className="flex min-w-0 shrink-0 items-center gap-2">
                        <span className="hidden text-xs font-bold text-muted sm:inline">Cửa hàng</span>
                        {currentUser.role === "owner" ? (
                          <select
                            value={accessoryFormStoreId}
                            disabled={inventorySaving}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "store-1" || v === "store-2" || v === "store-3") {
                                setAccessoryFormStoreId(v);
                              }
                            }}
                            className="h-9 max-w-[11rem] rounded-lg border border-line bg-white px-2 text-sm font-semibold text-ink outline-none focus:border-brand disabled:opacity-50 sm:max-w-[13rem]"
                            aria-label="Cửa hàng"
                          >
                            {stores.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex h-9 max-w-[11rem] items-center truncate rounded-lg border border-line bg-slate-50 px-2 text-sm font-semibold text-slate-700 sm:max-w-[13rem]">
                            {storeName(currentUser.storeId)}
                          </div>
                        )}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={closeInventoryModal}
                      disabled={inventorySaving}
                      className="h-9 shrink-0 rounded-xl border border-slate-200/60 bg-white/50 px-4 text-sm font-black text-slate-600 backdrop-blur-md transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Đóng
                    </button>
                  </div>
                  <div
                    className={`${inventoryTab === "accessories" ? "p-3 sm:p-4" : "p-5"} ${
                      inventorySaving ? "pointer-events-none select-none" : ""
                    }`}
                  >
                    {inventoryBackendError ? (
                      <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-danger">
                        {inventoryBackendError}
                      </div>
                    ) : null}
                    {inventoryTab === "phones" ? (
                      <form key={editingPhone?.id ?? (clonePhoneDraft ? `clone-${cloneFormKey}` : "new-phone")} onSubmit={savePhone} className="grid gap-3" autoComplete="off" spellCheck={false}>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {currentUser.role === "owner" ? (
                            <SelectField
                              label="Cửa hàng"
                              name="storeId"
                              options={stores.map((s) => [s.id, s.name])}
                              defaultValue={phoneFormStoreId}
                              onValueChange={(v) => {
                                if (v === "store-1" || v === "store-2" || v === "store-3") {
                                  setPhoneFormStoreId(v);
                                }
                              }}
                            />
                          ) : (
                            <Field label="Cửa hàng">
                              <input type="hidden" name="storeId" value={currentUser.storeId} />
                              <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                                {storeName(currentUser.storeId)}
                              </div>
                            </Field>
                          )}
                          <div className="hidden sm:block" aria-hidden />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <ManageableSelect label="Hãng" name="brand" options={brandOptions} setOptions={setFormLookupOptions(PHONE_LOOKUP_CATEGORIES.brand)} defaultValue={phoneFormDefaults?.brand} categoryCode={PHONE_LOOKUP_CATEGORIES.brand} storeId={phoneFormStoreId} onRenameCascade={reloadInventoryFromDb} allowManage actorUsername={currentUser.username} />
                          <ManageableSelect label="Tên máy" name="name" options={nameOptions} setOptions={setFormLookupOptions(PHONE_LOOKUP_CATEGORIES.modelName)} defaultValue={phoneFormDefaults?.name} categoryCode={PHONE_LOOKUP_CATEGORIES.modelName} storeId={phoneFormStoreId} onRenameCascade={reloadInventoryFromDb} allowManage actorUsername={currentUser.username} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="IMEI">
                            <input
                              name="imei"
                              required
                              defaultValue={phoneFormDefaults?.imei}
                              placeholder={clonePhoneDraft && !editingPhone ? "Sửa IMEI nếu trùng máy gốc" : undefined}
                              className="h-10 rounded-lg border border-line px-3"
                            />
                          </Field>
                          <SelectField label="Trạng thái" name="status" options={["Còn hàng", "Đã bán", "Đã hủy", "Chưa xử lý"].map((status) => [status, status])} defaultValue={phoneFormDefaults?.status ?? "Còn hàng"} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <ManageableSelect label="Màu sắc" name="color" options={colorOptions} setOptions={setFormLookupOptions(PHONE_LOOKUP_CATEGORIES.color)} defaultValue={phoneFormDefaults?.color} categoryCode={PHONE_LOOKUP_CATEGORIES.color} storeId={phoneFormStoreId} onRenameCascade={reloadInventoryFromDb} allowManage actorUsername={currentUser.username} />
                          <ManageableSelect label="Dung lượng máy" name="storage" options={storageOptions} setOptions={setFormLookupOptions(PHONE_LOOKUP_CATEGORIES.storage)} defaultValue={phoneFormDefaults?.storage} categoryCode={PHONE_LOOKUP_CATEGORIES.storage} storeId={phoneFormStoreId} onRenameCascade={reloadInventoryFromDb} allowManage actorUsername={currentUser.username} sortable />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <ManageableSelect label="Quốc gia" name="madeIn" options={madeInOptions} setOptions={setFormLookupOptions(PHONE_LOOKUP_CATEGORIES.madeIn)} defaultValue={phoneFormDefaults?.madeIn} required={false} categoryCode={PHONE_LOOKUP_CATEGORIES.madeIn} storeId={phoneFormStoreId} onRenameCascade={reloadInventoryFromDb} allowManage actorUsername={currentUser.username} />
                          <ManageableSelect label="Tình trạng máy" name="condition" options={conditionOptions} setOptions={setFormLookupOptions(PHONE_LOOKUP_CATEGORIES.condition)} defaultValue={phoneFormDefaults?.condition} categoryCode={PHONE_LOOKUP_CATEGORIES.condition} storeId={phoneFormStoreId} onRenameCascade={reloadInventoryFromDb} allowManage actorUsername={currentUser.username} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <ManageableSelect label="Tình trạng pin" name="batteryCondition" options={batteryOptions} setOptions={setFormLookupOptions(PHONE_LOOKUP_CATEGORIES.batteryCondition)} defaultValue={phoneFormDefaults?.batteryCondition} categoryCode={PHONE_LOOKUP_CATEGORIES.batteryCondition} storeId={phoneFormStoreId} onRenameCascade={reloadInventoryFromDb} allowManage actorUsername={currentUser.username} />
                          <ManageableSelect label="Dung lượng pin" name="batteryCapacity" options={batteryCapacityOptions} setOptions={setFormLookupOptions(PHONE_LOOKUP_CATEGORIES.batteryCapacity)} defaultValue={phoneFormDefaults?.batteryCapacity} required={false} categoryCode={PHONE_LOOKUP_CATEGORIES.batteryCapacity} storeId={phoneFormStoreId} onRenameCascade={reloadInventoryFromDb} allowManage actorUsername={currentUser.username} sortable />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-1">
                          <Field label="Ghi chú"><input name="note" defaultValue={phoneFormDefaults?.note} className="h-10 rounded-lg border border-line px-3" /></Field>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Ngày nhập"><input name="importDate" type="date" defaultValue={phoneFormDefaults?.importDate || vnNowDate()} className="h-10 rounded-lg border border-line px-3" /></Field>
                          <Field label="Ngày bán"><input name="saleDate" type="date" defaultValue={phoneFormDefaults?.saleDate} className="h-10 rounded-lg border border-line px-3" /></Field>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Giá nhập"><MoneyInput name="cost" defaultValue={phoneFormDefaults?.cost} /></Field>
                          <Field label="Giá bán"><MoneyInput name="expectedPrice" defaultValue={phoneFormDefaults?.expectedPrice} /></Field>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-line pt-4">
                          <button type="button" onClick={closeInventoryModal} disabled={inventorySaving} className="h-10 rounded-lg border border-line bg-white px-4 font-bold text-muted disabled:opacity-50">Hủy</button>
                          <button type="submit" disabled={inventorySaving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70">
                            {inventorySaving ? <Loader2 size={18} className="animate-spin" /> : editingPhone ? <Edit3 size={18} /> : clonePhoneDraft ? <CopyPlus size={18} /> : <Plus size={18} />}
                            {inventorySaving ? "Đang lưu…" : editingPhone ? "Lưu sửa" : clonePhoneDraft ? "Lưu máy mới" : "Thêm máy"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form
                        key={editingAccessory?.id ?? (cloneAccessoryDraft ? `clone-acc-${cloneAccessoryFormKey}` : "new-accessory")}
                        onSubmit={saveAccessory}
                        className="grid gap-2.5"
                        autoComplete="off"
                        spellCheck={false}
                      >
                        {/* Cửa hàng chọn trên header — hidden để FormData / saveAccessory */}
                        <input type="hidden" name="storeId" value={accessoryFormStoreId} />
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          <ManageableSelect
                            label="Danh mục"
                            name="category"
                            options={accessoryCategoryOptions}
                            setOptions={setFormLookupOptions(ACCESSORY_LOOKUP_CATEGORIES.category, accessoryFormStoreId)}
                            defaultValue={accessoryFormDefaults?.category}
                            categoryCode={ACCESSORY_LOOKUP_CATEGORIES.category}
                            storeId={accessoryFormStoreId}
                            onRenameCascade={reloadInventoryFromDb}
                            allowManage
                            actorUsername={currentUser.username}
                          />
                          <ManageableSelect
                            label="Hãng"
                            name="brand"
                            options={accessoryBrandOptions}
                            setOptions={setFormLookupOptions(ACCESSORY_LOOKUP_CATEGORIES.brand, accessoryFormStoreId)}
                            defaultValue={accessoryFormDefaults?.brand}
                            categoryCode={ACCESSORY_LOOKUP_CATEGORIES.brand}
                            storeId={accessoryFormStoreId}
                            onRenameCascade={reloadInventoryFromDb}
                            allowManage
                            actorUsername={currentUser.username}
                          />
                        </div>
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          <ManageableSelect
                            label="Mã hàng"
                            name="code"
                            options={accessoryCodeOptions}
                            setOptions={setFormLookupOptions(ACCESSORY_LOOKUP_CATEGORIES.code, accessoryFormStoreId)}
                            defaultValue={accessoryFormDefaults?.code ?? ""}
                            required
                            categoryCode={ACCESSORY_LOOKUP_CATEGORIES.code}
                            storeId={accessoryFormStoreId}
                            onRenameCascade={reloadInventoryFromDb}
                            allowManage
                            allowFreeText
                            actorUsername={currentUser.username}
                          />
                          <ManageableSelect
                            label="Tên hàng"
                            name="name"
                            options={accessoryNameOptions}
                            setOptions={setFormLookupOptions(ACCESSORY_LOOKUP_CATEGORIES.name, accessoryFormStoreId)}
                            defaultValue={accessoryFormDefaults?.name ?? ""}
                            required
                            categoryCode={ACCESSORY_LOOKUP_CATEGORIES.name}
                            storeId={accessoryFormStoreId}
                            onRenameCascade={reloadInventoryFromDb}
                            allowManage
                            allowFreeText
                            actorUsername={currentUser.username}
                          />
                        </div>
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          <Field label="Số lượng" required>
                            <input
                              name="quantity"
                              type="text"
                              inputMode="numeric"
                              pattern="[1-9][0-9]*"
                              required
                              defaultValue={
                                accessoryFormDefaults != null && accessoryFormDefaults.quantity > 0
                                  ? String(accessoryFormDefaults.quantity)
                                  : ""
                              }
                              placeholder=""
                              autoComplete="off"
                              onInput={(e) => {
                                const el = e.currentTarget;
                                // Chỉ giữ chữ số; bỏ 0 dẫn đầu (trừ khi rỗng)
                                const digits = el.value.replace(/\D/g, "");
                                el.value = digits.replace(/^0+/, "");
                              }}
                              className="h-10 rounded-lg border border-line bg-white px-3"
                            />
                          </Field>
                          <SelectField
                            label="Trạng thái"
                            name="status"
                            options={["Còn hàng", "Hết hàng", "Đã hủy"].map((status) => [status, status])}
                            defaultValue={accessoryFormDefaults?.status ?? "Còn hàng"}
                          />
                        </div>
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          <ManageableSelect
                            label="Giá bán"
                            name="price"
                            options={accessoryPriceOptions}
                            setOptions={setFormLookupOptions(ACCESSORY_LOOKUP_CATEGORIES.price, accessoryFormStoreId)}
                            defaultValue={
                              accessoryFormDefaults != null
                                ? formatInputMoney(accessoryFormDefaults.price ?? 0)
                                : ""
                            }
                            required
                            categoryCode={ACCESSORY_LOOKUP_CATEGORIES.price}
                            storeId={accessoryFormStoreId}
                            onRenameCascade={reloadInventoryFromDb}
                            allowManage
                            allowFreeText
                            actorUsername={currentUser.username}
                          />
                          <ManageableSelect
                            label="Giá nhập"
                            name="cost"
                            options={accessoryCostOptions}
                            setOptions={setFormLookupOptions(ACCESSORY_LOOKUP_CATEGORIES.cost, accessoryFormStoreId)}
                            defaultValue={
                              accessoryFormDefaults != null
                                ? formatInputMoney(accessoryFormDefaults.cost ?? 0)
                                : ""
                            }
                            required
                            categoryCode={ACCESSORY_LOOKUP_CATEGORIES.cost}
                            storeId={accessoryFormStoreId}
                            onRenameCascade={reloadInventoryFromDb}
                            allowManage
                            allowFreeText
                            actorUsername={currentUser.username}
                          />
                        </div>
                        <div className="grid gap-2.5 sm:grid-cols-1">
                          <Field label="Ghi chú">
                            <input name="note" defaultValue={accessoryFormDefaults?.note} className="h-10 rounded-lg border border-line px-3" />
                          </Field>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-line pt-3">
                          <button type="button" onClick={closeInventoryModal} disabled={inventorySaving} className="h-10 rounded-lg border border-line bg-white px-4 font-bold text-muted disabled:opacity-50">Hủy</button>
                          <button type="submit" disabled={inventorySaving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70">
                            {inventorySaving ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : editingAccessory ? (
                              <Edit3 size={14} />
                            ) : cloneAccessoryDraft ? (
                              <CopyPlus size={14} />
                            ) : (
                              <Plus size={14} />
                            )}
                            {inventorySaving
                              ? "Đang lưu…"
                              : editingAccessory
                                ? "Lưu sửa"
                                : cloneAccessoryDraft
                                  ? "Lưu phụ kiện mới"
                                  : "Thêm phụ kiện"}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </section>
              </div>
            )}

            {phoneHardDeleteTarget && (
              <div
                className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-md"
                role="dialog"
                aria-modal="true"
                aria-labelledby="phone-hard-delete-title"
                onClick={closePhoneHardDeleteModal}
              >
                <section
                  className="relative w-full max-w-[440px] overflow-hidden rounded-2xl border border-white/20 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.4)] backdrop-blur-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {phoneHardDeleting ? (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/55 backdrop-blur-sm">
                      <Loader2 className="h-8 w-8 animate-spin text-danger" />
                      <p className="text-sm font-bold text-slate-700">Đang xóa máy…</p>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between border-b border-slate-200/60 bg-gradient-to-r from-red-50 to-transparent p-5">
                    <h2 id="phone-hard-delete-title" className="text-lg font-black text-danger">
                      Xóa cứng máy
                    </h2>
                    <button
                      type="button"
                      onClick={closePhoneHardDeleteModal}
                      disabled={phoneHardDeleting}
                      className="h-9 rounded-xl border border-slate-200/60 bg-white/50 px-4 text-sm font-bold text-slate-600 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Đóng
                    </button>
                  </div>
                  <div className="grid gap-4 p-5">
                    <p className="text-sm font-semibold leading-relaxed text-slate-700">
                      Bạn sắp xóa hẳn máy{" "}
                      <strong className="text-ink">
                        {phoneHardDeleteTarget.label}
                        {phoneHardDeleteTarget.imeiHint}
                      </strong>{" "}
                      khỏi danh sách / hệ thống.
                    </p>
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                      Thao tác không hoàn tác được. Để xác nhận, hãy gõ chính xác{" "}
                      <span className="font-black tracking-wide">YES</span> vào ô bên dưới.
                    </p>
                    <Field label='Gõ "YES" để xác nhận'>
                      <input
                        type="text"
                        value={phoneHardDeleteYes}
                        onChange={(e) => setPhoneHardDeleteYes(e.target.value)}
                        disabled={phoneHardDeleting}
                        autoFocus
                        autoComplete="off"
                        placeholder="YES"
                        className="h-11 w-full rounded-lg border border-line bg-white px-3 font-mono text-base font-black tracking-wider text-ink outline-none ring-danger/30 focus:ring-2 disabled:opacity-50"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && phoneHardDeleteYes === "YES" && !phoneHardDeleting) {
                            e.preventDefault();
                            void confirmUnsoldPhoneHardDelete();
                          }
                        }}
                      />
                    </Field>
                    <div className="flex flex-wrap justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={closePhoneHardDeleteModal}
                        disabled={phoneHardDeleting}
                        className="h-10 rounded-lg border border-line bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={() => void confirmUnsoldPhoneHardDelete()}
                        disabled={phoneHardDeleting || phoneHardDeleteYes !== "YES"}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-danger px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                        Xóa cứng
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {viewingPhone && (
              <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-md">
                <section className="max-h-[92vh] w-full max-w-[860px] overflow-auto rounded-2xl border border-white/20 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.4)] backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-slate-200/60 bg-gradient-to-r from-brand/10 to-transparent p-5">
                    <h2 className="text-xl font-black text-brand">Chi tiết máy</h2>
                    <button onClick={() => setViewingPhoneId(null)} className="h-9 rounded-xl border border-slate-200/60 bg-white/50 px-4 text-sm font-bold text-slate-600 backdrop-blur-md transition hover:bg-white hover:text-slate-900">Đóng</button>
                  </div>
                  <div className="grid gap-4 p-5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                        <Smartphone size={24} />
                      </div>
                      <div>
                        <strong className="block text-lg">{viewingPhone.name}</strong>
                        <span className="text-sm font-semibold text-muted">{viewingPhone.brand}</span>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Hãng"><div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-slate-800">{viewingPhone.brand}</div></Field>
                        <Field label="Tên máy"><div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-slate-800">{viewingPhone.name}</div></Field>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="IMEI"><div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 font-mono text-slate-800">{viewingPhone.imei}</div></Field>
                        <Field label="Trạng thái">
                          <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3">
                            <StatusBadge tone={viewingPhone.status === "Còn hàng" ? "ok" : viewingPhone.status === "Đã bán" ? "warn" : viewingPhone.status === "Chưa xử lý" ? "neutral" : "danger"}>{viewingPhone.status}</StatusBadge>
                          </div>
                        </Field>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Màu sắc">
                          <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 text-slate-800">
                            <ColorDot color={viewingPhone.color} />
                            {viewingPhone.color}
                          </div>
                        </Field>
                        <Field label="Dung lượng máy"><div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-slate-800">{viewingPhone.storage}</div></Field>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Quốc gia"><div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-slate-800">{viewingPhone.madeIn}</div></Field>
                        <Field label="Tình trạng máy"><div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-slate-800">{viewingPhone.condition}</div></Field>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Tình trạng pin"><div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-slate-800">{viewingPhone.batteryCondition}</div></Field>
                        <Field label="Dung lượng pin"><div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-slate-800">{viewingPhone.batteryCapacity || "Không rõ"}</div></Field>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-1">
                        <Field label="Ghi chú"><div className="flex min-h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 py-2 text-slate-800">{viewingPhone.note || "Không có ghi chú"}</div></Field>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Ngày nhập"><div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-slate-800">{viewingPhone.importDate ? formatDateVi(viewingPhone.importDate) : "Chưa có"}</div></Field>
                        <Field label="Ngày bán"><div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-slate-800">{viewingPhone.saleDate ? formatDateVi(viewingPhone.saleDate) : "Chưa bán"}</div></Field>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Mã máy"><div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 font-mono text-slate-800">{viewingPhone.id}</div></Field>
                        <Field label="Cửa hàng"><div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-slate-800">{storeName(viewingPhone.storeId)}</div></Field>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Giá nhập"><div className="flex h-12 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-2xl font-black text-red-500">{formatMoney(viewingPhone.cost)}</div></Field>
                        <Field label="Giá bán"><div className="flex h-12 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-2xl font-black text-emerald-600">{formatMoney(viewingPhone.expectedPrice)}</div></Field>
                        <Field label="Lợi nhuận"><div className="flex h-12 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-2xl font-black text-amber-600">{formatMoney(viewingPhone.expectedPrice - viewingPhone.cost)}</div></Field>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {viewingAccessory && (
              <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-md">
                <section className="max-h-[92vh] w-full max-w-[640px] overflow-auto rounded-2xl border border-white/20 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.4)] backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-slate-200/60 bg-gradient-to-r from-brand/10 to-transparent p-5">
                    <h2 className="text-xl font-black text-brand">Chi tiết phụ kiện</h2>
                    <button
                      type="button"
                      onClick={() => setViewingAccessoryId(null)}
                      className="h-9 rounded-xl border border-slate-200/60 bg-white/50 px-4 text-sm font-bold text-slate-600 backdrop-blur-md transition hover:bg-white hover:text-slate-900"
                    >
                      Đóng
                    </button>
                  </div>
                  <div className="grid gap-4 p-5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                        <PackagePlus size={24} />
                      </div>
                      <div>
                        <strong className="block text-lg">{viewingAccessory.name}</strong>
                        <span className="text-sm font-semibold text-muted">
                          {viewingAccessory.code}
                          {viewingAccessory.brand ? ` • ${viewingAccessory.brand}` : ""}
                        </span>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Danh mục">
                          <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-slate-800">
                            {viewingAccessory.category || "—"}
                          </div>
                        </Field>
                        <Field label="Hãng">
                          <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-slate-800">
                            {viewingAccessory.brand || "—"}
                          </div>
                        </Field>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Mã hàng">
                          <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 font-mono text-slate-800">
                            {viewingAccessory.code}
                          </div>
                        </Field>
                        <Field label="Tên hàng">
                          <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-slate-800">
                            {viewingAccessory.name}
                          </div>
                        </Field>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Số lượng">
                          <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-slate-800">
                            {viewingAccessory.quantity}
                          </div>
                        </Field>
                        <Field label="Trạng thái">
                          <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3">
                            <StatusBadge
                              tone={
                                viewingAccessory.status === "Còn hàng"
                                  ? "ok"
                                  : viewingAccessory.status === "Hết hàng"
                                    ? "warn"
                                    : "danger"
                              }
                            >
                              {viewingAccessory.status}
                            </StatusBadge>
                          </div>
                        </Field>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Cửa hàng">
                          <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-slate-800">
                            {storeName(viewingAccessory.storeId)}
                          </div>
                        </Field>
                        <Field label="Ghi chú">
                          <div className="flex min-h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 py-2 text-slate-800">
                            {viewingAccessory.note || "Không có ghi chú"}
                          </div>
                        </Field>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Giá bán">
                          <div className="flex h-12 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-2xl font-black text-emerald-600">
                            {formatMoney(viewingAccessory.price)}
                          </div>
                        </Field>
                        <Field label="Giá nhập">
                          <div className="flex h-12 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-2xl font-black text-red-500">
                            {isAccessorySensitiveHidden ? "***" : formatMoney(viewingAccessory.cost)}
                          </div>
                        </Field>
                        <Field label="Lợi nhuận">
                          <div className="flex h-12 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-2xl font-black text-amber-600">
                            {isAccessorySensitiveHidden
                              ? "***"
                              : formatMoney(viewingAccessory.price - viewingAccessory.cost)}
                          </div>
                        </Field>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          const id = viewingAccessory.id;
                          setViewingAccessoryId(null);
                          openAccessoryEditModal(id);
                        }}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 font-bold text-white hover:bg-brand-dark"
                      >
                        <Edit3 size={16} />
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const id = viewingAccessory.id;
                          setViewingAccessoryId(null);
                          openAccessoryCloneModal(id);
                        }}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-50 px-4 font-bold text-sky-700 hover:bg-sky-100"
                      >
                        <CopyPlus size={16} />
                        Nhân bản
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteAccessoryItem(viewingAccessory.id)}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-50 px-4 font-bold text-danger hover:bg-red-100"
                      >
                        <Trash2 size={16} />
                        Xóa
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </section>
        )}

        {activePage === "software" && (
          <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-line bg-white p-1.5 shadow-panel">
            <button
              type="button"
              onClick={() => setSoftwareHubTab("repair")}
              className={`inline-flex h-10 items-center rounded-lg px-4 text-sm font-black transition ${
                softwareHubTab === "repair"
                  ? "bg-brand text-white shadow-sm"
                  : "bg-transparent text-muted hover:bg-slate-50 hover:text-ink"
              }`}
            >
              Sửa chữa
            </button>
            <button
              type="button"
              onClick={() => setSoftwareHubTab("ban-ga")}
              className={`inline-flex h-10 items-center rounded-lg px-4 text-sm font-black transition ${
                softwareHubTab === "ban-ga"
                  ? "bg-brand text-white shadow-sm"
                  : "bg-transparent text-muted hover:bg-slate-50 hover:text-ink"
              }`}
            >
              Bán Gà
            </button>
          </div>
        )}

        {showSalesUi && (
          <section className="grid gap-4">
            {/* KPI tháng / ngày — tương tự phần mềm */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="block text-sm font-bold text-emerald-800">Doanh thu & lãi tháng</span>
                  <input
                    type="month"
                    value={saleMonth}
                    onChange={(e) => setSaleMonth(e.target.value)}
                    className="h-8 rounded border border-emerald-200 bg-white px-2 text-sm font-semibold text-emerald-800"
                  />
                </div>
                <strong className="text-3xl text-emerald-700">
                  {isSaleSensitiveHidden ? "***" : formatMoney(saleStats.monthlyRevenue)}
                </strong>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-200/50 pt-2 text-sm font-semibold text-emerald-700/90">
                  <span>
                    Lãi:{" "}
                    {isSaleSensitiveHidden ? "***" : formatMoney(saleStats.monthlyProfit)}
                  </span>
                  <span>{saleStats.monthlyCount} phiếu</span>
                </div>
              </div>
              <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="block text-sm font-bold text-slate-500">Doanh thu & lãi ngày</span>
                  <input
                    type="date"
                    value={saleStats.displayDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="h-8 rounded border border-line bg-slate-50 px-2 text-sm font-semibold text-slate-700"
                  />
                </div>
                <strong className="text-3xl text-red-600">
                  {isSaleSensitiveHidden ? "***" : formatMoney(saleStats.dailyRevenue)}
                </strong>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-sm font-semibold text-slate-500">
                  <span>
                    Lãi: {isSaleSensitiveHidden ? "***" : formatMoney(saleStats.dailyProfit)}
                  </span>
                  <span>{saleStats.dailyCount} phiếu</span>
                </div>
              </div>
            </div>

            <Panel title="Danh sách bán hàng">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={saleStatusFilter}
                    onChange={(e) =>
                      setSaleStatusFilter(e.target.value as typeof saleStatusFilter)
                    }
                    className="h-10 rounded-lg border border-line px-3 text-sm font-bold"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="Hoàn tất">Hoàn tất</option>
                    <option value="Đã hủy">Đã hủy</option>
                  </select>
                  <select
                    value={saleTypeFilter}
                    onChange={(e) => setSaleTypeFilter(e.target.value as typeof saleTypeFilter)}
                    className="h-10 rounded-lg border border-line px-3 text-sm font-bold"
                  >
                    <option value="all">Tất cả loại</option>
                    <option value="Máy">Máy</option>
                    <option value="Phụ kiện">Phụ kiện</option>
                  </select>
                  <select
                    value={salePaymentFilter}
                    onChange={(e) =>
                      setSalePaymentFilter(e.target.value as typeof salePaymentFilter)
                    }
                    className="h-10 rounded-lg border border-line px-3 text-sm font-bold"
                  >
                    <option value="all">Tất cả TT</option>
                    <option value="paid">✅ Đã thanh toán</option>
                    <option value="partial">⚠️ Thanh toán 1 phần</option>
                    <option value="debt">❌ NỢ DAI</option>
                  </select>
                  <div className="flex items-center gap-2 rounded-lg border border-line bg-slate-50 px-2">
                    <span className="text-sm font-semibold text-slate-500">Lọc ngày:</span>
                    <input
                      type="date"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                      className="h-8 rounded border border-line px-2 text-sm"
                    />
                    {saleDate ? (
                      <button
                        type="button"
                        onClick={() => setSaleDate("")}
                        className="text-sm font-bold text-brand hover:underline"
                      >
                        Tất cả tháng
                      </button>
                    ) : null}
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 text-muted" size={16} />
                    <input
                      value={saleSearch}
                      onChange={(e) => setSaleSearch(e.target.value)}
                      placeholder="Tìm khách / hàng…"
                      className="h-10 w-48 rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-sm font-semibold outline-none focus:border-brand sm:w-56"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSaleSensitiveHidden((v) => !v)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
                  >
                    {isSaleSensitiveHidden ? <EyeOff size={18} /> : <Eye size={18} />}
                    {isSaleSensitiveHidden ? "Hiện" : "Ẩn"}
                  </button>
                  <button
                    type="button"
                    onClick={openSaleModal}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white shadow hover:bg-brand-dark"
                  >
                    <Plus size={18} />
                    Tạo phiếu mới
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto pb-2">
                <DataTable
                  headers={[
                    "Ngày",
                    "Khách",
                    "Hàng",
                    "Tổng tiền",
                    "Giá nhập",
                    "Lãi",
                    "Thanh toán",
                    "Thao tác",
                  ]}
                  rows={filteredSales.map((item) => {
                    const custName =
                      item.customerName ||
                      customers.find((c) => c.id === item.customerId)?.name ||
                      "Khách lẻ";
                    const payUi = salePayStatusLabel(item.payment, item.status);
                    const costShort =
                      item.cost != null
                        ? item.cost
                        : Math.max(
                            0,
                            Math.round((Number(item.amount) || 0) - (Number(item.profit) || 0))
                          );
                    return [
                      item.createdAt,
                      <span key={`c-${item.id}`} className="font-bold text-brand whitespace-nowrap">
                        {custName}
                      </span>,
                      <span key={`i-${item.id}`} className="font-semibold text-slate-700">
                        {item.itemName}
                        {item.quantity > 1 ? ` (${item.quantity})` : ""}
                      </span>,
                      <span key={`a-${item.id}`} className="font-black text-ink">
                        {isSaleSensitiveHidden ? "***" : formatMoney(item.amount)}
                      </span>,
                      <span key={`cost-${item.id}`} className="font-semibold text-slate-600">
                        {isSaleSensitiveHidden ? "***" : formatMoney(costShort)}
                      </span>,
                      <span key={`p-${item.id}`} className="font-black text-emerald-700">
                        {isSaleSensitiveHidden ? "***" : formatMoney(item.profit)}
                      </span>,
                      <span
                        key={`st-${item.id}`}
                        className={`inline-flex h-8 items-center rounded px-2 text-xs font-bold shadow-sm ${payUi.className}`}
                      >
                        {payUi.text}
                      </span>,
                      <div
                        key={`act-${item.id}`}
                        className="flex flex-nowrap items-center justify-center gap-1.5"
                      >
                        <button
                          type="button"
                          onClick={() => openSaleView(item.id)}
                          title="Chi tiết"
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void openSaleEditModal(item.id)}
                          title="Sửa"
                          disabled={item.status === "Đã hủy" || saleSaving}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand transition hover:bg-brand/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Edit3 size={16} />
                        </button>
                        {canCancel && item.status === "Hoàn tất" ? (
                          <button
                            type="button"
                            onClick={() => void cancelSale(item.id)}
                            title="Xóa phiếu"
                            disabled={saleSaving}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-danger transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : null}
                      </div>,
                    ];
                  })}
                />
              </div>
              {filteredSales.length === 0 ? (
                <p className="mt-2 text-center text-sm font-semibold text-muted">
                  Không có phiếu khớp bộ lọc.
                </p>
              ) : (
                <p className="mt-2 text-xs font-semibold text-muted">
                  Hiển thị {filteredSales.length} phiếu (DB).
                </p>
              )}

              {/* Tổng theo hình thức TT — gọn, 1 hàng ngoài grid */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-line bg-slate-50/80 px-3 py-2 text-xs font-semibold">
                <span className="font-black text-ink">Theo TT:</span>
                <span className="text-emerald-700">
                  TM{" "}
                  <strong className="tabular-nums">
                    {isSaleSensitiveHidden ? "***" : formatMoney(salePayTotals.cash.amount)}
                  </strong>
                  <span className="ml-1 text-muted">({salePayTotals.cash.count})</span>
                </span>
                <span className="text-sky-700">
                  CK{" "}
                  <strong className="tabular-nums">
                    {isSaleSensitiveHidden ? "***" : formatMoney(salePayTotals.transfer.amount)}
                  </strong>
                  <span className="ml-1 text-muted">({salePayTotals.transfer.count})</span>
                </span>
                <span className="text-red-700">
                  Nợ{" "}
                  <strong className="tabular-nums">
                    {isSaleSensitiveHidden ? "***" : formatMoney(salePayTotals.debt.amount)}
                  </strong>
                  <span className="ml-1 text-muted">({salePayTotals.debt.count})</span>
                </span>
                <span className="ml-auto text-muted">
                  Tổng{" "}
                  <strong className="tabular-nums text-ink">
                    {isSaleSensitiveHidden ? "***" : formatMoney(salePayTotals.totalAmount)}
                  </strong>
                  <span className="ml-1">({salePayTotals.totalCount})</span>
                  <span className="mx-1.5 text-line">·</span>
                  Lãi{" "}
                  <strong className="tabular-nums text-emerald-700">
                    {isSaleSensitiveHidden ? "***" : formatMoney(salePayTotals.totalProfit)}
                  </strong>
                </span>
              </div>
            </Panel>

            {isSaleModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-md">
                <section className="relative my-2 max-h-[94vh] w-full max-w-xl overflow-auto rounded-xl border border-white/20 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.4)] backdrop-blur-xl sm:max-w-2xl">
                  {saleSaving ? (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 rounded-xl bg-white/55 backdrop-blur-sm">
                      <Loader2 size={32} className="animate-spin text-brand" />
                      <p className="text-sm font-black text-ink">
                        {isSaleReadOnly
                          ? "Đang tải phiếu…"
                          : editingSaleId
                            ? "Đang lưu…"
                            : "Đang tạo phiếu…"}
                      </p>
                    </div>
                  ) : null}
                  <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200/60 bg-white/90 px-3 py-2.5 backdrop-blur-md">
                    <div className="min-w-0">
                      <h2 className="text-base font-black text-slate-800 sm:text-lg">
                        {isSaleReadOnly
                          ? `Chi tiết phiếu ${salesPageTitle}`
                          : editingSaleId
                            ? `Sửa phiếu ${salesPageTitle}`
                            : `Tạo phiếu ${salesPageTitle}`}
                      </h2>
                      {isSaleReadOnly ? (
                        <p className="text-[11px] font-semibold text-muted">Chỉ xem — không chỉnh sửa</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={closeSaleModal}
                      disabled={saleSaving}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-muted hover:bg-slate-50 disabled:opacity-50"
                      title="Đóng"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <form id="sale-create-form" onSubmit={createSale} className="grid gap-2 p-3">
                    {/* 2 nút tab lên đầu form — thay «Thêm máy» cũ, phân biệt rõ Bán PK / Bán Máy */}
                    {!isSaleReadOnly ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            // Giữ bảo hành khi rời tab Máy (ManageableSelect unmount).
                            if (saleModalTab === "phone") {
                              const form = document.getElementById(
                                "sale-create-form"
                              ) as HTMLFormElement | null;
                              if (form) {
                                const fd = new FormData(form);
                                setSaleWarranty(
                                  String(fd.get("saleWarranty") ?? "").trim()
                                );
                              }
                            }
                            setSaleModalTab("accessory");
                          }}
                          className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-black shadow-sm ring-1 transition ${
                            saleModalTab === "accessory"
                              ? "bg-amber-500 text-white ring-amber-400 hover:bg-amber-600"
                              : "bg-white text-amber-800 ring-amber-200 hover:bg-amber-50"
                          }`}
                        >
                          <PackagePlus size={17} />
                          Bán Phụ Kiện
                        </button>
                        <button
                          type="button"
                          onClick={() => setSaleModalTab("phone")}
                          className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-black shadow-sm ring-1 transition ${
                            saleModalTab === "phone"
                              ? "bg-indigo-600 text-white ring-indigo-400 hover:bg-indigo-700"
                              : "bg-white text-indigo-700 ring-indigo-200 hover:bg-indigo-50"
                          }`}
                        >
                          <Smartphone size={17} />
                          Bán Máy
                        </button>
                      </div>
                    ) : null}

                    <div className="grid gap-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="grid gap-0.5">
                          <span className="text-xs font-bold text-slate-700">Cửa hàng</span>
                          {currentUser?.role === "staff" || isSaleReadOnly ? (
                            <>
                              <input type="hidden" value={saleStoreId} readOnly />
                              <div className="flex h-9 items-center rounded-md border border-line bg-slate-50 px-2.5 text-sm font-bold text-ink">
                                {storeName(saleStoreId)}
                              </div>
                            </>
                          ) : (
                            <select
                              value={saleStoreId}
                              onChange={(e) => {
                                const next = e.target.value as Exclude<StoreId, "all">;
                                setSaleStoreId(next);
                                setSaleCart((prev) =>
                                  prev.filter((l) => {
                                    if (l.kind !== "phone") return true;
                                    const ph = phones.find((p) => p.id === l.phoneId);
                                    return ph?.storeId === next;
                                  })
                                );
                              }}
                              className="h-9 rounded-md border border-line bg-white px-2.5 text-sm font-semibold"
                            >
                              {stores.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </label>
                        <label className="grid gap-0.5">
                          <span className="text-xs font-bold text-slate-700">
                            Ngày bán {!isSaleReadOnly ? <span className="text-red-500">*</span> : null}
                          </span>
                          <input
                            type="datetime-local"
                            required={!isSaleReadOnly}
                            value={saleSoldAt}
                            onChange={(e) => setSaleSoldAt(e.target.value)}
                            readOnly={isSaleReadOnly}
                            disabled={isSaleReadOnly}
                            className={`h-9 rounded-md border border-line px-2 text-sm font-semibold outline-none focus:border-brand ${
                              isSaleReadOnly ? "cursor-default bg-slate-50 text-slate-700" : "bg-white"
                            }`}
                          />
                        </label>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="grid gap-0.5">
                          <span className="text-xs font-bold text-slate-700">
                            Hình thức thanh toán {!isSaleReadOnly ? <span className="text-red-500">*</span> : null}
                          </span>
                          <select
                            required={!isSaleReadOnly}
                            value={salePayMethod}
                            onChange={(e) => setSalePayMethod(e.target.value as SalePayMethod)}
                            disabled={isSaleReadOnly}
                            className={`h-9 rounded-md border border-line px-2.5 text-sm font-semibold ${
                              isSaleReadOnly ? "cursor-default bg-slate-50 text-slate-700" : "bg-white"
                            }`}
                          >
                            {SALE_PAY_METHOD_OPTIONS.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-0.5">
                          <span className="text-xs font-bold text-slate-700">
                            Trạng thái thanh toán {!isSaleReadOnly ? <span className="text-red-500">*</span> : null}
                          </span>
                          <select
                            required={!isSaleReadOnly}
                            value={salePayStatus}
                            onChange={(e) => setSalePayStatus(e.target.value as SalePayStatus)}
                            disabled={isSaleReadOnly}
                            className={`h-9 rounded-md border border-line px-2.5 text-sm font-semibold ${
                              isSaleReadOnly ? "cursor-default bg-slate-50 text-slate-700" : "bg-white"
                            }`}
                          >
                            {SALE_PAY_STATUS_OPTIONS.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>

                    {/* Nội dung theo tab — ẩn khi chỉ xem */}
                    {!isSaleReadOnly ? (
                      <>
                        {saleModalTab === "accessory" ? (
                          <div className="relative overflow-hidden rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-orange-50/40 to-white p-2.5 shadow-sm ring-1 ring-amber-100/80">
                            <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-amber-200/30 blur-2xl" />
                            <div className="relative mb-1.5 flex items-center gap-1.5">
                              <span className="grid h-7 w-7 place-items-center rounded-md bg-amber-100 text-amber-700 ring-1 ring-amber-200/80">
                                <PackagePlus size={14} />
                              </span>
                              <p className="text-sm font-black text-amber-950">Thêm phụ kiện</p>
                            </div>
                            <div className="relative grid gap-3">
                              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_6.5rem_auto] sm:items-end">
                                <div className="grid min-w-0 gap-1.5">
                                  <span className="text-sm font-bold text-amber-950">Tên phụ kiện</span>
                                  <div className="min-w-0 [&_label>span]:hidden">
                                    <ManageableSelect
                                      key={`sale-acc-name-${saleAccFormKey}-${saleStoreId}`}
                                      label="Tên phụ kiện"
                                      name="saleAccName"
                                      options={saleAccNameOptions}
                                      setOptions={setSaleAccNameOptions}
                                      defaultValue={saleAccDefaultName}
                                      required={false}
                                      categoryCode={ACCESSORY_LOOKUP_CATEGORIES.name}
                                      storeId={saleStoreId}
                                      onRenameCascade={reloadInventoryFromDb}
                                      allowManage
                                      allowFreeText
                                      actorUsername={currentUser?.username ?? ""}
                                      onManageNotify={(type, message) => showUiToast(type, message)}
                                    />
                                  </div>
                                </div>
                                <div className="grid gap-1.5">
                                  <span className="text-sm font-bold text-amber-950">Số lượng</span>
                                  <input
                                    type="number"
                                    min={1}
                                    value={saleAccQty}
                                    onChange={(e) => setSaleAccQty(Math.max(1, Number(e.target.value) || 1))}
                                    className="h-10 w-full rounded-lg border border-amber-200/70 bg-white px-2 text-center text-sm font-semibold outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                                    title="Số lượng"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={addAccessoryToSaleCart}
                                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 text-sm font-bold text-white shadow-sm hover:bg-amber-600"
                                >
                                  <Plus size={16} />
                                  giỏ hàng
                                </button>
                              </div>
                              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                                <div className="grid min-w-0 gap-1.5">
                                  <span className="text-sm font-bold text-amber-950">
                                    Giá bán <span className="text-red-500">*</span>
                                  </span>
                                  <div
                                    className="min-w-0 [&_label>span]:hidden"
                                    title="Giá bán (đơn vị shop)"
                                  >
                                    <ManageableSelect
                                      key={`sale-acc-price-${saleAccFormKey}-${saleStoreId}`}
                                      label="Giá bán"
                                      name="saleAccPrice"
                                      options={saleAccPriceOptions}
                                      setOptions={setSaleAccPriceOptions}
                                      defaultValue=""
                                      required={false}
                                      categoryCode={ACCESSORY_LOOKUP_CATEGORIES.price}
                                      storeId={saleStoreId}
                                      onRenameCascade={reloadInventoryFromDb}
                                      allowManage
                                      allowFreeText
                                      actorUsername={currentUser?.username ?? ""}
                                      onManageNotify={(type, message) => showUiToast(type, message)}
                                    />
                                  </div>
                                </div>
                                <div className="grid min-w-0 gap-1.5">
                                  <span className="text-sm font-bold text-amber-950">Giá nhập</span>
                                  <div
                                    className="min-w-0 [&_label>span]:hidden"
                                    title="Giá nhập (đơn vị shop)"
                                  >
                                    <ManageableSelect
                                      key={`sale-acc-cost-${saleAccFormKey}-${saleStoreId}`}
                                      label="Giá nhập"
                                      name="saleAccCost"
                                      options={saleAccCostOptions}
                                      setOptions={setSaleAccCostOptions}
                                      defaultValue=""
                                      required={false}
                                      categoryCode={ACCESSORY_LOOKUP_CATEGORIES.cost}
                                      storeId={saleStoreId}
                                      onRenameCascade={reloadInventoryFromDb}
                                      allowManage
                                      allowFreeText
                                      actorUsername={currentUser?.username ?? ""}
                                      onManageNotify={(type, message) => showUiToast(type, message)}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid gap-2">
                            {/* Khách hàng — bắt buộc khi bán máy */}
                            <div className="rounded-lg border border-line/80 bg-slate-50/80 px-2.5 py-2">
                              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
                                <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-600">
                                  <Users size={13} className="text-muted" />
                                  Khách hàng
                                </p>
                                <button
                                  type="button"
                                  onClick={resetSaleCustomerToWalkIn}
                                  className="rounded-full border border-line bg-white px-2 py-0.5 text-[11px] font-bold text-muted hover:bg-white"
                                >
                                  Về khách lẻ
                                </button>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <label className="grid gap-0.5">
                                  <span className="text-xs font-bold text-slate-700">
                                    Tên khách <span className="text-red-500">*</span>
                                  </span>
                                  <div className="relative">
                                    <input
                                      value={saleCustomerName}
                                      onChange={(e) => {
                                        setSaleCustomerName(e.target.value);
                                        setSaleCustomerId(null);
                                        setSaleCustomerSuggestOpen(true);
                                      }}
                                      onFocus={() => setSaleCustomerSuggestOpen(true)}
                                      onBlur={() => {
                                        window.setTimeout(() => setSaleCustomerSuggestOpen(false), 180);
                                      }}
                                      required={saleCart.some((l) => l.kind === "phone")}
                                      className="h-9 w-full rounded-md border border-line bg-white px-2.5 text-sm font-semibold outline-none focus:border-brand"
                                      placeholder="Bắt buộc khi bán máy"
                                      autoComplete="off"
                                    />
                                    {saleCustomerSuggestOpen && saleCustomerSuggestions.length > 0 ? (
                                      <ul className="absolute z-20 mt-1 max-h-44 w-full overflow-auto rounded-lg border border-line bg-white py-1 shadow-panel">
                                        {saleCustomerSuggestions.map((c) => (
                                          <li key={c.id}>
                                            <button
                                              type="button"
                                              onMouseDown={(e) => e.preventDefault()}
                                              onClick={() => selectSaleCustomer(c)}
                                              className="flex w-full flex-col items-start px-2.5 py-1.5 text-left hover:bg-brand-soft"
                                            >
                                              <span className="text-sm font-bold text-ink">{c.name}</span>
                                              <span className="text-[11px] font-semibold text-muted">
                                                {c.phone || "Không SĐT"}
                                                {c.address ? ` · ${c.address}` : ""}
                                              </span>
                                            </button>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : null}
                                  </div>
                                </label>
                                <div className="grid min-w-0 gap-0.5">
                                  <span className="text-xs font-bold text-slate-700">Số điện thoại</span>
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    <input
                                      value={saleCustomerPhone}
                                      onChange={(e) => {
                                        setSaleCustomerPhone(e.target.value);
                                        setSaleCustomerId(null);
                                        setSaleCustomerSuggestOpen(true);
                                      }}
                                      onFocus={() => setSaleCustomerSuggestOpen(true)}
                                      onBlur={() => {
                                        window.setTimeout(() => setSaleCustomerSuggestOpen(false), 180);
                                      }}
                                      className="h-9 min-w-0 w-0 flex-[1_1_0%] max-w-[9.5rem] rounded-md border border-line bg-white px-2 text-sm font-semibold outline-none focus:border-brand sm:max-w-none sm:flex-[1_1_55%]"
                                      placeholder="SĐT"
                                      autoComplete="off"
                                    />
                                    <button
                                      type="button"
                                      onClick={handleSaveSaleCustomer}
                                      title="Lưu khách hàng"
                                      className="inline-flex h-9 min-w-0 flex-[1_1_45%] items-center justify-center gap-1.5 rounded-md border border-brand bg-brand-soft px-2.5 text-xs font-bold text-brand-dark hover:bg-brand hover:text-white sm:flex-none sm:px-3 sm:text-sm"
                                    >
                                      <Users size={14} />
                                      Lưu khách
                                    </button>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
                                <label className="grid min-w-0 gap-0.5">
                                  <span className="text-xs font-bold text-slate-700">Địa chỉ</span>
                                  <input
                                    value={saleCustomerAddress}
                                    onChange={(e) => {
                                      setSaleCustomerAddress(e.target.value);
                                      setSaleCustomerId(null);
                                    }}
                                    className="h-9 w-full rounded-md border border-line bg-white px-2.5 text-sm font-semibold outline-none focus:border-brand"
                                    placeholder="Không bắt buộc"
                                    autoComplete="off"
                                  />
                                </label>
                                <div className="grid min-w-0 gap-0.5">
                                  <span className="text-xs font-bold text-slate-700">Bảo hành</span>
                                  <div className="min-w-0 [&_label>span]:hidden">
                                    <ManageableSelect
                                      key={`sale-warranty-${saleWarrantyKey}-${saleStoreId}`}
                                      label="Bảo hành"
                                      name="saleWarranty"
                                      options={saleWarrantyOptions}
                                      setOptions={setSaleWarrantyOptions}
                                      defaultValue={saleWarranty}
                                      required={false}
                                      categoryCode={SALE_LOOKUP_CATEGORIES.warranty}
                                      storeId={saleStoreId}
                                      allowManage
                                      allowFreeText
                                      actorUsername={currentUser?.username ?? ""}
                                      onValueChange={setSaleWarranty}
                                      onManageNotify={(type, message) => showUiToast(type, message)}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Tặng PK — giá bán 0, vốn nhập trừ lãi máy */}
                            <div className="relative overflow-hidden rounded-xl border border-fuchsia-200/80 bg-gradient-to-br from-fuchsia-50 via-pink-50/40 to-white p-2.5 shadow-sm ring-1 ring-fuchsia-100/80">
                              <div className="relative mb-1.5 flex items-center gap-1.5">
                                <span className="grid h-7 w-7 place-items-center rounded-md bg-fuchsia-100 text-fuchsia-700 ring-1 ring-fuchsia-200/80">
                                  <PackagePlus size={14} />
                                </span>
                                <div>
                                  <p className="text-sm font-black text-fuchsia-950">Tặng PK</p>
                                  <p className="text-[11px] font-semibold text-muted">
                                    Giá tặng trừ vào lãi bán máy
                                  </p>
                                </div>
                              </div>
                              <div className="relative grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_7.5rem_auto] sm:items-end">
                                <div className="grid min-w-0 gap-1.5">
                                  <span className="text-sm font-bold text-fuchsia-950">Tên PK</span>
                                  <div className="min-w-0 [&_label>span]:hidden">
                                    <ManageableSelect
                                      key={`sale-gift-name-${saleGiftFormKey}-${saleStoreId}`}
                                      label="Tên PK tặng"
                                      name="saleGiftName"
                                      options={saleAccNameOptions}
                                      setOptions={setSaleAccNameOptions}
                                      defaultValue=""
                                      required={false}
                                      categoryCode={ACCESSORY_LOOKUP_CATEGORIES.name}
                                      storeId={saleStoreId}
                                      onRenameCascade={reloadInventoryFromDb}
                                      allowManage
                                      allowFreeText
                                      actorUsername={currentUser?.username ?? ""}
                                      onManageNotify={(type, message) => showUiToast(type, message)}
                                    />
                                  </div>
                                </div>
                                <div className="grid gap-1.5">
                                  <span className="text-sm font-bold text-fuchsia-950">Giá</span>
                                  <input
                                    inputMode="numeric"
                                    value={saleGiftCost}
                                    onChange={(e) => setSaleGiftCost(formatInputMoney(e.target.value))}
                                    className="h-10 w-full rounded-lg border border-fuchsia-200/80 bg-white px-2.5 text-sm font-bold text-fuchsia-950 outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-100"
                                    title="Giá vốn PK tặng (đơn vị shop) — trừ vào lãi"
                                    placeholder="0"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={addGiftAccessoryToSaleCart}
                                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-fuchsia-600 px-3.5 text-sm font-bold text-white shadow-sm hover:bg-fuchsia-700"
                                >
                                  <Plus size={16} />
                                  Thêm tặng
                                </button>
                              </div>
                            </div>

                            <div className="space-y-2 rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50 via-slate-50 to-white p-2.5 shadow-sm ring-1 ring-indigo-100/80">
                              <button
                                type="button"
                                onClick={() => {
                                  setSalePhoneListOpen((open) => {
                                    if (open) setSalePhoneSearch("");
                                    return !open;
                                  });
                                }}
                                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                                  salePhoneListOpen
                                    ? "bg-indigo-100/80 ring-1 ring-indigo-200"
                                    : "bg-white/80 ring-1 ring-indigo-100 hover:bg-indigo-50"
                                }`}
                              >
                                <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-indigo-800">
                                  <Smartphone size={13} />
                                  Máy còn hàng
                                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold normal-case tracking-normal text-indigo-700 ring-1 ring-indigo-200/80">
                                    {saleAvailablePhones.length} máy
                                  </span>
                                </span>
                                <span
                                  className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-bold ${
                                    salePhoneListOpen
                                      ? "bg-indigo-600 text-white"
                                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                                  }`}
                                >
                                  {salePhoneListOpen ? "Thu gọn" : "Chọn máy"}
                                  <ChevronDown
                                    size={14}
                                    className={`transition ${salePhoneListOpen ? "rotate-180" : ""}`}
                                  />
                                </span>
                              </button>
                              {salePhoneListOpen ? (
                                <>
                                  <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={16} />
                                    <input
                                      value={salePhoneSearch}
                                      onChange={(e) => setSalePhoneSearch(e.target.value)}
                                      placeholder="Tìm tên / IMEI / màu…"
                                      className="h-9 w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-semibold outline-none focus:border-indigo-400"
                                    />
                                  </div>
                                  <div className="max-h-48 space-y-1 overflow-auto rounded-lg border border-slate-200 bg-white p-1">
                                    {saleAvailablePhones.length === 0 ? (
                                      <p className="px-3 py-3 text-center text-sm font-semibold text-muted">
                                        Không còn máy tại cửa hàng này
                                      </p>
                                    ) : (
                                      saleAvailablePhones.map((p) => {
                                        const colorHex = p.color ? getColorCode(p.color) : "";
                                        const colorIsLight =
                                          !colorHex ||
                                          ["#ffffff", "#cbd5e1", "#e2e8f0", "#f8fafc", "#94a3b8", "#a8a29e"].includes(
                                            colorHex.toLowerCase()
                                          );
                                        return (
                                          <div
                                            key={p.id}
                                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-50"
                                          >
                                            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                                              <span className="shrink-0 text-sm font-black text-indigo-700">
                                                {p.brand} {p.name}
                                              </span>
                                              {p.color ? (
                                                <span
                                                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-black ring-1"
                                                  style={{
                                                    color: colorIsLight ? "#334155" : colorHex,
                                                    backgroundColor: colorIsLight ? "#f1f5f9" : `${colorHex}22`,
                                                    borderColor: colorIsLight ? "#cbd5e1" : `${colorHex}55`,
                                                  }}
                                                  title={p.color}
                                                >
                                                  <ColorDot color={p.color} size="sm" />
                                                  {p.color}
                                                </span>
                                              ) : null}
                                              {p.storage ? (
                                                <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                                                  {p.storage}
                                                </span>
                                              ) : null}
                                              <span className="min-w-0 truncate font-mono text-[11px] font-medium text-slate-400">
                                                {p.imei}
                                              </span>
                                            </div>
                                            <span className="shrink-0 text-sm font-black text-amber-800">
                                              {formatMoney(p.expectedPrice)}
                                            </span>
                                            <button
                                              type="button"
                                              title="Thêm vào giỏ"
                                              onClick={() => addPhoneToSaleCart(p)}
                                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 ring-1 ring-slate-200 hover:bg-indigo-600 hover:text-white"
                                            >
                                              <Plus size={15} />
                                            </button>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </>
                    ) : null}

                    {/* View-only: hiện khách nếu phiếu có máy */}
                    {isSaleReadOnly && saleCart.some((l) => l.kind === "phone") ? (
                      <div className="rounded-lg border border-line/80 bg-slate-50/80 px-2.5 py-2">
                        <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-600">
                          <Users size={13} className="text-muted" />
                          Khách hàng
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="grid gap-0.5">
                            <span className="text-xs font-bold text-slate-700">Tên khách</span>
                            <input
                              value={saleCustomerName}
                              readOnly
                              disabled
                              className="h-9 w-full cursor-default rounded-md border border-line bg-slate-50 px-2.5 text-sm font-semibold text-slate-700"
                            />
                          </label>
                          <label className="grid gap-0.5">
                            <span className="text-xs font-bold text-slate-700">Số điện thoại</span>
                            <input
                              value={saleCustomerPhone}
                              readOnly
                              disabled
                              className="h-9 w-full cursor-default rounded-md border border-line bg-slate-50 px-2.5 text-sm font-semibold text-slate-700"
                            />
                          </label>
                        </div>
                        {saleCustomerAddress || saleWarranty ? (
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {saleCustomerAddress ? (
                              <label className="grid gap-0.5">
                                <span className="text-xs font-bold text-slate-700">Địa chỉ</span>
                                <input
                                  value={saleCustomerAddress}
                                  readOnly
                                  disabled
                                  className="h-9 w-full cursor-default rounded-md border border-line bg-slate-50 px-2.5 text-sm font-semibold text-slate-700"
                                />
                              </label>
                            ) : null}
                            {saleWarranty ? (
                              <label className="grid gap-0.5">
                                <span className="text-xs font-bold text-slate-700">Bảo hành</span>
                                <input
                                  value={saleWarranty}
                                  readOnly
                                  disabled
                                  className="h-9 w-full cursor-default rounded-md border border-line bg-slate-50 px-2.5 text-sm font-semibold text-slate-700"
                                />
                              </label>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Giỏ — chỉ thông tin cần */}
                    <div className="rounded-xl border border-rose-200/80 bg-gradient-to-br from-rose-50 via-red-50/50 to-orange-50/40 p-3 shadow-sm ring-1 ring-rose-100">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="inline-flex items-center gap-2 text-sm font-black text-rose-950">
                          <span className="grid h-7 w-7 place-items-center rounded-md bg-red-600 text-white shadow-sm ring-1 ring-red-500/30">
                            <ShoppingCart size={14} />
                          </span>
                          Giỏ hàng
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800 ring-1 ring-red-200/80">
                            {saleCart.length}
                          </span>
                        </p>
                        {!isSaleReadOnly && saleCart.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setSaleCart([])}
                            className="text-xs font-bold text-danger hover:underline"
                          >
                            Xóa giỏ
                          </button>
                        ) : null}
                      </div>
                      {saleCart.length === 0 ? (
                        <p className="py-2 text-center text-sm font-semibold text-muted">Giỏ trống</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {saleCart.map((line) => {
                            const lineCost =
                              line.kind === "phone" ? line.cost : line.cost || 0;
                            return (
                            <li
                              key={line.key}
                              className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-1.5"
                            >
                              <div className="min-w-0 flex-1 basis-[10rem]">
                                {line.kind === "phone" ? (
                                  <p className="truncate text-sm font-bold text-ink">
                                    <span className="mr-1 font-black text-indigo-700">{line.name}</span>
                                    {line.color ? (
                                      <span className="font-semibold text-slate-500"> · {line.color}</span>
                                    ) : null}
                                    {line.storage ? (
                                      <span className="font-semibold text-slate-500"> · {line.storage}</span>
                                    ) : null}
                                    <span className="ml-1 font-mono text-[11px] font-medium text-slate-400">
                                      {line.imei}
                                    </span>
                                  </p>
                                ) : (
                                  <p className="truncate text-sm font-bold text-ink">
                                    <span className="mr-1 rounded bg-amber-50 px-1 py-0.5 text-[10px] font-black uppercase text-amber-800">
                                      PK
                                    </span>
                                    {line.name}
                                    <span className="ml-1 font-semibold text-muted">×{line.quantity}</span>
                                    {line.unitPrice === 0 ? (
                                      <span className="ml-1 rounded bg-fuchsia-50 px-1 py-0.5 text-[10px] font-black uppercase text-fuchsia-700 ring-1 ring-fuchsia-200">
                                        Tặng
                                      </span>
                                    ) : null}
                                  </p>
                                )}
                              </div>
                              {/* Giá nhập */}
                              <div className="flex shrink-0 flex-col items-end gap-0.5">
                                <span className="text-[10px] font-bold text-muted">Giá nhập</span>
                                {isSaleReadOnly || line.kind === "phone" ? (
                                  <span
                                    className="inline-flex h-8 min-w-[4.5rem] items-center justify-end rounded-md border border-line bg-slate-50 px-2 text-sm font-bold text-slate-700"
                                    title="Giá nhập (đơn vị shop)"
                                  >
                                    {isSaleSensitiveHidden ? "***" : formatMoney(lineCost)}
                                  </span>
                                ) : (
                                  <input
                                    inputMode="numeric"
                                    value={lineCost ? formatInputMoney(lineCost) : ""}
                                    onChange={(e) =>
                                      updateSaleCartCost(line.key, parseShopMoney(e.target.value))
                                    }
                                    className="h-8 w-20 rounded-md border border-line px-2 text-right text-sm font-bold text-slate-700 outline-none focus:border-brand"
                                    title="Giá nhập (đơn vị shop)"
                                    placeholder="0"
                                  />
                                )}
                              </div>
                              {/* Giá bán */}
                              <div className="flex shrink-0 flex-col items-end gap-0.5">
                                <span className="text-[10px] font-bold text-muted">Giá bán</span>
                                {line.kind === "accessory" && line.unitPrice === 0 ? (
                                  <span
                                    className="inline-flex h-8 min-w-[4.5rem] items-center justify-end rounded-md border border-fuchsia-200 bg-fuchsia-50 px-2 text-sm font-bold text-fuchsia-800"
                                    title="Giá bán 0 (tặng)"
                                  >
                                    {isSaleSensitiveHidden ? "***" : "0"}
                                  </span>
                                ) : isSaleReadOnly ? (
                                  <span className="inline-flex h-8 min-w-[4.5rem] items-center justify-end rounded-md border border-line bg-slate-50 px-2 text-sm font-bold text-emerald-700">
                                    {isSaleSensitiveHidden ? "***" : formatMoney(line.unitPrice)}
                                  </span>
                                ) : (
                                  <input
                                    inputMode="numeric"
                                    value={
                                      line.unitPrice ? formatInputMoney(line.unitPrice) : ""
                                    }
                                    onChange={(e) =>
                                      updateSaleCartUnitPrice(line.key, parseShopMoney(e.target.value))
                                    }
                                    className="h-8 w-20 rounded-md border border-line px-2 text-right text-sm font-bold text-emerald-700 outline-none focus:border-brand"
                                    title="Giá bán (đơn vị shop)"
                                  />
                                )}
                              </div>
                              {line.kind === "accessory" && line.quantity > 1 ? (
                                <span className="w-16 shrink-0 self-end pb-1 text-right text-xs font-black text-ink">
                                  {isSaleSensitiveHidden
                                    ? "***"
                                    : formatMoney(line.unitPrice * line.quantity)}
                                </span>
                              ) : null}
                              {!isSaleReadOnly ? (
                                <button
                                  type="button"
                                  onClick={() => removeSaleCartLine(line.key)}
                                  className="self-end rounded-md bg-red-50 p-1.5 text-danger hover:bg-red-100"
                                  title="Xóa"
                                >
                                  <Trash2 size={14} />
                                </button>
                              ) : null}
                            </li>
                            );
                          })}
                        </ul>
                      )}
                      <div className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t border-line pt-3">
                        <div>
                          <p className="text-sm font-semibold text-muted">
                            Tổng:{" "}
                            <strong className="text-base font-black text-ink">
                              {isSaleSensitiveHidden ? "***" : formatMoney(saleCartTotals.amountShort)}
                            </strong>
                            {salePayStatus === "NỢ DAI" ? (
                              <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                                ❌ NỢ DAI
                              </span>
                            ) : salePayStatus === "Thanh toán 1 phần" ? (
                              <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                ⚠️ 1 phần
                              </span>
                            ) : (
                              <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                                ✅ Đã TT
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-[11px] font-semibold text-muted">
                            Giá nhập:{" "}
                            <strong className="font-bold text-slate-700">
                              {isSaleSensitiveHidden ? "***" : formatMoney(saleCartTotals.costShort)}
                            </strong>
                            <span className="mx-1.5 text-line">·</span>
                            Lãi ước tính:{" "}
                            <strong className="font-bold text-emerald-700">
                              {isSaleSensitiveHidden ? "***" : formatMoney(saleCartTotals.profitShort)}
                            </strong>
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {isSaleReadOnly ? (
                            <button
                              type="button"
                              onClick={closeSaleModal}
                              disabled={saleSaving}
                              className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-bold text-muted hover:bg-slate-50 disabled:opacity-60"
                            >
                              Đóng
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={closeSaleModal}
                                disabled={saleSaving}
                                className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-white px-3 text-sm font-bold text-muted hover:bg-slate-50 disabled:opacity-60"
                              >
                                Hủy
                              </button>
                              <button
                                type="submit"
                                disabled={saleSaving || saleCart.length === 0}
                                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-60"
                              >
                                {saleSaving ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : editingSaleId ? (
                                  <Edit3 size={16} />
                                ) : (
                                  <Plus size={16} />
                                )}
                                {editingSaleId ? "Lưu thay đổi" : "Lưu phiếu bán"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </form>
                </section>
              </div>
            )}
          </section>
        )}

        {activePage === "customers" && (
          <Panel title="Khách hàng">
            <DataTable
              headers={["Tên", "Số điện thoại", "Địa chỉ", "Ghi chú", "Số phiếu liên quan"]}
              rows={customers.map((customer) => [
                customer.name,
                customer.phone || "—",
                customer.address || "—",
                customer.note || "—",
                sales.filter((s) => s.customerId === customer.id).length + repairs.filter((r) => r.customerId === customer.id).length,
              ])}
            />
          </Panel>
        )}

        {activePage === "debt-notes" && (
          <section className="grid min-h-[min(70vh,36rem)] place-items-center rounded-2xl border border-line bg-white p-8 shadow-panel sm:p-12">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                <NotebookPen size={32} />
              </div>
              <p className="text-2xl font-black leading-snug text-ink sm:text-3xl md:text-4xl">
                Tính năng này sẽ được update sau bữa hải sản ngon. Tùy thuộc vào sự nhiệt tình
                của Chủ Shop cho đội ngũ phát triển chúng tôi!
              </p>
              <p className="mt-6 text-sm font-semibold text-muted">
                Menu Ghi nợ — đang bảo trì / chờ update.
              </p>
            </div>
          </section>
        )}

        {activePage === "ledger" && (() => {
          // Sửa chữa: map đơn NỢ DAI từ repair_orders (API) → dòng công nợ ảo.
          // Số nợ = lãi (báo giá − phí DV), như cũ.
          const repairDebtRows: DebtItem[] = shopRepairs
            .filter((r) => {
              const isDebt = r.paymentStatus === "NỢ DAI";
              const isPaid = r.paymentStatus === "Đã thanh toán" || r.isPaid;
              if (debtStatusFilter === "open") return isDebt;
              if (debtStatusFilter === "paid") return isPaid;
              if (debtStatusFilter === "cancelled") return false;
              return isDebt || isPaid; // all
            })
            .filter((r) => storeFilter === "all" || true) // shopRepairs đã scope theo CH khi load
            .map((r) => {
              const isOpen = r.paymentStatus === "NỢ DAI";
              return {
                id: `repair:${r.id}`,
                source: "repair" as const,
                sourceId: r.id,
                storeId: (currentUser?.storeId ?? "store-1") as Exclude<StoreId, "all">,
                customerName: r.customerName,
                customerPhone: "",
                title: r.deviceName,
                amount: Math.max(0, (Number(r.quote) || 0) - (Number(r.deposit) || 0)),
                debtDate: (r.receiveDate || r.createdAt || "").slice(0, 10),
                status: (isOpen ? "open" : "paid") as DebtItem["status"],
                note: [r.condition, r.warranty, r.issue].filter(Boolean).join(" · "),
              };
            })
            .filter((r) => r.amount > 0 || r.status !== "open");

          // Bán hàng / Bán Gà: phiếu NỢ DAI → số nợ = lãi (profit), như cũ.
          // Không có lịch sử “đã thu nợ” trên sales → filter paid/cancelled không liệt kê.
          const salePool = [...salesRetail, ...salesBanGa];
          const saleDebtRows: DebtItem[] = salePool
            .filter((s) => {
              if (s.status === "Đã hủy") return false;
              if (storeFilter !== "all" && s.storeId !== storeFilter) return false;
              const isDebt = s.payment === "NỢ DAI" || s.payment === "Nợ";
              if (debtStatusFilter === "paid" || debtStatusFilter === "cancelled") return false;
              return isDebt;
            })
            .map((s) => ({
              id: `sale:${s.id}`,
              source: "sale" as const,
              sourceId: s.id,
              storeId: s.storeId,
              customerName: s.customerName || "Khách lẻ",
              customerPhone: s.customerPhone || "",
              title: s.itemName || "Phiếu bán",
              amount: Math.max(0, Number(s.profit) || 0),
              debtDate: String(s.createdAt || "").slice(0, 10),
              status: "open" as const,
              note: s.note || "",
            }));

          const tabRows: DebtItem[] =
            debtTab === "software"
              ? debts.filter((d) => d.source === "software")
              : debtTab === "manual"
                ? debts.filter((d) => d.source === "manual")
                : debtTab === "repair"
                  ? repairDebtRows
                  : saleDebtRows;

          const debtCustomerOptions = Array.from(
            new Set(tabRows.map((d) => d.customerName.trim()).filter(Boolean))
          ).sort((a, b) => a.localeCompare(b, "vi"));

          const customerQ = debtCustomerQuery.trim().toLowerCase();
          const displayDebts = !customerQ
            ? tabRows
            : tabRows.filter((d) => d.customerName.toLowerCase().includes(customerQ));

          const openDebtsApi = debts.filter((d) => d.status === "open");
          const openSelected = displayDebts.filter(
            (d) => selectedDebtIds.includes(d.id) && d.status === "open"
          );
          const openIds = displayDebts.filter((d) => d.status === "open").map((d) => d.id);
          const allOpenSelected =
            openIds.length > 0 && openIds.every((id) => selectedDebtIds.includes(id));
          const totalSoftware = openDebtsApi
            .filter((d) => d.source === "software")
            .reduce((s, d) => s + d.amount, 0);
          const totalManual = openDebtsApi
            .filter((d) => d.source === "manual")
            .reduce((s, d) => s + d.amount, 0);
          // Tổng nợ sale/repair luôn lấy trạng thái open (kể cả khi filter tab paid)
          const totalSale = salePool
            .filter(
              (s) =>
                s.status === "Hoàn tất" &&
                (s.payment === "NỢ DAI" || s.payment === "Nợ") &&
                (storeFilter === "all" || s.storeId === storeFilter)
            )
            .reduce((sum, s) => sum + (Number(s.profit) || 0), 0);
          const totalRepair = shopRepairs
            .filter((r) => r.paymentStatus === "NỢ DAI")
            .reduce(
              (sum, r) =>
                sum + Math.max(0, (Number(r.quote) || 0) - (Number(r.deposit) || 0)),
              0
            );
          const totalOpen = totalSoftware + totalManual + totalSale + totalRepair;

          /** Tổng nợ đang mở của khách đang lọc (gõ / chọn tên). */
          const filteredCustomerOpenTotal = displayDebts
            .filter((d) => d.status === "open")
            .reduce((s, d) => s + d.amount, 0);
          const filteredCustomerNames = Array.from(
            new Set(displayDebts.map((d) => d.customerName.trim()).filter(Boolean))
          );
          const showCustomerDebtSummary = customerQ.length > 0 && displayDebts.length > 0;

          const editingManual = editingManualDebtId
            ? debts.find((d) => d.source === "manual" && d.sourceId === editingManualDebtId)
            : null;
          const manualFormDefaults = editingManual ?? cloneManualDebtDraft;
          const isManualClone = !editingManual && Boolean(cloneManualDebtDraft);

          const sourceBadge = (source: string) => {
            if (source === "software")
              return (
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700">
                  Phần mềm
                </span>
              );
            if (source === "sale")
              return (
                <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-bold text-fuchsia-800">
                  Bán hàng
                </span>
              );
            if (source === "repair")
              return (
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-800">
                  Sửa chữa
                </span>
              );
            return (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">
                Nợ khác
              </span>
            );
          };

          const debtTabs: { id: typeof debtTab; label: string; count: number; tone: string }[] = [
            {
              id: "software",
              label: "Phần mềm",
              count: debts.filter((d) => d.source === "software" && d.status === "open").length,
              tone: "sky",
            },
            {
              id: "sale",
              label: "Bán hàng",
              count: saleDebtRows.filter((d) => d.status === "open").length,
              tone: "fuchsia",
            },
            {
              id: "repair",
              label: "Sửa chữa",
              count: repairDebtRows.filter((d) => d.status === "open").length,
              tone: "violet",
            },
            {
              id: "manual",
              label: "Nợ khác",
              count: debts.filter((d) => d.source === "manual" && d.status === "open").length,
              tone: "amber",
            },
          ];

          const statusLabel = (st: DebtItem["status"]) =>
            st === "open" ? "Đang nợ" : st === "paid" ? "Đã TT" : "Đã hủy";

          return (
            <section className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 sm:col-span-2 lg:col-span-1">
                  <span className="text-sm font-bold text-red-700">Tổng dư nợ</span>
                  <strong className="mt-1 block text-2xl font-black text-red-700">
                    {isDebtSensitiveHidden ? "***" : formatMoney(totalOpen)}
                  </strong>
                </div>
                <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-4 py-3">
                  <span className="text-sm font-bold text-fuchsia-800">Nợ bán hàng</span>
                  <strong className="mt-1 block text-2xl font-black text-fuchsia-900">
                    {isDebtSensitiveHidden ? "***" : formatMoney(totalSale)}
                  </strong>
                        </div>
                <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
                  <span className="text-sm font-bold text-violet-800">Nợ sửa chữa</span>
                  <strong className="mt-1 block text-2xl font-black text-violet-900">
                    {isDebtSensitiveHidden ? "***" : formatMoney(totalRepair)}
                  </strong>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
                  <span className="text-sm font-bold text-sky-700">Nợ phần mềm</span>
                  <strong className="mt-1 block text-2xl font-black text-sky-800">
                    {isDebtSensitiveHidden ? "***" : formatMoney(totalSoftware)}
                  </strong>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <span className="text-sm font-bold text-amber-800">Nợ khác (tay)</span>
                  <strong className="mt-1 block text-2xl font-black text-amber-900">
                    {isDebtSensitiveHidden ? "***" : formatMoney(totalManual)}
                  </strong>
                </div>
              </div>

              <Panel title="Sổ công nợ">
                  {debtsError ? (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-danger">
                      {debtsError}
                    </div>
                  ) : null}

                  <div className="mb-3 inline-flex w-full max-w-full flex-wrap gap-1 rounded-lg border border-line bg-slate-100 p-1">
                    {debtTabs.map((tab) => {
                      const active = debtTab === tab.id;
                      const activeCls =
                        tab.tone === "sky"
                          ? "bg-white text-sky-800 shadow-sm"
                          : tab.tone === "fuchsia"
                            ? "bg-white text-fuchsia-900 shadow-sm"
                            : tab.tone === "violet"
                              ? "bg-white text-violet-900 shadow-sm"
                              : "bg-white text-amber-900 shadow-sm";
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setDebtTab(tab.id);
                            setSelectedDebtIds([]);
                            setDebtCustomerQuery("");
                          }}
                          className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-bold transition ${
                            active ? activeCls : "text-muted hover:text-ink"
                          }`}
                        >
                          {tab.label}
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-xs font-black ${
                              active ? "bg-slate-100 text-slate-700" : "bg-white/80 text-slate-500"
                            }`}
                          >
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <select
                      value={debtStatusFilter}
                      onChange={(e) => {
                        setDebtStatusFilter(e.target.value as typeof debtStatusFilter);
                        setSelectedDebtIds([]);
                      }}
                      className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-bold"
                    >
                      <option value="open">Đang nợ</option>
                      <option value="paid">Đã TT</option>
                      <option value="cancelled">Đã hủy</option>
                      <option value="all">Tất cả TT</option>
                    </select>
                    <div className="relative min-w-[14rem] flex-1">
                      <Search className="pointer-events-none absolute left-3 top-2.5 text-muted" size={16} />
                      <input
                        list="debt-customer-datalist"
                        value={debtCustomerQuery}
                        onChange={(e) => {
                          setDebtCustomerQuery(e.target.value);
                          setSelectedDebtIds([]);
                        }}
                        placeholder="Chọn hoặc gõ tên khách nợ…"
                        className="h-10 w-full rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-sm font-semibold outline-none focus:border-brand"
                        autoComplete="off"
                      />
                      <datalist id="debt-customer-datalist">
                        {debtCustomerOptions.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    </div>
                    {debtCustomerQuery.trim() ? (
                      <button
                        type="button"
                        onClick={() => {
                          setDebtCustomerQuery("");
                          setSelectedDebtIds([]);
                        }}
                        className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-bold text-muted hover:bg-slate-50"
                      >
                        Xóa lọc khách
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setIsDebtSensitiveHidden((v) => !v)}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 font-bold text-slate-600"
                    >
                      {isDebtSensitiveHidden ? <EyeOff size={18} /> : <Eye size={18} />}
                      {isDebtSensitiveHidden ? "Hiện" : "Ẩn"}
                    </button>
                    <button
                      type="button"
                      disabled={debtsSaving || openSelected.length === 0}
                      onClick={() => void markSelectedDebtsPaid()}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {debtsSaving ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={18} />
                      )}
                      {openSelected.length > 0 ? `Thu nợ (${openSelected.length})` : "Thu nợ"}
                    </button>
                    {debtTab === "manual" ? (
                      <button
                        type="button"
                        onClick={openManualDebtCreateModal}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 font-bold text-white hover:bg-brand-dark"
                      >
                        <Plus size={18} />
                        Thêm nợ
                      </button>
                    ) : null}
                  </div>

                  {debtTab === "sale" ? (
                    <p className="mb-3 rounded-lg border border-fuchsia-100 bg-fuchsia-50 px-3 py-2 text-sm font-semibold text-fuchsia-900">
                      Nợ bán hàng = lãi phiếu (NỢ DAI). Thu nợ → chuyển sang Tiền mặt.
                    </p>
                  ) : null}
                  {debtTab === "repair" ? (
                    <p className="mb-3 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-900">
                      Nợ sửa chữa = lãi (báo giá − phí DV). Thu nợ → Đã thanh toán.
                    </p>
                  ) : null}
                  {debtTab === "software" ? (
                    <p className="mb-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900">
                      Nợ phần mềm = báo giá đơn. Chọn dòng → Thu nợ → Đã thanh toán.
                    </p>
                  ) : null}

                  {showCustomerDebtSummary ? (
                    <div className="mb-3 flex w-fit max-w-full flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-brand/25 bg-brand-soft px-3 py-2 text-left">
                      <div className="text-sm font-bold text-brand-dark">
                        {filteredCustomerNames.length === 1 ? (
                          <>
                            Tổng nợ của <span className="font-black">{filteredCustomerNames[0]}</span>
                            <span className="ml-1 font-semibold text-muted">
                              ({displayDebts.length} khoản · {openIds.length} đang nợ)
                            </span>
                          </>
                        ) : (
                          <>
                            Tổng nợ khớp lọc{" "}
                            <span className="font-black">“{debtCustomerQuery.trim()}”</span>
                            <span className="ml-1 font-semibold text-muted">
                              ({filteredCustomerNames.length} khách · {displayDebts.length} khoản ·{" "}
                              {openIds.length} đang nợ)
                            </span>
                          </>
                        )}
                      </div>
                      <strong className="text-lg font-black text-red-600">
                        {isDebtSensitiveHidden ? "***" : formatMoney(filteredCustomerOpenTotal)}
                      </strong>
                    </div>
                  ) : null}

                  {debtsLoading ? (
                    <div className="inline-flex items-center gap-2 text-sm font-bold text-muted">
                      <Loader2 size={16} className="animate-spin" /> Đang tải công nợ…
                    </div>
                  ) : (
                    <DataTable
                      compact
                      headers={[
                        "",
                        "Ngày",
                        "Nguồn",
                        "Khách / nội dung",
                        "Cửa hàng",
                        "Số nợ",
                        "Trạng thái",
                        "Thao tác",
                      ]}
                      rows={displayDebts.map((item) => {
                        const isOpen = item.status === "open";
                        const checked = selectedDebtIds.includes(item.id);
                        return [
                          <div
                            key={`chk-${item.id}`}
                            className="flex items-center justify-center"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 cursor-pointer accent-brand disabled:cursor-not-allowed"
                              checked={checked}
                              disabled={!isOpen || debtsSaving}
                              title={isOpen ? "Chọn để thu nợ" : "Chỉ chọn được khoản đang nợ"}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                const on = e.target.checked;
                                setSelectedDebtIds((prev) =>
                                  on
                                    ? prev.includes(item.id)
                                      ? prev
                                      : [...prev, item.id]
                                    : prev.filter((x) => x !== item.id)
                                );
                              }}
                            />
                          </div>,
                          <span key={`dt-${item.id}`} className="text-sm font-semibold">
                            {item.debtDate || "—"}
                          </span>,
                          sourceBadge(item.source),
                          <div key={`info-${item.id}`} className="text-left">
                            <div className="font-bold text-brand">{item.customerName}</div>
                            <div className="text-sm font-semibold text-slate-600">{item.title}</div>
                            {item.customerPhone ? (
                              <div className="text-xs font-semibold text-muted">{item.customerPhone}</div>
                            ) : null}
                          </div>,
                          storeName(item.storeId),
                          <span key={`amt-${item.id}`} className="font-black text-red-600">
                            {isDebtSensitiveHidden ? "***" : formatMoney(item.amount)}
                          </span>,
                          <StatusBadge
                            key={`st-${item.id}`}
                            tone={
                              item.status === "open" ? "danger" : item.status === "paid" ? "ok" : "neutral"
                            }
                          >
                            {statusLabel(item.status)}
                          </StatusBadge>,
                          <div key={`act-${item.id}`} className="flex flex-nowrap justify-center gap-1">
                            {item.source === "manual" && isOpen ? (
                              <button
                                type="button"
                                title="Sửa"
                                onClick={() => openManualDebtEditModal(item.sourceId)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand"
                              >
                                <Edit3 size={16} />
                              </button>
                            ) : null}
                            {item.source === "manual" ? (
                              <button
                                type="button"
                                title="Nhân bản"
                                onClick={() => openManualDebtCloneModal(item.sourceId)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100"
                              >
                                <CopyPlus size={16} />
                              </button>
                            ) : null}
                            {item.source === "software" ? (
                              <button
                                type="button"
                                title="Mở phần mềm"
                                onClick={() => {
                                  setActivePage("online-repairs");
                                  setViewingOnlineRepairId(item.sourceId);
                                }}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-700"
                              >
                                <Eye size={16} />
                              </button>
                            ) : null}
                            {item.source === "repair" ? (
                              <button
                                type="button"
                                title="Mở sửa chữa"
                                onClick={() => setActivePage("software")}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700"
                              >
                                <Eye size={16} />
                              </button>
                            ) : null}
                            {item.source === "manual" && isOpen && currentUser.role === "owner" ? (
                              <button
                                type="button"
                                title="Hủy nợ"
                                onClick={() => void cancelManualDebtItem(item.sourceId)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-danger"
                              >
                                <Trash2 size={16} />
                              </button>
                            ) : null}
                          </div>,
                        ];
                      })}
                    />
                  )}

                  {openIds.length > 0 ? (
                    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand"
                          checked={allOpenSelected}
                          disabled={debtsSaving}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setSelectedDebtIds((prev) => {
                              if (on) {
                                const set = new Set(prev);
                                openIds.forEach((id) => set.add(id));
                                return Array.from(set);
                              }
                              return prev.filter((id) => !openIds.includes(id));
                            });
                          }}
                        />
                        Chọn tất cả đang nợ ({openIds.length})
                      </label>
                    </div>
                  ) : null}
              </Panel>

              {isManualDebtModalOpen ? (
                <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-md">
                  <section className="relative max-h-[92vh] w-full max-w-[520px] overflow-auto rounded-2xl border border-white/20 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.4)] backdrop-blur-xl">
                    {debtsSaving ? (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/55 backdrop-blur-sm">
                        <Loader2 size={36} className="animate-spin text-brand" />
                        <p className="text-sm font-black text-ink">Đang lưu…</p>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between border-b border-slate-200/60 bg-white/80 p-4">
                      <div>
                        <h2 className="text-lg font-black text-slate-800">
                          {editingManual
                            ? "Sửa nợ tay"
                            : isManualClone
                              ? "Thêm nợ (nhân bản)"
                              : "Thêm nợ khác"}
                        </h2>
                        {isManualClone ? (
                          <p className="mt-1 text-sm font-semibold text-sky-700">
                            Đã copy thông tin — sửa nếu cần rồi lưu khoản nợ mới.
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={closeManualDebtModal}
                        disabled={debtsSaving}
                        className="h-9 shrink-0 rounded-xl border border-slate-200/60 bg-white/50 px-4 text-sm font-black text-slate-600 hover:bg-white disabled:opacity-50"
                      >
                        Đóng
                      </button>
                    </div>
                    <form
                      key={
                        editingManualDebtId ??
                        (cloneManualDebtDraft
                          ? `clone-debt-${cloneManualDebtFormKey}`
                          : `new-debt-${cloneManualDebtFormKey}`)
                      }
                      onSubmit={saveManualDebt}
                      className={`grid gap-3 p-4 ${debtsSaving ? "pointer-events-none select-none" : ""}`}
                      autoComplete="off"
                    >
                      {currentUser.role === "owner" ? (
                        <SelectField
                          label="Cửa hàng"
                          name="storeId"
                          options={stores.map((s) => [s.id, s.name])}
                          defaultValue={
                            manualFormDefaults?.storeId ??
                            (storeFilter !== "all" ? storeFilter : currentUser.storeId)
                          }
                        />
                      ) : (
                        <Field label="Cửa hàng">
                          <input type="hidden" name="storeId" value={currentUser.storeId} />
                          <div className="flex h-10 items-center rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold">
                            {storeName(currentUser.storeId)}
                          </div>
                        </Field>
                      )}
                      <Field label="Khách / đối tượng" required>
                        <input
                          name="customerName"
                          required
                          defaultValue={manualFormDefaults?.customerName ?? ""}
                          className="h-10 rounded-lg border border-line bg-white px-3"
                        />
                      </Field>
                      <Field label="SĐT">
                        <input
                          name="customerPhone"
                          defaultValue={manualFormDefaults?.customerPhone ?? ""}
                          className="h-10 rounded-lg border border-line bg-white px-3"
                        />
                      </Field>
                      <Field label="Nội dung nợ" required>
                        <input
                          name="title"
                          required
                          defaultValue={manualFormDefaults?.title ?? ""}
                          className="h-10 rounded-lg border border-line bg-white px-3"
                          placeholder="Nợ máy, ứng tiền, …"
                        />
                      </Field>
                      <Field label="Số tiền" required>
                        <MoneyInput name="amount" defaultValue={manualFormDefaults?.amount} />
                      </Field>
                      <Field label="Ngày phát sinh">
                        <input
                          name="debtDate"
                          type="date"
                          defaultValue={
                            isManualClone
                              ? vnNowDate()
                              : manualFormDefaults?.debtDate || vnNowDate()
                          }
                          className="h-10 rounded-lg border border-line bg-white px-3"
                        />
                      </Field>
                      <Field label="Ghi chú">
                        <input
                          name="note"
                          defaultValue={manualFormDefaults?.note ?? ""}
                          className="h-10 rounded-lg border border-line bg-white px-3"
                        />
                      </Field>
                      <div className="flex justify-end gap-2 border-t border-line pt-3">
                        <button
                          type="button"
                          onClick={closeManualDebtModal}
                          disabled={debtsSaving}
                          className="h-10 rounded-lg border border-line bg-white px-4 font-bold text-muted disabled:opacity-50"
                        >
                          Hủy
                        </button>
                        <button
                          type="submit"
                          disabled={debtsSaving}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white hover:bg-brand-dark disabled:opacity-60"
                        >
                          {debtsSaving ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : editingManual ? (
                            <Edit3 size={18} />
                          ) : isManualClone ? (
                            <CopyPlus size={18} />
                          ) : (
                            <Plus size={18} />
                          )}
                          {editingManual
                            ? "Lưu sửa"
                            : isManualClone
                              ? "Lưu nợ mới"
                              : "Thêm nợ"}
                        </button>
                      </div>
                    </form>
                  </section>
                </div>
              ) : null}
            </section>
          );
        })()}

        {activePage === "logs" && (
          <Panel title="Nhật ký thao tác">
            <DataTable
              headers={["Thời gian", "Người thao tác", "Cửa hàng", "Hành động", "Dữ liệu"]}
              rows={logs.map((item) => [item.createdAt, item.user, storeName(item.storeId), item.action, item.target])}
            />
          </Panel>
        )}

        {activePage === "accounts" && currentUser.role === "owner" && (
          <Panel title="Quản lý tài khoản & menu">
            <p className="mb-4 text-sm font-semibold text-muted">
              Owner (<strong>admin</strong>, <strong>quynhbupbe</strong>) có thể đổi mật khẩu, bật/tắt tài khoản và phân menu. Pass seed mặc định: <strong>123456</strong>.
            </p>
            {accountsError ? (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-danger">{accountsError}</p>
            ) : null}
            {accountsLoading ? (
              <div className="inline-flex items-center gap-2 text-sm font-bold text-muted">
                <Loader2 size={16} className="animate-spin" /> Đang tải tài khoản…
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-3">Tài khoản</th>
                      <th className="px-3 py-3">Vai trò</th>
                      <th className="px-3 py-3">Cửa hàng</th>
                      <th className="px-3 py-3">Trạng thái</th>
                      <th className="px-3 py-3">Menu được vào</th>
                      <th className="px-3 py-3">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountsList.map((acc) => {
                      const draft = accountsDraft[acc.id] ?? [];
                      const isOwnerRow = acc.role === "owner";
                      const isSelf = acc.id === currentUser.id;
                      const active = acc.isActive !== false;
                      const busy = accountsSavingId === acc.id;
                      return (
                        <tr
                          key={acc.id}
                          className={`border-t border-line align-top ${active ? "" : "bg-slate-50/80 opacity-80"}`}
                        >
                          <td className="px-3 py-3">
                            <div className="font-black text-ink">{acc.name}</div>
                            <div className="font-mono text-xs font-semibold text-muted">{acc.username}</div>
                          </td>
                          <td className="px-3 py-3 font-bold">
                            {isOwnerRow ? (
                              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand">Owner · full</span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">Staff</span>
                            )}
                          </td>
                          <td className="px-3 py-3 font-semibold text-slate-700">{storeName(acc.storeId)}</td>
                          <td className="px-3 py-3">
                            {active ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">Active</span>
                            ) : (
                              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-danger">Inactive</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="grid max-w-xl grid-cols-2 gap-1.5 sm:grid-cols-3">
                              {navItems.map((menu) => {
                                const checked = isOwnerRow || draft.includes(menu.id);
                                return (
                                  <label
                                    key={`${acc.id}-${menu.id}`}
                                    className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                                      checked ? "border-brand/30 bg-brand-soft text-brand-dark" : "border-line bg-white text-slate-600"
                                    } ${isOwnerRow ? "cursor-default opacity-80" : ""}`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="accent-brand"
                                      checked={checked}
                                      disabled={isOwnerRow || busy}
                                      onChange={(e) => toggleAccountMenu(acc.id, menu.id, e.target.checked)}
                                    />
                                    <span className="truncate">{MENU_LABELS[menu.id] ?? menu.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex min-w-[9rem] flex-col gap-1.5">
                              {!isOwnerRow ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void saveAccountMenus(acc.id)}
                                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-bold text-white hover:bg-brand-dark disabled:opacity-60"
                                >
                                  {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                                  Lưu menu
                                </button>
                              ) : (
                                <span className="text-xs font-semibold text-muted">Menu: full</span>
                              )}
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void changeAccountPassword(acc.id, acc.username)}
                                className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink hover:bg-slate-50 disabled:opacity-60"
                              >
                                Đổi mật khẩu
                              </button>
                              <button
                                type="button"
                                disabled={busy || isSelf}
                                title={isSelf ? "Không thể tự vô hiệu hóa" : active ? "Vô hiệu hóa" : "Kích hoạt lại"}
                                onClick={() => void toggleAccountActive(acc.id, !active)}
                                className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-bold disabled:opacity-50 ${
                                  active
                                    ? "bg-red-50 text-danger hover:bg-red-100"
                                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                              >
                                {active ? "Inactive" : "Active"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!accountsList.length ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-sm font-semibold text-muted">
                          Chưa có tài khoản trong DB.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        {activePage === "software" && softwareHubTab === "repair" && (() => {
          // UI Sửa chữa — clone layout Phần mềm; mock state (shopRepairs), chưa API/DB.
          const todayString = vnNowDate();
          const displayDate = shopRepairDate || todayString;
          const orderTimeKey = (r: ShopRepairOrder) =>
            (r.receiveDate || r.createdAt || "").replace("T", " ");

          let filteredRepairs = shopRepairs;
          if (shopRepairDate) {
            filteredRepairs = filteredRepairs.filter((r) => orderTimeKey(r).includes(shopRepairDate));
          } else {
            filteredRepairs = filteredRepairs.filter((r) => orderTimeKey(r).startsWith(shopRepairMonth));
          }
          if (shopRepairFilter !== "all") {
            filteredRepairs = filteredRepairs.filter((r) =>
              shopRepairFilter === "paid" ? r.isPaid : !r.isPaid
            );
          }
          const shopRepairSearchQ = shopRepairSearch.trim().toLowerCase();
          if (shopRepairSearchQ) {
            filteredRepairs = filteredRepairs.filter((r) => {
              const hay = [
                r.customerName,
                r.deviceName,
                r.condition,
                r.warranty,
                r.issue,
                r.paymentStatus,
                r.paymentMethod,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
              return hay.includes(shopRepairSearchQ);
            });
          }

          const debtVisibleRepairs = filteredRepairs.filter((r) => r.paymentStatus === "NỢ DAI");
          const debtVisibleIds = debtVisibleRepairs.map((r) => r.id);
          const selectedDebtCount = debtVisibleIds.filter((id) =>
            selectedShopRepairIds.includes(id)
          ).length;
          const allDebtSelected =
            debtVisibleIds.length > 0 &&
            debtVisibleIds.every((id) => selectedShopRepairIds.includes(id));

          /** Tổng ngoài grid — TM / CK / Nợ (giống bán hàng). */
          const repairPayTotals = (() => {
            const buckets = {
              cash: { count: 0, amount: 0, profit: 0 },
              transfer: { count: 0, amount: 0, profit: 0 },
              debt: { count: 0, amount: 0, profit: 0 },
            };
            let totalCount = 0;
            let totalAmount = 0;
            let totalProfit = 0;
            for (const r of filteredRepairs) {
              const amt = Number(r.quote) || 0;
              const prof = amt - (Number(r.deposit) || 0);
              totalCount += 1;
              totalAmount += amt;
              totalProfit += prof;
              if (r.paymentStatus === "NỢ DAI") {
                buckets.debt.count += 1;
                buckets.debt.amount += amt;
                buckets.debt.profit += prof;
              } else if ((r.paymentMethod || "Tiền mặt") === "Chuyển khoản") {
                buckets.transfer.count += 1;
                buckets.transfer.amount += amt;
                buckets.transfer.profit += prof;
              } else {
                buckets.cash.count += 1;
                buckets.cash.amount += amt;
                buckets.cash.profit += prof;
              }
            }
            return { ...buckets, totalCount, totalAmount, totalProfit };
          })();

          const monthlyRepairs = shopRepairs.filter((r) =>
            orderTimeKey(r).startsWith(shopRepairMonth)
          );
          const dailyRepairs = shopRepairs.filter((r) =>
            orderTimeKey(r).includes(displayDate)
          );

          return (
          <section className="grid gap-4">
            {(shopRepairBackendError || shopRepairLoading) && (
              <div
                className={`rounded-lg border p-3 text-sm font-semibold ${
                  shopRepairBackendError
                    ? "border-red-200 bg-red-50 text-danger"
                    : "border-line bg-white text-muted"
                }`}
              >
                {shopRepairBackendError || "Đang tải đơn sửa chữa từ Supabase…"}
                {!shopRepairLoading && shopRepairBackendError ? (
                  <button
                    type="button"
                    onClick={() => void reloadShopRepairsFromDb()}
                    className="ml-2 font-bold text-brand hover:underline"
                  >
                    Thử lại
                  </button>
                ) : null}
              </div>
            )}

            {isShopRepairModalOpen && (() => {
              const formDefaults = editingShopRepairId
                ? shopRepairs.find((r) => r.id === editingShopRepairId) ?? null
                : cloneShopRepairDraft;
              const isCloneMode = !editingShopRepairId && Boolean(cloneShopRepairDraft);
              return (
              <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-md">
                <div className="relative my-auto w-full max-w-4xl rounded-2xl border border-white/20 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.4)] backdrop-blur-xl">
                  {shopRepairSaving ? (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/55 backdrop-blur-sm">
                      <Loader2 size={40} className="animate-spin text-brand" />
                      <p className="text-base font-black text-ink">Đang lưu…</p>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between border-b border-slate-200/60 bg-white/80 p-4 backdrop-blur-md">
                    <h2 className="text-xl font-black text-brand">
                      {editingShopRepairId
                        ? "Sửa đơn Sửa chữa"
                        : isCloneMode
                          ? "Tạo đơn (nhân bản)"
                          : "Tạo đơn Sửa chữa"}
                    </h2>
                    <button
                      type="button"
                      onClick={closeShopRepairModal}
                      disabled={shopRepairSaving}
                      className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className={`p-4 ${shopRepairSaving ? "pointer-events-none select-none" : ""}`}>
                    {isCloneMode ? (
                      <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">
                        Đã copy thông tin đơn mẫu — sửa nếu cần, rồi lưu thành đơn mới (mock).
                      </div>
                    ) : null}
                    <form
                      key={
                        editingShopRepairId ??
                        (isCloneMode ? `clone-${cloneShopRepairFormKey}` : "new")
                      }
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (shopRepairSaving) return;
                        void saveShopRepairFromForm(new FormData(e.currentTarget));
                      }}
                      className="grid gap-3"
                      autoComplete="off"
                      spellCheck={false}
                    >
                <div className="grid gap-3 sm:grid-cols-2">
                  <ManageableSelect
                    label="Khách hàng"
                    name="customerName"
                    options={shopRepairCustomerOptions}
                    setOptions={setFormLookupOptions(REPAIR_LOOKUP_CATEGORIES.customer, repairLookupStoreId)}
                    defaultValue={formDefaults?.customerName ?? "Khách lẻ"}
                    categoryCode={REPAIR_LOOKUP_CATEGORIES.customer}
                    storeId={repairLookupStoreId}
                    onRenameCascade={reloadShopRepairsFromDb}
                    allowManage
                    allowFreeText
                    actorUsername={currentUser?.username ?? ""}
                  />
                  <ManageableSelect
                    label="Tên máy"
                    name="deviceName"
                    options={shopRepairDeviceOptions}
                    setOptions={setFormLookupOptions(REPAIR_LOOKUP_CATEGORIES.device, repairLookupStoreId)}
                    defaultValue={formDefaults?.deviceName}
                    categoryCode={REPAIR_LOOKUP_CATEGORIES.device}
                    storeId={repairLookupStoreId}
                    onRenameCascade={reloadShopRepairsFromDb}
                    allowManage
                    allowFreeText
                    actorUsername={currentUser?.username ?? ""}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ManageableSelect
                    label="Tình trạng"
                    name="condition"
                    options={shopRepairConditionOptions}
                    setOptions={setFormLookupOptions(REPAIR_LOOKUP_CATEGORIES.condition, repairLookupStoreId)}
                    defaultValue={formDefaults?.condition}
                    required={false}
                    categoryCode={REPAIR_LOOKUP_CATEGORIES.condition}
                    storeId={repairLookupStoreId}
                    onRenameCascade={reloadShopRepairsFromDb}
                    allowManage
                    allowFreeText
                    actorUsername={currentUser?.username ?? ""}
                  />
                  <ManageableSelect
                    label="Bảo hành"
                    name="warranty"
                    options={shopRepairWarrantyOptions}
                    setOptions={setFormLookupOptions(REPAIR_LOOKUP_CATEGORIES.warranty, repairLookupStoreId)}
                    defaultValue={formDefaults?.warranty}
                    required={false}
                    categoryCode={REPAIR_LOOKUP_CATEGORIES.warranty}
                    storeId={repairLookupStoreId}
                    onRenameCascade={reloadShopRepairsFromDb}
                    allowManage
                    allowFreeText
                    actorUsername={currentUser?.username ?? ""}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ManageableSelect
                    label="Báo giá"
                    name="quote"
                    options={shopRepairQuoteOptions}
                    setOptions={setFormLookupOptions(REPAIR_LOOKUP_CATEGORIES.quote, repairLookupStoreId)}
                    defaultValue={formatInputMoney(formDefaults?.quote ?? "")}
                    categoryCode={REPAIR_LOOKUP_CATEGORIES.quote}
                    storeId={repairLookupStoreId}
                    onRenameCascade={reloadShopRepairsFromDb}
                    allowManage
                    allowFreeText
                    actorUsername={currentUser?.username ?? ""}
                  />
                  <ManageableSelect
                    label="Phí dịch vụ"
                    name="deposit"
                    options={shopRepairFeeOptions}
                    setOptions={setFormLookupOptions(REPAIR_LOOKUP_CATEGORIES.fee, repairLookupStoreId)}
                    defaultValue={
                      formDefaults != null
                        ? formatInputMoney(formDefaults.deposit ?? "")
                        : ""
                    }
                    required
                    categoryCode={REPAIR_LOOKUP_CATEGORIES.fee}
                    storeId={repairLookupStoreId}
                    onRenameCascade={reloadShopRepairsFromDb}
                    allowManage
                    allowFreeText
                    actorUsername={currentUser?.username ?? ""}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(() => {
                    const raw = formDefaults?.receiveDate || vnNowDateTimeLocal();
                    const local = String(raw).slice(0, 16).replace(" ", "T");
                    const [datePart = "", timePart = ""] = local.includes("T")
                      ? local.split("T")
                      : [local.slice(0, 10), "00:00"];
                    const [hourPart = "00", minutePart = "00"] = (timePart || "00:00")
                      .slice(0, 5)
                      .split(":");
                    const hours = Array.from({ length: 24 }, (_, i) =>
                      String(i).padStart(2, "0")
                    );
                    const minutes = Array.from({ length: 60 }, (_, i) =>
                      String(i).padStart(2, "0")
                    );
                    return (
                      <div className="grid min-w-0 gap-1.5 sm:col-span-1">
                        <span className="text-base font-black text-slate-950">
                          Ngày & giờ <span className="ml-1 text-red-500">*</span>
                        </span>
                        <div className="grid min-w-0 grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.7fr)] gap-2">
                          <label className="grid min-w-0 gap-1">
                            <span className="text-xs font-bold text-brand">Ngày</span>
                            <input
                              name="receiveDatePart"
                              type="date"
                              required
                              defaultValue={datePart}
                              className="h-10 w-full min-w-0 rounded-lg border border-line bg-brand-soft/40 px-2 text-sm font-black text-brand outline-none focus:border-brand"
                            />
                          </label>
                          <label className="grid min-w-0 gap-1">
                            <span className="text-xs font-bold text-amber-800">Giờ</span>
                            <select
                              name="receiveHour"
                              required
                              defaultValue={hourPart.padStart(2, "0")}
                              className="h-10 w-full min-w-0 rounded-lg border border-line bg-amber-50 px-1.5 text-sm font-black text-amber-900 outline-none focus:border-amber-500"
                            >
                              {hours.map((h) => (
                                <option key={`h-${h}`} value={h}>{h}</option>
                              ))}
                            </select>
                          </label>
                          <label className="grid min-w-0 gap-1">
                            <span className="text-xs font-bold text-amber-800">Phút</span>
                            <select
                              name="receiveMinute"
                              required
                              defaultValue={minutePart.padStart(2, "0")}
                              className="h-10 w-full min-w-0 rounded-lg border border-line bg-amber-50 px-1.5 text-sm font-black text-amber-900 outline-none focus:border-amber-500"
                            >
                              {minutes.map((m) => (
                                <option key={`m-${m}`} value={m}>{m}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    );
                  })()}
                  <Field label="Trạng thái TT" required>
                    <select
                      name="paymentStatus"
                      required
                      defaultValue={formDefaults?.paymentStatus ?? "Đã thanh toán"}
                      className="h-10 rounded-lg border border-line bg-white px-3 font-semibold"
                    >
                      <option value="Đã thanh toán">Đã thanh toán</option>
                      <option value="NỢ DAI">NỢ DAI</option>
                    </select>
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Hình thức thanh toán" required>
                    <select
                      name="paymentMethod"
                      required
                      defaultValue={formDefaults?.paymentMethod ?? "Tiền mặt"}
                      className="h-10 rounded-lg border border-line bg-white px-3 font-semibold"
                    >
                      {SALE_PAY_METHOD_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="flex justify-end gap-2 border-t border-line pt-4">
                  <button
                    type="button"
                    onClick={closeShopRepairModal}
                    disabled={shopRepairSaving}
                    className="h-10 rounded-lg border border-line bg-white px-4 font-bold text-muted disabled:opacity-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={shopRepairSaving}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {shopRepairSaving ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : editingShopRepairId ? (
                      <Edit3 size={18} />
                    ) : isCloneMode ? (
                      <CopyPlus size={18} />
                    ) : (
                      <Plus size={18} />
                    )}
                    {shopRepairSaving
                      ? "Đang lưu…"
                      : editingShopRepairId
                        ? "Lưu thay đổi"
                        : isCloneMode
                          ? "Lưu đơn mới"
                          : "Tạo đơn"}
                  </button>
                </div>
              </form>
                  </div>
                </div>
              </div>
              );
            })()}

            <div className="grid gap-4">
              <div className="rounded-lg bg-gradient-to-br from-emerald-800 via-brand to-teal-700 p-4 sm:p-5 text-white shadow relative overflow-hidden flex flex-col md:flex-row justify-between items-center md:text-left text-center gap-4 mb-4">
                <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-white/10 blur-3xl mix-blend-overlay pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -mb-16 -ml-16 h-48 w-48 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
                <div className="relative z-10 md:w-1/2">
                  <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white drop-shadow-sm">
                    Trung Tâm Sửa Chữa Điện Thoại Kim Chi
                  </h1>
                </div>
                <div className="relative z-10 md:w-1/2 flex flex-col md:items-end gap-1">
                  <p className="flex items-center gap-2 text-xs font-bold text-white sm:text-sm">
                    <span className="hidden h-1.5 w-1.5 shrink-0 rounded-full bg-white md:block"></span>
                    Nhanh — Uy tín — Bảo hành rõ ràng
                  </p>
                  <p className="flex items-center gap-2 text-xs font-semibold text-white sm:text-sm">
                    <span className="hidden h-1.5 w-1.5 shrink-0 rounded-full bg-white md:block"></span>
                    Nơi Trao trọn niềm tin số 1 của khách hàng Tại Phường Nam Sách, TP. Hải Phòng
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-brand bg-emerald-50 p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="block text-sm font-bold text-emerald-800">Lợi nhuận Tháng</span>
                    <input
                      type="month"
                      value={shopRepairMonth}
                      onChange={(e) => {
                        setShopRepairMonth(e.target.value);
                        setSelectedShopRepairIds([]);
                      }}
                      className="h-8 rounded border border-emerald-200 bg-white px-2 text-sm font-semibold text-emerald-800"
                    />
                  </div>
                  <strong className="text-3xl text-emerald-700">
                    {isShopRepairSensitiveHidden
                      ? "*** ₫"
                      : formatMoney(monthlyRepairs.reduce((sum, r) => sum + (r.quote - r.deposit), 0))}
                  </strong>
                  <div className="mt-2 flex items-center justify-between border-t border-emerald-200/50 pt-2 text-sm font-semibold text-emerald-700/80">
                    <span>Dư nợ tháng:</span>
                    <span>
                      {isShopRepairSensitiveHidden
                        ? "***"
                        : formatMoney(
                            monthlyRepairs
                              .filter((r) => r.paymentStatus === "NỢ DAI")
                              .reduce((sum, r) => sum + r.quote, 0)
                          )}
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="block text-sm font-bold text-slate-500">Lợi nhuận Ngày</span>
                    <input
                      type="date"
                      value={displayDate}
                      onChange={(e) => setShopRepairDate(e.target.value)}
                      className="h-8 rounded border border-line bg-slate-50 px-2 text-sm font-semibold text-slate-700"
                    />
                  </div>
                  <strong className="text-3xl text-red-600">
                    {isShopRepairSensitiveHidden
                      ? "*** ₫"
                      : formatMoney(dailyRepairs.reduce((sum, r) => sum + (r.quote - r.deposit), 0))}
                  </strong>
                  <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-sm font-semibold text-slate-500">
                    <span>Dư nợ ngày:</span>
                    <span>
                      {isShopRepairSensitiveHidden
                        ? "***"
                        : formatMoney(
                            dailyRepairs
                              .filter((r) => r.paymentStatus === "NỢ DAI")
                              .reduce((sum, r) => sum + r.quote, 0)
                          )}
                    </span>
                  </div>
                </div>
              </div>

              <Panel title="Danh sách Sửa chữa">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={shopRepairFilter}
                      onChange={(e) => {
                        setShopRepairFilter(e.target.value);
                        setSelectedShopRepairIds([]);
                      }}
                      className="h-10 rounded-lg border border-line px-3 text-sm font-bold"
                    >
                      <option value="all">Tất cả trạng thái</option>
                      <option value="paid">Đã thanh toán</option>
                      <option value="unpaid">NỢ DAI</option>
                    </select>
                    <div className="flex items-center gap-2 rounded-lg border border-line bg-slate-50 px-2">
                      <span className="text-sm font-semibold text-slate-500">Lọc ngày:</span>
                      <input
                        type="date"
                        value={shopRepairDate}
                        onChange={(e) => {
                          setShopRepairDate(e.target.value);
                          setSelectedShopRepairIds([]);
                        }}
                        className="h-8 rounded border border-line px-2 text-sm"
                      />
                      {shopRepairDate ? (
                        <button
                          type="button"
                          onClick={() => {
                            setShopRepairDate("");
                            setSelectedShopRepairIds([]);
                          }}
                          className="text-sm font-bold text-brand hover:underline"
                        >
                          Tất cả tháng
                        </button>
                      ) : null}
                    </div>
                    <div className="relative min-w-[14rem] flex-1 sm:max-w-md">
                      <Search className="pointer-events-none absolute left-3 top-2.5 text-muted" size={16} />
                      <input
                        value={shopRepairSearch}
                        onChange={(e) => {
                          setShopRepairSearch(e.target.value);
                          setSelectedShopRepairIds([]);
                        }}
                        placeholder="Tìm tên máy, khách hàng, bảo hành…"
                        className="h-10 w-full rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-sm font-semibold outline-none focus:border-brand"
                        autoComplete="off"
                      />
                    </div>
                    {shopRepairSearch.trim() ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShopRepairSearch("");
                          setSelectedShopRepairIds([]);
                        }}
                        className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-bold text-muted hover:bg-slate-50"
                      >
                        Xóa tìm
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={shopRepairPaying || selectedDebtCount === 0}
                      onClick={() => void markSelectedShopRepairsPaid(debtVisibleRepairs)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Đánh dấu các đơn NỢ DAI đã chọn → Đã thanh toán"
                    >
                      {shopRepairPaying ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={18} />
                      )}
                      {shopRepairPaying
                        ? "Đang thanh toán…"
                        : selectedDebtCount > 0
                          ? `Thanh toán (${selectedDebtCount})`
                          : "Thanh toán"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsShopRepairSensitiveHidden((v) => !v)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
                    >
                      {isShopRepairSensitiveHidden ? <EyeOff size={18} /> : <Eye size={18} />}
                      {isShopRepairSensitiveHidden ? "Hiện" : "Ẩn"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingShopRepairId(null);
                        setCloneShopRepairDraft(null);
                        setIsShopRepairModalOpen(true);
                      }}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white shadow hover:bg-brand-dark"
                    >
                      <Plus size={18} /> Tạo đơn mới
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto pb-4">
                  <DataTable
                    compact
                    headers={[
                      "",
                      "Khách hàng",
                      "Tên máy",
                      "Tình trạng",
                      "Bảo hành",
                      "Báo giá",
                      "Phí dịch vụ",
                      "Lãi",
                      "Ngày & giờ",
                      "Thanh toán",
                      "Hình thức TT",
                      "Thao tác",
                    ]}
                    rows={filteredRepairs.map((item) => {
                      const isNợ = item.paymentStatus === "NỢ DAI";
                      const isDaThanhToan = item.paymentStatus === "Đã thanh toán";
                      const isChecked = selectedShopRepairIds.includes(item.id);
                      const payMethod = item.paymentMethod?.trim() || "Tiền mặt";
                      return [
                        <div
                          key={`chk-${item.id}`}
                          className="flex items-center justify-center"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-brand"
                            checked={isChecked}
                            disabled={!isNợ}
                            title={isNợ ? "Chọn để thanh toán" : "Chỉ chọn được đơn NỢ DAI"}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setSelectedShopRepairIds((prev) => {
                                if (on) return prev.includes(item.id) ? prev : [...prev, item.id];
                                return prev.filter((x) => x !== item.id);
                              });
                            }}
                          />
                        </div>,
                        <span key={`c-${item.id}`} className="font-bold text-brand whitespace-nowrap">
                          {item.customerName}
                        </span>,
                        <span key={`d-${item.id}`} className="font-semibold text-slate-700 whitespace-nowrap">
                          {item.deviceName}
                        </span>,
                        <span key={`cond-${item.id}`} className="font-semibold text-slate-600 whitespace-nowrap">
                          {item.condition?.trim() || "—"}
                        </span>,
                        <span key={`war-${item.id}`} className="font-semibold text-slate-600 whitespace-nowrap">
                          {item.warranty?.trim() || "—"}
                        </span>,
                        formatMoney(item.quote),
                        isShopRepairSensitiveHidden ? "***" : formatMoney(item.deposit),
                        <span key={`p-${item.id}`} className="font-black text-amber-700">
                          {isShopRepairSensitiveHidden
                            ? "***"
                            : formatMoney(item.quote - item.deposit)}
                        </span>,
                        <ColoredDateTime key={`dt-${item.id}`} value={item.receiveDate} />,
                        <span
                          key={`st-${item.id}`}
                          className={`inline-flex h-8 items-center rounded text-xs font-bold px-2 shadow-sm border border-line ${
                            isNợ
                              ? "bg-red-50 text-red-600"
                              : isDaThanhToan
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-slate-50 text-slate-600"
                          }`}
                        >
                          {isDaThanhToan ? "✅ Đã thanh toán" : "❌ NỢ DAI"}
                        </span>,
                        <span
                          key={`pm-${item.id}`}
                          className="whitespace-nowrap text-sm font-bold text-slate-700"
                        >
                          {payMethod}
                        </span>,
                        <div key={`act-${item.id}`} className="flex flex-nowrap items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingShopRepairId(item.id)}
                            title="Chi tiết"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCloneShopRepairDraft(null);
                              setEditingShopRepairId(item.id);
                              setIsShopRepairModalOpen(true);
                            }}
                            title="Sửa"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand transition hover:bg-brand/20"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openShopRepairCloneModal(item.id)}
                            title="Nhân bản thêm mới"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 transition hover:bg-sky-100"
                          >
                            <CopyPlus size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteShopRepair(item.id)}
                            title="Xóa đơn"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-danger transition hover:bg-red-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>,
                      ];
                    })}
                  />
                </div>
                {debtVisibleIds.length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-line pt-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand"
                        checked={allDebtSelected}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setSelectedShopRepairIds((prev) => {
                            if (on) {
                              const set = new Set(prev);
                              debtVisibleIds.forEach((id) => set.add(id));
                              return Array.from(set);
                            }
                            return prev.filter((id) => !debtVisibleIds.includes(id));
                          });
                        }}
                      />
                      Chọn tất cả NỢ DAI trên lưới ({debtVisibleIds.length})
                    </label>
                    {selectedDebtCount > 0 ? (
                      <span className="text-sm font-semibold text-muted">
                        Đã chọn {selectedDebtCount} đơn nợ
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {/* Tổng theo hình thức TT — giống bán hàng */}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-line bg-slate-50/80 px-3 py-2 text-xs font-semibold">
                  <span className="font-black text-ink">Theo TT:</span>
                  <span className="text-emerald-700">
                    TM{" "}
                    <strong className="tabular-nums">
                      {isShopRepairSensitiveHidden
                        ? "***"
                        : formatMoney(repairPayTotals.cash.amount)}
                    </strong>
                    <span className="ml-1 text-muted">({repairPayTotals.cash.count})</span>
                  </span>
                  <span className="text-sky-700">
                    CK{" "}
                    <strong className="tabular-nums">
                      {isShopRepairSensitiveHidden
                        ? "***"
                        : formatMoney(repairPayTotals.transfer.amount)}
                    </strong>
                    <span className="ml-1 text-muted">({repairPayTotals.transfer.count})</span>
                  </span>
                  <span className="text-red-700">
                    Nợ{" "}
                    <strong className="tabular-nums">
                      {isShopRepairSensitiveHidden
                        ? "***"
                        : formatMoney(repairPayTotals.debt.amount)}
                    </strong>
                    <span className="ml-1 text-muted">({repairPayTotals.debt.count})</span>
                  </span>
                  <span className="ml-auto text-muted">
                    Tổng{" "}
                    <strong className="tabular-nums text-ink">
                      {isShopRepairSensitiveHidden
                        ? "***"
                        : formatMoney(repairPayTotals.totalAmount)}
                    </strong>
                    <span className="ml-1">({repairPayTotals.totalCount})</span>
                    <span className="mx-1.5 text-line">·</span>
                    Lãi{" "}
                    <strong className="tabular-nums text-emerald-700">
                      {isShopRepairSensitiveHidden
                        ? "***"
                        : formatMoney(repairPayTotals.totalProfit)}
                    </strong>
                  </span>
                </div>
              </Panel>
            </div>

            {viewingShopRepair && (
              <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-md">
                <section className="max-h-[92vh] w-full max-w-[640px] overflow-auto rounded-2xl border border-white/20 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.4)] backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-slate-200/60 bg-gradient-to-r from-brand/10 to-transparent p-5">
                    <h2 className="text-xl font-black text-brand">Chi tiết đơn sửa chữa</h2>
                    <button
                      type="button"
                      onClick={() => setViewingShopRepairId(null)}
                      className="h-9 rounded-xl border border-slate-200/60 bg-white/50 px-4 text-sm font-bold text-slate-600 backdrop-blur-md transition hover:bg-white hover:text-slate-900"
                    >
                      Đóng
                    </button>
                  </div>
                  <div className="grid gap-4 p-5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                        <Wrench size={24} />
                      </div>
                      <div>
                        <strong className="block text-lg">{viewingShopRepair.customerName}</strong>
                        <span className="text-sm font-semibold text-muted">{viewingShopRepair.deviceName}</span>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Khách hàng">
                        <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 font-bold text-brand">
                          {viewingShopRepair.customerName}
                        </div>
                      </Field>
                      <Field label="Loại khách">
                        <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-slate-800">
                          {viewingShopRepair.customerType || "Vãng lai"}
                        </div>
                      </Field>
                      <Field label="Tên máy">
                        <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 font-semibold text-slate-800">
                          {viewingShopRepair.deviceName}
                        </div>
                      </Field>
                      <Field label="Tình trạng">
                        <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 font-semibold text-slate-800">
                          {viewingShopRepair.condition?.trim() || "—"}
                        </div>
                      </Field>
                      <Field label="Bảo hành">
                        <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 font-semibold text-slate-800">
                          {viewingShopRepair.warranty?.trim() || "—"}
                        </div>
                      </Field>
                      <Field label="Trạng thái thanh toán">
                        <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3">
                          <span
                            className={`inline-flex h-8 items-center rounded px-2 text-xs font-bold ${
                              viewingShopRepair.paymentStatus === "Đã thanh toán"
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-red-50 text-red-600"
                            }`}
                          >
                            {viewingShopRepair.paymentStatus === "Đã thanh toán"
                              ? "✅ Đã thanh toán"
                              : "❌ NỢ DAI"}
                          </span>
                        </div>
                      </Field>
                      <Field label="Hình thức thanh toán">
                        <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 font-semibold text-slate-800">
                          {viewingShopRepair.paymentMethod?.trim() || "Tiền mặt"}
                        </div>
                      </Field>
                      <Field label="Báo giá">
                        <div className="flex h-12 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-xl font-black text-slate-800">
                          {formatMoney(viewingShopRepair.quote)}
                        </div>
                      </Field>
                      <Field label="Phí dịch vụ">
                        <div className="flex h-12 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-xl font-black text-slate-700">
                          {formatMoney(viewingShopRepair.deposit)}
                        </div>
                      </Field>
                      <Field label="Lãi">
                        <div className="flex h-12 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-xl font-black text-amber-700">
                          {formatMoney(viewingShopRepair.quote - viewingShopRepair.deposit)}
                        </div>
                      </Field>
                      <Field label="Giờ nhận">
                        <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3">
                          <ColoredDateTime value={viewingShopRepair.receiveDate} size="md" />
                        </div>
                      </Field>
                      <Field label="Ghi chú / Lỗi">
                        <div className="flex min-h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 py-2 text-slate-800 sm:col-span-2">
                          {viewingShopRepair.issue?.trim() || "Không có"}
                        </div>
                      </Field>
                      <Field label="Mã đơn">
                        <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 font-mono text-xs text-slate-600">
                          {viewingShopRepair.id}
                        </div>
                      </Field>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-line pt-4">
                      <button
                        type="button"
                        onClick={() => setViewingShopRepairId(null)}
                        className="h-10 rounded-lg border border-line bg-white px-4 font-bold text-muted"
                      >
                        Đóng
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setViewingShopRepairId(null);
                          setCloneShopRepairDraft(null);
                          setEditingShopRepairId(viewingShopRepair.id);
                          setIsShopRepairModalOpen(true);
                        }}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 font-bold text-white hover:bg-brand-dark"
                      >
                        <Edit3 size={16} /> Sửa đơn
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </section>
          );
        })()}

        {activePage === "online-repairs" && (() => {
          const todayString = vnNowDate();
          const displayDate = onlineRepairDate || todayString;
          const orderTimeKey = (r: OnlineRepair) =>
            (r.receiveDate || r.createdAt || "").replace("T", " ");

          let filteredRepairs = onlineRepairs;
          if (onlineRepairDate) {
            filteredRepairs = filteredRepairs.filter((r) => orderTimeKey(r).includes(onlineRepairDate));
          } else {
            filteredRepairs = filteredRepairs.filter((r) => orderTimeKey(r).startsWith(onlineRepairMonth));
          }

          if (onlineRepairFilter !== "all") {
            filteredRepairs = filteredRepairs.filter((r) =>
              onlineRepairFilter === "paid" ? r.isPaid : !r.isPaid
            );
          }

          const debtVisibleRepairs = filteredRepairs.filter((r) => r.paymentStatus === "NỢ DAI");
          const debtVisibleIds = debtVisibleRepairs.map((r) => r.id);
          const selectedDebtCount = debtVisibleIds.filter((id) =>
            selectedSoftwareIds.includes(id)
          ).length;
          const allDebtSelected =
            debtVisibleIds.length > 0 &&
            debtVisibleIds.every((id) => selectedSoftwareIds.includes(id));

          const monthlyRepairs = onlineRepairs.filter((s) =>
            orderTimeKey(s).startsWith(onlineRepairMonth)
          );
          const dailyRepairs = onlineRepairs.filter((s) =>
            orderTimeKey(s).includes(displayDate)
          );

          return (
          <section className="grid gap-4">
            {(softwareBackendError || softwareLoading) && (
              <div
                className={`rounded-lg border p-3 text-sm font-semibold ${
                  softwareBackendError
                    ? "border-red-200 bg-red-50 text-danger"
                    : "border-line bg-white text-muted"
                }`}
              >
                {softwareBackendError || "Đang tải đơn phần mềm từ Supabase…"}
                {!softwareLoading && softwareBackendError ? (
                  <button
                    type="button"
                    onClick={() => void reloadSoftwareFromDb()}
                    className="ml-3 font-black text-brand underline"
                  >
                    Thử lại
                  </button>
                ) : null}
              </div>
            )}
            {isOnlineRepairModalOpen && (() => {
              const onlineRepairFormDefaults = editingOnlineRepairId
                ? onlineRepairs.find((r) => r.id === editingOnlineRepairId) ?? null
                : cloneOnlineRepairDraft;
              const isCloneMode = !editingOnlineRepairId && Boolean(cloneOnlineRepairDraft);
              return (
              <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-md">
                <div className="relative my-auto w-full max-w-4xl rounded-2xl border border-white/20 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.4)] backdrop-blur-xl">
                  {softwareSaving ? (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/55 backdrop-blur-sm">
                      <Loader2 size={40} className="animate-spin text-brand" />
                      <p className="text-base font-black text-ink">Đang lưu…</p>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between border-b border-slate-200/60 bg-white/80 p-4 backdrop-blur-md">
                    <h2 className="text-xl font-black text-brand">
                      {editingOnlineRepairId
                        ? "Sửa đơn Phần mềm"
                        : isCloneMode
                          ? "Tạo đơn (nhân bản)"
                          : "Tạo đơn Phần mềm"}
                    </h2>
                    <button
                      type="button"
                      onClick={closeOnlineRepairModal}
                      disabled={softwareSaving}
                      className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className={`p-4 ${softwareSaving ? "pointer-events-none select-none" : ""}`}>
                    {softwareBackendError ? (
                      <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-danger">
                        {softwareBackendError}
                      </div>
                    ) : null}
                    {isCloneMode ? (
                      <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">
                        Đã copy thông tin đơn mẫu — sửa nếu cần, rồi lưu thành đơn mới.
                      </div>
                    ) : null}
                    <form
                      key={
                        editingOnlineRepairId ??
                        (isCloneMode ? `clone-${cloneOnlineRepairFormKey}` : "new")
                      }
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (softwareSaving) return;
                        const form = new FormData(e.currentTarget);
                        const quote = parseInputMoney(form.get("quote"));
                        const deposit = parseInputMoney(form.get("deposit"));
                        const pStatus = String(
                          form.get("paymentStatus")
                        ) as OnlineRepair["paymentStatus"];
                        const isEdit = Boolean(editingOnlineRepairId);
                        const isClone = !isEdit && Boolean(cloneOnlineRepairDraft);
                        const existing = editingOnlineRepairId
                          ? onlineRepairs.find((r) => r.id === editingOnlineRepairId)
                          : null;
                        const draft = isClone ? cloneOnlineRepairDraft : null;

                        const payload = {
                          id: editingOnlineRepairId ?? undefined,
                          customerName: String(form.get("customerName")),
                          customerType: (form.get("customerType")
                            ? String(form.get("customerType"))
                            : existing?.customerType ||
                              draft?.customerType ||
                              "Vãng lai") as OnlineRepair["customerType"],
                          deviceName: String(form.get("deviceName")),
                          issue: existing?.issue ?? draft?.issue ?? "",
                          quote,
                          deposit,
                          receiveDate: (() => {
                            const d = String(form.get("receiveDatePart") || "").trim();
                            const h = String(form.get("receiveHour") || "").trim().padStart(2, "0");
                            const m = String(form.get("receiveMinute") || "").trim().padStart(2, "0");
                            // Fallback: ô time gộp (nếu còn)
                            const t =
                              h && m && /^\d{2}$/.test(h) && /^\d{2}$/.test(m)
                                ? `${h}:${m}`
                                : String(form.get("receiveTimePart") || "").trim();
                            if (d && t) return `${d}T${t}`;
                            if (d) return d;
                            return String(form.get("receiveDate") || "");
                          })(),
                          completeDate: existing?.completeDate ?? "",
                          paymentDate: existing?.paymentDate ?? "",
                          paymentStatus: pStatus,
                          rewardPoints: existing?.rewardPoints ?? 0,
                          isPaid: pStatus === "Đã thanh toán",
                          actorUsername: currentUser.username,
                          storeId:
                            currentUser.role === "staff"
                              ? currentUser.storeId
                              : dataScopeStore !== "all"
                                ? dataScopeStore
                                : currentUser.storeId,
                        };

                        setSoftwareSaving(true);
                        setSoftwareBackendError("");
                        try {
                          const saved = await apiUpsertSoftwareOrder(payload);
                          // Droplist chỉ cập nhật khi bấm nút + (ManageableSelect), không auto-ensure khi lưu đơn.
                          pushLog(
                            isEdit
                              ? "Sửa đơn phần mềm"
                              : isClone
                                ? "Nhân bản đơn phần mềm"
                                : "Tạo đơn phần mềm",
                            `${saved.customerName} — ${saved.deviceName}`,
                            softwareLookupStoreId
                          );
                          // Reload grid từ DB để danh sách đơn khớp server.
                          await reloadSoftwareFromDb();
                          showUiToast(
                            "success",
                            isEdit
                              ? `Đã sửa đơn ${saved.customerName} — ${saved.deviceName} thành công.`
                              : isClone
                                ? `Đã nhân bản đơn ${saved.customerName} — ${saved.deviceName} thành công.`
                                : `Đã tạo đơn ${saved.customerName} — ${saved.deviceName} thành công.`
                          );
                          setSoftwareSaving(false);
                          setEditingOnlineRepairId(null);
                          setCloneOnlineRepairDraft(null);
                          setIsOnlineRepairModalOpen(false);
                        } catch (err) {
                          const msg = toUiError(err);
                          setSoftwareBackendError(msg);
                          showUiToast("error", `Lưu đơn phần mềm thất bại: ${msg}`);
                          setSoftwareSaving(false);
                        }
                      }}
                      className="grid gap-3"
                      autoComplete="off"
                      spellCheck={false}
                    >
                <div className="grid gap-3 sm:grid-cols-2">
                  <ManageableSelect
                    label="Khách hàng / Thợ"
                    name="customerName"
                    options={softwareCustomerOptions}
                    setOptions={setFormLookupOptions(SOFTWARE_LOOKUP_CATEGORIES.customer, softwareLookupStoreId)}
                    defaultValue={onlineRepairFormDefaults?.customerName}
                    categoryCode={SOFTWARE_LOOKUP_CATEGORIES.customer}
                    storeId={softwareLookupStoreId}
                    onRenameCascade={reloadSoftwareFromDb}
                    allowManage
                    allowFreeText
                    actorUsername={currentUser.username}
                  />
                  <ManageableSelect
                    label="Tên máy"
                    name="deviceName"
                    options={softwareDeviceOptions}
                    setOptions={setFormLookupOptions(SOFTWARE_LOOKUP_CATEGORIES.device, softwareLookupStoreId)}
                    defaultValue={onlineRepairFormDefaults?.deviceName}
                    categoryCode={SOFTWARE_LOOKUP_CATEGORIES.device}
                    storeId={softwareLookupStoreId}
                    onRenameCascade={reloadSoftwareFromDb}
                    allowManage
                    allowFreeText
                    actorUsername={currentUser.username}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ManageableSelect
                    label="Báo giá"
                    name="quote"
                    options={softwareQuoteOptions}
                    setOptions={setFormLookupOptions(SOFTWARE_LOOKUP_CATEGORIES.quote, softwareLookupStoreId)}
                    defaultValue={formatInputMoney(onlineRepairFormDefaults?.quote ?? "")}
                    categoryCode={SOFTWARE_LOOKUP_CATEGORIES.quote}
                    storeId={softwareLookupStoreId}
                    onRenameCascade={reloadSoftwareFromDb}
                    allowManage
                    allowFreeText
                    actorUsername={currentUser.username}
                  />
                  <ManageableSelect
                    label="Phí dịch vụ"
                    name="deposit"
                    options={softwareFeeOptions}
                    setOptions={setFormLookupOptions(SOFTWARE_LOOKUP_CATEGORIES.fee, softwareLookupStoreId)}
                    defaultValue={formatInputMoney(
                      onlineRepairFormDefaults != null ? onlineRepairFormDefaults.deposit ?? 0 : 0
                    )}
                    categoryCode={SOFTWARE_LOOKUP_CATEGORIES.fee}
                    storeId={softwareLookupStoreId}
                    onRenameCascade={reloadSoftwareFromDb}
                    allowManage
                    allowFreeText
                    actorUsername={currentUser.username}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(() => {
                    const raw =
                      onlineRepairFormDefaults?.receiveDate || vnNowDateTimeLocal();
                    const local = String(raw).slice(0, 16).replace(" ", "T");
                    const [datePart = "", timePart = ""] = local.includes("T")
                      ? local.split("T")
                      : [local.slice(0, 10), "00:00"];
                    const [hourPart = "00", minutePart = "00"] = (timePart || "00:00")
                      .slice(0, 5)
                      .split(":");
                    const hours = Array.from({ length: 24 }, (_, i) =>
                      String(i).padStart(2, "0")
                    );
                    const minutes = Array.from({ length: 60 }, (_, i) =>
                      String(i).padStart(2, "0")
                    );
                    return (
                      <div className="grid min-w-0 gap-1.5 sm:col-span-1">
                        <span className="text-base font-black text-slate-950">
                          Ngày & giờ <span className="ml-1 text-red-500">*</span>
                        </span>
                        <div className="grid min-w-0 grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.7fr)] gap-2">
                          <label className="grid min-w-0 gap-1">
                            <span className="text-xs font-bold text-brand">Ngày</span>
                            <input
                              name="receiveDatePart"
                              type="date"
                              required
                              defaultValue={datePart}
                              title="Ngày tháng năm"
                              className="h-10 w-full min-w-0 rounded-lg border border-line bg-brand-soft/40 px-2 text-sm font-black text-brand outline-none focus:border-brand"
                            />
                          </label>
                          <label className="grid min-w-0 gap-1">
                            <span className="text-xs font-bold text-amber-800">Giờ</span>
                            <select
                              name="receiveHour"
                              required
                              defaultValue={hourPart.padStart(2, "0")}
                              title="Giờ (0–23)"
                              className="h-10 w-full min-w-0 rounded-lg border border-line bg-amber-50 px-1.5 text-sm font-black text-amber-900 outline-none focus:border-amber-500"
                            >
                              {hours.map((h) => (
                                <option key={`h-${h}`} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="grid min-w-0 gap-1">
                            <span className="text-xs font-bold text-amber-800">Phút</span>
                            <select
                              name="receiveMinute"
                              required
                              defaultValue={minutePart.padStart(2, "0")}
                              title="Phút (0–59)"
                              className="h-10 w-full min-w-0 rounded-lg border border-line bg-amber-50 px-1.5 text-sm font-black text-amber-900 outline-none focus:border-amber-500"
                            >
                              {minutes.map((m) => (
                                <option key={`m-${m}`} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    );
                  })()}
                  <Field label="Thanh toán" required>
                    <select
                      name="paymentStatus"
                      required
                      defaultValue={onlineRepairFormDefaults?.paymentStatus ?? "NỢ DAI"}
                      className="h-10 rounded-lg border border-line bg-white px-3 font-semibold"
                    >
                      <option value="NỢ DAI">NỢ DAI</option>
                      <option value="Đã thanh toán">Đã thanh toán</option>
                    </select>
                  </Field>
                </div>
                <div className="flex justify-end gap-2 border-t border-line pt-4">
                  <button
                    type="button"
                    onClick={closeOnlineRepairModal}
                    disabled={softwareSaving}
                    className="h-10 rounded-lg border border-line bg-white px-4 font-bold text-muted disabled:opacity-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={softwareSaving}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {softwareSaving ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : editingOnlineRepairId ? (
                      <Edit3 size={18} />
                    ) : isCloneMode ? (
                      <CopyPlus size={18} />
                    ) : (
                      <Plus size={18} />
                    )}
                    {softwareSaving
                      ? "Đang lưu…"
                      : editingOnlineRepairId
                        ? "Lưu thay đổi"
                        : isCloneMode
                          ? "Lưu đơn mới"
                          : "Tạo đơn"}
                  </button>
                </div>
              </form>
                  </div>
                </div>
              </div>
              );
            })()}

            <div className="grid gap-4">
              <div className="rounded-lg bg-gradient-to-br from-pink-600 via-rose-500 to-fuchsia-600 p-4 sm:p-5 text-white shadow relative overflow-hidden flex flex-col md:flex-row justify-between items-center md:text-left text-center gap-4 mb-4">
                <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-white/10 blur-3xl mix-blend-overlay pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -mb-16 -ml-16 h-48 w-48 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
                <div className="relative z-10 md:w-1/2">
                  <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white drop-shadow-sm">
                    Trung Tâm Giải Mã Phần Mềm Điện Thoại Nam Sách
                  </h1>
                </div>
                <div className="relative z-10 md:w-1/2 flex flex-col md:items-end gap-1">
                  <p className="flex items-center gap-2 text-xs font-bold text-white sm:text-sm">
                    <span className="hidden h-1.5 w-1.5 shrink-0 rounded-full bg-white md:block"></span>
                    Chuyên Nghiệp - Nhanh Chóng - Giá Thành Hợp Lý
                  </p>
                  <p className="flex items-center gap-2 text-xs font-semibold text-white sm:text-sm">
                    <span className="hidden h-1.5 w-1.5 shrink-0 rounded-full bg-white md:block"></span>
                    Địa chỉ tin cậy và uy tín tại số 1 TP. Hải Phòng
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-brand bg-emerald-50 p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="block text-sm font-bold text-emerald-800">Lợi nhuận Tháng</span>
                    <input
                      type="month"
                      value={onlineRepairMonth}
                      onChange={(e) => {
                        setOnlineRepairMonth(e.target.value);
                        setSelectedSoftwareIds([]);
                      }}
                      className="h-8 rounded border border-emerald-200 bg-white px-2 text-sm font-semibold text-emerald-800"
                    />
                  </div>
                  <strong className="text-3xl text-emerald-700">{isOnlineRepairSensitiveHidden ? "*** ₫" : formatMoney(monthlyRepairs.reduce((sum, r) => sum + (r.quote - r.deposit), 0))}</strong>
                  <div className="mt-2 flex items-center justify-between border-t border-emerald-200/50 pt-2 text-sm font-semibold text-emerald-700/80">
                    <span>Dư nợ tháng:</span>
                    <span>{isOnlineRepairSensitiveHidden ? "***" : formatMoney(monthlyRepairs.filter(r => r.paymentStatus === "NỢ DAI").reduce((sum, r) => sum + r.quote, 0))}</span>
                  </div>
                </div>
                <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="block text-sm font-bold text-slate-500">Lợi nhuận Ngày</span>
                    <input type="date" value={displayDate} onChange={e => setOnlineRepairDate(e.target.value)} className="h-8 rounded border border-line bg-slate-50 px-2 text-sm font-semibold text-slate-700" />
                  </div>
                  <strong className="text-3xl text-red-600">{isOnlineRepairSensitiveHidden ? "*** ₫" : formatMoney(dailyRepairs.reduce((sum, r) => sum + (r.quote - r.deposit), 0))}</strong>
                  <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-sm font-semibold text-slate-500">
                    <span>Dư nợ ngày:</span>
                    <span>{isOnlineRepairSensitiveHidden ? "***" : formatMoney(dailyRepairs.filter(r => r.paymentStatus === "NỢ DAI").reduce((sum, r) => sum + r.quote, 0))}</span>
                  </div>
                </div>
              </div>

              <Panel title="Danh sách Phần mềm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={onlineRepairFilter}
                      onChange={(e) => {
                        setOnlineRepairFilter(e.target.value);
                        setSelectedSoftwareIds([]);
                      }}
                      className="h-10 rounded-lg border border-line px-3 text-sm font-bold"
                    >
                      <option value="all">Tất cả trạng thái</option>
                      <option value="paid">Đã thanh toán</option>
                      <option value="unpaid">NỢ DAI</option>
                    </select>
                    
                    <div className="flex items-center gap-2 rounded-lg border border-line bg-slate-50 px-2">
                      <span className="text-sm font-semibold text-slate-500">Lọc ngày:</span>
                      <input
                        type="date"
                        value={onlineRepairDate}
                        onChange={(e) => {
                          setOnlineRepairDate(e.target.value);
                          setSelectedSoftwareIds([]);
                        }}
                        className="h-8 rounded border border-line px-2 text-sm"
                      />
                      {onlineRepairDate && (
                        <button
                          type="button"
                          onClick={() => {
                            setOnlineRepairDate("");
                            setSelectedSoftwareIds([]);
                          }}
                          className="text-sm font-bold text-brand hover:underline"
                        >
                          Tất cả tháng
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={softwarePaying || selectedDebtCount === 0}
                      onClick={() => void markSelectedSoftwarePaid(debtVisibleRepairs)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Đánh dấu các đơn NỢ DAI đã chọn → Đã thanh toán"
                    >
                      {softwarePaying ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={18} />
                      )}
                      {softwarePaying
                        ? "Đang thanh toán…"
                        : selectedDebtCount > 0
                          ? `Thanh toán (${selectedDebtCount})`
                          : "Thanh toán"}
                    </button>
                    <button onClick={() => setIsOnlineRepairSensitiveHidden(!isOnlineRepairSensitiveHidden)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 font-bold text-slate-600 shadow-sm transition hover:bg-slate-50">
                      {isOnlineRepairSensitiveHidden ? <EyeOff size={18} /> : <Eye size={18} />}
                      {isOnlineRepairSensitiveHidden ? "Hiện" : "Ẩn"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingOnlineRepairId(null);
                        setCloneOnlineRepairDraft(null);
                        setIsOnlineRepairModalOpen(true);
                      }}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white shadow hover:bg-brand-dark"
                    >
                      <Plus size={18} /> Tạo đơn mới
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto pb-4">
                  <DataTable
                    headers={[
                      "",
                      "Khách hàng",
                      "Tên máy",
                      "Báo giá",
                      "Phí dịch vụ",
                      "Lãi",
                      "Giờ",
                      "Trạng thái TT",
                      "Thao tác",
                    ]}
                    rows={filteredRepairs.map((item) => {
                      const isNợ = item.paymentStatus === "NỢ DAI";
                      const isDaThanhToan = item.paymentStatus === "Đã thanh toán";
                      const isChecked = selectedSoftwareIds.includes(item.id);

                      return [
                        <div
                          key={`chk-${item.id}`}
                          className="flex items-center justify-center"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-brand"
                            checked={isChecked}
                            disabled={!isNợ || softwarePaying}
                            title={isNợ ? "Chọn để thanh toán" : "Chỉ chọn được đơn NỢ DAI"}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setSelectedSoftwareIds((prev) => {
                                if (on) return prev.includes(item.id) ? prev : [...prev, item.id];
                                return prev.filter((x) => x !== item.id);
                              });
                            }}
                          />
                        </div>,
                        <span key={`c-${item.id}`} className="font-bold text-brand whitespace-nowrap">{item.customerName}</span>,
                        <span key={`d-${item.id}`} className="font-semibold text-slate-700 whitespace-nowrap">{item.deviceName}</span>,
                        formatMoney(item.quote),
                        isOnlineRepairSensitiveHidden ? "***" : formatMoney(item.deposit),
                        <span key={`p-${item.id}`} className="font-black text-amber-700">{isOnlineRepairSensitiveHidden ? "***" : formatMoney(item.quote - item.deposit)}</span>,
                        <ColoredDateTime key={`dt-${item.id}`} value={item.receiveDate} />,
                        <span
                          key={`st-${item.id}`}
                          className={`inline-flex h-8 items-center rounded text-xs font-bold px-2 shadow-sm border border-line ${isNợ ? "bg-red-50 text-red-600" : isDaThanhToan ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-600"}`}
                        >
                          {isDaThanhToan ? "✅ Đã thanh toán" : "❌ NỢ DAI"}
                        </span>,
                        <div key={`act-${item.id}`} className="flex flex-nowrap items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingOnlineRepairId(item.id)}
                            title="Chi tiết"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCloneOnlineRepairDraft(null);
                              setEditingOnlineRepairId(item.id);
                              setIsOnlineRepairModalOpen(true);
                            }}
                            title="Sửa"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand transition hover:bg-brand/20"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openOnlineRepairCloneModal(item.id)}
                            title="Nhân bản thêm mới"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 transition hover:bg-sky-100"
                          >
                            <CopyPlus size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteOnlineRepair(item.id)}
                            title="Xóa đơn"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-danger transition hover:bg-red-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ];
                    })}
                  />
                </div>
                {debtVisibleIds.length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-line pt-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand"
                        checked={allDebtSelected}
                        disabled={softwarePaying}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setSelectedSoftwareIds((prev) => {
                            if (on) {
                              const set = new Set(prev);
                              debtVisibleIds.forEach((id) => set.add(id));
                              return Array.from(set);
                            }
                            return prev.filter((id) => !debtVisibleIds.includes(id));
                          });
                        }}
                      />
                      Chọn tất cả NỢ DAI trên lưới ({debtVisibleIds.length})
                    </label>
                    {selectedDebtCount > 0 ? (
                      <span className="text-sm font-semibold text-muted">
                        Đã chọn {selectedDebtCount} đơn nợ
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </Panel>
            </div>

            {viewingOnlineRepair && (
              <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-md">
                <section className="max-h-[92vh] w-full max-w-[640px] overflow-auto rounded-2xl border border-white/20 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.4)] backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-slate-200/60 bg-gradient-to-r from-brand/10 to-transparent p-5">
                    <h2 className="text-xl font-black text-brand">Chi tiết đơn phần mềm</h2>
                    <button
                      type="button"
                      onClick={() => setViewingOnlineRepairId(null)}
                      className="h-9 rounded-xl border border-slate-200/60 bg-white/50 px-4 text-sm font-bold text-slate-600 backdrop-blur-md transition hover:bg-white hover:text-slate-900"
                    >
                      Đóng
                    </button>
                  </div>
                  <div className="grid gap-4 p-5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                        <Terminal size={24} />
                      </div>
                      <div>
                        <strong className="block text-lg">{viewingOnlineRepair.customerName}</strong>
                        <span className="text-sm font-semibold text-muted">{viewingOnlineRepair.deviceName}</span>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Khách hàng / Thợ">
                        <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 font-bold text-brand">
                          {viewingOnlineRepair.customerName}
                        </div>
                      </Field>
                      <Field label="Loại khách">
                        <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-slate-800">
                          {viewingOnlineRepair.customerType || "Vãng lai"}
                        </div>
                      </Field>
                      <Field label="Tên máy">
                        <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 font-semibold text-slate-800">
                          {viewingOnlineRepair.deviceName}
                        </div>
                      </Field>
                      <Field label="Trạng thái thanh toán">
                        <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3">
                          <span
                            className={`inline-flex h-8 items-center rounded px-2 text-xs font-bold ${
                              viewingOnlineRepair.paymentStatus === "Đã thanh toán"
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-red-50 text-red-600"
                            }`}
                          >
                            {viewingOnlineRepair.paymentStatus === "Đã thanh toán"
                              ? "✅ Đã thanh toán"
                              : "❌ NỢ DAI"}
                          </span>
                        </div>
                      </Field>
                      <Field label="Báo giá">
                        <div className="flex h-12 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-xl font-black text-slate-800">
                          {formatMoney(viewingOnlineRepair.quote)}
                        </div>
                      </Field>
                      <Field label="Phí dịch vụ">
                        <div className="flex h-12 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-xl font-black text-slate-700">
                          {formatMoney(viewingOnlineRepair.deposit)}
                        </div>
                      </Field>
                      <Field label="Lãi">
                        <div className="flex h-12 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-xl font-black text-amber-700">
                          {formatMoney(viewingOnlineRepair.quote - viewingOnlineRepair.deposit)}
                        </div>
                      </Field>
                      <Field label="Giờ nhận">
                        <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3">
                          <ColoredDateTime value={viewingOnlineRepair.receiveDate} size="md" />
                        </div>
                      </Field>
                      <Field label="Ghi chú / Lỗi">
                        <div className="flex min-h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 py-2 text-slate-800 sm:col-span-2">
                          {viewingOnlineRepair.issue?.trim() || "Không có"}
                        </div>
                      </Field>
                      <Field label="Mã đơn">
                        <div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 font-mono text-xs text-slate-600">
                          {viewingOnlineRepair.id}
                        </div>
                      </Field>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-line pt-4">
                      <button
                        type="button"
                        onClick={() => setViewingOnlineRepairId(null)}
                        className="h-10 rounded-lg border border-line bg-white px-4 font-bold text-muted"
                      >
                        Đóng
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setViewingOnlineRepairId(null);
                          setCloneOnlineRepairDraft(null);
                          setEditingOnlineRepairId(viewingOnlineRepair.id);
                          setIsOnlineRepairModalOpen(true);
                        }}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 font-bold text-white hover:bg-brand-dark"
                      >
                        <Edit3 size={16} /> Sửa đơn
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </section>
          );
        })()}
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <h2 className="mb-4 text-lg font-black">{title}</h2>
      {children}
    </section>
  );
}

/** Ngày (xanh brand) + giờ phút (vàng amber) — đồng bộ form tạo đơn. */
function ColoredDateTime({
  value,
  size = "sm",
}: {
  value?: string | null;
  size?: "sm" | "md";
}) {
  const raw = formatVnDateTime(value) || String(value || "").replace("T", " ").trim();
  if (!raw) {
    return <span className="text-muted">—</span>;
  }
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/);
  const textCls = size === "md" ? "text-sm font-bold" : "text-xs font-semibold";
  if (!m) {
    return <span className={`${textCls} text-slate-600 whitespace-nowrap`}>{raw}</span>;
  }
  const datePart = m[1];
  const timePart = m[2].slice(0, 5); // HH:mm
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${textCls}`}>
      <span className="rounded-md bg-brand-soft/70 px-1.5 py-0.5 font-black text-brand">{datePart}</span>
      <span className="rounded-md bg-amber-50 px-1.5 py-0.5 font-black text-amber-800">{timePart}</span>
    </span>
  );
}

/** Max visible option rows before dropdown scrolls (row = h-10). */
const DROPDOWN_MAX_VISIBLE = 10;
const DROPDOWN_PANEL_MAX_H = `${DROPDOWN_MAX_VISIBLE * 2.5}rem`; // 10 × h-10

type ScrollableSelectOption = { value: string; label: string };

/** Custom droplist: max 10 rows + scroll; fixed panel so modal overflow doesn't clip.
 *  allowFreeText = combobox: gõ tay + chọn từ list (lọc theo text đang gõ). */
function ScrollableSelect({
  name,
  options,
  value,
  onChange,
  required = true,
  disabled = false,
  className = "",
  placeholder = "Chọn",
  colorPreview = false,
  allowFreeText = false,
}: {
  name: string;
  options: ScrollableSelectOption[];
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  /** Hiện chấm màu cạnh option (dùng cho Màu sắc). */
  colorPreview?: boolean;
  /** true = nhập tay + droplist (combobox), không bắt buộc chọn đúng option. */
  allowFreeText?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedLabel = useMemo(() => {
    const hit = options.find((o) => o.value === value);
    return hit?.label ?? (value || "");
  }, [options, value]);

  const visibleOptions = useMemo(() => {
    if (!allowFreeText) return options;
    const q = value.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [allowFreeText, options, value]);

  const updatePanelPosition = useCallback(() => {
    const el = allowFreeText ? inputRef.current : triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Nút chevron cạnh input: lấy width cả khối root
    const rootW = rootRef.current?.getBoundingClientRect().width ?? r.width;
    const spaceBelow = window.innerHeight - r.bottom - 8;
    const maxH = DROPDOWN_MAX_VISIBLE * 40; // px ≈ h-10
    const openUp =
      spaceBelow < Math.min(maxH, visibleOptions.length * 40) && r.top > spaceBelow;
    setPanelStyle({
      position: "fixed",
      left: allowFreeText ? (rootRef.current?.getBoundingClientRect().left ?? r.left) : r.left,
      width: Math.max(allowFreeText ? rootW : r.width, 120),
      zIndex: 200,
      maxHeight: DROPDOWN_PANEL_MAX_H,
      ...(openUp
        ? { bottom: window.innerHeight - r.top + 4, top: "auto" }
        : { top: r.bottom + 4, bottom: "auto" }),
    });
  }, [allowFreeText, visibleOptions.length]);

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
    const onScrollOrResize = () => updatePanelPosition();
    window.addEventListener("resize", onScrollOrResize);
    // capture scroll from modal overflow containers
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const t = event.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const panel =
    open && mounted
      ? createPortal(
          <ul
            ref={panelRef}
            role="listbox"
            style={panelStyle}
            className="overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-panel"
          >
            {visibleOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm font-semibold text-muted">
                {allowFreeText && value.trim()
                  ? "Không khớp — có thể dùng text vừa nhập"
                  : "Chưa có option"}
              </li>
            ) : (
              visibleOptions.map((o) => {
                const active = o.value === value;
                return (
                  <li key={`${name}-opt-${o.value}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(o.value);
                        setOpen(false);
                      }}
                      className={`flex h-10 w-full items-center gap-2 px-3 text-left text-sm font-semibold transition hover:bg-brand-soft ${
                        active ? "bg-brand-soft text-brand" : "text-ink"
                      }`}
                    >
                      {colorPreview ? <ColorDot color={o.label} size="sm" /> : null}
                      <span className="truncate">{o.label}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      {allowFreeText ? (
        <>
          {/* FormData: giá trị gõ tay không bị chặn bởi option list */}
          <input type="hidden" name={name} value={value} />
          <div className="flex h-10 w-full min-w-0 items-center gap-1 rounded-lg border border-line bg-white focus-within:border-brand">
            {colorPreview && value ? (
              <span className="pl-3">
                <ColorDot color={value} size="sm" />
              </span>
            ) : null}
            <input
              ref={inputRef}
              type="text"
              value={value}
              disabled={disabled}
              required={required}
              placeholder={placeholder}
              autoComplete="off"
              onFocus={() => !disabled && setOpen(true)}
              onChange={(e) => {
                onChange(e.target.value);
                if (!open) setOpen(true);
              }}
              className="min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-ink outline-none placeholder:text-muted disabled:opacity-60"
            />
            <button
              type="button"
              disabled={disabled}
              tabIndex={-1}
              aria-label="Mở danh sách"
              onClick={() => !disabled && setOpen((v) => !v)}
              className="grid h-full w-9 shrink-0 place-items-center text-muted hover:text-ink disabled:opacity-60"
            >
              <ChevronDown size={16} className={`transition ${open ? "rotate-180" : ""}`} />
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Native select for FormData + HTML required validation (visually hidden) */}
          <select
            name={name}
            required={required}
            value={value}
            disabled={disabled}
            tabIndex={-1}
            aria-hidden
            onChange={(e) => onChange(e.target.value)}
            className="pointer-events-none absolute h-px w-px opacity-0"
          >
            <option value="">{placeholder}</option>
            {options.map((o) => (
              <option key={`${name}-${o.value}`} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <button
            ref={triggerRef}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setOpen((v) => !v)}
            className="flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 text-left outline-none focus:border-brand disabled:opacity-60"
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {colorPreview && value ? <ColorDot color={value} size="sm" /> : null}
              <span className={`min-w-0 flex-1 truncate font-semibold ${value ? "text-ink" : "text-muted"}`}>
                {value ? selectedLabel : placeholder}
              </span>
            </span>
            <ChevronDown size={16} className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} />
          </button>
        </>
      )}

      {panel}
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  defaultValue,
  onValueChange,
}: {
  label: string;
  name: string;
  options: string[][];
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const items = useMemo(
    () => options.map(([v, text]) => ({ value: v, label: text })),
    [options]
  );

  return (
    <Field label={label} required>
      <ScrollableSelect
        name={name}
        options={items}
        value={value}
        onChange={(next) => {
          setValue(next);
          onValueChange?.(next);
        }}
        required
      />
    </Field>
  );
}

function MoneyInput({ name, defaultValue }: { name: string; defaultValue?: number }) {
  function handleInput(event: FormEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    input.value = formatInputMoney(input.value);
  }

  return (
    <input
      name={name}
      inputMode="numeric"
      defaultValue={formatInputMoney(defaultValue)}
      onInput={handleInput}
      className="h-10 rounded-lg border border-line px-3"
    />
  );
}

function ManageableSelect({
  label,
  name,
  options,
  setOptions,
  defaultValue,
  required = true,
  categoryCode,
  storeId = "store-1",
  onRenameCascade,
  sortable = false,
  allowManage = true,
  actorUsername = "",
  /** Mặc định bật combobox (gõ tay + droplist) — chuẩn toàn hệ thống. */
  allowFreeText = true,
  /** Toast / feedback ngoài (vd form bán) — optional, không bắt buộc kho/PM. */
  onManageNotify,
  /** Đồng bộ giá trị ra parent (form bán: bảo hành…). */
  onValueChange,
}: {
  label: string;
  name: string;
  options: string[];
  setOptions: (o: string[]) => void;
  defaultValue?: string;
  required?: boolean;
  /** When set, +/sửa/xóa persist to lookup_items via API. */
  categoryCode?: string;
  /** Cửa hàng sở hữu droplist (bắt buộc khi categoryCode có). */
  storeId?: string;
  /** After rename (phones may cascade), refresh inventory from DB. */
  onRenameCascade?: () => Promise<void>;
  /** Hiện nút sắp xếp (ghi sort_order DB khi có categoryCode). */
  sortable?: boolean;
  /** false = ẩn nút +/sửa/xóa/sort (mặc định bật; staff chỉ mutate được store của mình ở API) */
  allowManage?: boolean;
  /** Username actor khi gọi API mutate lookup */
  actorUsername?: string;
  /**
   * true (mặc định) = gõ tay + chọn droplist + lọc option.
   * false = chỉ chọn trong list (dùng khi option cố định).
   */
  allowFreeText?: boolean;
  /** Gọi khi thêm/sửa/xóa option (persist hoặc local). */
  onManageNotify?: (type: "success" | "error", message: string) => void;
  /** Gọi mỗi khi giá trị combobox đổi (gõ tay / chọn / + / sửa / xóa). */
  onValueChange?: (value: string) => void;
}) {
  const [value, setValueState] = useState(defaultValue ?? "");
  const setValue = (next: string) => {
    setValueState(next);
    onValueChange?.(next);
  };
  const [busy, setBusy] = useState(false);
  /** Inline editor — tránh window.prompt (thường bị chặn / mất focus trong modal). */
  const [editMode, setEditMode] = useState<null | "add" | "edit">(null);
  const [draftText, setDraftText] = useState("");
  const [manageError, setManageError] = useState("");
  const [manageSuccess, setManageSuccess] = useState("");
  const draftInputRef = useRef<HTMLInputElement>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSuccess = (msg: string) => {
    setManageSuccess(msg);
    onManageNotify?.("success", msg);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setManageSuccess(""), 2500);
  };

  const flashError = (msg: string) => {
    setManageError(msg);
    onManageNotify?.("error", msg);
  };

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (editMode && draftInputRef.current) {
      draftInputRef.current.focus();
      draftInputRef.current.select();
    }
  }, [editMode]);

  const handleSort = async () => {
    if (!allowManage) return;
    if (!options.length) return;
    const selected = value;
    setManageError("");

    if (!categoryCode) {
      const sorted = [...options].sort((a, b) =>
        a.localeCompare(b, "vi", { numeric: true, sensitivity: "base" })
      );
      setOptions(sorted);
      if (selected) setValue(selected);
      return;
    }

    try {
      setBusy(true);
      const result = await apiSortLookupItems(categoryCode, actorUsername, storeId);
      setOptions(result.labels);
      if (selected) setValue(selected);
    } catch (err) {
      setManageError(toUiError(err));
    } finally {
      setBusy(false);
    }
  };

  /** Chỉ sửa/xóa option đã có trong droplist — text gõ tay (chưa +) không phải option. */
  const valueInOptions = Boolean(
    value && options.some((o) => o.toLowerCase() === value.toLowerCase())
  );

  const openAddEditor = () => {
    if (!allowManage || busy) return;
    setManageError("");
    setManageSuccess("");
    // Ưu tiên text đang gõ trên combobox
    setDraftText(value.trim());
    setEditMode("add");
  };

  const openEditEditor = () => {
    if (!allowManage || busy || !value || !valueInOptions) return;
    setManageError("");
    setManageSuccess("");
    setDraftText(value);
    setEditMode("edit");
  };

  const cancelEditor = () => {
    setEditMode(null);
    setDraftText("");
    setManageError("");
  };

  const commitEditor = async () => {
    if (!allowManage || busy) return;
    const next = draftText.trim();
    if (!next) {
      setManageError("Nhập giá trị option.");
      return;
    }

    if (editMode === "add") {
      if (options.some((o) => o.toLowerCase() === next.toLowerCase())) {
        flashError(`"${next}" đã có trong danh sách.`);
        return;
      }
      if (!categoryCode) {
        setOptions([...options, next]);
        setValue(next);
        cancelEditor();
        flashSuccess(`Đã thêm "${next}" (chỉ phiên này — chưa gắn DB).`);
        return;
      }
      if (!actorUsername?.trim()) {
        flashError("Thiếu tài khoản đăng nhập — không thêm được option.");
        return;
      }
      try {
        setBusy(true);
        setManageError("");
        const result = await apiAddLookupItem(categoryCode, next, actorUsername, storeId);
        setOptions(result.labels);
        setValue(result.label ?? next);
        cancelEditor();
        flashSuccess(`Đã lưu "${result.label ?? next}" vào droplist.`);
      } catch (err) {
        flashError(toUiError(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (editMode === "edit") {
      const oldVal = value;
      if (!oldVal || next === oldVal) {
        cancelEditor();
        return;
      }
      if (!categoryCode) {
        setOptions(options.map((o) => (o === oldVal ? next : o)));
        setValue(next);
        cancelEditor();
        flashSuccess(`Đã đổi tên option (chỉ phiên này).`);
        return;
      }
      if (!actorUsername?.trim()) {
        flashError("Thiếu tài khoản đăng nhập — không sửa được option.");
        return;
      }
      try {
        setBusy(true);
        setManageError("");
        const result = await apiUpdateLookupItem(
          categoryCode,
          oldVal,
          next,
          actorUsername,
          storeId
        );
        setOptions(result.labels);
        setValue(result.label ?? next);
        if (onRenameCascade) await onRenameCascade();
        cancelEditor();
        flashSuccess(`Đã cập nhật "${result.label ?? next}".`);
      } catch (err) {
        flashError(toUiError(err));
      } finally {
        setBusy(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!allowManage) return;
    if (!value || !valueInOptions) return;
    if (!window.confirm(`Xóa giá trị "${value}" khỏi danh sách ${label}?`)) return;
    setManageError("");
    setManageSuccess("");

    const removed = value;
    if (!categoryCode) {
      setOptions(options.filter((o) => o !== removed));
      setValue("");
      flashSuccess(`Đã xóa "${removed}" (chỉ phiên này).`);
      return;
    }
    if (!actorUsername?.trim()) {
      flashError("Thiếu tài khoản đăng nhập — không xóa được option.");
      return;
    }

    try {
      setBusy(true);
      const result = await apiDeactivateLookupItem(
        categoryCode,
        removed,
        actorUsername,
        storeId
      );
      setOptions(result.labels);
      setValue("");
      flashSuccess(`Đã xóa "${removed}" khỏi droplist.`);
    } catch (err) {
      flashError(toUiError(err));
    } finally {
      setBusy(false);
    }
  };

  const displayOptions = useMemo(() => {
    // Rule droplist toàn project: gõ tay / giá trị form KHÔNG được inject vào list.
    // Chỉ option đã có (seed DB hoặc bấm +) mới hiện trong droplist.
    // Text free-text vẫn nằm trên input (allowFreeText), không thành option.
    if (allowFreeText) {
      return options.map((o) => ({ value: o, label: o }));
    }
    // Chế độ chỉ-chọn: giữ value/default nếu bị xóa khỏi list để không mất hiển thị.
    let list = options;
    if (defaultValue && !list.includes(defaultValue)) list = [defaultValue, ...list];
    if (value && !list.includes(value)) list = [value, ...list];
    return list.map((o) => ({ value: o, label: o }));
  }, [options, defaultValue, value, allowFreeText]);

  return (
    <Field label={label} required={required}>
      <div className="grid min-w-0 gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <ScrollableSelect
            name={name}
            options={displayOptions}
            value={value}
            onChange={setValue}
            required={required && editMode == null}
            disabled={busy || editMode != null}
            className="min-w-0 flex-1"
            colorPreview={name === "color"}
            allowFreeText={allowFreeText}
            placeholder={allowFreeText ? "Chọn hoặc nhập" : "Chọn"}
          />
          {allowManage ? (
            <div
              className="flex shrink-0 items-center gap-1"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {sortable ? (
                <button
                  type="button"
                  onClick={() => void handleSort()}
                  disabled={busy || options.length < 2 || editMode != null}
                  title="Sắp xếp (nhỏ → lớn)"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                >
                  <ArrowUpDown size={16} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={openAddEditor}
                disabled={busy || editMode != null}
                title={
                  value.trim() && !valueInOptions
                    ? `Thêm "${value.trim()}" vào droplist`
                    : "Thêm option vào droplist"
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
              >
                <Plus size={16} />
              </button>
              <button
                type="button"
                onClick={openEditEditor}
                disabled={busy || !valueInOptions || editMode != null}
                title={
                  valueInOptions
                    ? "Sửa option trong droplist"
                    : "Chỉ sửa option đã có trong droplist (bấm + để thêm text đang gõ)"
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 disabled:opacity-50"
              >
                <Edit3 size={16} />
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={busy || !valueInOptions || editMode != null}
                title={
                  valueInOptions
                    ? "Xóa option khỏi droplist"
                    : "Chỉ xóa option đã có trong droplist"
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-danger hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : null}
        </div>

        {editMode ? (
          <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-brand/30 bg-brand-soft/40 p-2">
            <span className="text-xs font-bold text-brand-dark">
              {editMode === "add" ? `Thêm option — ${label}` : `Sửa option — ${label}`}
            </span>
            <div className="flex min-w-0 items-center gap-1.5">
              <input
                ref={draftInputRef}
                type="text"
                value={draftText}
                disabled={busy}
                onChange={(e) => setDraftText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void commitEditor();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEditor();
                  }
                }}
                className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-brand"
                placeholder="Nhập giá trị…"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void commitEditor()}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Đang lưu…
                  </>
                ) : (
                  "Lưu"
                )}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={cancelEditor}
                className="h-10 shrink-0 rounded-lg border border-line bg-white px-3 text-sm font-bold text-muted disabled:opacity-50"
              >
                Hủy
              </button>
            </div>
          </div>
        ) : null}

        {manageError ? (
          <p className="text-xs font-semibold text-danger">{manageError}</p>
        ) : null}
        {!manageError && manageSuccess ? (
          <p className="text-xs font-semibold text-emerald-700">{manageSuccess}</p>
        ) : null}
      </div>
    </Field>
  );
}

function InventoryBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm font-bold">
        <span>{label}</span>
        <span className="text-muted">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function DataTable({
  headers,
  rows,
  compact = false,
}: {
  headers: ReactNode[];
  rows: ReactNode[][];
  compact?: boolean;
}) {
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

  if (!rows.length) {
    return <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm font-semibold text-muted">Chưa có dữ liệu phù hợp.</div>;
  }

  return (
    <div className="overflow-auto rounded-xl border border-line bg-white shadow-sm">
      <table className={`min-w-max w-full border-collapse ${compact ? "text-base" : "text-base"}`}>
        <thead className={`bg-slate-100 text-center font-black uppercase tracking-wider text-slate-800 ${compact ? "text-xs" : "text-sm"}`}>
          <tr>
            {headers.map((header, headerIndex) => (
              <th
                key={typeof header === "string" || typeof header === "number" ? String(header) : `h-${headerIndex}`}
                className={`border-b border-line ${compact ? "px-2 py-3" : "px-5 py-4"} ${header === "Thao tác" ? `${compact ? "w-[118px]" : "w-[180px]"} text-center` : ""}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, rowIndex) => {
            const isSelected = selectedRowIndex === rowIndex;
            const rowTone = isSelected ? "bg-fuchsia-100/90 shadow-[inset_4px_0_0_#c026d3]" : rowIndex % 2 === 0 ? "bg-slate-50" : "bg-slate-200/60";

            return (
              <tr
                key={rowIndex}
                onClick={() => setSelectedRowIndex(rowIndex)}
                className={`cursor-pointer transition-all ${rowTone} hover:bg-fuchsia-100/70 hover:shadow-[inset_4px_0_0_#e879f9]`}
              >
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`} className={`${compact ? "px-2 py-3" : "px-5 py-4"} text-center align-middle`}>
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
