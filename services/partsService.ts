import type { StoreId } from "@/types";
import type { PartInboundDto, PartInboundUpsertInput } from "@/lib/db/partsRepo";

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return body.data as T;
}

export type { PartInboundDto, PartInboundUpsertInput };

export async function listPartInbounds(
  store?: string | null,
  actorUsername?: string | null
): Promise<PartInboundDto[]> {
  const params = new URLSearchParams();
  if (store && store !== "all") params.set("store", store);
  if (actorUsername?.trim()) params.set("actor", actorUsername.trim());
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/parts${q}`, { cache: "no-store" });
  return parseJson<PartInboundDto[]>(res);
}

export async function upsertPartInbound(
  input: PartInboundUpsertInput
): Promise<PartInboundDto> {
  const res = await fetch("/api/parts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<PartInboundDto>(res);
}

export async function deletePartInbound(id: string): Promise<PartInboundDto> {
  const res = await fetch("/api/parts", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  return parseJson<PartInboundDto>(res);
}

export type PartInboundStoreId = Exclude<StoreId, "all">;
