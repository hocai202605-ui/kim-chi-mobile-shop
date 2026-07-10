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

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return body.data as T;
}

export async function listLookupLabels(categoryCode: string): Promise<string[]> {
  const res = await fetch(`/api/inventory/lookups/${encodeURIComponent(categoryCode)}`, {
    cache: "no-store",
  });
  return parseJson<string[]>(res);
}

export async function listLookupItems(categoryCode: string): Promise<LookupItem[]> {
  const labels = await listLookupLabels(categoryCode);
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
  label: string
): Promise<LookupMutationResult> {
  const res = await fetch(`/api/inventory/lookups/${encodeURIComponent(categoryCode)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  return parseJson<LookupMutationResult>(res);
}

export async function updateLookupItem(
  categoryCode: string,
  oldLabel: string,
  newLabel: string
): Promise<LookupMutationResult> {
  const res = await fetch(`/api/inventory/lookups/${encodeURIComponent(categoryCode)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oldLabel, label: newLabel }),
  });
  return parseJson<LookupMutationResult>(res);
}

export async function deactivateLookupItem(
  categoryCode: string,
  label: string
): Promise<LookupMutationResult> {
  const res = await fetch(`/api/inventory/lookups/${encodeURIComponent(categoryCode)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  return parseJson<LookupMutationResult>(res);
}

/** Sort options + persist sort_order (storage: 64GB → 1TB). */
export async function sortLookupItems(categoryCode: string): Promise<LookupMutationResult> {
  const res = await fetch(`/api/inventory/lookups/${encodeURIComponent(categoryCode)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sort" }),
  });
  return parseJson<LookupMutationResult>(res);
}
