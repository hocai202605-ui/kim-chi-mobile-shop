"use client";

/**
 * LINH KIỆN — Phase A mock, UI Excel-like:
 * Không form trên — nhập/sửa trên grid.
 * Android: mỗi hãng = 1 tab (Samsung / Oppo / Xiaomi), không gộp 3 cột.
 */

import { Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  clonePartCatalogSeed,
  emptyGradesFor,
  nextPartCatalogMockId,
  type PartCatalogCategory,
  type PartCatalogItem,
  type PartGradeCell,
} from "@/data/mock/partsCatalog";
import type { Role, StoreId } from "@/types";

type Props = {
  storeFilter: StoreId;
  writeStoreId: Exclude<StoreId, "all">;
  role: Role;
  isStatsHidden?: boolean;
  onNotify: (type: "success" | "error", message: string) => void;
};

/** Tab UI: 3 hãng Android tách riêng + iPhone + Pin */
type SheetTabId =
  | "android_samsung"
  | "android_oppo"
  | "android_xiaomi"
  | "man_iphone"
  | "pin";

type SheetTabDef = {
  id: SheetTabId;
  label: string;
  category: PartCatalogCategory;
  brandGroup: string;
  /** Header màu bảng */
  headClass: string;
  headTitle: string;
};

const SHEET_TABS: SheetTabDef[] = [
  {
    id: "android_samsung",
    label: "Samsung",
    category: "man_android",
    brandGroup: "samsung",
    headClass: "bg-slate-800 text-white",
    headTitle: "SAMSUNG LCD (RẺ)",
  },
  {
    id: "android_oppo",
    label: "Oppo-Realme",
    category: "man_android",
    brandGroup: "oppo_realme",
    headClass: "bg-emerald-800 text-white",
    headTitle: "OPPO - REALME",
  },
  {
    id: "android_xiaomi",
    label: "Xiaomi-Poco",
    category: "man_android",
    brandGroup: "xiaomi_poco",
    headClass: "bg-orange-700 text-white",
    headTitle: "XIAOMI - POCO",
  },
  {
    id: "man_iphone",
    label: "Màn iPhone",
    category: "man_iphone",
    brandGroup: "",
    headClass: "bg-rose-600 text-white",
    headTitle: "Màn iPhone",
  },
  {
    id: "pin",
    label: "Pin",
    category: "pin",
    brandGroup: "",
    headClass: "bg-slate-900 text-white",
    headTitle: "Pin",
  },
];

const IPHONE_GRADES: { key: string; label: string }[] = [
  { key: "zin", label: "Zin" },
  { key: "lo", label: "Lô" },
  { key: "lo_xin", label: "Lô xịn" },
  { key: "gx", label: "GX" },
];

const PIN_GRADES: { key: string; label: string }[] = [
  { key: "re", label: "Rẻ" },
  { key: "dlc", label: "DLC" },
  { key: "used", label: "Đã SD" },
  { key: "used_dlc", label: "ĐSD DLC" },
];

function formatCell(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function parseCellInput(raw: string): number | null {
  const t = raw.trim().replace(/,/g, "");
  if (!t || t === "-") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

function cellPrice(grades: Record<string, PartGradeCell>, key: string): number | null {
  const c = grades[key];
  if (!c) return null;
  return c.price ?? null;
}

function totalQty(item: PartCatalogItem): number {
  let s = 0;
  for (const c of Object.values(item.grades || {})) {
    s += Math.max(0, Number(c?.qty) || 0);
  }
  return s;
}

export function PartsCatalogSheet({
  storeFilter,
  writeStoreId,
  role,
  isStatsHidden = false,
  onNotify,
}: Props) {
  const [tabId, setTabId] = useState<SheetTabId>("android_samsung");
  const [items, setItems] = useState<PartCatalogItem[]>(() => clonePartCatalogSeed());
  const [query, setQuery] = useState("");

  const activeTab = useMemo(
    () => SHEET_TABS.find((t) => t.id === tabId) ?? SHEET_TABS[0],
    [tabId]
  );

  const visibleByStore = useMemo(() => {
    return items.filter((it) => {
      if (it.status !== "active") return false;
      if (storeFilter !== "all" && it.storeId !== storeFilter) return false;
      return true;
    });
  }, [items, storeFilter]);

  const byTab = useMemo(() => {
    return visibleByStore.filter((it) => {
      if (it.category !== activeTab.category) return false;
      if (activeTab.category === "man_android") {
        return (it.brandGroup || "").toLowerCase() === activeTab.brandGroup.toLowerCase();
      }
      return true;
    });
  }, [visibleByStore, activeTab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter((it) => it.name.toLowerCase().includes(q));
  }, [byTab, query]);

  const kpiModels = filtered.length;
  const kpiQty = useMemo(
    () => filtered.reduce((s, it) => s + totalQty(it), 0),
    [filtered]
  );

  function saveGradeField(
    item: PartCatalogItem,
    gradeKey: string,
    field: "cost" | "price" | "qty",
    raw: string
  ) {
    const value = parseCellInput(raw);
    const prev = item.grades[gradeKey]?.[field];
    const prevN = prev === undefined ? null : prev;
    if (prevN === value) return;

    setItems((list) =>
      list.map((x) => {
        if (x.id !== item.id) return x;
        const prevCell = x.grades[gradeKey] || {};
        const nextCell: PartGradeCell = {
          ...prevCell,
          [field]:
            field === "qty" && value !== null ? Math.max(0, Math.round(value)) : value,
        };
        return {
          ...x,
          grades: { ...x.grades, [gradeKey]: nextCell },
        };
      })
    );
  }

  function renameItem(item: PartCatalogItem, raw: string) {
    const name = raw.trim();
    if (!name) {
      onNotify("error", "Tên model không được trống.");
      return;
    }
    if (name.toLowerCase() === item.name.trim().toLowerCase()) return;

    const dup = items.some(
      (x) =>
        x.id !== item.id &&
        x.status === "active" &&
        x.storeId === item.storeId &&
        x.category === item.category &&
        (x.brandGroup || "").toLowerCase() === (item.brandGroup || "").toLowerCase() &&
        x.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (dup) {
      onNotify("error", `Model «${name}» đã có trong sheet.`);
      return;
    }

    setItems((list) => list.map((x) => (x.id === item.id ? { ...x, name } : x)));
  }

  function addRow(nameRaw: string) {
    const name = nameRaw.trim();
    if (!name) return false;

    const brandKey =
      activeTab.category === "man_android" ? activeTab.brandGroup : "";

    const dup = items.some(
      (x) =>
        x.status === "active" &&
        x.storeId === writeStoreId &&
        x.category === activeTab.category &&
        (x.brandGroup || "").toLowerCase() === brandKey.toLowerCase() &&
        x.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (dup) {
      onNotify("error", `Model «${name}» đã có trong sheet.`);
      return false;
    }

    const row: PartCatalogItem = {
      id: nextPartCatalogMockId(),
      storeId: writeStoreId,
      category: activeTab.category,
      brandGroup: brandKey,
      name,
      note: "",
      grades: emptyGradesFor(activeTab.category),
      status: "active",
    };
    setItems((list) =>
      [...list, row].sort((a, b) =>
        a.name.localeCompare(b.name, "vi", { sensitivity: "base" })
      )
    );
    return true;
  }

  function handleHide(item: PartCatalogItem) {
    if (role !== "owner") {
      onNotify("error", "Chỉ chủ cửa hàng được ẩn dòng.");
      return;
    }
    if (!window.confirm(`Ẩn model «${item.name}» khỏi sheet?`)) return;
    setItems((list) =>
      list.map((x) => (x.id === item.id ? { ...x, status: "hidden" as const } : x))
    );
    onNotify("success", `Đã ẩn «${item.name}» (mock).`);
  }

  function handleResetMock() {
    setItems(clonePartCatalogSeed());
    onNotify("success", "Đã nạp lại seed mock.");
  }

  const isAndroidTab = activeTab.category === "man_android";

  return (
    <section className="grid gap-4">
      <div className="rounded-xl border border-line bg-white shadow-panel">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-ink">Linh kiện</h2>
            <p className="text-sm font-semibold text-muted">
              Nhập / sửa trên lưới (như Excel). Mỗi hãng Android 1 tab.{" "}
              <span className="text-amber-700">
                Phase A mock — F5 mất chỉnh sửa. Gõ model ở hàng cuối để thêm.
              </span>
            </p>
          </div>
        </div>

        {/* Tab: Samsung | Oppo | Xiaomi | iPhone | Pin */}
        <div className="flex flex-wrap gap-1 border-b border-line bg-slate-50 p-2">
          {SHEET_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTabId(t.id);
                setQuery("");
              }}
              className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                tabId === t.id
                  ? "bg-white text-brand shadow-sm ring-1 ring-line"
                  : "text-muted hover:bg-white/70 hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-muted" size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 w-full rounded-lg border border-line bg-slate-50 pl-10 pr-3 font-semibold outline-none focus:border-brand focus:bg-white"
              placeholder={
                activeTab.category === "pin"
                  ? "Tìm model pin..."
                  : "Tìm màn / model..."
              }
              autoComplete="off"
            />
          </label>
          <div className="flex h-10 items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-bold text-emerald-800">
            <span>
              Model:{" "}
              <strong className="tabular-nums">{isStatsHidden ? "***" : kpiModels}</strong>
            </span>
            <span className="text-emerald-300">|</span>
            <span>
              Tổng SL:{" "}
              <strong className="tabular-nums">{isStatsHidden ? "***" : kpiQty}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetMock}
            className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
            title="Nạp lại dữ liệu demo"
          >
            Reset mock
          </button>
        </div>

        {storeFilter === "all" ? (
          <p className="border-b border-line px-4 py-2 text-xs font-semibold text-amber-700">
            Toàn hệ thống — dòng mới gắn <strong>{writeStoreId}</strong>. Seed demo: store-1.
          </p>
        ) : storeFilter !== "store-1" ? (
          <p className="border-b border-line px-4 py-2 text-xs font-semibold text-muted">
            Seed demo ở store-1 — gõ hàng cuối để thêm model cho CH hiện tại.
          </p>
        ) : null}

        <div className="p-4">
          {isAndroidTab ? (
            <AndroidBrandSheet
              title={activeTab.headTitle}
              headClass={activeTab.headClass}
              items={filtered}
              role={role}
              onSaveField={saveGradeField}
              onRename={renameItem}
              onAdd={addRow}
              onHide={handleHide}
            />
          ) : activeTab.category === "man_iphone" ? (
            <GradePriceSheet
              title={activeTab.headTitle}
              headerClass={activeTab.headClass}
              grades={IPHONE_GRADES}
              items={filtered}
              role={role}
              onSaveField={saveGradeField}
              onRename={renameItem}
              onAdd={addRow}
              onHide={handleHide}
            />
          ) : (
            <GradePriceSheet
              title={activeTab.headTitle}
              headerClass={activeTab.headClass}
              grades={PIN_GRADES}
              items={filtered}
              role={role}
              onSaveField={saveGradeField}
              onRename={renameItem}
              onAdd={addRow}
              onHide={handleHide}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function EditableNumCell({
  value,
  onCommit,
  className = "",
}: {
  value: number | null | undefined;
  onCommit: (raw: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(formatCell(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(formatCell(value));
  }, [value, focused]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={`h-8 w-full min-w-[3.25rem] rounded border border-transparent bg-transparent px-1 text-center text-sm font-bold tabular-nums outline-none hover:border-line focus:border-brand focus:bg-white ${className}`}
      placeholder="-"
    />
  );
}

function EditableTextCell({
  value,
  onCommit,
  placeholder = "",
  className = "",
  bold = false,
}: {
  value: string;
  onCommit: (raw: string) => void;
  placeholder?: string;
  className?: string;
  bold?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  return (
    <input
      type="text"
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder={placeholder}
      autoComplete="off"
      className={`h-8 w-full min-w-0 rounded border border-transparent bg-transparent px-1 text-left text-sm outline-none hover:border-line focus:border-brand focus:bg-white ${
        bold ? "font-bold text-ink" : "font-semibold text-ink"
      } ${className}`}
    />
  );
}

function NewRowNameCell({
  onAdd,
  placeholder = "Gõ model mới…",
}: {
  onAdd: (name: string) => boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const ok = onAdd(draft);
    if (ok) setDraft("");
  }

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft.trim()) commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
      placeholder={placeholder}
      autoComplete="off"
      className="h-8 w-full min-w-0 rounded border border-dashed border-line/80 bg-slate-50/80 px-1 text-left text-sm font-semibold text-ink outline-none placeholder:text-muted/80 focus:border-brand focus:bg-white"
    />
  );
}

/** 1 hãng Android = 1 bảng full width */
function AndroidBrandSheet({
  title,
  headClass,
  items,
  role,
  onSaveField,
  onRename,
  onAdd,
  onHide,
}: {
  title: string;
  headClass: string;
  items: PartCatalogItem[];
  role: Role;
  onSaveField: (
    item: PartCatalogItem,
    gradeKey: string,
    field: "cost" | "price" | "qty",
    raw: string
  ) => void;
  onRename: (item: PartCatalogItem, raw: string) => void;
  onAdd: (name: string) => boolean;
  onHide: (item: PartCatalogItem) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line shadow-sm">
      <div className={`px-3 py-2 text-center text-sm font-black ${headClass}`}>{title}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-amber-100 text-xs font-black text-ink">
              <th className="min-w-[12rem] px-2 py-2 text-left">Model</th>
              <th className="min-w-[5rem] px-1 py-2">Nhập</th>
              <th className="min-w-[5rem] px-1 py-2">Bán</th>
              <th className="min-w-[4rem] px-1 py-2">SL</th>
              {role === "owner" ? <th className="w-9 px-1 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={role === "owner" ? 5 : 4}
                  className="px-3 py-6 text-center text-sm font-semibold text-muted"
                >
                  Chưa có model — gõ ở hàng cuối để thêm
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const g = item.grades.default || {};
                return (
                  <tr
                    key={item.id}
                    className={`border-b border-line/70 ${
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50/80"
                    }`}
                  >
                    <td className="px-1 py-0.5">
                      <EditableTextCell
                        value={item.name}
                        bold
                        onCommit={(raw) => onRename(item, raw)}
                      />
                    </td>
                    <td className="px-0.5 py-1">
                      <EditableNumCell
                        value={g.cost}
                        onCommit={(raw) => onSaveField(item, "default", "cost", raw)}
                        className="text-slate-600"
                      />
                    </td>
                    <td className="px-0.5 py-1">
                      <EditableNumCell
                        value={g.price}
                        onCommit={(raw) => onSaveField(item, "default", "price", raw)}
                        className="text-emerald-700"
                      />
                    </td>
                    <td className="px-0.5 py-1">
                      <EditableNumCell
                        value={g.qty}
                        onCommit={(raw) => onSaveField(item, "default", "qty", raw)}
                        className="text-sky-700"
                      />
                    </td>
                    {role === "owner" ? (
                      <td className="px-1 py-1">
                        <button
                          type="button"
                          onClick={() => onHide(item)}
                          title="Ẩn dòng"
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-danger hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
            <tr className="bg-slate-50/50">
              <td className="px-1 py-1">
                <NewRowNameCell placeholder="Model mới…" onAdd={onAdd} />
              </td>
              <td className="px-1 py-1 text-center text-xs text-muted" colSpan={3}>
                —
              </td>
              {role === "owner" ? <td /> : null}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GradePriceSheet({
  title,
  headerClass,
  grades,
  items,
  role,
  onSaveField,
  onRename,
  onAdd,
  onHide,
}: {
  title: string;
  headerClass: string;
  grades: { key: string; label: string }[];
  items: PartCatalogItem[];
  role: Role;
  onSaveField: (
    item: PartCatalogItem,
    gradeKey: string,
    field: "cost" | "price" | "qty",
    raw: string
  ) => void;
  onRename: (item: PartCatalogItem, raw: string) => void;
  onAdd: (name: string) => boolean;
  onHide: (item: PartCatalogItem) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line shadow-sm">
      <div className={`px-3 py-2 text-center text-sm font-black ${headerClass}`}>{title}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-fuchsia-100 text-xs font-black text-ink">
              <th className="sticky left-0 z-[1] min-w-[10rem] bg-fuchsia-100 px-3 py-2 text-left">
                Model
              </th>
              {grades.map((g) => (
                <th key={g.key} className="min-w-[4.5rem] px-1 py-2">
                  {g.label}
                </th>
              ))}
              {role === "owner" ? <th className="w-9 px-1 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={item.id}
                className={`border-b border-line/70 ${
                  idx % 2 === 0 ? "bg-white" : "bg-slate-50/80"
                }`}
              >
                <td className="sticky left-0 z-[1] bg-inherit px-1 py-0.5">
                  <EditableTextCell
                    value={item.name}
                    bold
                    onCommit={(raw) => onRename(item, raw)}
                  />
                </td>
                {grades.map((g) => (
                  <td key={g.key} className="px-0.5 py-1">
                    <EditableNumCell
                      value={cellPrice(item.grades, g.key)}
                      onCommit={(raw) => onSaveField(item, g.key, "price", raw)}
                      className="text-emerald-800"
                    />
                  </td>
                ))}
                {role === "owner" ? (
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => onHide(item)}
                      title="Ẩn dòng"
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-danger hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
            <tr className="bg-slate-50/50">
              <td className="sticky left-0 z-[1] bg-slate-50/50 px-1 py-1">
                <NewRowNameCell placeholder="Gõ model mới…" onAdd={onAdd} />
              </td>
              {grades.map((g) => (
                <td key={g.key} className="px-1 py-1 text-center text-xs text-muted">
                  —
                </td>
              ))}
              {role === "owner" ? <td /> : null}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
