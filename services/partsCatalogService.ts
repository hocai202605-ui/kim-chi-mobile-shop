import type { StoreId } from "@/types";
import type {
  PartCatalogCategory,
  PartCatalogCreateInput,
  PartCatalogItemDto,
  PartCatalogPatchInput,
  PartGradeCell,
} from "@/lib/db/partsCatalogRepo";

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return body.data as T;
}

export type {
  PartCatalogCategory,
  PartCatalogCreateInput,
  PartCatalogItemDto,
  PartCatalogPatchInput,
  PartGradeCell,
};

export async function listPartCatalog(opts?: {
  store?: string | null;
  category?: PartCatalogCategory | null;
  actorUsername?: string | null;
  includeHidden?: boolean;
}): Promise<PartCatalogItemDto[]> {
  const params = new URLSearchParams();
  if (opts?.store && opts.store !== "all") params.set("store", opts.store);
  if (opts?.category) params.set("category", opts.category);
  if (opts?.actorUsername?.trim()) params.set("actor", opts.actorUsername.trim());
  if (opts?.includeHidden) params.set("includeHidden", "1");
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/parts/catalog${q}`, { cache: "no-store" });
  return parseJson<PartCatalogItemDto[]>(res);
}

export async function createPartCatalog(
  input: PartCatalogCreateInput
): Promise<PartCatalogItemDto> {
  const res = await fetch("/api/parts/catalog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<PartCatalogItemDto>(res);
}

export async function patchPartCatalog(
  input: PartCatalogPatchInput
): Promise<PartCatalogItemDto> {
  const res = await fetch(`/api/parts/catalog/${encodeURIComponent(input.id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<PartCatalogItemDto>(res);
}

export async function hidePartCatalog(
  id: string,
  actorUsername?: string
): Promise<PartCatalogItemDto> {
  const res = await fetch(`/api/parts/catalog/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actorUsername }),
  });
  return parseJson<PartCatalogItemDto>(res);
}

export type PartCatalogStoreId = Exclude<StoreId, "all">;
