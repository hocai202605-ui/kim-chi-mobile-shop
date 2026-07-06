"use client";

import {
  Activity,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Edit3,
  Eye,
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
  Trash2,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";
import { FormEvent, ReactNode, useMemo, useState } from "react";

type Role = "owner" | "staff";
type StoreId = "all" | "store-1" | "store-2" | "store-3";
type PaymentMethod = "Tiền mặt" | "Chuyển khoản" | "Thẻ" | "Khác";
type ProductStatus = "Còn hàng" | "Đã bán" | "Đã hủy";
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

const phoneSeed: PhoneItem[] = [
  { id: "p1", brand: "iPhone", name: "13 Pro Max", imei: "356789101234561", color: "Xanh lá", storage: "256GB", madeIn: "VN/A", networkVersion: "5G", batteryCondition: "Zin 92%", condition: "Like New", note: "Máy đẹp keng, full box", storeId: "store-1", cost: 13500000, expectedPrice: 15200000, status: "Còn hàng", importDate: "2026-07-01" },
  { id: "p2", brand: "iPhone", name: "12", imei: "356789101234562", color: "Đen", storage: "128GB", madeIn: "LL/A", networkVersion: "5G", batteryCondition: "80-90%", condition: "Cũ", note: "Trầy viền nhẹ", storeId: "store-2", cost: 7200000, expectedPrice: 8200000, status: "Còn hàng", importDate: "2026-07-02" },
  { id: "p3", brand: "Samsung", name: "Galaxy S22 Ultra", imei: "356789101234563", color: "Đỏ", storage: "256GB", madeIn: "VN/A", networkVersion: "5G", batteryCondition: "Zin", condition: "Like New", note: "Còn bảo hành hãng", storeId: "store-3", cost: 12500000, expectedPrice: 14000000, status: "Còn hàng", importDate: "2026-07-03" },
  { id: "p4", brand: "iPhone", name: "11", imei: "356789101234564", color: "Tím", storage: "64GB", madeIn: "VN/A", networkVersion: "4G", batteryCondition: "Đã thay", condition: "Cũ", note: "Máy zin áp, thay pin pisen", storeId: "store-1", cost: 5500000, expectedPrice: 6500000, status: "Còn hàng", importDate: "2026-07-01" },
  { id: "p5", brand: "Oppo", name: "Reno 8", imei: "356789101234565", color: "Vàng", storage: "256GB", madeIn: "Trung Quốc", networkVersion: "5G", batteryCondition: "Zin", condition: "Mới 100%", note: "Nguyên seal", storeId: "store-2", cost: 7000000, expectedPrice: 8500000, status: "Còn hàng", importDate: "2026-07-04" },
  { id: "p6", brand: "Xiaomi", name: "Redmi Note 12", imei: "356789101234566", color: "Xám", storage: "128GB", madeIn: "Trung Quốc", networkVersion: "5G", batteryCondition: "Zin", condition: "Like New", note: "", storeId: "store-3", cost: 3500000, expectedPrice: 4200000, status: "Còn hàng", importDate: "2026-07-05" },
  { id: "p7", brand: "iPhone", name: "14 Pro Max", imei: "356789101234567", color: "Tím", storage: "256GB", madeIn: "LL/A", networkVersion: "5G", batteryCondition: "Zin 98%", condition: "Like New", note: "Kèm ốp lưng xịn", storeId: "store-1", cost: 21500000, expectedPrice: 23200000, status: "Còn hàng", importDate: "2026-07-02" },
  { id: "p8", brand: "iPhone", name: "15 Pro Max", imei: "356789101234568", color: "Titan", storage: "512GB", madeIn: "VN/A", networkVersion: "5G", batteryCondition: "Zin 100%", condition: "Mới 100%", note: "Chưa active", storeId: "store-1", cost: 29500000, expectedPrice: 32000000, status: "Còn hàng", importDate: "2026-07-05" },
  { id: "p9", brand: "Samsung", name: "Z Fold 5", imei: "356789101234569", color: "Xanh dương", storage: "512GB", madeIn: "VN/A", networkVersion: "5G", batteryCondition: "Zin", condition: "Like New", note: "Có bút S-Pen", storeId: "store-2", cost: 25000000, expectedPrice: 28000000, status: "Còn hàng", importDate: "2026-07-06" },
  { id: "p10", brand: "iPhone", name: "XS Max", imei: "356789101234570", color: "Vàng", storage: "256GB", madeIn: "LL/A", networkVersion: "4G", batteryCondition: "Đã thay pin", condition: "Cũ", note: "Màn hình xước dăm", storeId: "store-3", cost: 4500000, expectedPrice: 5500000, status: "Còn hàng", importDate: "2026-07-01" },
  { id: "p11", brand: "Oppo", name: "Find X5 Pro", imei: "356789101234571", color: "Trắng", storage: "256GB", madeIn: "Trung Quốc", networkVersion: "5G", batteryCondition: "Zin", condition: "Like New", note: "Mặt lưng gốm", storeId: "store-2", cost: 9000000, expectedPrice: 10500000, status: "Còn hàng", importDate: "2026-07-03" },
  { id: "p12", brand: "iPhone", name: "14", imei: "356789101234572", color: "Xanh biển", storage: "128GB", madeIn: "VN/A", networkVersion: "5G", batteryCondition: "Zin 88%", condition: "Cũ", note: "Phụ kiện sạc cáp", storeId: "store-1", cost: 13000000, expectedPrice: 14500000, status: "Đã bán", importDate: "2026-06-20", saleDate: "2026-07-05" },
  { id: "p13", brand: "iPhone", name: "13", imei: "356789101234573", color: "Hồng", storage: "128GB", madeIn: "VN/A", networkVersion: "5G", batteryCondition: "Zin 90%", condition: "Like New", note: "Máy nữ dùng", storeId: "store-1", cost: 10500000, expectedPrice: 11800000, status: "Đã bán", importDate: "2026-06-25", saleDate: "2026-07-06" },
  { id: "p14", brand: "Samsung", name: "Galaxy A54", imei: "356789101234574", color: "Tím", storage: "128GB", madeIn: "Việt Nam", networkVersion: "5G", batteryCondition: "Zin", condition: "Mới 100%", note: "Tặng kèm ốp", storeId: "store-3", cost: 6500000, expectedPrice: 7500000, status: "Còn hàng", importDate: "2026-07-06" },
];

const accessorySeed: Accessory[] = [
  { id: "a1", code: "PK-CAP20", name: "Cáp sạc nhanh 20W Apple", storeId: "store-1", quantity: 34, cost: 55000, price: 120000, status: "Còn hàng" },
  { id: "a2", code: "PK-OP13", name: "Ốp lưng Silicon iPhone 13 Pro Max", storeId: "store-2", quantity: 18, cost: 30000, price: 90000, status: "Còn hàng" },
  { id: "a3", code: "PK-KLCL", name: "Kính cường lực Kingkong", storeId: "store-3", quantity: 50, cost: 18000, price: 70000, status: "Còn hàng" },
  { id: "a4", code: "PK-SDP10", name: "Sạc dự phòng 10000mAh", storeId: "store-1", quantity: 12, cost: 250000, price: 400000, status: "Còn hàng" },
  { id: "a5", code: "PK-TNAP", name: "Tai nghe AirPods Pro 2 Rep", storeId: "store-1", quantity: 5, cost: 350000, price: 550000, status: "Còn hàng" },
  { id: "a6", code: "PK-OP14", name: "Ốp lưng chống sốc iPhone 14", storeId: "store-2", quantity: 0, cost: 40000, price: 110000, status: "Hết hàng" },
  { id: "a7", code: "PK-SAC65", name: "Củ sạc GaN 65W Baseus", storeId: "store-3", quantity: 8, cost: 320000, price: 550000, status: "Còn hàng" },
  { id: "a8", code: "PK-GIA", name: "Giá đỡ điện thoại ô tô", storeId: "store-1", quantity: 15, cost: 70000, price: 150000, status: "Còn hàng" },
  { id: "a9", code: "PK-DNM", name: "Dây đeo Apple Watch cao su", storeId: "store-2", quantity: 22, cost: 45000, price: 120000, status: "Còn hàng" },
  { id: "a10", code: "PK-KLCL-S22", name: "Cường lực Samsung S22", storeId: "store-3", quantity: 10, cost: 20000, price: 80000, status: "Còn hàng" },
];

const salesSeed: Sale[] = [
  { id: "s1", createdAt: "2026-07-05", customerId: "c1", storeId: "store-1", itemName: "iPhone 14 128GB", itemType: "Máy", quantity: 1, amount: 14500000, profit: 1500000, payment: "Chuyển khoản", status: "Hoàn tất" },
  { id: "s2", createdAt: "2026-07-06", customerId: "c3", storeId: "store-3", itemName: "Kính cường lực Kingkong", itemType: "Phụ kiện", quantity: 2, amount: 140000, profit: 104000, payment: "Tiền mặt", status: "Hoàn tất" },
  { id: "s3", createdAt: "2026-07-06", customerId: "c2", storeId: "store-1", itemName: "iPhone 13 128GB Hồng", itemType: "Máy", quantity: 1, amount: 11800000, profit: 1300000, payment: "Thẻ", status: "Hoàn tất" },
  { id: "s4", createdAt: "2026-07-05", customerId: "c1", storeId: "store-2", itemName: "Ốp lưng chống sốc iPhone 14", itemType: "Phụ kiện", quantity: 1, amount: 110000, profit: 70000, payment: "Tiền mặt", status: "Hoàn tất" },
  { id: "s5", createdAt: "2026-07-04", customerId: "c2", storeId: "store-1", itemName: "Cáp sạc nhanh 20W Apple", itemType: "Phụ kiện", quantity: 1, amount: 120000, profit: 65000, payment: "Chuyển khoản", status: "Hoàn tất" },
  { id: "s6", createdAt: "2026-07-03", customerId: "c3", storeId: "store-3", itemName: "Củ sạc GaN 65W Baseus", itemType: "Phụ kiện", quantity: 1, amount: 550000, profit: 230000, payment: "Tiền mặt", status: "Hoàn tất" },
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
  { id: "sales", label: "Quản lý bán hàng", icon: ReceiptText },
  { id: "customers", label: "Khách hàng", icon: Users },
  { id: "repairs", label: "Sửa chữa", icon: Wrench },
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
  return (value / 1000).toLocaleString("vi-VN");
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
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid gap-1.5 text-sm font-bold text-slate-700 ${className}`}>
      {label}
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
  const [activePage, setActivePage] = useState<PageId>("dashboard");
  const [storeFilter, setStoreFilter] = useState<StoreId>("all");
  const [query, setQuery] = useState("");
  const [inventoryTab, setInventoryTab] = useState<"phones" | "accessories">("phones");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState("all");
  const [inventoryNameFilter, setInventoryNameFilter] = useState("");
  const [inventoryPriceRange, setInventoryPriceRange] = useState("all");
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState("Còn hàng");
  const [inventorySort, setInventorySort] = useState("price-desc");
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [viewingPhoneId, setViewingPhoneId] = useState<string | null>(null);
  const [editingAccessoryId, setEditingAccessoryId] = useState<string | null>(null);
  const [customers, setCustomers] = useState(customersSeed);
  const [phones, setPhones] = useState(phoneSeed);
  const [accessories, setAccessories] = useState(accessorySeed);
  const [sales, setSales] = useState(salesSeed);
  const [repairs, setRepairs] = useState(repairsSeed);
  const [ledger, setLedger] = useState(ledgerSeed);
  const [logs, setLogs] = useState(logSeed);

  const canCancel = currentUser?.role === "owner";

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
      const matchesQuickSearch = [item.name, item.imei, item.condition, item.color].join(" ").toLowerCase().includes(q);
      const matchesName = item.name.toLowerCase().includes(name);
      const matchesType = inventoryTypeFilter === "all" || item.name.toLowerCase().startsWith(inventoryTypeFilter.toLowerCase());
      const matchesPrice = item.expectedPrice >= minInventoryPrice && item.expectedPrice <= maxInventoryPrice;
      const matchesStatus = inventoryStatusFilter === "all" || item.status === inventoryStatusFilter;
      return matchesStore && matchesQuickSearch && matchesName && matchesType && matchesPrice && matchesStatus;
    })
    .sort((a, b) => (inventorySort === "price-asc" ? a.expectedPrice - b.expectedPrice : b.expectedPrice - a.expectedPrice));

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
    .sort((a, b) => (inventorySort === "price-asc" ? a.price - b.price : b.price - a.price));

  const filteredRepairs = repairs.filter((item) => storeFilter === "all" || item.storeId === storeFilter);
  const filteredLedger = ledger.filter((item) => storeFilter === "all" || item.storeId === storeFilter);
  const filteredSales = sales.filter((item) => storeFilter === "all" || item.storeId === storeFilter);
  const inventoryPageSize = 5;
  const inventoryRowsCount = inventoryTab === "phones" ? filteredPhones.length : filteredAccessories.length;
  const inventoryTotalPages = Math.max(1, Math.ceil(inventoryRowsCount / inventoryPageSize));
  const safeInventoryPage = Math.min(inventoryPage, inventoryTotalPages);
  const inventoryStart = (safeInventoryPage - 1) * inventoryPageSize;
  const paginatedPhones = filteredPhones.slice(inventoryStart, inventoryStart + inventoryPageSize);
  const paginatedAccessories = filteredAccessories.slice(inventoryStart, inventoryStart + inventoryPageSize);
  const editingPhone = editingPhoneId ? phones.find((item) => item.id === editingPhoneId) : null;
  const editingAccessory = editingAccessoryId ? accessories.find((item) => item.id === editingAccessoryId) : null;
  const viewingPhone = viewingPhoneId ? phones.find((item) => item.id === viewingPhoneId) : null;
  const inventorySummary = useMemo(() => {
    const visiblePhones = phones.filter((item) => storeFilter === "all" || item.storeId === storeFilter);
    const visibleAccessories = accessories.filter((item) => storeFilter === "all" || item.storeId === storeFilter);
    const availablePhones = visiblePhones.filter((item) => item.status === "Còn hàng");
    const activeAccessories = visibleAccessories.filter((item) => item.status !== "Đã hủy");
    const phoneValue = availablePhones.reduce((sum, item) => sum + item.expectedPrice, 0);
    const accessoryValue = activeAccessories.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalValue = phoneValue + accessoryValue;
    const lowAccessories = activeAccessories.filter((item) => item.quantity <= 10).length;

    return {
      availablePhones: availablePhones.length,
      accessoryQuantity: activeAccessories.reduce((sum, item) => sum + item.quantity, 0),
      totalValue,
      lowAccessories,
      phonePercent: totalValue ? Math.round((phoneValue / totalValue) * 100) : 0,
      accessoryPercent: totalValue ? Math.round((accessoryValue / totalValue) * 100) : 0,
    };
  }, [accessories, phones, storeFilter]);

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

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const selected = users.find((user) => user.email === email) ?? users[0];
    setCurrentUser(selected);
    setStoreFilter(selected.role === "owner" ? "all" : selected.storeId);
  }

  function openInventoryCreateModal(tab: "phones" | "accessories" = inventoryTab) {
    setInventoryTab(tab);
    setEditingPhoneId(null);
    setEditingAccessoryId(null);
    setIsInventoryModalOpen(true);
  }

  function openPhoneEditModal(id: string) {
    setInventoryTab("phones");
    setEditingPhoneId(id);
    setEditingAccessoryId(null);
    setIsInventoryModalOpen(true);
  }

  function openAccessoryEditModal(id: string) {
    setInventoryTab("accessories");
    setEditingAccessoryId(id);
    setEditingPhoneId(null);
    setIsInventoryModalOpen(true);
  }

  function closeInventoryModal() {
    setIsInventoryModalOpen(false);
    setEditingPhoneId(null);
    setEditingAccessoryId(null);
  }

  function savePhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const storeId = String(form.get("storeId")) as Exclude<StoreId, "all">;
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
      condition: String(form.get("condition")),
      note: String(form.get("note") || ""),
      importDate: String(form.get("importDate") || new Date().toISOString().slice(0, 10)),
      saleDate: String(form.get("saleDate") || ""),
      storeId,
      cost: Number(form.get("cost") || 0),
      expectedPrice: Number(form.get("expectedPrice") || 0),
      status: String(form.get("status")) as ProductStatus,
    };

    setPhones((prev) => (editingPhoneId ? prev.map((item) => (item.id === editingPhoneId ? payload : item)) : [payload, ...prev]));
    pushLog(editingPhoneId ? "Sửa máy trong kho" : "Thêm máy vào kho", payload.imei, storeId);
    closeInventoryModal();
    setInventoryPage(1);
    event.currentTarget.reset();
  }

  function saveAccessory(event: FormEvent<HTMLFormElement>) {
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
      cost: Number(form.get("cost") || 0),
      price: Number(form.get("price") || 0),
      status: String(form.get("status") || (quantity > 0 ? "Còn hàng" : "Hết hàng")) as AccessoryStatus,
    };

    setAccessories((prev) => (editingAccessoryId ? prev.map((item) => (item.id === editingAccessoryId ? payload : item)) : [payload, ...prev]));
    pushLog(editingAccessoryId ? "Sửa phụ kiện trong kho" : "Thêm phụ kiện vào kho", payload.code, storeId);
    closeInventoryModal();
    setInventoryPage(1);
    event.currentTarget.reset();
  }

  function cancelPhone(id: string) {
    const phone = phones.find((item) => item.id === id);
    if (!phone || !canCancel) return;
    setPhones((prev) => prev.map((item) => (item.id === id ? { ...item, status: "Đã hủy" } : item)));
    pushLog("Hủy mềm máy trong kho", phone.imei, phone.storeId);
  }

  function cancelAccessory(id: string) {
    const accessory = accessories.find((item) => item.id === id);
    if (!accessory || !canCancel) return;
    setAccessories((prev) => prev.map((item) => (item.id === id ? { ...item, status: "Đã hủy" } : item)));
    pushLog("Hủy mềm phụ kiện trong kho", accessory.code, accessory.storeId);
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
            <span className="text-sm font-semibold text-muted">Frontend MVP</span>
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
            <Field label="Mật khẩu demo">
              <input name="password" className="h-11 rounded-lg border border-line px-3" placeholder="Nhập bất kỳ" type="password" />
            </Field>
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
        <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">{navItems.find((item) => item.id === activePage)?.label}</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Xin chào, {currentUser.name}. Dữ liệu hiện là mock FE, chưa ghi Supabase.</p>
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
            <button onClick={() => setCurrentUser(null)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-bold">
              <LogOut size={17} />
              Đăng xuất
            </button>
          </div>
        </header>

        {activePage === "dashboard" && (
          <div className="grid gap-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              Mật khẩu màn hình trong phiếu sửa đang được hiển thị như ghi chú thường theo phạm vi MVP; cần nâng cấp bảo mật ở giai đoạn backend.
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Máy còn hàng" value={`${dashboard.phones}`} hint={storeName(storeFilter)} icon={<Smartphone size={20} />} />
              <StatCard label="Phụ kiện tồn" value={`${dashboard.accessories}`} hint="Tổng số lượng khả dụng" icon={<PackagePlus size={20} />} />
              <StatCard label="Tổng vốn" value={formatMoney(dashboard.capital)} hint="Máy + phụ kiện tồn" icon={<Store size={20} />} />
              <StatCard label="Lãi đã ghi" value={formatMoney(dashboard.profit)} hint="Từ phiếu bán hiệu lực" icon={<Activity size={20} />} />
              <StatCard label="Tổng thu" value={formatMoney(dashboard.income)} hint="Theo sổ thu chi" icon={<ReceiptText size={20} />} />
              <StatCard label="Tổng chi" value={formatMoney(dashboard.expense)} hint="Theo sổ thu chi" icon={<CreditCard size={20} />} />
              <StatCard label="Máy đang sửa" value={`${dashboard.repairs}`} hint="Chưa trả khách" icon={<Wrench size={20} />} />
              <StatCard label="Dòng tiền ròng" value={formatMoney(dashboard.income - dashboard.expense)} hint="Thu trừ chi" icon={<FileText size={20} />} />
            </div>
          </div>
        )}

        {activePage === "inventory" && (
          <section className="grid gap-4">
            <div className="rounded-lg border border-amber-200 bg-white p-5 shadow-panel">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-black text-amber-700">Inventory Management</p>
                  <h2 className="mt-2 text-3xl font-black">Quản lý kho hàng</h2>
                  <p className="mt-2 text-sm font-semibold text-muted">Theo dõi máy cũ theo IMEI, phụ kiện theo số lượng, lọc giá và sắp xếp tồn kho.</p>
                </div>
                <div className="rounded-lg border border-line bg-slate-50 px-4 py-3">
                  <p className="text-xs font-bold text-muted">Đang xem</p>
                  <strong className="text-base">{storeName(storeFilter)}</strong>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                <p className="text-sm font-bold text-muted">Máy còn hàng</p>
                <div className="mt-4 flex items-center justify-between">
                  <strong className="text-3xl">{inventorySummary.availablePhones}</strong>
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-red-50 text-danger"><Smartphone size={20} /></span>
                </div>
                <p className="mt-4 text-sm font-semibold text-muted">{inventoryRowsCount} kết quả sau lọc</p>
              </section>
              <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                <p className="text-sm font-bold text-muted">Phụ kiện tồn</p>
                <div className="mt-4 flex items-center justify-between">
                  <strong className="text-3xl">{inventorySummary.accessoryQuantity}</strong>
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-brand-soft text-brand"><PackagePlus size={20} /></span>
                </div>
                <p className="mt-4 text-sm font-semibold text-muted">{inventorySummary.lowAccessories} mặt hàng sắp hết</p>
              </section>
              <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
                <p className="text-sm font-bold text-muted">Giá trị tồn dự kiến</p>
                <strong className="mt-4 block text-3xl text-amber-700">{formatMoney(inventorySummary.totalValue)}</strong>
                <div className="mt-5 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.max(8, inventorySummary.phonePercent)}%` }} />
                </div>
                <p className="mt-3 text-sm font-semibold text-muted">Máy chiếm {inventorySummary.phonePercent}% giá trị tồn</p>
              </section>
            </div>

            <section className="rounded-lg border border-line bg-white shadow-panel">
              <div className="border-b border-line p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-black">Danh sách tồn kho</h2>
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
                        Máy cũ
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
                  </select>
                  <select value={inventorySort} onChange={(event) => setInventorySort(event.target.value)} className="h-10 rounded-lg border border-line bg-white px-3 font-semibold">
                    <option value="price-desc">Giá cao đến thấp</option>
                    <option value="price-asc">Giá thấp đến cao</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-4 p-4">
                <aside className="rounded-lg border border-line bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-1 gap-6">
                      <div>
                        <span className="block text-sm font-bold text-muted">Số lượng đã bán</span>
                        <strong className="text-2xl text-emerald-600">
                          {inventoryTab === "phones"
                            ? phones.filter((p) => p.status === "Đã bán" && (storeFilter === "all" || p.storeId === storeFilter)).length
                            : sales.filter((s) => s.itemType === "Phụ kiện" && s.status === "Hoàn tất" && (storeFilter === "all" || s.storeId === storeFilter)).reduce((sum, s) => sum + s.quantity, 0)}
                        </strong>
                      </div>
                      <div className="w-px bg-line" />
                      <div>
                        <span className="block text-sm font-bold text-muted">Số lượng còn hàng</span>
                        <strong className="text-2xl text-brand">
                          {inventoryTab === "phones"
                            ? phones.filter((p) => p.status === "Còn hàng" && (storeFilter === "all" || p.storeId === storeFilter)).length
                            : accessories.filter((a) => a.status === "Còn hàng" && (storeFilter === "all" || a.storeId === storeFilter)).reduce((sum, a) => sum + a.quantity, 0)}
                        </strong>
                      </div>
                    </div>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-muted shadow-sm">{storeName(storeFilter)}</span>
                  </div>
                </aside>

                <div className="min-w-0">
              {inventoryTab === "phones" ? (
                <DataTable
                  headers={["Tên máy", "Dung lượng", "IMEI", "Giá bán", "Màu sắc", "Pin", "Thao tác"]}
                  rows={paginatedPhones.map((item) => [
                    <div key={`name-${item.id}`} className="flex flex-col items-center gap-1.5">
                      <div className="flex items-center justify-center gap-2 text-lg font-black text-brand"><Smartphone size={18} className="text-slate-400" />{item.name}</div>
                      <span className="text-sm font-semibold text-slate-500">{item.brand} • <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-600">{item.condition}</span></span>
                    </div>,
                    <span className="text-base font-bold text-slate-800" key={`storage-${item.id}`}>{item.storage}</span>,
                    <span className="rounded-md bg-red-50 px-3 py-1.5 font-mono text-xl font-black tracking-widest text-red-600 shadow-sm" key={`imei-${item.id}`}>{item.imei.slice(-5)}</span>,
                    <span className="text-lg font-black text-emerald-600" key={`price-${item.id}`}>{formatMoney(item.expectedPrice)}</span>,
                    <div key={`color-${item.id}`} className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 shrink-0 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: getColorCode(item.color) }} />
                      <span className="text-base font-medium text-slate-700">{item.color}</span>
                    </div>,
                    <div className="flex items-center justify-center gap-1.5 text-base font-bold text-amber-600" key={`bat-${item.id}`}><Activity size={16} />{item.batteryCondition}</div>,
                    <div key={item.id} className="flex flex-nowrap justify-center gap-2">
                      <button onClick={() => setViewingPhoneId(item.id)} title="Chi tiết" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900">
                        <Eye size={20} />
                      </button>
                      <button onClick={() => openPhoneEditModal(item.id)} title="Sửa" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand transition hover:bg-brand/20">
                        <Edit3 size={20} />
                      </button>
                      <button
                        title="Hủy"
                        disabled={!canCancel || item.status === "Đã hủy"}
                        onClick={() => cancelPhone(item.id)}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-danger transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>,
                  ])}
                />
              ) : (
                <DataTable
                  headers={["Mã", "Tên phụ kiện", "SL", "Giá nhập", "Giá bán", "Lợi nhuận", "Thao tác"]}
                  rows={paginatedAccessories.map((item) => [
                    <span className="font-mono text-sm font-medium text-slate-500" key={`code-${item.id}`}>{item.code}</span>,
                    <span className="text-lg font-black text-brand" key={`name-${item.id}`}>{item.name}</span>,
                    <span className="text-base font-bold text-slate-800" key={`qty-${item.id}`}>{item.quantity}</span>,
                    <span className="text-base font-medium text-slate-600" key={`cost-${item.id}`}>{formatMoney(item.cost)}</span>,
                    <span className="text-lg font-black text-emerald-600" key={`price-${item.id}`}>{formatMoney(item.price)}</span>,
                    <span className="text-base font-bold text-amber-600" key={`profit-${item.id}`}>{formatMoney(item.price - item.cost)}</span>,
                    <div key={item.id} className="flex flex-nowrap justify-center gap-2">
                      <button onClick={() => openAccessoryEditModal(item.id)} title="Sửa" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand transition hover:bg-brand/20">
                        <Edit3 size={20} />
                      </button>
                      <button
                        title="Hủy"
                        disabled={!canCancel || item.status === "Đã hủy"}
                        onClick={() => cancelAccessory(item.id)}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-danger transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={20} />
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
              <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
                <section className="max-h-[92vh] w-full max-w-[760px] overflow-auto rounded-lg border border-line bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
                  <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-white p-4">
                    <div>
                      <p className="text-sm font-black text-amber-700">Inventory Form</p>
                      <h2 className="text-2xl font-black">
                        {inventoryTab === "phones" ? (editingPhone ? "Sửa máy trong kho" : "Thêm máy vào kho") : editingAccessory ? "Sửa phụ kiện" : "Thêm phụ kiện"}
                      </h2>
                    </div>
                    <button onClick={closeInventoryModal} className="h-9 rounded-lg border border-line bg-slate-50 px-3 text-sm font-black text-muted">
                      Đóng
                    </button>
                  </div>
                  <div className="p-4">
                    <div className="mb-4 inline-flex w-full rounded-lg border border-line bg-slate-100 p-1">
                      <button
                        disabled={Boolean(editingAccessory)}
                        onClick={() => {
                          setInventoryTab("phones");
                          setEditingAccessoryId(null);
                        }}
                        className={`flex-1 rounded-md px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 ${inventoryTab === "phones" ? "bg-white text-brand shadow-sm" : "text-muted"}`}
                      >
                        Máy cũ
                      </button>
                      <button
                        disabled={Boolean(editingPhone)}
                        onClick={() => {
                          setInventoryTab("accessories");
                          setEditingPhoneId(null);
                        }}
                        className={`flex-1 rounded-md px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 ${inventoryTab === "accessories" ? "bg-white text-brand shadow-sm" : "text-muted"}`}
                      >
                        Phụ kiện
                      </button>
                    </div>

                    {inventoryTab === "phones" ? (
                      <form key={editingPhone?.id ?? "new-phone"} onSubmit={savePhone} className="grid gap-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <SelectField label="Hãng" name="brand" options={["iPhone", "Samsung", "Oppo", "Xiaomi"].map((b) => [b, b])} defaultValue={editingPhone?.brand ?? "iPhone"} />
                          <Field label="Tên máy">
                            <input name="name" required list="phone-models" defaultValue={editingPhone?.name} className="h-10 w-full rounded-lg border border-line bg-white px-3" placeholder="13 Pro" />
                            <datalist id="phone-models">
                              <option value="10" />
                              <option value="11" />
                              <option value="12" />
                              <option value="13 Pro" />
                              <option value="Galaxy S22" />
                              <option value="Galaxy Z Fold4" />
                              <option value="Reno 8" />
                              <option value="Find X5" />
                              <option value="Redmi Note 12" />
                              <option value="Xiaomi 13" />
                            </datalist>
                          </Field>
                        </div>
                        <Field label="IMEI"><input name="imei" required defaultValue={editingPhone?.imei} className="h-10 rounded-lg border border-line px-3" placeholder="356789..." /></Field>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Màu sắc"><input name="color" defaultValue={editingPhone?.color} className="h-10 rounded-lg border border-line px-3" placeholder="Xanh" /></Field>
                          <Field label="Dung lượng"><input name="storage" defaultValue={editingPhone?.storage} className="h-10 rounded-lg border border-line px-3" placeholder="256GB" /></Field>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Made In"><input name="madeIn" defaultValue={editingPhone?.madeIn} className="h-10 rounded-lg border border-line px-3" placeholder="VN/A, LL/A..." /></Field>
                          <SelectField label="Phiên bản" name="networkVersion" options={["4G", "5G"].map((v) => [v, v])} defaultValue={editingPhone?.networkVersion ?? "5G"} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <SelectField label="Tình trạng pin" name="batteryCondition" options={["Zin", "Đã thay", "80-90%"].map((v) => [v, v])} defaultValue={editingPhone?.batteryCondition ?? "Zin"} />
                          <SelectField label="Tình trạng máy" name="condition" options={["Zin", "Cũ", "Like New", "Mới 100%"].map((v) => [v, v])} defaultValue={editingPhone?.condition ?? "Like New"} />
                        </div>
                        <Field label="Ghi chú"><input name="note" defaultValue={editingPhone?.note} className="h-10 rounded-lg border border-line px-3" placeholder="Màn đẹp, trầy viền nhẹ..." /></Field>
                        <SelectField label="Cửa hàng" name="storeId" options={stores.map((s) => [s.id, s.name])} defaultValue={editingPhone?.storeId} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Ngày nhập"><input name="importDate" type="date" defaultValue={editingPhone?.importDate || new Date().toISOString().slice(0, 10)} className="h-10 rounded-lg border border-line px-3" /></Field>
                          <Field label="Ngày bán"><input name="saleDate" type="date" defaultValue={editingPhone?.saleDate} className="h-10 rounded-lg border border-line px-3" /></Field>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Giá nhập"><input name="cost" type="number" min="0" defaultValue={editingPhone?.cost} className="h-10 rounded-lg border border-line px-3" /></Field>
                          <Field label="Giá dự kiến"><input name="expectedPrice" type="number" min="0" defaultValue={editingPhone?.expectedPrice} className="h-10 rounded-lg border border-line px-3" /></Field>
                        </div>
                        <SelectField label="Trạng thái" name="status" options={["Còn hàng", "Đã bán", "Đã hủy"].map((status) => [status, status])} defaultValue={editingPhone?.status ?? "Còn hàng"} />
                        <div className="flex justify-end gap-2 border-t border-line pt-4">
                          <button type="button" onClick={closeInventoryModal} className="h-10 rounded-lg border border-line bg-white px-4 font-bold text-muted">Hủy</button>
                          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-bold text-white hover:bg-brand-dark">
                            <Plus size={18} />
                            {editingPhone ? "Lưu sửa" : "Thêm máy"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form key={editingAccessory?.id ?? "new-accessory"} onSubmit={saveAccessory} className="grid gap-3">
                        <Field label="Mã hàng"><input name="code" required defaultValue={editingAccessory?.code} className="h-10 rounded-lg border border-line px-3" placeholder="PK-CAP20" /></Field>
                        <Field label="Tên phụ kiện"><input name="name" required defaultValue={editingAccessory?.name} className="h-10 rounded-lg border border-line px-3" placeholder="Cáp sạc nhanh 20W" /></Field>
                        <SelectField label="Cửa hàng" name="storeId" options={stores.map((s) => [s.id, s.name])} defaultValue={editingAccessory?.storeId} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Số lượng"><input name="quantity" type="number" min="0" defaultValue={editingAccessory?.quantity ?? 1} className="h-10 rounded-lg border border-line px-3" /></Field>
                          <Field label="Giá nhập"><input name="cost" type="number" min="0" defaultValue={editingAccessory?.cost} className="h-10 rounded-lg border border-line px-3" /></Field>
                        </div>
                        <Field label="Giá bán"><input name="price" type="number" min="0" defaultValue={editingAccessory?.price} className="h-10 rounded-lg border border-line px-3" /></Field>
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
              <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
                <section className="w-full max-w-[640px] overflow-hidden rounded-lg border border-line bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
                  <div className="flex items-center justify-between border-b border-line bg-slate-50 p-4">
                    <h2 className="text-xl font-black text-brand">Chi tiết máy</h2>
                    <button onClick={() => setViewingPhoneId(null)} className="h-8 rounded-lg border border-line bg-white px-3 text-sm font-bold text-muted hover:bg-slate-100">Đóng</button>
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
                    <div className="grid grid-cols-2 gap-y-3 rounded-lg border border-line bg-slate-50 p-4 text-sm">
                      <div>
                        <span className="block text-xs font-bold text-muted">Màu sắc</span>
                        <strong className="text-slate-800">{viewingPhone.color}</strong>
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-muted">Dung lượng</span>
                        <strong className="text-slate-800">{viewingPhone.storage}</strong>
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-muted">Tình trạng máy</span>
                        <strong className="text-slate-800">{viewingPhone.condition}</strong>
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-muted">Tình trạng pin</span>
                        <strong className="text-slate-800">{viewingPhone.batteryCondition}</strong>
                      </div>
                      <div className="col-span-2">
                        <span className="block text-xs font-bold text-muted">Quốc gia/Phiên bản</span>
                        <strong className="text-slate-800">{viewingPhone.madeIn} ({viewingPhone.networkVersion})</strong>
                      </div>
                      <div className="col-span-2">
                        <span className="block text-xs font-bold text-muted">IMEI</span>
                        <strong className="font-mono text-slate-800">{viewingPhone.imei}</strong>
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-muted">Giá nhập</span>
                        <strong className="text-slate-800">{formatMoney(viewingPhone.cost)}</strong>
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-muted">Giá bán</span>
                        <strong className="text-emerald-600">{formatMoney(viewingPhone.expectedPrice)}</strong>
                      </div>
                      <div className="col-span-2">
                        <span className="block text-xs font-bold text-muted">Lợi nhuận dự kiến</span>
                        <strong className="text-base font-black text-amber-600">{formatMoney(viewingPhone.expectedPrice - viewingPhone.cost)}</strong>
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-muted">Ngày nhập</span>
                        <strong className="text-slate-800">{viewingPhone.importDate ? new Date(viewingPhone.importDate).toLocaleDateString("vi-VN") : "Chưa có"}</strong>
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-muted">Ngày bán</span>
                        <strong className="text-slate-800">{viewingPhone.saleDate ? new Date(viewingPhone.saleDate).toLocaleDateString("vi-VN") : "Chưa bán"}</strong>
                      </div>
                      <div className="col-span-2">
                        <span className="block text-xs font-bold text-muted">Trạng thái</span>
                        <StatusBadge tone={viewingPhone.status === "Còn hàng" ? "ok" : viewingPhone.status === "Đã bán" ? "warn" : "danger"}>{viewingPhone.status}</StatusBadge>
                      </div>
                      {viewingPhone.note && (
                        <div className="col-span-2 mt-2 rounded-lg bg-white p-2 border border-line">
                          <span className="block text-xs font-bold text-muted">Ghi chú</span>
                          <span className="text-slate-800">{viewingPhone.note}</span>
                        </div>
                      )}
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
    <Field label={label}>
      <select name={name} defaultValue={defaultValue} className="h-10 rounded-lg border border-line px-3">
        {options.map(([value, text]) => (
          <option key={`${name}-${value}`} value={value}>
            {text}
          </option>
        ))}
      </select>
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

function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  if (!rows.length) {
    return <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm font-semibold text-muted">Chưa có dữ liệu phù hợp.</div>;
  }

  return (
    <div className="overflow-auto rounded-xl border border-line bg-white shadow-sm">
      <table className="min-w-max w-full border-collapse text-base">
        <thead className="bg-slate-50/80 text-center text-sm font-bold uppercase tracking-wider text-slate-500">
          <tr>
            {headers.map((header) => (
              <th key={header} className={`border-b border-line px-5 py-4 ${header === "Thao tác" ? "w-[180px] text-center" : ""}`}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="transition-colors hover:bg-slate-50/60">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="px-5 py-4 text-center align-middle">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
