"use client";

/**
 * LINH KIỆN — Phase A: UI mock (state client), chưa gọi API/DB.
 * Phase B: thay setState bằng service, giữ shape PartCatalogItem.
 */

import { Plus, Search, Trash2 } from "lucide-react";
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

const TABS: { id: PartCatalogCategory; label: string }[] = [
  { id: "man_android", label: "Màn Android" },
  { id: "man_iphone", label: "Màn iPhone" },
  { id: "pin", label: "Pin" },
];

const ANDROID_BRANDS: { id: string; label: string; headClass: string }[] = [
  { id: "samsung", label: "SAMSUNG LCD (RẺ)", headClass: "bg-slate-800 text-white" },
  { id: "oppo_realme", label: "OPPO - REALME", headClass: "bg-slate-800 text-white" },
  { id: "xiaomi_poco", label: "XIAOMI - POCO", headClass: "bg-slate-800 text-white" },
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
  const [tab, setTab] = useState<PartCatalogCategory>("man_android");
  const [items, setItems] = useState<PartCatalogItem[]>(() => clonePartCatalogSeed());
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [newBrand, setNewBrand] = useState("samsung");

  const visibleByStore = useMemo(() => {
    return items.filter((it) => {
      if (it.status !== "active") return false;
      if (storeFilter !== "all" && it.storeId !== storeFilter) return false;
      return true;
    });
  }, [items, storeFilter]);

  const byTab = useMemo(
    () => visibleByStore.filter((it) => it.category === tab),
    [visibleByStore, tab]
  );

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
          [field]: field === "qty" && value !== null ? Math.max(0, Math.round(value)) : value,
        };
        return {
          ...x,
          grades: { ...x.grades, [gradeKey]: nextCell },
        };
      })
    );
  }

  function handleAddRow() {
    const name = newName.trim();
    if (!name) {
      onNotify("error", "Nhập tên model.");
      return;
    }
    if (tab === "man_android" && !newBrand.trim()) {
      onNotify("error", "Chọn hãng.");
      return;
    }
    const brandKey = tab === "man_android" ? newBrand : "";
    const dup = items.some(
      (x) =>
        x.status === "active" &&
        x.storeId === writeStoreId &&
        x.category === tab &&
        (x.brandGroup || "").toLowerCase() === brandKey.toLowerCase() &&
        x.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (dup) {
      onNotify("error", "Model «" + name + "» đã có trong sheet (mock).");
      return;
    }

    const row: PartCatalogItem = {
      id: nextPartCatalogMockId(),
      storeId: writeStoreId,
      category: tab,
      brandGroup: brandKey,
      name,
      note: "",
      grades: emptyGradesFor(tab),
      status: "active",
    };
    setItems((list) =>
      [...list, row].sort((a, b) =>
        a.name.localeCompare(b.name, "vi", { sensitivity: "base" })
      )
    );
    setNewName("");
    onNotify("success", "Đã thêm «" + name + "» (mock — chưa lưu DB).");
  }

  function handleHide(item: PartCatalogItem) {
    if (role !== "owner") {
      onNotify("error", "Chỉ chủ cửa hàng được ẩn dòng.");
      return;
    }
    if (!window.confirm("Ẩn model «" + item.name + "» khỏi sheet?")) return;
    setItems((list) =>
      list.map((x) => (x.id === item.id ? { ...x, status: "hidden" as const } : x))
    );
    onNotify("success", "Đã ẩn «" + item.name + "» (mock).");
  }

  function handleResetMock() {
    setItems(clonePartCatalogSeed());
    onNotify("success", "Đã nạp lại seed mock.");
  }

  return (
    <section className="grid gap-4">
      <div className="rounded-xl border border-line bg-white shadow-panel">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-ink">Linh kiện</h2>
            <p className="text-sm font-semibold text-muted">
              Sheet giá + tồn (giống Excel).{" "}
              <span className="text-amber-700">Phase A: dữ liệu mock — F5 sẽ mất chỉnh sửa.</span>
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-line bg-slate-100 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setQuery("");
                }}
                className={`rounded-md px-3 py-2 text-sm font-bold ${
                  tab === t.id ? "bg-white text-brand shadow-sm" : "text-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-muted" size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 w-full rounded-lg border border-line bg-slate-50 pl-10 pr-3 font-semibold outline-none focus:border-brand focus:bg-white"
              placeholder={tab === "pin" ? "Tìm model pin..." : "Tìm màn / model..."}
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

        <div className="flex flex-wrap items-end gap-2 border-b border-line p-4">
          {tab === "man_android" ? (
            <label className="grid gap-1">
              <span className="text-xs font-bold text-muted">Hãng</span>
              <select
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
                className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-semibold"
              >
                {ANDROID_BRANDS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="min-w-[12rem] flex-1 grid gap-1">
            <span className="text-xs font-bold text-muted">Thêm model</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddRow();
                }
              }}
              className="h-10 rounded-lg border border-line px-3 text-sm font-semibold outline-none focus:border-brand"
              placeholder="VD: A13, 11 Pro, 12 - 12 Pro…"
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-black text-white hover:bg-brand-dark"
          >
            <Plus size={16} />
            Thêm dòng
          </button>
          {storeFilter === "all" ? (
            <p className="w-full text-xs font-semibold text-amber-700">
              Toàn hệ thống — dòng mới gắn <strong>{writeStoreId}</strong> (mock). Seed demo hiện ở
              store-1.
            </p>
          ) : storeFilter !== "store-1" ? (
            <p className="w-full text-xs font-semibold text-muted">
              Seed demo chỉ có store-1 — thêm dòng mới tại CH này hoặc chọn store-1 để xem mẫu.
            </p>
          ) : null}
        </div>

        <div className="p-4">
          {tab === "man_android" ? (
            <AndroidSheet
              items={filtered}
              role={role}
              onSaveField={saveGradeField}
              onHide={handleHide}
            />
          ) : tab === "man_iphone" ? (
            <GradePriceSheet
              title="Màn iPhone"
              headerClass="bg-rose-600 text-white"
              grades={IPHONE_GRADES}
              items={filtered}
              role={role}
              onSaveField={saveGradeField}
              onHide={handleHide}
            />
          ) : (
            <GradePriceSheet
              title="Pin"
              headerClass="bg-slate-900 text-white"
              grades={PIN_GRADES}
              items={filtered}
              role={role}
              onSaveField={saveGradeField}
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

function AndroidSheet({
  items,
  role,
  onSaveField,
  onHide,
}: {
  items: PartCatalogItem[];
  role: Role;
  onSaveField: (
    item: PartCatalogItem,
    gradeKey: string,
    field: "cost" | "price" | "qty",
    raw: string
  ) => void;
  onHide: (item: PartCatalogItem) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {ANDROID_BRANDS.map((brand) => {
        const rows = items.filter(
          (it) => (it.brandGroup || "").toLowerCase() === brand.id
        );
        return (
          <div
            key={brand.id}
            className="overflow-hidden rounded-lg border border-line shadow-sm"
          >
            <div className={`px-3 py-2 text-center text-sm font-black ${brand.headClass}`}>
              {brand.label}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-amber-100 text-xs font-black text-ink">
                    <th className="px-2 py-2 text-left">Model</th>
                    <th className="px-1 py-2">Nhập</th>
                    <th className="px-1 py-2">Bán</th>
                    <th className="px-1 py-2">SL</th>
                    {role === "owner" ? <th className="w-9 px-1 py-2" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={role === "owner" ? 5 : 4}
                        className="px-3 py-6 text-center text-sm font-semibold text-muted"
                      >
                        Chưa có model
                      </td>
                    </tr>
                  ) : (
                    rows.map((item, idx) => {
                      const g = item.grades.default || {};
                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-line/70 ${
                            idx % 2 === 0 ? "bg-white" : "bg-slate-50/80"
                          }`}
                        >
                          <td className="max-w-[10rem] px-2 py-1 font-bold text-ink">
                            <span className="line-clamp-2" title={item.name}>
                              {item.name}
                            </span>
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
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
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
  onHide: (item: PartCatalogItem) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line shadow-sm">
      <div className={`px-3 py-2 text-center text-sm font-black ${headerClass}`}>{title}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-fuchsia-100 text-xs font-black text-ink">
              <th className="sticky left-0 z-[1] bg-fuchsia-100 px-3 py-2 text-left">Model</th>
              {grades.map((g) => (
                <th key={g.key} className="min-w-[4.5rem] px-1 py-2">
                  {g.label}
                </th>
              ))}
              {role === "owner" ? <th className="w-9 px-1 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={grades.length + (role === "owner" ? 2 : 1)}
                  className="px-3 py-8 text-center text-sm font-semibold text-muted"
                >
                  Chưa có model — thêm dòng phía trên
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`border-b border-line/70 ${
                    idx % 2 === 0 ? "bg-white" : "bg-slate-50/80"
                  }`}
                >
                  <td className="sticky left-0 z-[1] bg-inherit px-3 py-1 font-black text-ink">
                    {item.name}
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
