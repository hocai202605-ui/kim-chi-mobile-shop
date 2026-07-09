"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CopyPlus,
  CreditCard,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  LayoutDashboard,
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
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadInventoryBootstrap as apiLoadInventoryBootstrap,
  upsertAccessory as apiUpsertAccessory,
  upsertPhone as apiUpsertPhone,
} from "@/services/inventoryService";
import {
  reportInventoryMonthly,
  reportInventoryYearly,
  toYearlyChartRows,
} from "@/services/inventoryReportService";
import {
  PHONE_LOOKUP_CATEGORIES,
  addLookupItem as apiAddLookupItem,
  deactivateLookupItem as apiDeactivateLookupItem,
  updateLookupItem as apiUpdateLookupItem,
} from "@/services/lookupService";
import {
  listSoftwareOrders as apiListSoftwareOrders,
  upsertSoftwareOrder as apiUpsertSoftwareOrder,
} from "@/services/softwareService";

function toUiError(err: unknown): string {
  return err instanceof Error ? err.message : "Lỗi không xác định";
}

type Role = "owner" | "staff";
type StoreId = "all" | "store-1" | "store-2" | "store-3";
type PaymentMethod = "Tiền mặt" | "Chuyển khoản" | "Thẻ" | "Khác";
type ProductStatus = "Còn hàng" | "Đã bán" | "Đã hủy" | "Chưa xử lý";
type AccessoryStatus = "Còn hàng" | "Hết hàng" | "Đã hủy";
type RepairStatus = "Đang chờ" | "Đang sửa" | "Đã xong" | "Đã trả khách" | "Đã hủy";

type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  storeId: Exclude<StoreId, "all">;
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
  paymentStatus: "Đã thanh toán" | "Nợ dai";
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
  { id: "store-1", name: "Cửa hàng 1" },
  { id: "store-2", name: "Cửa hàng 2" },
  { id: "store-3", name: "Cửa hàng 3" },
] as const;

const users: User[] = [
  { id: "u1", name: "Chủ cửa hàng", email: "owner@kimchi.vn", role: "owner", storeId: "store-1" },
  { id: "u2", name: "Nhân viên CH1", email: "staff@kimchi.vn", role: "staff", storeId: "store-1" },
  { id: "u3", name: "Nhân viên CH2", email: "chi2@kimchi.vn", role: "staff", storeId: "store-2" },
  { id: "u4", name: "Nhân viên CH3", email: "chi3@kimchi.vn", role: "staff", storeId: "store-3" },
];

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

function getColorCode(colorName: string): string {
  if (!colorName) return "#e2e8f0";
  const name = colorName.toLowerCase();
  if (name.includes("đỏ") || name.includes("red")) return "#ef4444";
  if (name.includes("xanh dương") || name.includes("xanh biển") || name.includes("blue")) return "#3b82f6";
  if (name.includes("xanh lá") || name.includes("xanh ngọc") || name.includes("green")) return "#22c55e";
  if (name.includes("vàng") || name.includes("gold")) return "#eab308";
  if (name.includes("đen") || name.includes("black") || name.includes("midnight")) return "#1e293b";
  if (name.includes("trắng") || name.includes("white") || name.includes("starlight")) return "#ffffff";
  if (name.includes("bạc") || name.includes("silver")) return "#cbd5e1";
  if (name.includes("xám") || name.includes("gray") || name.includes("grey")) return "#64748b";
  if (name.includes("tím") || name.includes("purple")) return "#a855f7";
  if (name.includes("hồng") || name.includes("pink")) return "#ec4899";
  if (name.includes("titan")) return "#a8a29e";
  return "#e2e8f0";
}

const logSeed: AuditLog[] = [
  { id: "g1", createdAt: "2026-07-06 09:15", user: "Chủ cửa hàng", storeId: "store-1", action: "Tạo phiếu bán", target: "s1" },
  { id: "g2", createdAt: "2026-07-06 10:20", user: "Nhân viên CH2", storeId: "store-2", action: "Tạo phiếu sửa", target: "r1" },
];

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "inventory", label: "Kho hàng", icon: Boxes },
  { id: "inventoryReports", label: "Báo cáo kho hàng", icon: FileText },
  { id: "sales", label: "Quản lý bán hàng", icon: ReceiptText },
  { id: "software", label: "Sửa chữa", icon: Wrench },
  { id: "online-repairs", label: "Phần mềm", icon: Terminal },
  { id: "customers", label: "Khách hàng", icon: Users },
  { id: "repairs", label: "Sửa chữa (cũ)", icon: Wrench },
  { id: "ledger", label: "Thu chi", icon: CreditCard },
  { id: "logs", label: "Nhật ký", icon: ClipboardList },
  { id: "accounts", label: "Tài khoản", icon: UserCog },
] as const;

type PageId = (typeof navItems)[number]["id"];

function storeName(id: StoreId) {
  if (id === "all") return "Toàn hệ thống";
  return stores.find((store) => store.id === id)?.name ?? id;
}

function formatMoney(value: number) {
  return value.toLocaleString("vi-VN");
}

function formatInputMoney(value?: number | string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("vi-VN") : "";
}

function parseInputMoney(value: FormDataEntryValue | null) {
  return Number(String(value ?? "").replace(/\D/g, "") || 0);
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
  const [loginError, setLoginError] = useState("");
  const [isLoginPasswordVisible, setIsLoginPasswordVisible] = useState(false);
  const [isStatsHidden, setIsStatsHidden] = useState(false);
  const [reportYear, setReportYear] = useState(() => new Date().getFullYear().toString());
  const [hideReportSold, setHideReportSold] = useState(false);
  const [hideReportRevenue, setHideReportRevenue] = useState(false);
  const [hideReportProfit, setHideReportProfit] = useState(false);
  const [activePage, setActivePage] = useState<PageId>("inventory");
  const [storeFilter, setStoreFilter] = useState<StoreId>("all");
  const [query, setQuery] = useState("");
  const [inventoryTab, setInventoryTab] = useState<"phones" | "accessories">("phones");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryReportMonth, setInventoryReportMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState("all");
  const [inventoryBrandFilter, setInventoryBrandFilter] = useState("iPhone");
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
  const [isOnlineRepairModalOpen, setIsOnlineRepairModalOpen] = useState(false);
  const [isOnlineRepairSensitiveHidden, setIsOnlineRepairSensitiveHidden] = useState(false);
  const [onlineRepairFilter, setOnlineRepairFilter] = useState("all");
  const [onlineRepairMonth, setOnlineRepairMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [onlineRepairDate, setOnlineRepairDate] = useState("");
  const [customers, setCustomers] = useState(customersSeed);
  const [phones, setPhones] = useState<PhoneItem[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [sales, setSales] = useState(salesSeed);
  const [softwareServices, setSoftwareServices] = useState(softwareServiceSeed);
  const [onlineRepairs, setOnlineRepairs] = useState<OnlineRepair[]>([]);
  const [softwareLoading, setSoftwareLoading] = useState(false);
  const [softwareBackendError, setSoftwareBackendError] = useState("");
  const [repairs, setRepairs] = useState(repairsSeed);
  const [ledger, setLedger] = useState(ledgerSeed);
  const [logs, setLogs] = useState(logSeed);
  const [brandOptions, setBrandOptions] = useState(["iPhone", "Samsung", "Oppo", "Xiaomi"]);
  const [nameOptions, setNameOptions] = useState(["10", "11", "12", "13 Pro", "13 Pro Max", "14", "14 Pro Max", "15 Pro Max", "Galaxy S22 Ultra", "Galaxy A54", "Z Fold 5", "Reno 8", "Find X5 Pro", "Redmi Note 12"]);
  const [colorOptions, setColorOptions] = useState(["Đen", "Trắng", "Xanh", "Xanh dương", "Xanh biển", "Xanh lá", "Đỏ", "Vàng", "Tím", "Xám", "Titan", "Hồng"]);
  const [storageOptions, setStorageOptions] = useState(["64GB", "128GB", "256GB", "512GB", "1TB"]);
  const [madeInOptions, setMadeInOptions] = useState(["VN/A", "LL/A", "Trung Quốc", "Việt Nam"]);
  const [batteryOptions, setBatteryOptions] = useState(["Zin", "Đã thay", "Đã thay pin", "80-90%", "Zin 88%", "Zin 90%", "Zin 92%", "Zin 98%", "Zin 100%"]);
  const [batteryCapacityOptions, setBatteryCapacityOptions] = useState(["100%", "99%", "98%", "95%", "90%", "85%", "80%", "Dưới 80%"]);
  const [conditionOptions, setConditionOptions] = useState(["Zin", "Cũ", "Like New", "Mới 100%"]);
  const [inventoryBackendError, setInventoryBackendError] = useState("");
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [supabaseReportMonthly, setSupabaseReportMonthly] = useState<{ soldPhones: number; revenue: number; profit: number } | null>(null);
  const [supabaseYearlyChart, setSupabaseYearlyChart] = useState<{ month: string; revenue: number; profit: number; sold: number }[] | null>(null);
  const canCancel = currentUser?.role === "owner";

  /** Kho hàng: 1 request bootstrap (phones + accessories + lookups) — bớt storm kết nối. */
  const reloadInventoryFromDb = useCallback(async () => {
    setInventoryLoading(true);
    setInventoryBackendError("");
    try {
      const data = await apiLoadInventoryBootstrap();
      setPhones(data.phones);
      setAccessories(data.accessories);

      const L = data.lookups;
      const brands = L[PHONE_LOOKUP_CATEGORIES.brand] ?? [];
      const names = L[PHONE_LOOKUP_CATEGORIES.modelName] ?? [];
      const colors = L[PHONE_LOOKUP_CATEGORIES.color] ?? [];
      const storages = L[PHONE_LOOKUP_CATEGORIES.storage] ?? [];
      const madeIns = L[PHONE_LOOKUP_CATEGORIES.madeIn] ?? [];
      const conditions = L[PHONE_LOOKUP_CATEGORIES.condition] ?? [];
      const batteries = L[PHONE_LOOKUP_CATEGORIES.batteryCondition] ?? [];
      const batCaps = L[PHONE_LOOKUP_CATEGORIES.batteryCapacity] ?? [];
      if (brands.length) setBrandOptions(brands);
      if (names.length) setNameOptions(names);
      if (colors.length) setColorOptions(colors);
      if (storages.length) setStorageOptions(storages);
      if (madeIns.length) setMadeInOptions(madeIns);
      if (conditions.length) setConditionOptions(conditions);
      if (batteries.length) setBatteryOptions(batteries);
      if (batCaps.length) setBatteryCapacityOptions(batCaps);
    } catch (err) {
      setPhones([]);
      setAccessories([]);
      setInventoryBackendError(toUiError(err));
    } finally {
      setInventoryLoading(false);
    }
  }, []);

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
    })();
  }, [currentUser, reloadInventoryFromDb, reloadSoftwareFromDb]);

  useEffect(() => {
    if (!currentUser) {
      setSupabaseReportMonthly(null);
      setSupabaseYearlyChart(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Sequential reports to avoid connection spikes
        const monthly = await reportInventoryMonthly(inventoryReportMonth, storeFilter);
        if (cancelled) return;
        setSupabaseReportMonthly(monthly);
        const yearly = await reportInventoryYearly(Number(reportYear), storeFilter);
        if (cancelled) return;
        setSupabaseYearlyChart(toYearlyChartRows(yearly));
      } catch {
        if (!cancelled) {
          setSupabaseReportMonthly(null);
          setSupabaseYearlyChart(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser, inventoryReportMonth, reportYear, storeFilter]);

  let minInventoryPrice = 0;
  let maxInventoryPrice = Number.MAX_SAFE_INTEGER;
  if (inventoryPriceRange === "u1m") maxInventoryPrice = 1000000;
  else if (inventoryPriceRange === "1m-2m") { minInventoryPrice = 1000000; maxInventoryPrice = 2000000; }
  else if (inventoryPriceRange === "2m-4m") { minInventoryPrice = 2000000; maxInventoryPrice = 4000000; }
  else if (inventoryPriceRange === "4m-6m") { minInventoryPrice = 4000000; maxInventoryPrice = 6000000; }
  else if (inventoryPriceRange === "6m-10m") { minInventoryPrice = 6000000; maxInventoryPrice = 10000000; }
  else if (inventoryPriceRange === "o10m") minInventoryPrice = 10000000;

  const phoneTypeOptions = Array.from(new Set(phones.map((item) => item.name.split(" ")[0]).filter(Boolean)));
  const accessoryTypeOptions = Array.from(new Set(accessories.map((item) => item.code.split("-")[0]).filter(Boolean)));
  const inventoryTypeOptions = inventoryTab === "phones" ? phoneTypeOptions : accessoryTypeOptions;

  const filteredPhones = phones
    .filter((item) => {
      const matchesStore = storeFilter === "all" || item.storeId === storeFilter;
      const q = query.toLowerCase();
      const name = inventoryNameFilter.toLowerCase();
      const matchesQuickSearch = [item.name, item.imei, item.condition, item.color, item.storage].join(" ").toLowerCase().includes(q);
      const matchesName = item.name.toLowerCase().includes(name);
      const matchesBrand = inventoryBrandFilter === "all" || item.brand === inventoryBrandFilter;
      const matchesType = inventoryTypeFilter === "all" || item.name.toLowerCase().startsWith(inventoryTypeFilter.toLowerCase());
      const matchesPrice = item.expectedPrice >= minInventoryPrice && item.expectedPrice <= maxInventoryPrice;
      const matchesStatus = inventoryStatusFilter === "all" || item.status === inventoryStatusFilter;
      return matchesStore && matchesQuickSearch && matchesName && matchesBrand && matchesType && matchesPrice && matchesStatus;
    })
    .sort((a, b) => b.expectedPrice - a.expectedPrice);

  const filteredAccessories = accessories
    .filter((item) => {
      const matchesStore = storeFilter === "all" || item.storeId === storeFilter;
      const q = query.toLowerCase();
      const name = inventoryNameFilter.toLowerCase();
      const matchesQuickSearch = [item.name, item.code].join(" ").toLowerCase().includes(q);
      const matchesName = item.name.toLowerCase().includes(name);
      const matchesType = inventoryTypeFilter === "all" || item.code.toLowerCase().startsWith(inventoryTypeFilter.toLowerCase());
      const matchesPrice = item.price >= minInventoryPrice && item.price <= maxInventoryPrice;
      const matchesStatus = inventoryStatusFilter === "all" || item.status === inventoryStatusFilter || (inventoryStatusFilter === "Đã bán" && item.status === "Hết hàng");
      return matchesStore && matchesQuickSearch && matchesName && matchesType && matchesPrice && matchesStatus;
    })
    .sort((a, b) => b.price - a.price);

  const filteredRepairs = repairs.filter((item) => storeFilter === "all" || item.storeId === storeFilter);
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
  const editingAccessory = editingAccessoryId ? accessories.find((item) => item.id === editingAccessoryId) : null;
  const viewingPhone = viewingPhoneId ? phones.find((item) => item.id === viewingPhoneId) : null;
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
    const activePhones = phones.filter((item) => item.status === "Còn hàng" && (storeFilter === "all" || item.storeId === storeFilter));
    const activeAccessories = accessories.filter((item) => item.status !== "Đã hủy" && (storeFilter === "all" || item.storeId === storeFilter));
    const activeLedger = ledger.filter((item) => item.status === "Hiệu lực" && (storeFilter === "all" || item.storeId === storeFilter));
    const activeRepairs = repairs.filter((item) => item.status !== "Đã trả khách" && item.status !== "Đã hủy" && (storeFilter === "all" || item.storeId === storeFilter));
    const activeSales = sales.filter((item) => item.status === "Hoàn tất" && (storeFilter === "all" || item.storeId === storeFilter));

    return {
      phones: activePhones.length,
      accessories: activeAccessories.reduce((sum, item) => sum + item.quantity, 0),
      capital:
        activePhones.reduce((sum, item) => sum + item.cost, 0) +
        activeAccessories.reduce((sum, item) => sum + item.cost * item.quantity, 0),
      profit: activeSales.reduce((sum, item) => sum + item.profit, 0),
      income: activeLedger.filter((item) => item.type === "Thu").reduce((sum, item) => sum + item.amount, 0),
      expense: activeLedger.filter((item) => item.type === "Chi").reduce((sum, item) => sum + item.amount, 0),
      repairs: activeRepairs.length,
    };
  }, [accessories, ledger, phones, repairs, sales, storeFilter]);

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
        createdAt: new Date().toLocaleString("vi-VN"),
        user: currentUser?.name ?? "Demo",
        storeId,
        action,
        target,
      },
      ...prev,
    ]);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "").trim();
    if (!password) {
      setLoginError("Vui lòng nhập mật khẩu.");
      return;
    }

    // Login demo UI (role); dữ liệu kho luôn từ DB, không phụ thuộc mock seed.
    if (password !== "123456") {
      setLoginError("Mật khẩu không đúng (demo: 123456).");
      return;
    }
    const selected = users.find((user) => user.email === email) ?? users[0];
    setLoginError("");
    setInventoryBackendError("");
    setCurrentUser(selected);
    setStoreFilter(selected.role === "owner" ? "all" : selected.storeId);
  }

  function openInventoryCreateModal(tab: "phones" | "accessories" = inventoryTab) {
    setInventoryTab(tab);
    setEditingPhoneId(null);
    setClonePhoneDraft(null);
    setEditingAccessoryId(null);
    setIsInventoryModalOpen(true);
  }

  function openPhoneEditModal(id: string) {
    setInventoryTab("phones");
    setEditingPhoneId(id);
    setClonePhoneDraft(null);
    setEditingAccessoryId(null);
    setIsInventoryModalOpen(true);
  }

  /** Clone máy → popup xác nhận → mở form thêm mới (prefill, xóa IMEI / ngày bán). */
  function openPhoneCloneModal(id: string) {
    const source = phones.find((item) => item.id === id);
    if (!source) return;

    const label = `${source.brand} ${source.name}`.trim();
    const imeiHint = source.imei ? ` (…${source.imei.slice(-5)})` : "";
    const ok = window.confirm(
      `Nhân bản máy "${label}"${imeiHint}?\n\nForm thêm mới sẽ được điền sẵn thông tin. IMEI để trống — bạn cần nhập IMEI mới trước khi lưu.`
    );
    if (!ok) return;

    setInventoryTab("phones");
    setEditingPhoneId(null);
    setEditingAccessoryId(null);
    setClonePhoneDraft({
      ...source,
      id: "",
      imei: "",
      saleDate: "",
      status: "Còn hàng",
      importDate: new Date().toISOString().slice(0, 10),
    });
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
    setIsInventoryModalOpen(false);
    setEditingPhoneId(null);
    setClonePhoneDraft(null);
    setEditingAccessoryId(null);
  }

  async function savePhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const storeId =
      (form.get("storeId") as Exclude<StoreId, "all">) ||
      (storeFilter !== "all" ? storeFilter : currentUser?.storeId) ||
      "store-1";
    const payload: PhoneItem = {
      id: editingPhoneId ?? `p${Date.now()}`,
      brand: String(form.get("brand")),
      name: String(form.get("name")),
      imei: String(form.get("imei")),
      color: String(form.get("color")),
      storage: String(form.get("storage")),
      madeIn: String(form.get("madeIn")),
      networkVersion: String(form.get("networkVersion")),
      batteryCondition: String(form.get("batteryCondition")),
      batteryCapacity: String(form.get("batteryCapacity") || ""),
      condition: String(form.get("condition")),
      note: String(form.get("note") || ""),
      importDate: String(form.get("importDate") || new Date().toISOString().slice(0, 10)),
      saleDate: String(form.get("saleDate") || ""),
      storeId,
      cost: parseInputMoney(form.get("cost")),
      expectedPrice: parseInputMoney(form.get("expectedPrice")),
      status: String(form.get("status")) as ProductStatus,
    };

    try {
      const saved = await apiUpsertPhone({ ...payload, id: editingPhoneId ?? undefined });
      setPhones((prev) =>
        editingPhoneId
          ? prev.map((item) => (item.id === editingPhoneId ? saved : item))
          : [saved, ...prev]
      );
      // Server ensure-lookup đã ghi DB; đồng bộ option local (không cần full bootstrap).
      const pushOpt = (setter: (fn: (prev: string[]) => string[]) => void, value: string) => {
        const v = value?.trim();
        if (!v) return;
        setter((prev) => (prev.some((o) => o.toLowerCase() === v.toLowerCase()) ? prev : [...prev, v]));
      };
      pushOpt(setBrandOptions, saved.brand);
      pushOpt(setNameOptions, saved.name);
      pushOpt(setColorOptions, saved.color);
      pushOpt(setStorageOptions, saved.storage);
      pushOpt(setMadeInOptions, saved.madeIn);
      pushOpt(setConditionOptions, saved.condition);
      pushOpt(setBatteryOptions, saved.batteryCondition);
      pushOpt(setBatteryCapacityOptions, saved.batteryCapacity || "");
      pushLog(editingPhoneId ? "Sửa máy trong kho" : "Thêm máy vào kho", saved.imei, storeId);
      setInventoryBackendError("");
    } catch (err) {
      setInventoryBackendError(toUiError(err));
      return;
    }

    closeInventoryModal();
    setInventoryPage(1);
    event.currentTarget.reset();
  }

  async function saveAccessory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const storeId = String(form.get("storeId")) as Exclude<StoreId, "all">;
    const quantity = Number(form.get("quantity") || 0);
    const payload: Accessory = {
      id: editingAccessoryId ?? `a${Date.now()}`,
      code: String(form.get("code")),
      name: String(form.get("name")),
      storeId,
      quantity,
      cost: parseInputMoney(form.get("cost")),
      price: parseInputMoney(form.get("price")),
      status: String(form.get("status") || (quantity > 0 ? "Còn hàng" : "Hết hàng")) as AccessoryStatus,
    };

    try {
      const saved = await apiUpsertAccessory({
        ...payload,
        id: editingAccessoryId ?? undefined,
      });
      setAccessories((prev) =>
        editingAccessoryId
          ? prev.map((item) => (item.id === editingAccessoryId ? saved : item))
          : [saved, ...prev]
      );
      pushLog(
        editingAccessoryId ? "Sửa phụ kiện trong kho" : "Thêm phụ kiện vào kho",
        saved.code,
        storeId
      );
      setInventoryBackendError("");
    } catch (err) {
      setInventoryBackendError(toUiError(err));
      return;
    }

    closeInventoryModal();
    setInventoryPage(1);
    event.currentTarget.reset();
  }

  function createSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const storeId = String(form.get("storeId")) as Exclude<StoreId, "all">;
    const itemType = String(form.get("itemType")) as "Máy" | "Phụ kiện";
    const itemId = String(form.get("itemId"));
    const quantity = Number(form.get("quantity") || 1);
    const amount = Number(form.get("amount") || 0);
    const profit = Number(form.get("profit") || 0);
    const payment = String(form.get("payment")) as PaymentMethod;
    const itemName =
      itemType === "Máy"
        ? phones.find((item) => item.id === itemId)?.name ?? "Máy"
        : accessories.find((item) => item.id === itemId)?.name ?? "Phụ kiện";
    const sale: Sale = {
      id: `s${Date.now()}`,
      createdAt: new Date().toISOString().slice(0, 10),
      customerId: String(form.get("customerId")),
      storeId,
      itemName,
      itemType,
      quantity,
      amount,
      profit,
      payment,
      status: "Hoàn tất",
    };

    if (itemType === "Máy") {
      setPhones((prev) => prev.map((item) => (item.id === itemId ? { ...item, status: "Đã bán" } : item)));
    } else {
      setAccessories((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, quantity: Math.max(0, item.quantity - quantity), status: item.quantity - quantity <= 0 ? "Hết hàng" : item.status }
            : item,
        ),
      );
    }

    setSales((prev) => [sale, ...prev]);
    setLedger((prev) => [
      { id: `l${Date.now()}`, createdAt: sale.createdAt, storeId, type: "Thu", source: `Phiếu bán ${sale.id}`, amount, payment, status: "Hiệu lực" },
      ...prev,
    ]);
    pushLog("Tạo phiếu bán", sale.id, storeId);
    event.currentTarget.reset();
  }

  function createRepair(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const storeId = String(form.get("storeId")) as Exclude<StoreId, "all">;
    const deposit = Number(form.get("deposit") || 0);
    const repair: Repair = {
      id: `r${Date.now()}`,
      createdAt: new Date().toISOString().slice(0, 10),
      customerId: String(form.get("customerId")),
      storeId,
      deviceName: String(form.get("deviceName")),
      screenPassword: String(form.get("screenPassword")),
      issue: String(form.get("issue")),
      intakeNote: String(form.get("intakeNote")),
      quote: Number(form.get("quote") || 0),
      deposit,
      status: "Đang chờ",
    };

    setRepairs((prev) => [repair, ...prev]);
    if (deposit > 0) {
      setLedger((prev) => [
        { id: `l${Date.now()}`, createdAt: repair.createdAt, storeId, type: "Thu", source: `Cọc sửa ${repair.id}`, amount: deposit, payment: "Tiền mặt", status: "Hiệu lực" },
        ...prev,
      ]);
    }
    pushLog("Tạo phiếu sửa", repair.id, storeId);
    event.currentTarget.reset();
  }

  function createExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const storeId = String(form.get("storeId")) as Exclude<StoreId, "all">;
    const entry: Ledger = {
      id: `l${Date.now()}`,
      createdAt: new Date().toISOString().slice(0, 10),
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

  function updateRepairStatus(id: string, status: RepairStatus) {
    const repair = repairs.find((item) => item.id === id);
    if (!repair) return;
    setRepairs((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
    pushLog("Cập nhật trạng thái sửa chữa", `${id}: ${status}`, repair.storeId);
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
          <form onSubmit={handleLogin} className="grid gap-4">
            <Field label="Tài khoản">
              <select name="email" className="h-11 rounded-lg border border-line px-3">
                {users.map((user) => (
                  <option key={user.id} value={user.email}>
                    {user.name} - {user.email}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mật khẩu">
              <div className={`flex h-11 items-center rounded-lg border bg-white transition focus-within:border-brand ${loginError ? "border-red-300 bg-red-50" : "border-line"}`}>
                <input
                  name="password"
                  className="min-w-0 flex-1 bg-transparent px-3 outline-none"
                  placeholder="Vui lòng nhập pass"
                  type={isLoginPasswordVisible ? "text" : "password"}
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
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white hover:bg-brand-dark">
              <ShieldCheck size={18} />
              Vào hệ thống
            </button>
          </form>
        </section>
      </main>
    );
  }

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
          {navItems.map((item) => {
            const Icon = item.icon;
            const isDisabled = item.id === "accounts" && currentUser.role !== "owner";
            return (
              <button
                key={item.id}
                disabled={isDisabled}
                onClick={() => setActivePage(item.id)}
                className={`group flex h-11 items-center gap-3 rounded-lg border px-3 text-left text-sm font-bold transition ${
                  activePage === item.id
                    ? "border-emerald-300/40 bg-brand text-white shadow-[0_10px_24px_rgba(15,139,98,0.32)]"
                    : "border-white/5 bg-white/[0.04] text-slate-300 hover:border-emerald-300/25 hover:bg-white/[0.09] hover:text-white"
                } ${isDisabled ? "cursor-not-allowed opacity-45" : ""}`}
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
        <header className={`mb-5 flex flex-col gap-4 lg:flex-row lg:items-center ${activePage === "online-repairs" ? "justify-end" : "lg:justify-between"}`}>
          <div className={activePage === "online-repairs" ? "hidden" : "block"}>
            <h1 className="text-2xl font-black sm:text-3xl">{navItems.find((item) => item.id === activePage)?.label}</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Xin chào, {currentUser.name}. Chúc bạn một ngày làm việc hiệu quả!</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={storeFilter} onChange={(event) => setStoreFilter(event.target.value as StoreId)} className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-bold">
              <option value="all">Toàn hệ thống</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setLoginError("");
                setInventoryBackendError("");
                setPhones([]);
                setAccessories([]);
                setCurrentUser(null);
              }}
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
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              Mật khẩu màn hình trong phiếu sửa đang được hiển thị như ghi chú thường theo phạm vi MVP; cần nâng cấp bảo mật ở giai đoạn backend.
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Máy còn hàng" value={isStatsHidden ? "***" : `${dashboard.phones}`} hint={storeName(storeFilter)} icon={<Smartphone size={20} />} />
              <StatCard label="Phụ kiện tồn" value={isStatsHidden ? "***" : `${dashboard.accessories}`} hint="Tổng số lượng khả dụng" icon={<PackagePlus size={20} />} />
              <StatCard label="Tổng vốn" value={isStatsHidden ? "***" : formatMoney(dashboard.capital)} hint="Máy + phụ kiện tồn" icon={<Store size={20} />} />
              <StatCard label="Lãi đã ghi" value={isStatsHidden ? "***" : formatMoney(dashboard.profit)} hint="Từ phiếu bán hiệu lực" icon={<Activity size={20} />} />
              <StatCard label="Tổng thu" value={isStatsHidden ? "***" : formatMoney(dashboard.income)} hint="Theo sổ thu chi" icon={<ReceiptText size={20} />} />
              <StatCard label="Tổng chi" value={isStatsHidden ? "***" : formatMoney(dashboard.expense)} hint="Theo sổ thu chi" icon={<CreditCard size={20} />} />
              <StatCard label="Máy đang sửa" value={isStatsHidden ? "***" : `${dashboard.repairs}`} hint="Chưa trả khách" icon={<Wrench size={20} />} />
              <StatCard label="Dòng tiền ròng" value={isStatsHidden ? "***" : formatMoney(dashboard.income - dashboard.expense)} hint="Thu trừ chi" icon={<FileText size={20} />} />
            </div>
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
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                  <p className="text-sm font-bold text-muted">Bán được</p>
                  <div className="mt-4 flex items-center justify-between">
                    <strong className="text-3xl text-sky-800">{isStatsHidden || hideReportSold ? "***" : `${inventoryMonthlyReport.soldPhones} con`}</strong>
                    <button onClick={() => setHideReportSold(!hideReportSold)} className="grid h-11 w-11 place-items-center rounded-lg bg-sky-50 text-sky-700 transition hover:bg-sky-100"><Smartphone size={20} /></button>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-muted">Số máy bán trong tháng</p>
                </section>
                <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                  <p className="text-sm font-bold text-muted">Tổng doanh thu tháng</p>
                  <div className="mt-4 flex items-center justify-between">
                    <strong className="text-3xl text-amber-700">{isStatsHidden || hideReportRevenue ? "***" : formatMoney(inventoryMonthlyReport.revenue)}</strong>
                    <button onClick={() => setHideReportRevenue(!hideReportRevenue)} className="grid h-11 w-11 place-items-center rounded-lg bg-amber-50 text-amber-700 transition hover:bg-amber-100"><ReceiptText size={20} /></button>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-muted">Từ phiếu bán hoàn tất</p>
                </section>
                <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                  <p className="text-sm font-bold text-muted">Tổng lợi nhuận tháng</p>
                  <div className="mt-4 flex items-center justify-between">
                    <strong className="text-3xl text-emerald-700">{isStatsHidden || hideReportProfit ? "***" : formatMoney(inventoryMonthlyReport.profit)}</strong>
                    <button onClick={() => setHideReportProfit(!hideReportProfit)} className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"><Activity size={20} /></button>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-muted">Lãi ghi nhận trong tháng</p>
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
                    <p className="text-sm font-semibold text-muted">Tìm kiếm nâng cao theo loại, tên máy, khoảng giá và thứ tự giá.</p>
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
                    {brandOptions.map((brand) => (
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
                <aside className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <span className="block text-sm font-bold text-emerald-700">Số lượng đã bán</span>
                    <strong className="text-2xl text-emerald-700">
                      {isStatsHidden ? "***" : (inventoryTab === "phones"
                        ? phones.filter((p) => p.status === "Đã bán" && (storeFilter === "all" || p.storeId === storeFilter)).length
                        : sales.filter((s) => s.itemType === "Phụ kiện" && s.status === "Hoàn tất" && (storeFilter === "all" || s.storeId === storeFilter)).reduce((sum, s) => sum + s.quantity, 0))}
                    </strong>
                  </div>
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
                    <span className="block text-sm font-bold text-sky-700">Số lượng còn hàng</span>
                    <strong className="text-2xl text-sky-700">
                      {isStatsHidden ? "***" : (inventoryTab === "phones"
                        ? phones.filter((p) => p.status === "Còn hàng" && (storeFilter === "all" || p.storeId === storeFilter)).length
                        : accessories.filter((a) => a.status === "Còn hàng" && (storeFilter === "all" || a.storeId === storeFilter)).reduce((sum, a) => sum + a.quantity, 0))}
                    </strong>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <span className="block text-sm font-bold text-amber-700">Số lượng chưa xử lý</span>
                    <strong className="text-2xl text-amber-700">
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
                      <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: getColorCode(item.color) }} />
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
                <section className="max-h-[92vh] w-full max-w-[860px] overflow-auto rounded-2xl border border-white/20 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.4)] backdrop-blur-xl">
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
                        <p className="mt-1 text-sm font-semibold text-sky-700">Đã copy thông tin máy mẫu — chỉnh IMEI / vài field rồi lưu máy mới.</p>
                      ) : null}
                    </div>
                    <button onClick={closeInventoryModal} className="h-9 rounded-xl border border-slate-200/60 bg-white/50 px-4 text-sm font-black text-slate-600 backdrop-blur-md transition hover:bg-white hover:text-slate-900">
                      Đóng
                    </button>
                  </div>
                  <div className="p-5">
                    {inventoryTab === "phones" ? (
                      <form key={editingPhone?.id ?? (clonePhoneDraft ? `clone-${cloneFormKey}` : "new-phone")} onSubmit={savePhone} className="grid gap-3" autoComplete="off" spellCheck={false}>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <ManageableSelect label="Hãng" name="brand" options={brandOptions} setOptions={setBrandOptions} defaultValue={phoneFormDefaults?.brand} categoryCode={PHONE_LOOKUP_CATEGORIES.brand} onRenameCascade={reloadInventoryFromDb} />
                          <ManageableSelect label="Tên máy" name="name" options={nameOptions} setOptions={setNameOptions} defaultValue={phoneFormDefaults?.name} categoryCode={PHONE_LOOKUP_CATEGORIES.modelName} onRenameCascade={reloadInventoryFromDb} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="IMEI"><input name="imei" defaultValue={phoneFormDefaults?.imei} placeholder={clonePhoneDraft && !editingPhone ? "Nhập IMEI máy mới" : undefined} className="h-10 rounded-lg border border-line px-3" /></Field>
                          <SelectField label="Trạng thái" name="status" options={["Còn hàng", "Đã bán", "Đã hủy", "Chưa xử lý"].map((status) => [status, status])} defaultValue={phoneFormDefaults?.status ?? "Còn hàng"} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <ManageableSelect label="Màu sắc" name="color" options={colorOptions} setOptions={setColorOptions} defaultValue={phoneFormDefaults?.color} categoryCode={PHONE_LOOKUP_CATEGORIES.color} onRenameCascade={reloadInventoryFromDb} />
                          <ManageableSelect label="Dung lượng máy" name="storage" options={storageOptions} setOptions={setStorageOptions} defaultValue={phoneFormDefaults?.storage} categoryCode={PHONE_LOOKUP_CATEGORIES.storage} onRenameCascade={reloadInventoryFromDb} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <ManageableSelect label="Quốc gia" name="madeIn" options={madeInOptions} setOptions={setMadeInOptions} defaultValue={phoneFormDefaults?.madeIn} required={false} categoryCode={PHONE_LOOKUP_CATEGORIES.madeIn} onRenameCascade={reloadInventoryFromDb} />
                          <ManageableSelect label="Tình trạng máy" name="condition" options={conditionOptions} setOptions={setConditionOptions} defaultValue={phoneFormDefaults?.condition} categoryCode={PHONE_LOOKUP_CATEGORIES.condition} onRenameCascade={reloadInventoryFromDb} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <ManageableSelect label="Tình trạng pin" name="batteryCondition" options={batteryOptions} setOptions={setBatteryOptions} defaultValue={phoneFormDefaults?.batteryCondition} categoryCode={PHONE_LOOKUP_CATEGORIES.batteryCondition} onRenameCascade={reloadInventoryFromDb} />
                          <ManageableSelect label="Dung lượng pin" name="batteryCapacity" options={batteryCapacityOptions} setOptions={setBatteryCapacityOptions} defaultValue={phoneFormDefaults?.batteryCapacity} required={false} categoryCode={PHONE_LOOKUP_CATEGORIES.batteryCapacity} onRenameCascade={reloadInventoryFromDb} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-1">
                          <Field label="Ghi chú"><input name="note" defaultValue={phoneFormDefaults?.note} className="h-10 rounded-lg border border-line px-3" /></Field>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Ngày nhập"><input name="importDate" type="date" defaultValue={phoneFormDefaults?.importDate || new Date().toISOString().slice(0, 10)} className="h-10 rounded-lg border border-line px-3" /></Field>
                          <Field label="Ngày bán"><input name="saleDate" type="date" defaultValue={phoneFormDefaults?.saleDate} className="h-10 rounded-lg border border-line px-3" /></Field>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Giá nhập"><MoneyInput name="cost" defaultValue={phoneFormDefaults?.cost} /></Field>
                          <Field label="Giá bán"><MoneyInput name="expectedPrice" defaultValue={phoneFormDefaults?.expectedPrice} /></Field>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-line pt-4">
                          <button type="button" onClick={closeInventoryModal} className="h-10 rounded-lg border border-line bg-white px-4 font-bold text-muted">Hủy</button>
                          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white hover:bg-brand-dark">
                            <Plus size={18} />
                            {editingPhone ? "Lưu sửa" : "Thêm máy"}
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
                          <button type="button" onClick={closeInventoryModal} className="h-10 rounded-lg border border-line bg-white px-4 font-bold text-muted">Hủy</button>
                          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white hover:bg-brand-dark">
                            <Plus size={18} />
                            {editingAccessory ? "Lưu sửa" : "Thêm phụ kiện"}
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
                            <span className="h-3.5 w-3.5 rounded-full border border-slate-200" style={{ backgroundColor: getColorCode(viewingPhone.color) }} />
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
                        <Field label="Ngày nhập"><div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-slate-800">{viewingPhone.importDate ? new Date(viewingPhone.importDate).toLocaleDateString("vi-VN") : "Chưa có"}</div></Field>
                        <Field label="Ngày bán"><div className="flex h-10 w-full items-center rounded-lg border border-line bg-slate-50 px-3 text-slate-800">{viewingPhone.saleDate ? new Date(viewingPhone.saleDate).toLocaleDateString("vi-VN") : "Chưa bán"}</div></Field>
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
                <Field label="Tổng tiền"><input name="amount" type="number" min="0" className="h-10 rounded-lg border border-line px-3" /></Field>
                <Field label="Lãi/Giá vốn nhập tay"><input name="profit" type="number" min="0" className="h-10 rounded-lg border border-line px-3" /></Field>
                <SelectField label="Thanh toán" name="payment" options={["Tiền mặt", "Chuyển khoản", "Thẻ", "Khác"].map((p) => [p, p])} />
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white"><Plus size={18} />Tạo phiếu bán</button>
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

        {activePage === "repairs" && (
          <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
            <Panel title="Tạo phiếu nhận máy">
              <form onSubmit={createRepair} className="grid gap-3">
                <SelectField label="Khách hàng" name="customerId" options={customers.map((c) => [c.id, `${c.name} - ${c.phone}`])} />
                <SelectField label="Cửa hàng" name="storeId" options={stores.map((s) => [s.id, s.name])} />
                <Field label="Tên máy"><input name="deviceName" className="h-10 rounded-lg border border-line px-3" placeholder="iPhone XS" /></Field>
                <Field label="Mật khẩu màn hình"><input name="screenPassword" className="h-10 rounded-lg border border-line px-3" placeholder="Lưu dạng ghi chú thường" /></Field>
                <Field label="Lỗi cần sửa"><input name="issue" className="h-10 rounded-lg border border-line px-3" /></Field>
                <Field label="Báo giá"><input name="quote" type="number" min="0" className="h-10 rounded-lg border border-line px-3" /></Field>
                <Field label="Tiền cọc"><input name="deposit" type="number" min="0" className="h-10 rounded-lg border border-line px-3" /></Field>
                <Field label="Tình trạng lúc nhận"><textarea name="intakeNote" className="min-h-24 rounded-lg border border-line px-3 py-2" /></Field>
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white"><Plus size={18} />Tạo phiếu sửa</button>
              </form>
            </Panel>
            <Panel title="Theo dõi sửa chữa">
              <DataTable
                headers={["Ngày", "Khách", "Máy", "Lỗi", "Cọc", "Trạng thái", "Cập nhật"]}
                rows={filteredRepairs.map((item) => [
                  item.createdAt,
                  customers.find((c) => c.id === item.customerId)?.name ?? "-",
                  item.deviceName,
                  item.issue,
                  formatMoney(item.deposit),
                  <StatusBadge key={item.id} tone={item.status === "Đã hủy" ? "danger" : item.status === "Đã trả khách" ? "ok" : "warn"}>{item.status}</StatusBadge>,
                  <select key={item.id} value={item.status} onChange={(event) => updateRepairStatus(item.id, event.target.value as RepairStatus)} className="h-9 rounded-lg border border-line px-2 text-sm">
                    {["Đang chờ", "Đang sửa", "Đã xong", "Đã trả khách", "Đã hủy"].map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>,
                ])}
              />
            </Panel>
          </section>
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

        {activePage === "accounts" && (
          <Panel title="Quản lý tài khoản">
            <DataTable
              headers={["Tên", "Email", "Vai trò", "Cửa hàng", "Quyền"]}
              rows={users.map((user) => [
                user.name,
                user.email,
                user.role === "owner" ? "Chủ cửa hàng" : "Nhân viên",
                storeName(user.storeId),
                user.role === "owner" ? "Toàn quyền, hủy mềm, xem báo cáo" : "Thêm/sửa nghiệp vụ, không hủy dữ liệu",
              ])}
            />
          </Panel>
        )}

        {activePage === "software" && (() => {
          const today = new Date().toLocaleDateString("vi-VN", { day: '2-digit' });
          const currentMonth = new Date().toISOString().slice(0, 7);
          const monthlyServices = softwareServices.filter(s => s.createdAt.startsWith(currentMonth));
          const dailyServices = softwareServices.filter(s => s.createdAt.includes(new Date().toISOString().slice(0, 10)));
          
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
                    createdAt: new Date().toISOString().slice(0, 16).replace("T", " "),
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
                  <span className="block text-sm font-bold text-emerald-800">Tháng {new Date().getMonth() + 1} (Doanh thu)</span>
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
          const todayString = new Date().toISOString().slice(0, 10);
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
            {isOnlineRepairModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto backdrop-blur-sm">
                <div className="w-full max-w-2xl bg-white rounded-lg shadow-2xl relative my-auto">
                  <div className="p-4 border-b border-line flex justify-between items-center bg-slate-50 rounded-t-lg">
                    <h2 className="text-xl font-black text-brand">{editingOnlineRepairId ? "Sửa đơn Phần mềm" : "Tạo đơn Phần mềm"}</h2>
                    <button onClick={() => { setIsOnlineRepairModalOpen(false); setEditingOnlineRepairId(null); }} className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-slate-700">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="p-4">
                    <form
                      key={editingOnlineRepairId ?? "new"}
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const form = new FormData(e.currentTarget);
                        const quote = parseInputMoney(form.get("quote"));
                        const deposit = parseInputMoney(form.get("deposit"));
                        const pStatus = String(
                          form.get("paymentStatus")
                        ) as OnlineRepair["paymentStatus"];
                        const existing = editingOnlineRepairId
                          ? onlineRepairs.find((r) => r.id === editingOnlineRepairId)
                          : null;

                        const payload = {
                          id: editingOnlineRepairId ?? undefined,
                          customerName: String(form.get("customerName")),
                          customerType: (form.get("customerType")
                            ? String(form.get("customerType"))
                            : existing?.customerType || "Vãng lai") as OnlineRepair["customerType"],
                          deviceName: String(form.get("deviceName")),
                          issue: existing?.issue ?? "",
                          quote,
                          deposit,
                          receiveDate: String(form.get("receiveDate") || ""),
                          completeDate: existing?.completeDate ?? "",
                          paymentDate: existing?.paymentDate ?? "",
                          paymentStatus: pStatus,
                          rewardPoints: existing?.rewardPoints ?? 0,
                          isPaid: pStatus === "Đã thanh toán",
                        };

                        try {
                          const saved = await apiUpsertSoftwareOrder(payload);
                          setOnlineRepairs((prev) =>
                            editingOnlineRepairId
                              ? prev.map((r) => (r.id === editingOnlineRepairId ? saved : r))
                              : [saved, ...prev]
                          );
                          setSoftwareBackendError("");
                          setEditingOnlineRepairId(null);
                          setIsOnlineRepairModalOpen(false);
                          pushLog(
                            editingOnlineRepairId
                              ? "Sửa đơn phần mềm"
                              : "Tạo đơn phần mềm",
                            `${saved.customerName} — ${saved.deviceName}`,
                            currentUser?.storeId || "store-1"
                          );
                        } catch (err) {
                          setSoftwareBackendError(toUiError(err));
                        }
                      }}
                      className="grid gap-3"
                    >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Khách hàng / Thợ" required><input name="customerName" required defaultValue={onlineRepairs.find(r => r.id === editingOnlineRepairId)?.customerName} className="h-10 rounded-lg border border-line px-3" placeholder="Ví dụ: Hoàng Táo" /></Field>
                  <Field label="Tên máy" required><input name="deviceName" required defaultValue={onlineRepairs.find(r => r.id === editingOnlineRepairId)?.deviceName} className="h-10 rounded-lg border border-line px-3" /></Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Báo giá"><input name="quote" type="text" required defaultValue={formatInputMoney(onlineRepairs.find(r => r.id === editingOnlineRepairId)?.quote ?? "")} onChange={e => e.target.value = formatInputMoney(e.target.value)} className="h-10 rounded-lg border border-line px-3" /></Field>
                  <Field label="Phí dịch vụ"><input name="deposit" type="text" required defaultValue={formatInputMoney(onlineRepairs.find(r => r.id === editingOnlineRepairId)?.deposit ?? "")} onChange={e => e.target.value = formatInputMoney(e.target.value)} className="h-10 rounded-lg border border-line px-3" /></Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Giờ"><input name="receiveDate" type="datetime-local" defaultValue={onlineRepairs.find(r => r.id === editingOnlineRepairId)?.receiveDate || new Date().toISOString().slice(0, 16)} className="h-10 rounded-lg border border-line px-3 text-xs" /></Field>
                  <Field label="Thanh toán" required>
                    <select name="paymentStatus" required defaultValue={onlineRepairs.find(r => r.id === editingOnlineRepairId)?.paymentStatus ?? ""} className="h-10 rounded-lg border border-line bg-white px-3 font-semibold">
                      <option value="" disabled hidden>Chọn</option>
                      <option value="Đã thanh toán">Đã thanh toán</option>
                      <option value="Nợ dai">Nợ dai</option>
                    </select>
                  </Field>
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <button type="button" onClick={() => { setIsOnlineRepairModalOpen(false); setEditingOnlineRepairId(null); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 font-bold text-slate-700 hover:bg-slate-200">Hủy</button>
                  <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white"><Plus size={18} />{editingOnlineRepairId ? "Lưu thay đổi" : "Tạo đơn"}</button>
                </div>
              </form>
                  </div>
                </div>
              </div>
            )}

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
                    <span>{isOnlineRepairSensitiveHidden ? "***" : formatMoney(monthlyRepairs.filter(r => r.paymentStatus === "Nợ dai").reduce((sum, r) => sum + r.quote, 0))}</span>
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
                    <span>{isOnlineRepairSensitiveHidden ? "***" : formatMoney(dailyRepairs.filter(r => r.paymentStatus === "Nợ dai").reduce((sum, r) => sum + r.quote, 0))}</span>
                  </div>
                </div>
              </div>

              <Panel title="Danh sách Phần mềm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={onlineRepairFilter} onChange={(e) => setOnlineRepairFilter(e.target.value)} className="h-10 rounded-lg border border-line px-3 text-sm font-bold">
                      <option value="all">Tất cả trạng thái</option>
                      <option value="paid">Đã thanh toán</option>
                      <option value="unpaid">Nợ dai</option>
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
                    <button onClick={() => { setEditingOnlineRepairId(null); setIsOnlineRepairModalOpen(true); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white shadow hover:bg-brand-dark">
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
                      
                      const formatDateTime = (dt: string) => {
                        if (!dt) return "-";
                        return dt.replace("T", " ");
                      };
                      
                      const isNợ = item.paymentStatus === "Nợ dai";
                      const isDaThanhToan = item.paymentStatus === "Đã thanh toán";

                      return [
                        <span key={item.id} className="font-bold text-brand whitespace-nowrap">{item.customerName}</span>,
                        <span key={item.id} className="font-semibold text-slate-700 whitespace-nowrap">{item.deviceName}</span>,
                        formatMoney(item.quote),
                        isOnlineRepairSensitiveHidden ? "***" : formatMoney(item.deposit),
                        <span key={item.id} className="font-black text-amber-700">{isOnlineRepairSensitiveHidden ? "***" : formatMoney(item.quote - item.deposit)}</span>,
                        <span key={item.id} className="text-xs font-semibold text-slate-500 whitespace-nowrap">{formatDateTime(item.receiveDate)}</span>,
                        <span
                          key={item.id}
                          className={`inline-flex h-8 items-center rounded text-xs font-bold px-2 shadow-sm border border-line ${isNợ ? "bg-red-50 text-red-600" : isDaThanhToan ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-600"}`}
                        >
                          {isDaThanhToan ? "✅ Đã thanh toán" : "❌ Nợ dai"}
                        </span>,
                        <div key={item.id} className="flex gap-2">
                          <button onClick={() => { setEditingOnlineRepairId(item.id); setIsOnlineRepairModalOpen(true); }} className="text-brand hover:text-brand-dark"><Edit3 size={16} /></button>
                        </div>
                      ];
                    })}
                  />
                </div>
              </Panel>
            </div>
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

function SelectField({ label, name, options, defaultValue }: { label: string; name: string; options: string[][]; defaultValue?: string }) {
  return (
    <Field label={label} required>
      <select name={name} required defaultValue={defaultValue ?? ""} className="h-10 rounded-lg border border-line px-3">
        <option value="" disabled hidden>Chọn</option>
        {options.map(([value, text]) => (
          <option key={`${name}-${value}`} value={value}>
            {text}
          </option>
        ))}
      </select>
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
  onRenameCascade,
}: {
  label: string;
  name: string;
  options: string[];
  setOptions: (o: string[]) => void;
  defaultValue?: string;
  required?: boolean;
  /** When set, +/sửa/xóa persist to lookup_items via API. */
  categoryCode?: string;
  /** After rename (phones may cascade), refresh inventory from DB. */
  onRenameCascade?: () => Promise<void>;
}) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    const val = window.prompt(`Thêm giá trị mới cho ${label}:`);
    const next = val?.trim();
    if (!next) return;
    if (options.some((o) => o.toLowerCase() === next.toLowerCase())) {
      window.alert(`"${next}" đã có trong danh sách.`);
      return;
    }

    if (!categoryCode) {
      setOptions([...options, next]);
      setTimeout(() => {
        if (selectRef.current) selectRef.current.value = next;
      }, 0);
      return;
    }

    try {
      setBusy(true);
      const result = await apiAddLookupItem(categoryCode, next);
      setOptions(result.labels);
      setTimeout(() => {
        if (selectRef.current) selectRef.current.value = result.label ?? next;
      }, 0);
    } catch (err) {
      window.alert(toUiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = async () => {
    const select = selectRef.current;
    if (!select || !select.value) return;
    const oldVal = select.value;
    const val = window.prompt(`Sửa giá trị "${oldVal}" thành:`, oldVal);
    const next = val?.trim();
    if (!next || next === oldVal) return;

    if (!categoryCode) {
      setOptions(options.map((o) => (o === oldVal ? next : o)));
      setTimeout(() => {
        if (selectRef.current) selectRef.current.value = next;
      }, 0);
      return;
    }

    try {
      setBusy(true);
      const result = await apiUpdateLookupItem(categoryCode, oldVal, next);
      setOptions(result.labels);
      setTimeout(() => {
        if (selectRef.current) selectRef.current.value = result.label ?? next;
      }, 0);
      if (onRenameCascade) await onRenameCascade();
    } catch (err) {
      window.alert(toUiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const select = selectRef.current;
    if (!select || !select.value) return;
    if (!window.confirm(`Xóa giá trị "${select.value}" khỏi danh sách ${label}?`)) return;

    const removed = select.value;
    if (!categoryCode) {
      setOptions(options.filter((o) => o !== removed));
      return;
    }

    try {
      setBusy(true);
      const result = await apiDeactivateLookupItem(categoryCode, removed);
      setOptions(result.labels);
    } catch (err) {
      window.alert(toUiError(err));
    } finally {
      setBusy(false);
    }
  };

  const displayOptions = useMemo(() => {
    if (defaultValue && !options.includes(defaultValue)) {
      return [defaultValue, ...options];
    }
    return options;
  }, [options, defaultValue]);

  return (
    <Field label={label} required={required}>
      <div className="flex gap-1">
        <select
          ref={selectRef}
          name={name}
          required={required}
          defaultValue={defaultValue ?? ""}
          disabled={busy}
          className="h-10 min-w-0 flex-1 rounded-lg border border-line px-3 outline-none focus:border-brand disabled:opacity-60"
        >
          <option value="" disabled hidden>
            Chọn
          </option>
          {displayOptions.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
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
