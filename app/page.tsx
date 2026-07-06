"use client";

import {
  Activity,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Edit3,
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
  condition: string;
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
  { id: "p1", brand: "iPhone", name: "iPhone 13 Pro", imei: "356789101234561", color: "Xanh", storage: "256GB", condition: "Đẹp 98%", storeId: "store-1", cost: 11700000, expectedPrice: 13200000, status: "Còn hàng" },
  { id: "p2", brand: "iPhone", name: "iPhone 12", imei: "356789101234562", color: "Đen", storage: "128GB", condition: "Pin 88%", storeId: "store-2", cost: 7200000, expectedPrice: 8200000, status: "Còn hàng" },
  { id: "p3", brand: "Samsung", name: "Galaxy S22", imei: "356789101234563", color: "Trắng", storage: "128GB", condition: "Trầy nhẹ", storeId: "store-3", cost: 6500000, expectedPrice: 7600000, status: "Còn hàng" },
  { id: "p4", brand: "iPhone", name: "iPhone 11", imei: "356789101234564", color: "Tím", storage: "64GB", condition: "Đẹp 99%", storeId: "store-1", cost: 5500000, expectedPrice: 6500000, status: "Còn hàng" },
  { id: "p5", brand: "Oppo", name: "Reno 8", imei: "356789101234565", color: "Vàng", storage: "256GB", condition: "Mới 100%", storeId: "store-2", cost: 7000000, expectedPrice: 8500000, status: "Còn hàng" },
  { id: "p6", brand: "Xiaomi", name: "Redmi Note 12", imei: "356789101234566", color: "Xám", storage: "128GB", condition: "Đẹp 99%", storeId: "store-3", cost: 3500000, expectedPrice: 4200000, status: "Còn hàng" },
  { id: "p7", brand: "iPhone", name: "iPhone 10", imei: "356789101234567", color: "Đen", storage: "64GB", condition: "Trầy nhiều", storeId: "store-1", cost: 2500000, expectedPrice: 3200000, status: "Còn hàng" },
];

const accessorySeed: Accessory[] = [
  { id: "a1", code: "PK-CAP20", name: "Cáp sạc nhanh 20W", storeId: "store-1", quantity: 34, cost: 55000, price: 120000, status: "Còn hàng" },
  { id: "a2", code: "PK-OP13", name: "Ốp iPhone 13", storeId: "store-2", quantity: 18, cost: 30000, price: 90000, status: "Còn hàng" },
  { id: "a3", code: "PK-KLCL", name: "Kính cường lực", storeId: "store-3", quantity: 8, cost: 18000, price: 70000, status: "Còn hàng" },
];

const salesSeed: Sale[] = [
  { id: "s1", createdAt: "2026-07-06", customerId: "c1", storeId: "store-1", itemName: "iPhone 11 128GB", itemType: "Máy", quantity: 1, amount: 6100000, profit: 700000, payment: "Chuyển khoản", status: "Hoàn tất" },
  { id: "s2", createdAt: "2026-07-06", customerId: "c3", storeId: "store-3", itemName: "Kính cường lực", itemType: "Phụ kiện", quantity: 2, amount: 140000, profit: 104000, payment: "Tiền mặt", status: "Hoàn tất" },
];

const repairsSeed: Repair[] = [
  { id: "r1", createdAt: "2026-07-06", customerId: "c2", storeId: "store-2", deviceName: "iPhone XS", screenPassword: "2580", issue: "Thay pin", intakeNote: "Màn trầy nhẹ, camera bình thường", quote: 650000, deposit: 200000, status: "Đang sửa" },
  { id: "r2", createdAt: "2026-07-05", customerId: "c1", storeId: "store-1", deviceName: "Samsung A52", screenPassword: "Không có", issue: "Lỗi sạc", intakeNote: "Máy móp góc dưới", quote: 450000, deposit: 0, status: "Đang chờ" },
];

const ledgerSeed: Ledger[] = [
  { id: "l1", createdAt: "2026-07-06", storeId: "store-1", type: "Thu", source: "Phiếu bán s1", amount: 6100000, payment: "Chuyển khoản", status: "Hiệu lực" },
  { id: "l2", createdAt: "2026-07-06", storeId: "store-3", type: "Thu", source: "Phiếu bán s2", amount: 140000, payment: "Tiền mặt", status: "Hiệu lực" },
  { id: "l3", createdAt: "2026-07-06", storeId: "store-2", type: "Thu", source: "Cọc sửa r1", amount: 200000, payment: "Tiền mặt", status: "Hiệu lực" },
  { id: "l4", createdAt: "2026-07-06", storeId: "store-1", type: "Chi", source: "Tiền mặt bằng", amount: 3000000, payment: "Chuyển khoản", status: "Hiệu lực" },
];

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

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

function storeName(id: StoreId) {
  if (id === "all") return "Toàn hệ thống";
  return stores.find((store) => store.id === id)?.name ?? id;
}

function formatMoney(value: number) {
  return money.format(value);
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
  const [inventoryMinPrice, setInventoryMinPrice] = useState("");
  const [inventoryMaxPrice, setInventoryMaxPrice] = useState("");
  const [inventorySort, setInventorySort] = useState("price-desc");
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [editingAccessoryId, setEditingAccessoryId] = useState<string | null>(null);
  const [customers, setCustomers] = useState(customersSeed);
  const [phones, setPhones] = useState(phoneSeed);
  const [accessories, setAccessories] = useState(accessorySeed);
  const [sales, setSales] = useState(salesSeed);
  const [repairs, setRepairs] = useState(repairsSeed);
  const [ledger, setLedger] = useState(ledgerSeed);
  const [logs, setLogs] = useState(logSeed);

  const canCancel = currentUser?.role === "owner";

  const minInventoryPrice = Number(inventoryMinPrice || 0);
  const maxInventoryPrice = Number(inventoryMaxPrice || Number.MAX_SAFE_INTEGER);
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
      return matchesStore && matchesQuickSearch && matchesName && matchesType && matchesPrice;
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
      return matchesStore && matchesQuickSearch && matchesName && matchesType && matchesPrice;
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
      condition: String(form.get("condition")),
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
                <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.9fr_0.8fr_0.8fr_0.9fr]">
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
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={inventoryMinPrice}
                      onChange={(event) => {
                        setInventoryMinPrice(event.target.value);
                        setInventoryPage(1);
                      }}
                      type="number"
                      min="0"
                      className="h-10 rounded-lg border border-line px-3 font-semibold"
                      placeholder="Giá từ"
                    />
                    <input
                      value={inventoryMaxPrice}
                      onChange={(event) => {
                        setInventoryMaxPrice(event.target.value);
                        setInventoryPage(1);
                      }}
                      type="number"
                      min="0"
                      className="h-10 rounded-lg border border-line px-3 font-semibold"
                      placeholder="Đến"
                    />
                  </div>
                  <select value={inventorySort} onChange={(event) => setInventorySort(event.target.value)} className="h-10 rounded-lg border border-line bg-white px-3 font-semibold">
                    <option value="price-desc">Giá cao đến thấp</option>
                    <option value="price-asc">Giá thấp đến cao</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 p-4 2xl:grid-cols-[1fr_300px]">
                <div className="min-w-0">
              {inventoryTab === "phones" ? (
                <DataTable
                  headers={["Hãng", "Máy", "IMEI", "Cửa hàng", "Giá nhập", "Giá dự kiến", "Trạng thái", "Thao tác"]}
                  rows={paginatedPhones.map((item) => [
                    item.brand,
                    `${item.name} • ${item.color} • ${item.storage}`,
                    item.imei,
                    storeName(item.storeId),
                    formatMoney(item.cost),
                    formatMoney(item.expectedPrice),
                    <StatusBadge key={item.id} tone={item.status === "Còn hàng" ? "ok" : item.status === "Đã bán" ? "warn" : "danger"}>{item.status}</StatusBadge>,
                    <div key={item.id} className="flex flex-wrap gap-2">
                      <button onClick={() => openPhoneEditModal(item.id)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-soft px-3 text-xs font-black text-brand">
                        <Edit3 size={14} />
                        Sửa
                      </button>
                      <button
                        disabled={!canCancel || item.status === "Đã hủy"}
                        onClick={() => cancelPhone(item.id)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-50 px-3 text-xs font-black text-danger disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                        Hủy
                      </button>
                    </div>,
                  ])}
                />
              ) : (
                <DataTable
                  headers={["Mã", "Tên phụ kiện", "Cửa hàng", "SL", "Giá nhập", "Giá bán", "Trạng thái", "Thao tác"]}
                  rows={paginatedAccessories.map((item) => [
                    item.code,
                    item.name,
                    storeName(item.storeId),
                    item.quantity,
                    formatMoney(item.cost),
                    formatMoney(item.price),
                    <StatusBadge key={item.id} tone={item.status === "Còn hàng" ? "ok" : item.status === "Hết hàng" ? "warn" : "danger"}>{item.status}</StatusBadge>,
                    <div key={item.id} className="flex flex-wrap gap-2">
                      <button onClick={() => openAccessoryEditModal(item.id)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-soft px-3 text-xs font-black text-brand">
                        <Edit3 size={14} />
                        Sửa
                      </button>
                      <button
                        disabled={!canCancel || item.status === "Đã hủy"}
                        onClick={() => cancelAccessory(item.id)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-50 px-3 text-xs font-black text-danger disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                        Hủy
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

                <aside className="rounded-lg border border-line bg-slate-50 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-black">Phân tích trực quan</h3>
                      <p className="text-sm font-semibold text-muted">Tỷ trọng giá trị tồn.</p>
                    </div>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-muted">{storeName(storeFilter)}</span>
                  </div>
                  <div className="grid place-items-center py-5">
                    <div
                      className="grid h-40 w-40 place-items-center rounded-full"
                      style={{
                        background: `conic-gradient(#0f8b62 0 ${inventorySummary.phonePercent}%, #e2b33c ${inventorySummary.phonePercent}% 100%)`,
                      }}
                    >
                      <div className="grid h-24 w-24 place-items-center rounded-full bg-slate-50 text-center">
                        <div>
                          <p className="text-xs font-black text-muted">TỔNG TỒN</p>
                          <strong>{formatMoney(inventorySummary.totalValue)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4">
                    <InventoryBar label="Máy cũ" value={inventorySummary.phonePercent} color="bg-brand" />
                    <InventoryBar label="Phụ kiện" value={inventorySummary.accessoryPercent} color="bg-gold" />
                    <InventoryBar label="Sắp hết" value={Math.min(100, inventorySummary.lowAccessories * 12)} color="bg-red-500" />
                  </div>
                </aside>
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
                            <input name="name" required list="phone-models" defaultValue={editingPhone?.name} className="h-10 w-full rounded-lg border border-line bg-white px-3" placeholder="iPhone 13 Pro" />
                            <datalist id="phone-models">
                              <option value="iPhone 10" />
                              <option value="iPhone 11" />
                              <option value="iPhone 12" />
                              <option value="iPhone 13 Pro" />
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
                          <Field label="Màu"><input name="color" defaultValue={editingPhone?.color} className="h-10 rounded-lg border border-line px-3" placeholder="Xanh" /></Field>
                          <Field label="Dung lượng"><input name="storage" defaultValue={editingPhone?.storage} className="h-10 rounded-lg border border-line px-3" placeholder="256GB" /></Field>
                        </div>
                        <Field label="Tình trạng"><input name="condition" defaultValue={editingPhone?.condition} className="h-10 rounded-lg border border-line px-3" placeholder="Đẹp 98%" /></Field>
                        <SelectField label="Cửa hàng" name="storeId" options={stores.map((s) => [s.id, s.name])} defaultValue={editingPhone?.storeId} />
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
    <div className="overflow-auto rounded-lg border border-line">
      <table className="min-w-[860px] w-full border-collapse bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
          <tr>
            {headers.map((header) => (
              <th key={header} className="border-b border-line px-3 py-3 font-black">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-line last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="px-3 py-3 align-top">
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
