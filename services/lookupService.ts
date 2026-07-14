export type LookupItem = {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
};

export const PHONE_LOOKUP_CATEGORIES = {
  brand: "phone_brand",
  modelName: "phone_model_name",
  color: "phone_color",
  storage: "phone_storage",
  madeIn: "phone_made_in",
  condition: "phone_condition",
  batteryCondition: "phone_battery_condition",
  batteryCapacity: "phone_battery_capacity",
} as const;

export type PhoneLookupCategoryCode =
  (typeof PHONE_LOOKUP_CATEGORIES)[keyof typeof PHONE_LOOKUP_CATEGORIES];

/** Droplist form Quản lý phần mềm (per-store lookup_items). */
export const SOFTWARE_LOOKUP_CATEGORIES = {
  customer: "software_customer",
  device: "software_device",
  quote: "software_quote",
  fee: "software_fee",
} as const;

export type SoftwareLookupCategoryCode =
  (typeof SOFTWARE_LOOKUP_CATEGORIES)[keyof typeof SOFTWARE_LOOKUP_CATEGORIES];

/** Droplist form phụ kiện (per-store lookup_items). */
export const ACCESSORY_LOOKUP_CATEGORIES = {
  category: "accessory_category",
  brand: "accessory_brand",
  code: "accessory_code",
  name: "accessory_name",
  /** Giá bán — label digits (short money), sort bé → lớn. */
  price: "accessory_price",
  /** Giá nhập — label digits (short money), sort bé → lớn. */
  cost: "accessory_cost",
} as const;

export type AccessoryLookupCategoryCode =
  (typeof ACCESSORY_LOOKUP_CATEGORIES)[keyof typeof ACCESSORY_LOOKUP_CATEGORIES];

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return body.data as T;
}

function storeQuery(storeId: string): string {
  return `storeId=${encodeURIComponent(storeId)}`;
}

export async function listLookupLabels(
  categoryCode: string,
  storeId: string
): Promise<string[]> {
  const res = await fetch(
    `/api/inventory/lookups/${encodeURIComponent(categoryCode)}?${storeQuery(storeId)}`,
    { cache: "no-store" }
  );
  return parseJson<string[]>(res);
}

export async function listLookupItems(
  categoryCode: string,
  storeId: string
): Promise<LookupItem[]> {
  const labels = await listLookupLabels(categoryCode, storeId);
  return labels.map((label, i) => ({
    id: `${categoryCode}-${i}`,
    code: label,
    label,
    sortOrder: i,
  }));
}

export type LookupMutationResult = {
  label?: string;
  labels: string[];
};

export async function addLookupItem(
  categoryCode: string,
  label: string,
  actorUsername: string,
  storeId: string
): Promise<LookupMutationResult> {
  const res = await fetch(`/api/inventory/lookups/${encodeURIComponent(categoryCode)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, actorUsername, storeId }),
  });
  return parseJson<LookupMutationResult>(res);
}

export async function updateLookupItem(
  categoryCode: string,
  oldLabel: string,
  newLabel: string,
  actorUsername: string,
  storeId: string
): Promise<LookupMutationResult> {
  const res = await fetch(`/api/inventory/lookups/${encodeURIComponent(categoryCode)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oldLabel, label: newLabel, actorUsername, storeId }),
  });
  return parseJson<LookupMutationResult>(res);
}

export async function deactivateLookupItem(
  categoryCode: string,
  label: string,
  actorUsername: string,
  storeId: string
): Promise<LookupMutationResult> {
  const res = await fetch(`/api/inventory/lookups/${encodeURIComponent(categoryCode)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, actorUsername, storeId }),
  });
  return parseJson<LookupMutationResult>(res);
}

/** Sort options + persist sort_order (storage: 64GB → 1TB). */
export async function sortLookupItems(
  categoryCode: string,
  actorUsername: string,
  storeId: string
): Promise<LookupMutationResult> {
  const res = await fetch(`/api/inventory/lookups/${encodeURIComponent(categoryCode)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sort", actorUsername, storeId }),
  });
  return parseJson<LookupMutationResult>(res);
}
