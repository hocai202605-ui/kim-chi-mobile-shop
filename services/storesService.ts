import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toInventoryError } from "@/lib/supabase/errors";
import type { DbStore } from "@/lib/supabase/types";
import type { StoreId } from "@/types";

export type StoreRecord = {
  id: string;
  code: Exclude<StoreId, "all">;
  name: string;
};

let cache: StoreRecord[] | null = null;
let codeToId: Map<string, string> | null = null;
let idToCode: Map<string, Exclude<StoreId, "all">> | null = null;

function buildMaps(rows: StoreRecord[]) {
  codeToId = new Map(rows.map((r) => [r.code, r.id]));
  idToCode = new Map(rows.map((r) => [r.id, r.code]));
}

export async function listStores(force = false): Promise<StoreRecord[]> {
  if (cache && !force) return cache;

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("stores")
    .select("id, code, name, is_active")
    .eq("is_active", true)
    .order("code");

  if (error) throw toInventoryError(error);

  cache = ((data ?? []) as DbStore[]).map((row) => ({
    id: row.id,
    code: row.code as Exclude<StoreId, "all">,
    name: row.name,
  }));
  buildMaps(cache);
  return cache;
}

export async function getStoreIdByCode(code: Exclude<StoreId, "all">): Promise<string> {
  await listStores();
  const id = codeToId?.get(code);
  if (!id) throw toInventoryError(new Error(`store_not_found:${code}`));
  return id;
}

export async function getStoreCodeById(id: string): Promise<Exclude<StoreId, "all">> {
  await listStores();
  return idToCode?.get(id) ?? "store-1";
}

export async function getStoreMaps(): Promise<{
  codeToId: Map<string, string>;
  idToCode: Map<string, Exclude<StoreId, "all">>;
}> {
  await listStores();
  return {
    codeToId: codeToId ?? new Map(),
    idToCode: idToCode ?? new Map(),
  };
}

export function clearStoreCache() {
  cache = null;
  codeToId = null;
  idToCode = null;
}
