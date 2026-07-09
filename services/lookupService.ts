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

export async function listLookupLabels(categoryCode: string): Promise<string[]> {
  const res = await fetch(`/api/inventory/lookups/${encodeURIComponent(categoryCode)}`, {
    cache: "no-store",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return (body.data ?? []) as string[];
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

export async function addLookupItem(_categoryCode: string, _label: string): Promise<LookupItem> {
  throw new Error("Thêm option lookup qua UI ManageableSelect local; API add sẽ bổ sung sau.");
}

export async function updateLookupItem(
  _id: string,
  _patch: { label?: string; sortOrder?: number }
): Promise<LookupItem> {
  throw new Error("updateLookupItem chưa hỗ trợ qua API.");
}

export async function deactivateLookupItem(_id: string): Promise<void> {
  throw new Error("deactivateLookupItem chưa hỗ trợ qua API.");
}
