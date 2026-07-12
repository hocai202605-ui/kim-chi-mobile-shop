"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  PackagePlus,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
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
  PHONE_LOOKUP_CATEGORIES,
  SOFTWARE_LOOKUP_CATEGORIES,
  addLookupItem as apiAddLookupItem,
  deactivateLookupItem as apiDeactivateLookupItem,
  sortLookupItems as apiSortLookupItems,
  updateLookupItem as apiUpdateLookupItem,
} from "@/services/lookupService";
import {
  createSale as apiCreateSale,
  listRecentSales as apiListRecentSales,
} from "@/services/salesService";
import {
  deleteSoftwareOrder as apiDeleteSoftwareOrder,
  listSoftwareOrders as apiListSoftwareOrders,
  upsertSoftwareOrder as apiUpsertSoftwareOrder,
} from "@/services/softwareService";
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
import {
  formatVnDateTime,
  vnNowDate,
  vnNowDateTimeLocal,
  vnNowMonth,
  vnNowYear,
} from "@/lib/datetime";

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
type PaymentMethod = "Tiền mặt" | "Chuyển khoản" | "Thẻ" | "Khác";
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
  note: string;
};

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
  code: string;
  name: string;
  storeId: Exclude<StoreId, "all">;
  quantity: number;
  cost: number;
  price: number;
  status: AccessoryStatus;
};

type Sale = {
  id: string;
  createdAt: string;
  customerId: string;
  storeId: Exclude<StoreId, "all">;
  itemName: string;
  itemType: "Máy" | "Phụ kiện";
  quantity: number;
  amount: number;
  profit: number;
  payment: PaymentMethod;
  status: "Hoàn tất" | "Đã hủy";
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
  { id: "c1", name: "Anh Minh", phone: "0901 234 567", note: "Hay mua iPhone cũ" },
  { id: "c2", name: "Chị Lan", phone: "0918 222 333", note: "Khách sửa máy" },
  { id: "c3", name: "Bạn Huy", phone: "0987 111 222", note: "Quan tâm phụ kiện" },
];

const salesSeed: Sale[] = [
  { id: "s1", createdAt: "2026-07-05", customerId: "c1", storeId: "store-1", itemName: "iPhone 14 128GB", itemType: "Máy", quantity: 1, amount: 14500000, profit: 1500000, payment: "Chuyển khoản", status: "Hoàn tất" },
  { id: "s2", createdAt: "2026-07-06", customerId: "c3", storeId: "store-3", itemName: "Kính cường lực Kingkong", itemType: "Phụ kiện", quantity: 2, amount: 140000, profit: 104000, payment: "Tiền mặt", status: "Hoàn tất" },
  { id: "s3", createdAt: "2026-07-06", customerId: "c2", storeId: "store-1", itemName: "iPhone 13 128GB Hồng", itemType: "Máy", quantity: 1, amount: 11800000, profit: 1300000, payment: "Thẻ", status: "Hoàn tất" },
  { id: "s4", createdAt: "2026-07-05", customerId: "c1", storeId: "store-2", itemName: "Ốp lưng chống sốc iPhone 14", itemType: "Phụ kiện", quantity: 1, amount: 110000, profit: 70000, payment: "Tiền mặt", status: "Hoàn tất" },
  { id: "s5", createdAt: "2026-07-04", customerId: "c2", storeId: "store-1", itemName: "Cáp sạc nhanh 20W Apple", itemType: "Phụ kiện", quantity: 1, amount: 120000, profit: 65000, payment: "Chuyển khoản", status: "Hoàn tất" },
  { id: "s6", createdAt: "2026-07-03", customerId: "c3", storeId: "store-3", itemName: "Củ sạc GaN 65W Baseus", itemType: "Phụ kiện", quantity: 1, amount: 550000, profit: 230000, payment: "Tiền mặt", status: "Hoàn tất" },
  { id: "s7", createdAt: "2026-01-15", customerId: "c1", storeId: "store-1", itemName: "iPhone 15 Pro Max", itemType: "Máy", quantity: 2, amount: 62000000, profit: 5000000, payment: "Chuyển khoản", status: "Hoàn tất" },
  { id: "s8", createdAt: "2026-02-10", customerId: "c2", storeId: "store-2", itemName: "Samsung S22 Ultra", itemType: "Máy", quantity: 1, amount: 14000000, profit: 1200000, payment: "Tiền mặt", status: "Hoàn tất" },
  { id: "s9", createdAt: "2026-03-20", customerId: "c3", storeId: "store-3", itemName: "iPhone 11 64GB", itemType: "Máy", quantity: 3, amount: 19500000, profit: 3000000, payment: "Thẻ", status: "Hoàn tất" },
  { id: "s10", createdAt: "2026-04-05", customerId: "c1", storeId: "store-1", itemName: "Oppo Reno 8", itemType: "Máy", quantity: 1, amount: 8500000, profit: 1500000, payment: "Chuyển khoản", status: "Hoàn tất" },
  { id: "s11", createdAt: "2026-05-12", customerId: "c2", storeId: "store-2", itemName: "Xiaomi Redmi Note 12", itemType: "Máy", quantity: 4, amount: 16800000, profit: 2800000, payment: "Tiền mặt", status: "Hoàn tất" },
  { id: "s12", createdAt: "2026-06-25", customerId: "c3", storeId: "store-3", itemName: "iPhone 14 Pro Max", itemType: "Máy", quantity: 1, amount: 23200000, profit: 1700000, payment: "Chuyển khoản", status: "Hoàn tất" },
  { id: "s13", createdAt: "2026-02-28", customerId: "c1", storeId: "store-1", itemName: "Z Fold 5", itemType: "Máy", quantity: 1, amount: 28000000, profit: 3000000, payment: "Thẻ", status: "Hoàn tất" },
  { id: "s14", createdAt: "2026-04-18", customerId: "c2", storeId: "store-2", itemName: "iPhone XS Max", itemType: "Máy", quantity: 2, amount: 11000000, profit: 2000000, payment: "Tiền mặt", status: "Hoàn tất" },
  { id: "s15", createdAt: "2026-01-05", customerId: "c3", storeId: "store-3", itemName: "Sạc dự phòng 10000mAh", itemType: "Phụ kiện", quantity: 5, amount: 2000000, profit: 750000, payment: "Chuyển khoản", status: "Hoàn tất" },
  { id: "s16", createdAt: "2026-03-10", customerId: "c1", storeId: "store-1", itemName: "Tai nghe AirPods Pro 2", itemType: "Phụ kiện", quantity: 2, amount: 1100000, profit: 400000, payment: "Tiền mặt", status: "Hoàn tất" },
  { id: "s17", createdAt: "2026-05-22", customerId: "c2", storeId: "store-2", itemName: "Giá đỡ điện thoại ô tô", itemType: "Phụ kiện", quantity: 3, amount: 450000, profit: 240000, payment: "Thẻ", status: "Hoàn tất" },
  { id: "s18", createdAt: "2026-06-15", customerId: "c3", storeId: "store-3", itemName: "Dây đeo Apple Watch", itemType: "Phụ kiện", quantity: 4, amount: 480000, profit: 300000, payment: "Chuyển khoản", status: "Hoàn tất" },
];

const softwareServiceSeed: SoftwareService[] = [
  { id: "sw1", createdAt: "2026-07-07 16:18", customerName: "Anh Đức FB", deviceName: "Bypass iCloud", quantity: 1, revenue: 200000, cost: 0, profit: 200000, isPaid: true },
  { id: "sw2", createdAt: "2026-07-07 16:18", customerName: "Quân Thảo", deviceName: "A53s", quantity: 1, revenue: 100000, cost: 0, profit: 100000, isPaid: false },
  { id: "sw3", createdAt: "2026-07-07 23:47", customerName: "Dũng Mobi", deviceName: "Unlock mạng", quantity: 1, revenue: 5000000, cost: 3500000, profit: 1500000, isPaid: true },
];

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
  { id: "online-repairs", label: "Phần mềm", icon: Terminal },
  { id: "inventory", label: "Kho hàng", icon: Boxes },
  { id: "inventoryReports", label: "Báo cáo kho hàng", icon: FileText },
  { id: "sales", label: "Bán hàng", icon: ReceiptText },
  { id: "software", label: "Sửa chữa", icon: Wrench },
  { id: "customers", label: "Khách hàng", icon: Users },
  { id: "ledger", label: "Thu chi", icon: CreditCard },
  { id: "logs", label: "Nhật ký", icon: ClipboardList },
  { id: "accounts", label: "Tài khoản", icon: UserCog },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
] as const;

type PageId = (typeof navItems)[number]["id"];

const MENU_LABELS: Record<string, string> = Object.fromEntries(
  navItems.map((item) => [item.id, item.label])
);

function canAccessMenu(user: User, pageId: string): boolean {
  if (user.role === "owner") return true;
  return user.allowedMenus.includes(pageId);
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

function parseInputMoney(value: FormDataEntryValue | null) {
  return Number(String(value ?? "").replace(/\D/g, "") || 0);
}

/**
 * Giá kho đơn vị short (bớt 3 số 0): 16.900 lưu = 16.900.000 ₫ thật.
 * Nếu lỡ nhập full (≥ 1tr) thì chia 1000 về short.
 */
function parseShopMoney(value: FormDataEntryValue | null) {
  const n = parseInputMoney(value);
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
  const [activePage, setActivePage] = useState<PageId>("inventory");
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
  const [editingAccessoryId, setEditingAccessoryId] = useState<string | null>(null);
  const [editingSoftwareId, setEditingSoftwareId] = useState<string | null>(null);
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
  const [customers, setCustomers] = useState(customersSeed);
  const [phones, setPhones] = useState<PhoneItem[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [sales, setSales] = useState(salesSeed);
  const [softwareServices, setSoftwareServices] = useState(softwareServiceSeed);
  const [onlineRepairs, setOnlineRepairs] = useState<OnlineRepair[]>([]);
  const [softwareLoading, setSoftwareLoading] = useState(false);
  const [softwareBackendError, setSoftwareBackendError] = useState("");
  /** Đang gọi API lưu đơn phần mềm — mờ popup + chặn thao tác. */
  const [softwareSaving, setSoftwareSaving] = useState(false);
  const [repairs, setRepairs] = useState(repairsSeed);
  const [ledger, setLedger] = useState(ledgerSeed);
  const [logs, setLogs] = useState(logSeed);
  /** Droplist theo cửa hàng: storeCode → categoryCode → labels */
  const [lookupsByStore, setLookupsByStore] = useState<Record<string, Record<string, string[]>>>({});
  /** Cửa hàng đang gắn form máy (quyết định droplist +/sửa/xóa). */
  const [phoneFormStoreId, setPhoneFormStoreId] = useState<Exclude<StoreId, "all">>("store-1");
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

  /** Phần mềm: load từ Postgres qua API — không mock. */
  const reloadSoftwareFromDb = useCallback(async () => {
    setSoftwareLoading(true);
    setSoftwareBackendError("");
    try {
      const rows = await apiListSoftwareOrders();
      setOnlineRepairs(rows);
    } catch (err) {
      setOnlineRepairs([]);
      setSoftwareBackendError(toUiError(err));
    } finally {
      setSoftwareLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    // Sequential: inventory first, then software — fewer concurrent DB slots
    void (async () => {
      await reloadInventoryFromDb();
      await reloadSoftwareFromDb();
      try {
        const rows = await apiListRecentSales();
        setSales(
          rows.map((r) => ({
            id: r.id,
            createdAt: r.soldAt,
            customerId: "db",
            storeId: r.storeId,
            itemName: r.itemName,
            itemType: r.itemType,
            quantity: r.quantity,
            amount: r.amount,
            profit: r.profit,
            payment: r.payment as PaymentMethod,
            status: "Hoàn tất" as const,
          }))
        );
      } catch {
        /* keep seed until first successful load */
      }
    })();
  }, [currentUser, reloadInventoryFromDb, reloadSoftwareFromDb]);

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
  const accessoryTypeOptions = Array.from(new Set(accessories.map((item) => item.code.split("-")[0]).filter(Boolean)));
  const inventoryTypeOptions = inventoryTab === "phones" ? phoneTypeOptions : accessoryTypeOptions;

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
      const q = query.toLowerCase();
      const name = inventoryNameFilter.toLowerCase();
      const matchesQuickSearch = [item.name, item.code].join(" ").toLowerCase().includes(q);
      const matchesName = item.name.toLowerCase().includes(name);
      const matchesType = inventoryTypeFilter === "all" || item.code.toLowerCase().startsWith(inventoryTypeFilter.toLowerCase());
      const matchesPrice = priceMatchesInventoryRange(shopMoneyToVnd(item.price), inventoryPriceRange);
      const matchesStatus = inventoryStatusFilter === "all" || item.status === inventoryStatusFilter || (inventoryStatusFilter === "Đã bán" && item.status === "Hết hàng");
      return matchesStore && matchesQuickSearch && matchesName && matchesType && matchesPrice && matchesStatus;
    })
    .sort((a, b) => {
      if (!hasInventorySearch) return 0;
      return compareSearchInventory({ name: a.name, price: a.price }, { name: b.name, price: b.price });
    });

  const filteredLedger = ledger.filter((item) => storeFilter === "all" || item.storeId === storeFilter);
  const filteredSales = sales.filter((item) => storeFilter === "all" || item.storeId === storeFilter);
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

  const setFormLookupOptions = useCallback(
    (categoryCode: string, storeKey?: string) => (next: string[]) => {
      const sid = storeKey ?? phoneFormStoreId;
      // Chuẩn hóa option tiền phần mềm → digits (ổn định parse + DB), sort bé → lớn
      const isMoney =
        categoryCode === SOFTWARE_LOOKUP_CATEGORIES.quote ||
        categoryCode === SOFTWARE_LOOKUP_CATEGORIES.fee;
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
  const viewingPhone = viewingPhoneId ? phones.find((item) => item.id === viewingPhoneId) : null;
  const viewingOnlineRepair = viewingOnlineRepairId
    ? onlineRepairs.find((item) => item.id === viewingOnlineRepairId)
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
    const activeAccessories = accessories.filter((item) => item.status !== "Đã hủy" && (storeFilter === "all" || item.storeId === storeFilter));
    const localCapitalShort =
      activePhones.reduce((sum, item) => sum + item.cost, 0) +
      activeAccessories.reduce((sum, item) => sum + item.cost * item.quantity, 0);
    const activeLedger = ledger.filter((item) => item.status === "Hiệu lực" && (storeFilter === "all" || item.storeId === storeFilter));
    const mockRepairsActive = repairs.filter(
      (item) => item.status !== "Đã trả khách" && item.status !== "Đã hủy" && (storeFilter === "all" || item.storeId === storeFilter)
    ).length;
    // Online repair tickets still open (chưa thanh toán xong)
    const onlineRepairsActive = onlineRepairs.filter((item) => !item.isPaid || item.paymentStatus === "NỢ DAI").length;

    const phonesCount = dashboardSummary?.phonesInStock ?? activePhones.length;
    const accessoryQty = dashboardSummary?.accessoryQty ?? activeAccessories.reduce((sum, item) => sum + item.quantity, 0);
    const capitalVnd = dashboardSummary?.capitalVnd ?? shopMoneyToVnd(localCapitalShort);
    const profit = dashboardSummary?.profit ?? 0;
    const revenue = dashboardSummary?.revenue ?? 0;

    return {
      phones: phonesCount,
      accessories: accessoryQty,
      capital: capitalVnd,
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

    sales.forEach((sale) => {
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
  }, [sales, reportYear, storeFilter]);

  const chartYearlyData = supabaseYearlyChart ?? yearlyReportData;

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

  useEffect(() => {
    if (!currentUser) return;
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
    setPhoneFormStoreId(resolvePhoneFormStore());
    setIsInventoryModalOpen(true);
  }

  function openPhoneEditModal(id: string) {
    const phone = phones.find((item) => item.id === id);
    setInventoryTab("phones");
    setEditingPhoneId(id);
    setClonePhoneDraft(null);
    setEditingAccessoryId(null);
    setPhoneFormStoreId(resolvePhoneFormStore(phone?.storeId));
    setIsInventoryModalOpen(true);
  }

  /** Clone máy → popup xác nhận → mở form thêm mới (prefill full, mọi ô vẫn sửa được). */
  function openPhoneCloneModal(id: string) {
    const source = phones.find((item) => item.id === id);
    if (!source) return;

    const label = `${source.brand} ${source.name}`.trim();
    const imeiHint = source.imei ? ` (…${source.imei.slice(-5)})` : "";
    const ok = window.confirm(
      `Nhân bản máy "${label}"${imeiHint}?\n\nForm sẽ điền sẵn toàn bộ thông tin. Bạn có thể sửa bất kỳ ô nào rồi lưu thành máy mới.\nLưu ý: IMEI phải khác máy gốc (IMEI không được trùng).`
    );
    if (!ok) return;

    setInventoryTab("phones");
    setEditingPhoneId(null);
    setEditingAccessoryId(null);
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
    setInventoryTab("accessories");
    setEditingAccessoryId(id);
    setEditingPhoneId(null);
    setClonePhoneDraft(null);
    setIsInventoryModalOpen(true);
  }

  function closeInventoryModal() {
    if (inventorySaving) return;
    setIsInventoryModalOpen(false);
    setEditingPhoneId(null);
    setClonePhoneDraft(null);
    setEditingAccessoryId(null);
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
      // Reload grid + droplist từ DB để khớp dữ liệu server (sort, status, lookup…).
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
    const storeId = String(form.get("storeId")) as Exclude<StoreId, "all">;
    const isEdit = Boolean(editingAccessoryId);
    const quantity = Number(form.get("quantity") || 0);
    const payload: Accessory = {
      id: editingAccessoryId ?? `a${Date.now()}`,
      code: String(form.get("code")),
      name: String(form.get("name")),
      storeId,
      quantity,
      cost: parseShopMoney(form.get("cost")),
      price: parseShopMoney(form.get("price")),
      status: String(form.get("status") || (quantity > 0 ? "Còn hàng" : "Hết hàng")) as AccessoryStatus,
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
        editingAccessoryId ? "Sửa phụ kiện trong kho" : "Thêm phụ kiện vào kho",
        saved.code,
        storeId
      );
      // Reload grid từ DB để danh sách phụ kiện khớp server.
      await reloadInventoryFromDb();
      showUiToast(
        "success",
        isEdit ? `Đã sửa phụ kiện ${saved.name} thành công.` : `Đã thêm phụ kiện ${saved.name} thành công.`
      );
      setInventorySaving(false);
      setIsInventoryModalOpen(false);
      setEditingPhoneId(null);
      setClonePhoneDraft(null);
      setEditingAccessoryId(null);
      setInventoryPage(1);
    } catch (err) {
      const msg = toUiError(err);
      setInventoryBackendError(msg);
      showUiToast("error", `Lưu phụ kiện thất bại: ${msg}`);
      setInventorySaving(false);
    }
  }

  async function createSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const storeId = String(form.get("storeId")) as Exclude<StoreId, "all">;
    const itemType = String(form.get("itemType")) as "Máy" | "Phụ kiện";
    const itemId = String(form.get("itemId"));
    const quantity = Number(form.get("quantity") || 1);
    const amount = Number(form.get("amount") || 0);
    const payment = String(form.get("payment")) as PaymentMethod;
    const customerId = String(form.get("customerId") || "");
    const customer = customers.find((c) => c.id === customerId);

    if (!itemId) {
      window.alert("Chọn hàng cần bán.");
      return;
    }
    if (!amount || amount <= 0) {
      window.alert("Nhập tổng tiền / đơn giá bán (vd 16.900 = 16tr9).");
      return;
    }

    try {
      const saved = await apiCreateSale({
        storeId,
        itemType,
        phoneId: itemType === "Máy" ? itemId : undefined,
        accessoryId: itemType === "Phụ kiện" ? itemId : undefined,
        quantity,
        unitPrice: amount,
        payment,
        customerName: customer?.name,
        customerPhone: customer?.phone,
        actorUsername: currentUser?.username,
      });

      const sale: Sale = {
        id: saved.id,
        createdAt: saved.soldAt,
        customerId: customerId || "db",
        storeId: saved.storeId,
        itemName: saved.itemName,
        itemType: saved.itemType,
        quantity: saved.quantity,
        amount: saved.amount,
        profit: saved.profit,
        payment: saved.payment as PaymentMethod,
        status: "Hoàn tất",
      };

      setSales((prev) => [sale, ...prev.filter((s) => s.id !== sale.id)]);
      setLedger((prev) => [
        {
          id: `l${Date.now()}`,
          createdAt: sale.createdAt,
          storeId,
          type: "Thu",
          source: `Phiếu bán ${sale.id}`,
          amount: sale.amount,
          payment,
          status: "Hiệu lực",
        },
        ...prev,
      ]);
      pushLog("Tạo phiếu bán", sale.id, storeId);

      // Đồng bộ kho + báo cáo + dashboard từ DB
      await reloadInventoryFromDb();
      try {
        const monthly = await reportInventoryMonthly(inventoryReportMonth, storeFilter);
        setSupabaseReportMonthly(monthly);
        const yearly = await reportInventoryYearly(Number(reportYear), storeFilter);
        setSupabaseYearlyChart(toYearlyChartRows(yearly));
      } catch {
        /* report refresh best-effort */
      }
      void refreshDashboardSummary();

      window.alert(
        `Đã lưu phiếu bán DB: ${saved.itemName} · ${formatMoney(saved.amount)} ₫ · lãi ${formatMoney(saved.profit)} ₫`
      );
      event.currentTarget.reset();
    } catch (err) {
      window.alert(toUiError(err));
    }
  }

  function createExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const storeId = String(form.get("storeId")) as Exclude<StoreId, "all">;
    const entry: Ledger = {
      id: `l${Date.now()}`,
      createdAt: vnNowDate(),
      storeId,
      type: String(form.get("type")) as "Thu" | "Chi",
      source: String(form.get("source")),
      amount: Number(form.get("amount") || 0),
      payment: String(form.get("payment")) as PaymentMethod,
      status: "Hiệu lực",
    };

    setLedger((prev) => [entry, ...prev]);
    pushLog(`Tạo ${entry.type.toLowerCase()} thủ công`, entry.id, storeId);
    event.currentTarget.reset();
  }

  function cancelSale(id: string) {
    const sale = sales.find((item) => item.id === id);
    if (!sale || !canCancel) return;
    setSales((prev) => prev.map((item) => (item.id === id ? { ...item, status: "Đã hủy" } : item)));
    setLedger((prev) => prev.map((item) => (item.source.includes(id) ? { ...item, status: "Đã hủy" } : item)));
    pushLog("Hủy mềm phiếu bán", id, sale.storeId);
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
                        {u.name} ({u.username}) · {storeName(u.storeId)}
                        {u.role === "owner" ? " · Chủ" : ""}
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
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`group flex h-11 items-center gap-3 rounded-lg border px-3 text-left text-sm font-bold transition ${
                  activePage === item.id
                    ? "border-emerald-300/40 bg-brand text-white shadow-[0_10px_24px_rgba(15,139,98,0.32)]"
                    : "border-white/5 bg-white/[0.04] text-slate-300 hover:border-emerald-300/25 hover:bg-white/[0.09] hover:text-white"
                }`}
              >
                <span
                  className={`grid h-7 w-7 place-items-center rounded-md transition ${
                    activePage === item.id ? "bg-white/18 text-white" : "bg-white/[0.06] text-emerald-100 group-hover:bg-white/[0.12]"
                  }`}
                >
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
            <div className="rounded-lg border border-brand/30 bg-brand-soft/60 p-3 text-sm font-semibold text-ink">
              {dashboardSummaryLoading
                ? "Đang đồng bộ dashboard từ DB…"
                : dashboard.fromDb
                  ? `Đã đồng bộ kho + phiếu bán (${storeName(storeFilter)}). Vốn quy ra ₫ (giá kho ×1.000). Thu/chi vẫn là dữ liệu demo.`
                  : dashboardSummaryError
                    ? `Chưa đồng bộ DB: ${dashboardSummaryError}`
                    : "Dashboard đang dùng cache local — mở lại hoặc đổi cửa hàng để tải summary."}
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Máy còn hàng" value={isStatsHidden || dashboardSummaryLoading ? "***" : `${dashboard.phones}`} hint={`${storeName(storeFilter)} · kho DB`} icon={<Smartphone size={20} />} />
              <StatCard label="Phụ kiện tồn" value={isStatsHidden || dashboardSummaryLoading ? "***" : `${dashboard.accessories}`} hint="Tổng SL · kho DB" icon={<PackagePlus size={20} />} />
              <StatCard label="Tổng vốn" value={isStatsHidden || dashboardSummaryLoading ? "***" : formatMoney(dashboard.capital)} hint="Máy + PK tồn · ₫ thật" icon={<Store size={20} />} />
              <StatCard label="Lãi đã ghi" value={isStatsHidden || dashboardSummaryLoading ? "***" : formatMoney(dashboard.profit)} hint="Σ profit phiếu bán completed" icon={<Activity size={20} />} />
              <StatCard label="Tổng thu" value={isStatsHidden ? "***" : formatMoney(dashboard.income)} hint="Demo sổ thu chi" icon={<ReceiptText size={20} />} />
              <StatCard label="Tổng chi" value={isStatsHidden ? "***" : formatMoney(dashboard.expense)} hint="Demo sổ thu chi" icon={<CreditCard size={20} />} />
              <StatCard label="Máy đang sửa" value={isStatsHidden ? "***" : `${dashboard.repairs}`} hint={onlineRepairs.length > 0 ? "Phiếu online (còn nợ/chưa TT)" : "Demo sửa chữa"} icon={<Wrench size={20} />} />
              <StatCard label="Dòng tiền ròng" value={isStatsHidden ? "***" : formatMoney(dashboard.income - dashboard.expense)} hint="Thu − chi (demo)" icon={<FileText size={20} />} />
            </div>

            <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-black">Tháng này (đồng bộ báo cáo kho)</h2>
                  <p className="text-sm font-semibold text-muted">Cùng API với màn Báo cáo kho · {inventoryReportMonth}</p>
                </div>
                <Field label="Tháng" className="w-full sm:w-44">
                  <input
                    type="month"
                    value={inventoryReportMonth}
                    onChange={(event) => setInventoryReportMonth(event.target.value)}
                    className="h-10 rounded-lg border border-line px-3 font-bold"
                  />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-line bg-slate-50 p-4">
                  <p className="text-sm font-bold text-muted">Bán được</p>
                  <strong className="mt-2 block text-2xl text-sky-800">
                    {isStatsHidden || !supabaseReportMonthly ? "***" : `${supabaseReportMonthly.soldPhones} con`}
                  </strong>
                </div>
                <div className="rounded-lg border border-line bg-slate-50 p-4">
                  <p className="text-sm font-bold text-muted">Doanh thu tháng</p>
                  <strong className="mt-2 block text-2xl text-amber-700">
                    {isStatsHidden || !supabaseReportMonthly ? "***" : formatMoney(supabaseReportMonthly.revenue)}
                  </strong>
                </div>
                <div className="rounded-lg border border-line bg-slate-50 p-4">
                  <p className="text-sm font-bold text-muted">Lãi tháng</p>
                  <strong className="mt-2 block text-2xl text-emerald-700">
                    {isStatsHidden || !supabaseReportMonthly ? "***" : formatMoney(supabaseReportMonthly.profit)}
                  </strong>
                </div>
              </div>
            </section>
          </div>
        )}

        {activePage === "inventoryReports" && (
          <section className="grid gap-4">
            <div className="rounded-lg border border-amber-200 bg-white p-5 shadow-panel">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-3xl font-black">Báo cáo kho hàng</h2>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden rounded-lg border border-line bg-slate-50 px-4 py-3 sm:block">
                    <p className="text-xs font-bold text-muted">Đang xem</p>
                    <strong className="text-base">{storeName(storeFilter)}</strong>
                  </div>
                </div>
              </div>
            </div>

            <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-black">Báo cáo theo tháng</h2>
                  <p className="text-sm font-semibold text-muted">Thống kê từ phiếu bán hoàn tất trong tháng đã chọn.</p>
                </div>
                <div className="flex items-end gap-2">
                  <Field label="Chọn tháng" className="w-full lg:w-56">
                    <input
                      type="month"
                      value={inventoryReportMonth}
                      onChange={(event) => setInventoryReportMonth(event.target.value)}
                      className="h-10 rounded-lg border border-line px-3 font-bold"
                    />
                  </Field>
                  <button onClick={() => setIsStatsHidden(!isStatsHidden)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    {isStatsHidden ? <EyeOff size={17} /> : <Eye size={17} />}
                    {isStatsHidden ? "Đã ẩn" : "Hiện số"}
                  </button>
                </div>
              </div>
              {supabaseReportMonthly &&
              inventoryMonthlyReport.revenue === 0 &&
              inventoryMonthlyReport.soldPhones === 0 ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                  Chưa có phiếu bán trong tháng {inventoryReportMonth} trên DB. Vào <strong>Phiếu bán</strong> tạo phiếu (ghi DB) rồi quay lại — doanh thu sẽ đồng bộ.
                </div>
              ) : null}
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                  <p className="text-sm font-bold text-muted">Bán được</p>
                  <div className="mt-4 flex items-center justify-between">
                    <strong className="text-3xl text-sky-800">{isStatsHidden || hideReportSold ? "***" : `${inventoryMonthlyReport.soldPhones} con`}</strong>
                    <button onClick={() => setHideReportSold(!hideReportSold)} className="grid h-11 w-11 place-items-center rounded-lg bg-sky-50 text-sky-700 transition hover:bg-sky-100"><Smartphone size={20} /></button>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-muted">Số máy bán trong tháng (DB)</p>
                </section>
                <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                  <p className="text-sm font-bold text-muted">Tổng doanh thu tháng</p>
                  <div className="mt-4 flex items-center justify-between">
                    <strong className="text-3xl text-amber-700">{isStatsHidden || hideReportRevenue ? "***" : formatMoney(inventoryMonthlyReport.revenue)}</strong>
                    <button onClick={() => setHideReportRevenue(!hideReportRevenue)} className="grid h-11 w-11 place-items-center rounded-lg bg-amber-50 text-amber-700 transition hover:bg-amber-100"><ReceiptText size={20} /></button>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-muted">Từ public.sales (completed)</p>
                </section>
                <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                  <p className="text-sm font-bold text-muted">Tổng lợi nhuận tháng</p>
                  <div className="mt-4 flex items-center justify-between">
                    <strong className="text-3xl text-emerald-700">{isStatsHidden || hideReportProfit ? "***" : formatMoney(inventoryMonthlyReport.profit)}</strong>
                    <button onClick={() => setHideReportProfit(!hideReportProfit)} className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"><Activity size={20} /></button>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-muted">Lãi ghi nhận trong tháng (DB)</p>
                </section>
              </div>
            </section>

            <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
              <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-black">Tổng quan năm {reportYear}</h2>
                  <p className="text-sm font-semibold text-muted">Biểu đồ thống kê doanh thu, lợi nhuận và số máy bán ra theo từng tháng.</p>
                </div>
                <Field label="Chọn năm" className="w-full lg:w-32">
                  <select value={reportYear} onChange={(e) => setReportYear(e.target.value)} className="h-10 rounded-lg border border-line bg-white px-3 font-bold">
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                  </select>
                </Field>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartYearlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }} dy={10} />
                    <YAxis yAxisId="left" orientation="left" stroke="#1e293b" axisLine={false} tickLine={false} tickFormatter={(val) => `${val / 1000000}M`} tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }} dx={-10} />
                    <YAxis yAxisId="right" orientation="right" stroke="#0ea5e9" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }} dx={10} />
                    <Tooltip
                      cursor={{ fill: "#f1f5f9" }}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontWeight: "bold" }}
                      formatter={(value: any, name: any) => {
                        if (name === "Doanh thu" || name === "Lợi nhuận") return [formatMoney(value as number), name];
                        return [value, name];
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px", fontWeight: "bold" }} />
                    <Bar yAxisId="left" dataKey="revenue" name="Doanh thu" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="profit" name="Lợi nhuận" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="sold" name="Máy bán" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
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
                          setInventoryPage(1);
                        }}
                        className={`rounded-md px-3 py-2 text-sm font-bold ${inventoryTab === "accessories" ? "bg-white text-brand shadow-sm" : "text-muted"}`}
                      >
                        Phụ kiện
                      </button>
                    </div>
                    <button onClick={() => openInventoryCreateModal(inventoryTab)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-black text-white hover:bg-brand-dark">
                      <Plus size={17} />
                      Thêm vào kho
                    </button>
                  </div>
                </div>
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
                    placeholder={inventoryTab === "phones" ? "Tên máy..." : "Tên phụ kiện..."}
                  />
                  <select
                    value={inventoryBrandFilter}
                    onChange={(event) => {
                      setInventoryBrandFilter(event.target.value);
                      setInventoryPage(1);
                    }}
                    disabled={inventoryTab !== "phones"}
                    className="h-10 rounded-lg border border-line bg-white px-3 font-semibold disabled:bg-slate-100 disabled:text-muted"
                  >
                    <option value="all">Tất cả hãng</option>
                    {filterBrandOptions.map((brand) => (
                      <option key={brand} value={brand}>{brand}</option>
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
                    <option value="all">{inventoryTab === "phones" ? "Tất cả loại máy" : "Tất cả nhóm"}</option>
                    {inventoryTypeOptions.map((type) => (
                      <option key={type} value={type}>{type}</option>
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
              </div>

              <div className="flex flex-col gap-4 p-4">
                <aside className="grid gap-2 sm:grid-cols-3">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                    <span className="min-w-0 text-sm font-bold text-emerald-700">Số lượng đã bán</span>
                    <strong className="shrink-0 text-xl font-black tabular-nums text-emerald-700">
                      {isStatsHidden ? "***" : (inventoryTab === "phones"
                        ? phones.filter((p) => p.status === "Đã bán" && (storeFilter === "all" || p.storeId === storeFilter)).length
                        : sales.filter((s) => s.itemType === "Phụ kiện" && s.status === "Hoàn tất" && (storeFilter === "all" || s.storeId === storeFilter)).reduce((sum, s) => sum + s.quantity, 0))}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5">
                    <span className="min-w-0 text-sm font-bold text-sky-700">Số lượng còn hàng</span>
                    <strong className="shrink-0 text-xl font-black tabular-nums text-sky-700">
                      {isStatsHidden ? "***" : (inventoryTab === "phones"
                        ? phones.filter((p) => p.status === "Còn hàng" && (storeFilter === "all" || p.storeId === storeFilter)).length
                        : accessories.filter((a) => a.status === "Còn hàng" && (storeFilter === "all" || a.storeId === storeFilter)).reduce((sum, a) => sum + a.quantity, 0))}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <span className="min-w-0 text-sm font-bold text-amber-700">Số lượng chưa xử lý</span>
                    <strong className="shrink-0 text-xl font-black tabular-nums text-amber-700">
                      {isStatsHidden ? "***" : (inventoryTab === "phones"
                        ? phones.filter((p) => p.status === "Chưa xử lý" && (storeFilter === "all" || p.storeId === storeFilter)).length
                        : 0)}
                    </strong>
                  </div>
                </aside>

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
                      <button onClick={() => setViewingPhoneId(item.id)} title="Chi tiết" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => openPhoneEditModal(item.id)} title="Sửa" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand transition hover:bg-brand/20">
                        <Edit3 size={18} />
                      </button>
                      <button
                        onClick={() => openPhoneCloneModal(item.id)}
                        title="Nhân bản thêm mới"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 transition hover:bg-sky-100"
                      >
                        <CopyPlus size={18} />
                      </button>
                    </div>,
                  ])}
                />
              ) : (
                <DataTable
                  compact
                  headers={["Mã", "Tên phụ kiện", "SL", "Giá nhập", "Giá bán", "Lợi nhuận", "Thao tác"]}
                  rows={paginatedAccessories.map((item) => [
                    <span className="font-mono text-sm font-medium text-slate-500" key={`code-${item.id}`}>{item.code}</span>,
                    <span className="text-lg font-black text-brand" key={`name-${item.id}`}>{item.name}</span>,
                    <span className="text-base font-bold text-slate-800" key={`qty-${item.id}`}>{item.quantity}</span>,
                    <span className="text-base font-medium text-slate-600" key={`cost-${item.id}`}>{formatMoney(item.cost)}</span>,
                    <span className="text-lg font-black text-emerald-600" key={`price-${item.id}`}>{formatMoney(item.price)}</span>,
                    <span className="text-base font-bold text-amber-600" key={`profit-${item.id}`}>{formatMoney(item.price - item.cost)}</span>,
                    <div key={item.id} className="flex flex-nowrap justify-center gap-1.5">
                      <button onClick={() => openAccessoryEditModal(item.id)} title="Sửa" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand transition hover:bg-brand/20">
                        <Edit3 size={18} />
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
                <section className="relative max-h-[92vh] w-full max-w-[860px] overflow-auto rounded-2xl border border-white/20 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.4)] backdrop-blur-xl">
                  {inventorySaving ? (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/55 backdrop-blur-sm">
                      <Loader2 size={40} className="animate-spin text-brand" />
                      <p className="text-base font-black text-ink">Đang lưu…</p>
                    </div>
                  ) : null}
                  <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200/60 bg-white/80 p-5 backdrop-blur-md">
                    <div>
                      <h2 className="text-2xl font-black text-slate-800">
                        {inventoryTab === "phones"
                          ? editingPhone
                            ? "Sửa máy trong kho"
                            : clonePhoneDraft
                              ? "Thêm máy (nhân bản)"
                              : "Thêm máy vào kho"
                          : editingAccessory
                            ? "Sửa phụ kiện"
                            : "Thêm phụ kiện"}
                      </h2>
                      {inventoryTab === "phones" && !editingPhone && clonePhoneDraft ? (
                        <p className="mt-1 text-sm font-semibold text-sky-700">
                          Đã copy đầy đủ thông tin máy mẫu — sửa bất kỳ ô nào nếu cần, rồi lưu máy mới (IMEI không được trùng).
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={closeInventoryModal}
                      disabled={inventorySaving}
                      className="h-9 rounded-xl border border-slate-200/60 bg-white/50 px-4 text-sm font-black text-slate-600 backdrop-blur-md transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Đóng
                    </button>
                  </div>
                  <div className={`p-5 ${inventorySaving ? "pointer-events-none select-none" : ""}`}>
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
                      <form key={editingAccessory?.id ?? "new-accessory"} onSubmit={saveAccessory} className="grid gap-3" autoComplete="off" spellCheck={false}>
                        <Field label="Mã hàng" required><input name="code" required defaultValue={editingAccessory?.code} className="h-10 rounded-lg border border-line px-3" placeholder="PK-CAP20" /></Field>
                        <Field label="Tên phụ kiện" required><input name="name" required defaultValue={editingAccessory?.name} className="h-10 rounded-lg border border-line px-3" placeholder="Cáp sạc nhanh 20W" /></Field>
                        <SelectField label="Cửa hàng" name="storeId" options={stores.map((s) => [s.id, s.name])} defaultValue={editingAccessory?.storeId} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Số lượng"><input name="quantity" type="number" min="0" defaultValue={editingAccessory?.quantity ?? 1} className="h-10 rounded-lg border border-line px-3" /></Field>
                          <Field label="Giá nhập"><MoneyInput name="cost" defaultValue={editingAccessory?.cost} /></Field>
                        </div>
                        <Field label="Giá bán"><MoneyInput name="price" defaultValue={editingAccessory?.price} /></Field>
                        <SelectField label="Trạng thái" name="status" options={["Còn hàng", "Hết hàng", "Đã hủy"].map((status) => [status, status])} defaultValue={editingAccessory?.status ?? "Còn hàng"} />
                        <div className="flex justify-end gap-2 border-t border-line pt-4">
                          <button type="button" onClick={closeInventoryModal} disabled={inventorySaving} className="h-10 rounded-lg border border-line bg-white px-4 font-bold text-muted disabled:opacity-50">Hủy</button>
                          <button type="submit" disabled={inventorySaving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70">
                            {inventorySaving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                            {inventorySaving ? "Đang lưu…" : editingAccessory ? "Lưu sửa" : "Thêm phụ kiện"}
                          </button>
                        </div>
                      </form>
                    )}
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
          </section>
        )}

        {activePage === "sales" && (
          <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
            <Panel title="Tạo phiếu bán">
              <form onSubmit={createSale} className="grid gap-3">
                <SelectField label="Khách hàng" name="customerId" options={customers.map((c) => [c.id, `${c.name} - ${c.phone}`])} />
                <SelectField label="Cửa hàng" name="storeId" options={stores.map((s) => [s.id, s.name])} />
                <SelectField label="Loại hàng" name="itemType" options={[["Máy", "Máy"], ["Phụ kiện", "Phụ kiện"]]} />
                <SelectField label="Chọn hàng" name="itemId" options={[...phones.filter((p) => p.status === "Còn hàng").map((p) => [p.id, `${p.name} - ${p.imei}`]), ...accessories.filter((a) => a.quantity > 0).map((a) => [a.id, `${a.name} (${a.quantity})`])]} />
                <Field label="Số lượng"><input name="quantity" type="number" min="1" defaultValue="1" className="h-10 rounded-lg border border-line px-3" /></Field>
                <Field label="Đơn giá / Tổng (short OK)">
                  <input name="amount" type="number" min="0" placeholder="vd 16900 = 16.900.000₫" className="h-10 rounded-lg border border-line px-3" />
                </Field>
                <p className="text-xs font-semibold text-muted">Lãi tự tính: giá bán (×1.000 nếu short) − giá vốn kho. Phiếu ghi DB → báo cáo doanh thu.</p>
                <SelectField label="Thanh toán" name="payment" options={["Tiền mặt", "Chuyển khoản", "Thẻ", "Khác"].map((p) => [p, p])} />
                <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white"><Plus size={18} />Tạo phiếu bán (DB)</button>
              </form>
            </Panel>
            <Panel title="Phiếu bán gần đây">
              <DataTable
                headers={["Ngày", "Khách", "Hàng", "Cửa hàng", "Tiền", "Lãi", "TT", ""]}
                rows={filteredSales.map((item) => [
                  item.createdAt,
                  customers.find((c) => c.id === item.customerId)?.name ?? "-",
                  `${item.itemName} (${item.quantity})`,
                  storeName(item.storeId),
                  formatMoney(item.amount),
                  formatMoney(item.profit),
                  <StatusBadge key={item.id} tone={item.status === "Hoàn tất" ? "ok" : "danger"}>{item.status}</StatusBadge>,
                  canCancel && item.status === "Hoàn tất" ? <button key={item.id} onClick={() => cancelSale(item.id)} className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-bold text-danger">Hủy mềm</button> : <span key={item.id} className="text-xs text-muted">Chỉ Chủ</span>,
                ])}
              />
            </Panel>
          </section>
        )}

        {activePage === "customers" && (
          <Panel title="Khách hàng">
            <DataTable
              headers={["Tên", "Số điện thoại", "Ghi chú", "Số phiếu liên quan"]}
              rows={customers.map((customer) => [
                customer.name,
                customer.phone,
                customer.note,
                sales.filter((s) => s.customerId === customer.id).length + repairs.filter((r) => r.customerId === customer.id).length,
              ])}
            />
          </Panel>
        )}

        {activePage === "ledger" && (
          <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
            <Panel title="Tạo thu/chi thủ công">
              <form onSubmit={createExpense} className="grid gap-3">
                <SelectField label="Loại" name="type" options={[["Thu", "Thu"], ["Chi", "Chi"]]} />
                <SelectField label="Cửa hàng" name="storeId" options={stores.map((s) => [s.id, s.name])} />
                <Field label="Nội dung"><input name="source" className="h-10 rounded-lg border border-line px-3" placeholder="Tiền điện, nước, mặt bằng..." /></Field>
                <Field label="Số tiền"><input name="amount" type="number" min="0" className="h-10 rounded-lg border border-line px-3" /></Field>
                <SelectField label="Thanh toán" name="payment" options={["Tiền mặt", "Chuyển khoản", "Thẻ", "Khác"].map((p) => [p, p])} />
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white"><Plus size={18} />Ghi sổ</button>
              </form>
            </Panel>
            <Panel title="Sổ thu chi">
              <DataTable
                headers={["Ngày", "Loại", "Nguồn", "Cửa hàng", "Số tiền", "Thanh toán", "Trạng thái"]}
                rows={filteredLedger.map((item) => [
                  item.createdAt,
                  item.type,
                  item.source,
                  storeName(item.storeId),
                  formatMoney(item.amount),
                  item.payment,
                  <StatusBadge key={item.id} tone={item.status === "Hiệu lực" ? "ok" : "danger"}>{item.status}</StatusBadge>,
                ])}
              />
            </Panel>
          </section>
        )}

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

        {activePage === "software" && (() => {
          const today = new Date().toLocaleDateString("vi-VN", {
            day: "2-digit",
            timeZone: "Asia/Ho_Chi_Minh",
          });
          const currentMonth = vnNowMonth();
          const monthlyServices = softwareServices.filter((s) => s.createdAt.startsWith(currentMonth));
          const dailyServices = softwareServices.filter((s) => s.createdAt.includes(vnNowDate()));
          
          return (
          <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
            <Panel title={editingSoftwareId ? "Sửa đơn Sửa chữa" : "Tạo đơn Sửa chữa"}>
              <form key={editingSoftwareId ?? "new"} onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const revenue = Number(form.get("revenue") || 0);
                const cost = Number(form.get("cost") || 0);
                
                if (editingSoftwareId) {
                  setSoftwareServices(softwareServices.map(s => s.id === editingSoftwareId ? {
                    ...s,
                    customerName: String(form.get("customerName")),
                    deviceName: String(form.get("deviceName")),
                    quantity: Number(form.get("quantity") || 1),
                    revenue,
                    cost,
                    profit: revenue - cost,
                    isPaid: form.get("isPaid") === "on",
                  } : s));
                  setEditingSoftwareId(null);
                } else {
                  const newService: SoftwareService = {
                    id: `sw${Date.now()}`,
                    createdAt: vnNowDateTimeLocal().replace("T", " "),
                    customerName: String(form.get("customerName")),
                    deviceName: String(form.get("deviceName")),
                    quantity: Number(form.get("quantity") || 1),
                    revenue,
                    cost,
                    profit: revenue - cost,
                    isPaid: form.get("isPaid") === "on",
                  };
                  setSoftwareServices([newService, ...softwareServices]);
                }
                e.currentTarget.reset();
              }} className="grid gap-3">
                <Field label="Tên khách hàng / Thợ" required><input name="customerName" required defaultValue={softwareServices.find(s => s.id === editingSoftwareId)?.customerName} className="h-10 rounded-lg border border-line px-3" placeholder="Ví dụ: Anh Đức FB" /></Field>
                <Field label="Tên máy sửa / Dịch vụ" required><input name="deviceName" required defaultValue={softwareServices.find(s => s.id === editingSoftwareId)?.deviceName} className="h-10 rounded-lg border border-line px-3" placeholder="Ví dụ: A53s, Bypass..." /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Số lượng"><input name="quantity" type="number" min="1" defaultValue={softwareServices.find(s => s.id === editingSoftwareId)?.quantity ?? 1} className="h-10 rounded-lg border border-line px-3" /></Field>
                  <Field label="Giá (Doanh thu)"><input name="revenue" type="number" min="0" required defaultValue={softwareServices.find(s => s.id === editingSoftwareId)?.revenue ?? 0} className="h-10 rounded-lg border border-line px-3" /></Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Phí DV (Chi phí)"><input name="cost" type="number" min="0" required defaultValue={softwareServices.find(s => s.id === editingSoftwareId)?.cost ?? 0} className="h-10 rounded-lg border border-line px-3" /></Field>
                  <label className="flex items-center gap-2 pt-6 font-bold cursor-pointer">
                    <input name="isPaid" type="checkbox" defaultChecked={softwareServices.find(s => s.id === editingSoftwareId)?.isPaid ?? true} className="h-5 w-5 accent-brand" /> Đã thanh toán
                  </label>
                </div>
                <div className="flex gap-2">
                  {editingSoftwareId && <button type="button" onClick={() => setEditingSoftwareId(null)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 font-bold text-slate-700 hover:bg-slate-200">Hủy</button>}
                  <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white"><Plus size={18} />{editingSoftwareId ? "Lưu sửa" : "Thêm đơn"}</button>
                </div>
              </form>
            </Panel>
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-brand bg-emerald-50 p-4">
                  <span className="block text-sm font-bold text-emerald-800">Tháng {Number(vnNowMonth().slice(5, 7))} (Doanh thu)</span>
                  <strong className="text-3xl text-emerald-700">{formatMoney(monthlyServices.reduce((sum, s) => sum + s.revenue, 0))}</strong>
                </div>
                <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
                  <span className="block text-sm font-bold text-slate-500">Ngày {today} (Doanh thu)</span>
                  <strong className="text-3xl text-red-600">{formatMoney(dailyServices.reduce((sum, s) => sum + s.revenue, 0))}</strong>
                </div>
              </div>
              <Panel title="Danh sách Sửa chữa">
                <DataTable
                  headers={["Khách hàng", "Tên máy", "SL", "Giá", "Phí DV", "Tổng", "TT", "Giờ", ""]}
                  rows={softwareServices.map((item) => [
                    <span key={item.id} className="font-bold text-brand">{item.customerName}</span>,
                    <span key={item.id} className="font-semibold text-slate-700">{item.deviceName}</span>,
                    item.quantity,
                    formatMoney(item.revenue),
                    formatMoney(item.cost),
                    <span key={item.id} className="font-black text-amber-700">{formatMoney(item.profit)}</span>,
                    <input 
                      key={item.id} 
                      type="checkbox" 
                      checked={item.isPaid} 
                      onChange={(e) => setSoftwareServices(softwareServices.map(s => s.id === item.id ? {...s, isPaid: e.target.checked} : s))}
                      className="h-5 w-5 accent-brand cursor-pointer" 
                    />,
                    <span key={item.id} className="text-sm font-semibold text-slate-500">{item.createdAt.slice(11, 16)}</span>,
                    <div key={item.id} className="flex gap-2">
                      <button onClick={() => { setEditingSoftwareId(item.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-brand hover:text-brand-dark"><Edit3 size={16} /></button>
                      <button onClick={() => setSoftwareServices(softwareServices.filter(s => s.id !== item.id))} className="text-danger hover:text-red-700"><Trash2 size={16} /></button>
                    </div>
                  ])}
                />
              </Panel>
            </div>
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

                        const lookupStore = softwareLookupStoreId;
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
                          lookupStoreId: lookupStore,
                          actorUsername: currentUser.username,
                        };

                        setSoftwareSaving(true);
                        setSoftwareBackendError("");
                        try {
                          const saved = await apiUpsertSoftwareOrder(payload);
                          // Đồng bộ option local store (server đã ensure DB)
                          const pushSw = (cat: string, val: string) => {
                            const v = val?.trim();
                            if (!v) return;
                            setLookupsByStore((prev) => {
                              const cur = prev[lookupStore]?.[cat] ?? [];
                              if (cur.some((o) => o.toLowerCase() === v.toLowerCase())) return prev;
                              return {
                                ...prev,
                                [lookupStore]: {
                                  ...(prev[lookupStore] ?? {}),
                                  [cat]: [...cur, v],
                                },
                              };
                            });
                          };
                          pushSw(SOFTWARE_LOOKUP_CATEGORIES.customer, saved.customerName);
                          pushSw(SOFTWARE_LOOKUP_CATEGORIES.device, saved.deviceName);
                          pushSw(SOFTWARE_LOOKUP_CATEGORIES.quote, String(Math.round(saved.quote || 0)));
                          pushSw(SOFTWARE_LOOKUP_CATEGORIES.fee, String(Math.round(saved.deposit || 0)));
                          pushLog(
                            isEdit
                              ? "Sửa đơn phần mềm"
                              : isClone
                                ? "Nhân bản đơn phần mềm"
                                : "Tạo đơn phần mềm",
                            `${saved.customerName} — ${saved.deviceName}`,
                            lookupStore
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
              <div className="rounded-lg bg-gradient-to-br from-indigo-800 via-blue-700 to-brand p-4 sm:p-5 text-white shadow relative overflow-hidden flex flex-col md:flex-row justify-between items-center md:text-left text-center gap-4 mb-4">
                <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-white/10 blur-3xl mix-blend-overlay pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -mb-16 -ml-16 h-48 w-48 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
                <div className="relative z-10 md:w-1/2">
                  <h1 className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-sm uppercase tracking-tight">
                    Trung Tâm Giải Mã Phần Mềm Điện Thoại Di Động Nam Sách
                  </h1>
                </div>
                <div className="relative z-10 md:w-1/2 flex flex-col md:items-end gap-1">
                  <p className="font-bold text-white/95 flex items-center gap-2 text-xs sm:text-sm">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-yellow-400 shrink-0 hidden md:block"></span>
                    Chuyên Nghiệp - Nhanh Chóng - Giá Thành Hợp Lý
                  </p>
                  <p className="font-semibold text-white/80 flex items-center gap-2 text-xs sm:text-sm">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-white/50 shrink-0 hidden md:block"></span>
                    Địa chỉ tin cậy và uy tín số 1 TP. Hải Phòng
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-brand bg-emerald-50 p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="block text-sm font-bold text-emerald-800">Lợi nhuận Tháng</span>
                    <input type="month" value={onlineRepairMonth} onChange={e => setOnlineRepairMonth(e.target.value)} className="h-8 rounded border border-emerald-200 bg-white px-2 text-sm font-semibold text-emerald-800" />
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
                    <select value={onlineRepairFilter} onChange={(e) => setOnlineRepairFilter(e.target.value)} className="h-10 rounded-lg border border-line px-3 text-sm font-bold">
                      <option value="all">Tất cả trạng thái</option>
                      <option value="paid">Đã thanh toán</option>
                      <option value="unpaid">NỢ DAI</option>
                    </select>
                    
                    <div className="flex items-center gap-2 rounded-lg border border-line bg-slate-50 px-2">
                      <span className="text-sm font-semibold text-slate-500">Lọc ngày:</span>
                      <input type="date" value={onlineRepairDate} onChange={(e) => setOnlineRepairDate(e.target.value)} className="h-8 rounded border border-line px-2 text-sm" />
                      {onlineRepairDate && <button onClick={() => setOnlineRepairDate("")} className="text-sm font-bold text-brand hover:underline">Tất cả tháng</button>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
                    headers={["Khách hàng", "Tên máy", "Báo giá", "Phí dịch vụ", "Lãi", "Giờ", "Trạng thái TT", ""]}
                    rows={filteredRepairs.map((item) => {
                      const typeColor = {
                        "Thân thiết": "text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full text-xs font-bold",
                        "Vãng lai": "text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full text-xs font-bold",
                        "Mới": "text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full text-xs font-bold",
                        "Ưu tiên": "text-red-600 bg-red-50 px-2 py-0.5 rounded-full text-xs font-bold",
                      }[item.customerType] || "text-slate-500";
                      
                      const isNợ = item.paymentStatus === "NỢ DAI";
                      const isDaThanhToan = item.paymentStatus === "Đã thanh toán";

                      return [
                        <span key={item.id} className="font-bold text-brand whitespace-nowrap">{item.customerName}</span>,
                        <span key={item.id} className="font-semibold text-slate-700 whitespace-nowrap">{item.deviceName}</span>,
                        formatMoney(item.quote),
                        isOnlineRepairSensitiveHidden ? "***" : formatMoney(item.deposit),
                        <span key={item.id} className="font-black text-amber-700">{isOnlineRepairSensitiveHidden ? "***" : formatMoney(item.quote - item.deposit)}</span>,
                        <ColoredDateTime key={`dt-${item.id}`} value={item.receiveDate} />,
                        <span
                          key={item.id}
                          className={`inline-flex h-8 items-center rounded text-xs font-bold px-2 shadow-sm border border-line ${isNợ ? "bg-red-50 text-red-600" : isDaThanhToan ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-600"}`}
                        >
                          {isDaThanhToan ? "✅ Đã thanh toán" : "❌ NỢ DAI"}
                        </span>,
                        <div key={item.id} className="flex flex-nowrap items-center justify-center gap-1.5">
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
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);

  const handleSort = async () => {
    if (!allowManage) return;
    if (!options.length) return;
    const selected = value;

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
      window.alert(toUiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async () => {
    if (!allowManage) return;
    const val = window.prompt(`Thêm giá trị mới cho ${label}:`);
    const next = val?.trim();
    if (!next) return;
    if (options.some((o) => o.toLowerCase() === next.toLowerCase())) {
      window.alert(`"${next}" đã có trong danh sách.`);
      return;
    }

    if (!categoryCode) {
      setOptions([...options, next]);
      setValue(next);
      return;
    }

    try {
      setBusy(true);
      const result = await apiAddLookupItem(categoryCode, next, actorUsername, storeId);
      setOptions(result.labels);
      setValue(result.label ?? next);
    } catch (err) {
      window.alert(toUiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = async () => {
    if (!allowManage) return;
    if (!value) return;
    const oldVal = value;
    const val = window.prompt(`Sửa giá trị "${oldVal}" thành:`, oldVal);
    const next = val?.trim();
    if (!next || next === oldVal) return;

    if (!categoryCode) {
      setOptions(options.map((o) => (o === oldVal ? next : o)));
      setValue(next);
      return;
    }

    try {
      setBusy(true);
      const result = await apiUpdateLookupItem(categoryCode, oldVal, next, actorUsername, storeId);
      setOptions(result.labels);
      setValue(result.label ?? next);
      if (onRenameCascade) await onRenameCascade();
    } catch (err) {
      window.alert(toUiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!allowManage) return;
    if (!value) return;
    if (!window.confirm(`Xóa giá trị "${value}" khỏi danh sách ${label}?`)) return;

    const removed = value;
    if (!categoryCode) {
      setOptions(options.filter((o) => o !== removed));
      setValue("");
      return;
    }

    try {
      setBusy(true);
      const result = await apiDeactivateLookupItem(categoryCode, removed, actorUsername, storeId);
      setOptions(result.labels);
      setValue("");
    } catch (err) {
      window.alert(toUiError(err));
    } finally {
      setBusy(false);
    }
  };

  const displayOptions = useMemo(() => {
    let list = options;
    if (defaultValue && !list.includes(defaultValue)) list = [defaultValue, ...list];
    if (value && !list.includes(value)) list = [value, ...list];
    return list.map((o) => ({ value: o, label: o }));
  }, [options, defaultValue, value]);

  return (
    <Field label={label} required={required}>
      <div className="flex min-w-0 items-center gap-1.5">
        <ScrollableSelect
          name={name}
          options={displayOptions}
          value={value}
          onChange={setValue}
          required={required}
          disabled={busy}
          className="min-w-0 flex-1"
          colorPreview={name === "color"}
          allowFreeText={allowFreeText}
          placeholder={allowFreeText ? "Chọn hoặc nhập" : "Chọn"}
        />
        {allowManage ? (
          <div className="flex shrink-0 items-center gap-1">
            {sortable ? (
              <button
                type="button"
                onClick={() => void handleSort()}
                disabled={busy || options.length < 2}
                title="Sắp xếp (nhỏ → lớn)"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 disabled:opacity-50"
              >
                <ArrowUpDown size={18} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy}
              title="Thêm"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
            >
              <Plus size={18} />
            </button>
            <button
              type="button"
              onClick={handleEdit}
              disabled={busy}
              title="Sửa"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 disabled:opacity-50"
            >
              <Edit3 size={18} />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              title="Xóa"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-danger hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 size={18} />
            </button>
          </div>
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

function DataTable({ headers, rows, compact = false }: { headers: string[]; rows: ReactNode[][]; compact?: boolean }) {
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

  if (!rows.length) {
    return <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm font-semibold text-muted">Chưa có dữ liệu phù hợp.</div>;
  }

  return (
    <div className="overflow-auto rounded-xl border border-line bg-white shadow-sm">
      <table className={`min-w-max w-full border-collapse ${compact ? "text-base" : "text-base"}`}>
        <thead className={`bg-slate-100 text-center font-black uppercase tracking-wider text-slate-800 ${compact ? "text-xs" : "text-sm"}`}>
          <tr>
            {headers.map((header) => (
              <th key={header} className={`border-b border-line ${compact ? "px-2 py-3" : "px-5 py-4"} ${header === "Thao tác" ? `${compact ? "w-[118px]" : "w-[180px]"} text-center` : ""}`}>
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
