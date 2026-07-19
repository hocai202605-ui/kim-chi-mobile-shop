import type { Accessory, PhoneItem, ProductStatus, StoreId } from "@/types";

export type PhoneFilters = {
  storeId?: StoreId;
  status?: ProductStatus | "all";
  brand?: string | "all";
  query?: string;
  name?: string;
  minPrice?: number;
  maxPrice?: number;
};

export type AccessoryFilters = {
  storeId?: StoreId;
  status?: string | "all";
  query?: string;
  name?: string;
  minPrice?: number;
  maxPrice?: number;
};

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return body.data as T;
}

function applyPhoneFilters(rows: PhoneItem[], filters: PhoneFilters = {}): PhoneItem[] {
  return rows.filter((item) => {
    if (filters.storeId && filters.storeId !== "all" && item.storeId !== filters.storeId) return false;
    if (filters.status && filters.status !== "all" && item.status !== filters.status) return false;
    if (filters.brand && filters.brand !== "all" && item.brand !== filters.brand) return false;
    if (filters.minPrice != null && item.expectedPrice < filters.minPrice) return false;
    if (filters.maxPrice != null && item.expectedPrice > filters.maxPrice) return false;
    const q = filters.query?.trim().toLowerCase();
    if (q) {
      const hay = [item.name, item.imei, item.condition, item.color, item.storage, item.brand]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const name = filters.name?.trim().toLowerCase();
    if (name && !item.name.toLowerCase().includes(name)) return false;
    return true;
  });
}

function applyAccessoryFilters(rows: Accessory[], filters: AccessoryFilters = {}): Accessory[] {
  return rows.filter((item) => {
    if (filters.storeId && filters.storeId !== "all" && item.storeId !== filters.storeId) return false;
    if (filters.status && filters.status !== "all") {
      const ok =
        item.status === filters.status ||
        (filters.status === "Đã bán" && item.status === "Hết hàng");
      if (!ok) return false;
    }
    if (filters.minPrice != null && item.price < filters.minPrice) return false;
    if (filters.maxPrice != null && item.price > filters.maxPrice) return false;
    const q = filters.query?.trim().toLowerCase();
    if (
      q &&
      ![item.name, item.code, item.category, item.brand, item.note]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    ) {
      return false;
    }
    const name = filters.name?.trim().toLowerCase();
    if (name && !item.name.toLowerCase().includes(name)) return false;
    return true;
  });
}

export type InventoryBootstrap = {
  phones: PhoneItem[];
  accessories: Accessory[];
  /** Per-store droplists: storeCode → categoryCode → labels */
  lookupsByStore: Record<string, Record<string, string[]>>;
};

/** One request: phones + accessories + all phone lookups per store (fewer DB connections). */
export async function loadInventoryBootstrap(): Promise<InventoryBootstrap> {
  const res = await fetch("/api/inventory/bootstrap", { cache: "no-store" });
  return parseJson<InventoryBootstrap>(res);
}

/** Always from DB via Next API (no client mock). */
export async function listPhones(filters: PhoneFilters = {}): Promise<PhoneItem[]> {
  const res = await fetch("/api/inventory/phones", { cache: "no-store" });
  const rows = await parseJson<PhoneItem[]>(res);
  return applyPhoneFilters(rows, filters);
}

export async function listAccessories(filters: AccessoryFilters = {}): Promise<Accessory[]> {
  const res = await fetch("/api/inventory/accessories", { cache: "no-store" });
  const rows = await parseJson<Accessory[]>(res);
  return applyAccessoryFilters(rows, filters);
}

export type PhoneUpsertInput = Omit<PhoneItem, "id"> & {
  id?: string;
  actorUsername?: string;
};

export async function upsertPhone(input: PhoneUpsertInput): Promise<PhoneItem> {
  const res = await fetch("/api/inventory/phones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<PhoneItem>(res);
}

export type AccessoryUpsertInput = Omit<Accessory, "id"> & {
  id?: string;
  actorUsername?: string;
};

export async function upsertAccessory(input: AccessoryUpsertInput): Promise<Accessory> {
  const res = await fetch("/api/inventory/accessories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<Accessory>(res);
}

export async function cancelPhone(id: string, actorUsername?: string): Promise<PhoneItem> {
  const res = await fetch(`/api/inventory/phones/${id}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actorUsername }),
  });
  return parseJson<PhoneItem>(res);
}

/** Xóa cứng máy khỏi DB / grid. */
export async function deletePhone(id: string): Promise<PhoneItem> {
  const res = await fetch(`/api/inventory/phones/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  return parseJson<PhoneItem>(res);
}

export async function cancelAccessory(
  id: string,
  actorUsername?: string
): Promise<Accessory> {
  const res = await fetch(`/api/inventory/accessories/${id}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actorUsername }),
  });
  return parseJson<Accessory>(res);
}

/** Xóa cứng phụ kiện khỏi DB / grid. */
export async function deleteAccessory(id: string): Promise<Accessory> {
  const res = await fetch(`/api/inventory/accessories/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  return parseJson<Accessory>(res);
}

export async function restorePhone(_id: string): Promise<PhoneItem> {
  throw new Error("restorePhone chưa expose API — dùng SQL/RPC owner.");
}

export async function restoreAccessory(_id: string): Promise<Accessory> {
  throw new Error("restoreAccessory chưa expose API — dùng SQL/RPC owner.");
}
