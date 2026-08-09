"use client";

import {
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  Edit3,
  Loader2,
  Minus,
  Plus,
  Trash2,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Role, StoreId } from "@/types";
import { storeName } from "@/lib/constants";
import {
  createPartCatalog,
  deletePartCatalog,
  listPartCatalog,
  patchPartCatalog,
  type PartCatalogItemDto,
} from "@/services/partsCatalogService";
import {
  PART_CATALOG_LOOKUP_CATEGORIES,
  addLookupItem,
  deactivateLookupItem,
  listLookupLabels,
  updateLookupItem,
} from "@/services/lookupService";

type Props = {
  storeFilter: StoreId;
  writeStoreId: Exclude<StoreId, "all">;
  role: Role;
  actorUsername: string;
  isStatsHidden?: boolean;
  onNotify: (type: "success" | "error", message: string) => void;
};

type Draft = {
  brand: string;
  partType: string;
  deviceType: string;
  color: string;
  costPrice: string;
  retailPrice: string;
  quantity: number;
};

const EMPTY_DRAFT: Draft = {
  brand: "",
  partType: "",
  deviceType: "",
  color: "",
  costPrice: "",
  retailPrice: "",
  quantity: 1,
};

function money(value: number | null | undefined) {
  return value == null ? "—" : value.toLocaleString("vi-VN");
}

function parseMoney(value: string): number | null {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

function dateVi(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("vi-VN");
}

function statusLabel(row: PartCatalogItemDto) {
  if (row.status === "hidden") return "Đã ẩn";
  return row.quantity > 0 ? "Còn hàng" : "Hết hàng";
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((x) => x.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "vi", { sensitivity: "base" })
  );
}

function CatalogSelect({
  label,
  value,
  options,
  categoryCode,
  storeId,
  actorUsername,
  required,
  moneyField,
  onChange,
  onOptionsChange,
  onNotify,
}: {
  label: string;
  value: string;
  options: string[];
  categoryCode: string;
  storeId: string;
  actorUsername: string;
  required?: boolean;
  moneyField?: boolean;
  onChange: (value: string) => void;
  onOptionsChange: (value: string[]) => void;
  onNotify: Props["onNotify"];
}) {
  const listId = `catalog-${categoryCode}`;
  async function manage(action: "add" | "edit" | "delete") {
    try {
      if (action === "add") {
        const raw = window.prompt(`Thêm ${label}`)?.trim();
        if (!raw) return;
        const next = moneyField ? String(parseMoney(raw) ?? "") : raw;
        if (!next) throw new Error("Giá trị không hợp lệ.");
        const result = await addLookupItem(categoryCode, next, actorUsername, storeId);
        onOptionsChange(result.labels);
        onChange(result.label || next);
        onNotify("success", `Đã thêm «${next}».`);
        return;
      }
      if (!value.trim()) throw new Error(`Chọn ${label} cần quản lý trước.`);
      if (action === "edit") {
        const raw = window.prompt(`Sửa ${label}`, value)?.trim();
        if (!raw) return;
        const next = moneyField ? String(parseMoney(raw) ?? "") : raw;
        if (!next) throw new Error("Giá trị không hợp lệ.");
        const result = await updateLookupItem(categoryCode, value, next, actorUsername, storeId);
        onOptionsChange(result.labels);
        onChange(result.label || next);
        onNotify("success", `Đã sửa option thành «${next}».`);
        return;
      }
      if (!window.confirm(`Xóa «${value}» khỏi droplist ${label}?\nDữ liệu linh kiện đã lưu không bị xóa.`)) return;
      const result = await deactivateLookupItem(categoryCode, value, actorUsername, storeId);
      onOptionsChange(result.labels);
      onChange("");
      onNotify("success", `Đã xóa «${value}» khỏi droplist.`);
    } catch (error) {
      onNotify("error", error instanceof Error ? error.message : "Không quản lý được droplist.");
    }
  }

  return (
    <label className="grid gap-1">
      <span className="text-sm font-black text-ink">
        {label}{required ? <span className="text-danger"> *</span> : null}
      </span>
      <div className="flex gap-1.5">
        <input
          list={listId}
          value={moneyField && value ? Number(value.replace(/\D/g, "") || 0).toLocaleString("vi-VN") : value}
          onChange={(e) => onChange(moneyField ? e.target.value.replace(/\D/g, "") : e.target.value)}
          required={required}
          inputMode={moneyField ? "numeric" : undefined}
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm font-semibold outline-none ring-brand/30 focus:ring-2"
        />
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option} value={moneyField ? Number(option.replace(/\D/g, "") || 0).toLocaleString("vi-VN") : option} />
          ))}
        </datalist>
        <button type="button" onClick={() => void manage("add")} title="Thêm option" className="h-11 w-10 rounded-lg border border-line bg-brand-soft font-black text-brand">+</button>
        <button type="button" onClick={() => void manage("edit")} title="Sửa option đang chọn" className="h-11 w-10 rounded-lg border border-line bg-white text-xs font-black text-slate-700">Sửa</button>
        <button type="button" onClick={() => void manage("delete")} title="Xóa option đang chọn" className="h-11 w-10 rounded-lg bg-red-50 text-xs font-black text-danger">Xóa</button>
      </div>
      <span className="text-[11px] font-semibold text-muted">Chọn từ danh sách hoặc nhập giá trị mới.</span>
    </label>
  );
}

export function PartsInventoryScreen(props: Props) {
  const { storeFilter, writeStoreId, role, actorUsername, isStatsHidden, onNotify } = props;
  const [rows, setRows] = useState<PartCatalogItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PartCatalogItemDto | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [lookups, setLookups] = useState<Record<string, string[]>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await listPartCatalog({ store: storeFilter, actorUsername, includeHidden: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được linh kiện.");
    } finally {
      setLoading(false);
    }
  }, [actorUsername, storeFilter]);

  const reloadLookups = useCallback(async () => {
    const entries = await Promise.all(
      Object.values(PART_CATALOG_LOOKUP_CATEGORIES).map(async (code) => {
        try { return [code, await listLookupLabels(code, writeStoreId)] as const; }
        catch { return [code, []] as const; }
      })
    );
    setLookups(Object.fromEntries(entries));
  }, [writeStoreId]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { void reloadLookups(); }, [reloadLookups]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (brandFilter !== "all" && row.brand !== brandFilter) return false;
      if (typeFilter !== "all" && row.partType !== typeFilter) return false;
      if (deviceFilter !== "all" && row.deviceType !== deviceFilter) return false;
      if (statusFilter === "active" && row.status !== "active") return false;
      if (statusFilter === "in_stock" && (row.status !== "active" || row.quantity <= 0)) return false;
      if (statusFilter === "out_of_stock" && (row.status !== "active" || row.quantity > 0)) return false;
      if (statusFilter === "hidden" && row.status !== "hidden") return false;
      if (q && ![row.brand, row.partType, row.deviceType, row.color].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, brandFilter, typeFilter, deviceFilter, statusFilter]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function openNew(base?: PartCatalogItemDto) {
    setEditing(null);
    setDraft(base ? {
      brand: base.brand, partType: base.partType, deviceType: base.deviceType,
      color: base.color, costPrice: base.costPrice == null ? "" : String(base.costPrice),
      retailPrice: base.retailPrice == null ? "" : String(base.retailPrice), quantity: base.quantity,
    } : EMPTY_DRAFT);
    setModalOpen(true);
  }

  function openEdit(row: PartCatalogItemDto) {
    setEditing(row);
    setDraft({
      brand: row.brand, partType: row.partType, deviceType: row.deviceType, color: row.color,
      costPrice: row.costPrice == null ? "" : String(row.costPrice),
      retailPrice: row.retailPrice == null ? "" : String(row.retailPrice), quantity: row.quantity,
    });
    setModalOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.brand.trim() || !draft.partType.trim() || !draft.deviceType.trim()) {
      onNotify("error", "Hãng, Loại linh kiện và Thuộc loại máy là bắt buộc.");
      return;
    }
    setSaving(true);
    try {
      const input = {
        brand: draft.brand.trim(), partType: draft.partType.trim(), deviceType: draft.deviceType.trim(),
        color: draft.color.trim(), costPrice: parseMoney(draft.costPrice), retailPrice: parseMoney(draft.retailPrice),
        quantity: Math.max(0, Math.round(draft.quantity)), actorUsername,
      };
      if (editing) await patchPartCatalog({ id: editing.id, ...input, name: input.deviceType, brandGroup: input.brand });
      else await createPartCatalog({ storeId: writeStoreId, category: "man_android", name: input.deviceType, brandGroup: input.brand, ...input });
      setModalOpen(false);
      onNotify("success", editing ? "Đã cập nhật linh kiện." : "Đã thêm linh kiện.");
      await reload();
    } catch (e) {
      onNotify("error", e instanceof Error ? e.message : "Không lưu được linh kiện.");
    } finally { setSaving(false); }
  }

  async function deleteRow(row: PartCatalogItemDto) {
    if (role !== "owner") return onNotify("error", "Chỉ owner được xóa linh kiện.");
    if (!window.confirm(`Xóa linh kiện «${row.deviceType}»?\nThao tác này không thể hoàn tác.`)) return;
    try {
      await deletePartCatalog(row.id, actorUsername);
      onNotify("success", `Đã xóa linh kiện «${row.deviceType}».`);
      await reload();
    } catch (e) { onNotify("error", e instanceof Error ? e.message : "Xóa linh kiện thất bại."); }
  }

  const filterOptions = {
    brands: unique(rows.map((r) => r.brand)), types: unique(rows.map((r) => r.partType)),
    devices: unique(rows.map((r) => r.deviceType)),
  };
  const resetFilters = () => { setQuery(""); setBrandFilter("all"); setTypeFilter("all"); setDeviceFilter("all"); setStatusFilter("all"); setPage(1); };
  const setLookup = (code: string) => (values: string[]) => setLookups((old) => ({ ...old, [code]: values }));

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-xl font-black text-ink">Linh kiện</h2><p className="text-sm font-semibold text-muted">Kho linh kiện độc lập · {filtered.length.toLocaleString("vi-VN")} dòng · {isStatsHidden ? "***" : filtered.reduce((s,r)=>s+r.quantity,0).toLocaleString("vi-VN")} sản phẩm</p></div>
        <button onClick={() => openNew()} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-white hover:bg-brand-dark"><Plus size={18}/>Tạo báo giá</button>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-danger">{error} <button onClick={() => void reload()} className="ml-2 font-black underline">Thử lại</button></div> : null}

      <section className="overflow-hidden rounded-xl border border-line bg-white shadow-panel">
        <div className="grid gap-2 border-b border-line p-4 md:grid-cols-3 xl:grid-cols-[minmax(18rem,2fr)_repeat(5,minmax(0,1fr))]">
          <label className="relative md:col-span-2 xl:col-span-1"><Search size={16} className="absolute left-3 top-3 text-muted"/><input value={query} onChange={(e)=>{setQuery(e.target.value);setPage(1);}} placeholder="Tìm hãng, loại, máy, màu…" className="h-10 w-full rounded-lg border border-line bg-slate-50 pl-9 pr-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand/30"/></label>
          <Filter value={brandFilter} onChange={setBrandFilter} label="Tất cả hãng" options={filterOptions.brands}/>
          <Filter value={deviceFilter} onChange={setDeviceFilter} label="Tất cả loại máy" options={filterOptions.devices}/>
          <Filter value={typeFilter} onChange={setTypeFilter} label="Tất cả loại LK" options={filterOptions.types}/>
          <select value={statusFilter} onChange={(e)=>{setStatusFilter(e.target.value);setPage(1);}} className="h-10 rounded-lg border border-line bg-white px-2 text-sm font-bold"><option value="all">Tất cả trạng thái</option><option value="in_stock">Còn hàng</option><option value="out_of_stock">Hết hàng</option></select>
          <button onClick={resetFilters} className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-line bg-white text-sm font-bold text-slate-700"><Settings2 size={15}/>Xóa lọc</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-center text-sm"><thead className="bg-slate-50 text-xs font-black uppercase text-muted"><tr><th className="px-3 py-3">Ngày</th><th className="px-3 py-3">Cửa Hàng</th><th className="px-3 py-3">Hãng</th><th className="px-3 py-3">Thuộc loại máy</th><th className="px-3 py-3">Loại linh kiện</th><th className="px-3 py-3">Giá thay khách</th><th className="px-3 py-3">SL</th><th className="px-3 py-3">Trạng thái</th><th className="px-3 py-3">Thao tác</th><th className="px-3 py-3">Giá nhập</th><th className="px-3 py-3">Màu sắc</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={11} className="py-12 text-center text-muted"><Loader2 className="mx-auto animate-spin"/></td></tr> : paged.length === 0 ? <tr><td colSpan={11} className="py-12 text-center font-semibold text-muted">Chưa có linh kiện phù hợp.</td></tr> : paged.map((row)=><tr key={row.id} className="border-t border-line hover:bg-slate-50"><td className="whitespace-nowrap px-3 py-2.5">{dateVi(row.createdAt)}</td><td className="whitespace-nowrap px-3 py-2.5 font-bold">{storeName(row.storeId)}</td><td className="px-3 py-2.5 font-bold text-ink">{row.brand}</td><td className="px-3 py-2.5 font-semibold">{row.deviceType}</td><td className="px-3 py-2.5"><span className="rounded-full bg-brand-soft px-2 py-1 text-xs font-bold text-brand-dark">{row.partType}</span></td><td className="whitespace-nowrap px-3 py-2.5 text-2xl font-black text-danger">{money(row.retailPrice)}</td><td className="px-3 py-2.5 font-black">{row.quantity.toLocaleString("vi-VN")}</td><td className="px-3 py-2.5"><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.status === "hidden" ? "bg-slate-100 text-slate-600" : row.quantity > 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{statusLabel(row)}</span></td><td className="px-3 py-2.5"><div className="flex justify-center gap-1"><button onClick={()=>openEdit(row)} title="Sửa" className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand"><Edit3 size={16}/></button><button onClick={()=>openNew(row)} title="Nhân bản" className="grid h-9 w-9 place-items-center rounded-lg bg-sky-50 text-sky-700"><CopyPlus size={16}/></button>{role === "owner" ? <button onClick={()=>void deleteRow(row)} title="Xóa" className="grid h-9 w-9 place-items-center rounded-lg bg-red-50 text-danger hover:bg-red-100"><Trash2 size={16}/></button> : null}</div></td><td className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-muted">{isStatsHidden ? "***" : money(row.costPrice)}</td><td className="px-3 py-2.5">{row.color || "—"}</td></tr>)}</tbody></table>
        </div>
        <div className="flex items-center justify-between border-t border-line p-4 text-sm font-semibold text-muted"><span>Trang {safePage}/{totalPages} · {filtered.length.toLocaleString("vi-VN")} bản ghi</span><div className="flex gap-2"><button disabled={safePage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="grid h-9 w-9 place-items-center rounded-lg border border-line disabled:opacity-40"><ChevronLeft size={16}/></button><button disabled={safePage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="grid h-9 w-9 place-items-center rounded-lg border border-line disabled:opacity-40"><ChevronRight size={16}/></button></div></div>
      </section>

      {modalOpen ? <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={()=>!saving&&setModalOpen(false)}><form onSubmit={submit} onClick={(e)=>e.stopPropagation()} className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white shadow-panel"><div className="flex items-center justify-between border-b border-line p-5"><div><h3 className="text-xl font-black text-ink">{editing ? "Sửa báo giá" : "Tạo báo giá"}</h3><p className="text-sm font-semibold text-muted">Lưu độc lập tại cửa hàng {writeStoreId}</p></div><button type="button" onClick={()=>setModalOpen(false)} className="grid h-10 w-10 place-items-center rounded-lg border border-line"><X size={18}/></button></div><div className="grid gap-4 p-5 md:grid-cols-2">
        <CatalogSelect label="Hãng" value={draft.brand} options={lookups[PART_CATALOG_LOOKUP_CATEGORIES.brand]||[]} categoryCode={PART_CATALOG_LOOKUP_CATEGORIES.brand} storeId={writeStoreId} actorUsername={actorUsername} required onChange={(brand)=>setDraft(d=>({...d,brand}))} onOptionsChange={setLookup(PART_CATALOG_LOOKUP_CATEGORIES.brand)} onNotify={onNotify}/>
        <CatalogSelect label="Loại linh kiện" value={draft.partType} options={lookups[PART_CATALOG_LOOKUP_CATEGORIES.partType]||[]} categoryCode={PART_CATALOG_LOOKUP_CATEGORIES.partType} storeId={writeStoreId} actorUsername={actorUsername} required onChange={(partType)=>setDraft(d=>({...d,partType}))} onOptionsChange={setLookup(PART_CATALOG_LOOKUP_CATEGORIES.partType)} onNotify={onNotify}/>
        <CatalogSelect label="Giá thay khách" value={draft.retailPrice} options={lookups[PART_CATALOG_LOOKUP_CATEGORIES.retailPrice]||[]} categoryCode={PART_CATALOG_LOOKUP_CATEGORIES.retailPrice} storeId={writeStoreId} actorUsername={actorUsername} moneyField onChange={(retailPrice)=>setDraft(d=>({...d,retailPrice}))} onOptionsChange={setLookup(PART_CATALOG_LOOKUP_CATEGORIES.retailPrice)} onNotify={onNotify}/>
        <CatalogSelect label="Giá nhập" value={draft.costPrice} options={lookups[PART_CATALOG_LOOKUP_CATEGORIES.costPrice]||[]} categoryCode={PART_CATALOG_LOOKUP_CATEGORIES.costPrice} storeId={writeStoreId} actorUsername={actorUsername} moneyField onChange={(costPrice)=>setDraft(d=>({...d,costPrice}))} onOptionsChange={setLookup(PART_CATALOG_LOOKUP_CATEGORIES.costPrice)} onNotify={onNotify}/>
        <CatalogSelect label="Thuộc loại máy" value={draft.deviceType} options={lookups[PART_CATALOG_LOOKUP_CATEGORIES.deviceType]||[]} categoryCode={PART_CATALOG_LOOKUP_CATEGORIES.deviceType} storeId={writeStoreId} actorUsername={actorUsername} required onChange={(deviceType)=>setDraft(d=>({...d,deviceType}))} onOptionsChange={setLookup(PART_CATALOG_LOOKUP_CATEGORIES.deviceType)} onNotify={onNotify}/>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid min-w-0 gap-1"><span className="text-sm font-black text-ink">Số lượng</span><div className="flex h-11 min-w-0 overflow-hidden rounded-lg border border-line"><button type="button" onClick={()=>setDraft(d=>({...d,quantity:Math.max(1,d.quantity-1)}))} className="grid w-9 shrink-0 place-items-center bg-slate-50"><Minus size={16}/></button><input value={draft.quantity} onChange={(e)=>setDraft(d=>({...d,quantity:Math.max(1,Number(e.target.value.replace(/\D/g,""))||1)}))} inputMode="numeric" className="min-w-0 flex-1 text-center font-black outline-none"/><button type="button" onClick={()=>setDraft(d=>({...d,quantity:d.quantity+1}))} className="grid w-9 shrink-0 place-items-center bg-brand-soft text-brand"><Plus size={16}/></button></div></label>
          <label className="grid min-w-0 gap-1"><span className="text-sm font-black text-ink">Màu sắc</span><input value={draft.color} onChange={(e)=>setDraft(d=>({...d,color:e.target.value}))} className="h-11 min-w-0 rounded-lg border border-line px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand/30" placeholder="Nhập tự do"/></label>
        </div>
      </div><div className="flex justify-end gap-2 border-t border-line p-5"><button type="button" disabled={saving} onClick={()=>setModalOpen(false)} className="h-11 rounded-lg border border-line px-4 font-bold">Hủy</button><button type="submit" disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 font-bold text-white disabled:opacity-50">{saving?<Loader2 size={17} className="animate-spin"/>:<Plus size={17}/>} {editing?"Cập nhật":"Lưu báo giá"}</button></div></form></div> : null}
    </section>
  );
}

function Filter({ value, onChange, label, options }: { value:string; onChange:(v:string)=>void; label:string; options:string[] }) {
  return <select value={value} onChange={(e)=>onChange(e.target.value)} className="h-10 min-w-0 rounded-lg border border-line bg-white px-2 text-sm font-bold"><option value="all">{label}</option>{options.map(x=><option key={x} value={x}>{x}</option>)}</select>;
}
