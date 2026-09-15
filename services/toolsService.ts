import type { StoreId } from "@/types";
import type {
  ToolNote,
  ToolNoteInput,
  ToolNoteListFilters,
} from "@/lib/db/toolsRepo";

export type { ToolNote, ToolNoteInput, ToolNoteListFilters };

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return body.data as T;
}

function toQuery(filters: ToolNoteListFilters = {}): string {
  const p = new URLSearchParams();
  if (filters.storeId && filters.storeId !== "all") p.set("storeId", filters.storeId);
  if (filters.query) p.set("query", filters.query);
  if (filters.username) p.set("username", filters.username);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function listToolNotes(
  filters: ToolNoteListFilters = {}
): Promise<ToolNote[]> {
  const res = await fetch(`/api/tools${toQuery(filters)}`, { cache: "no-store" });
  return parseJson<ToolNote[]>(res);
}

export async function upsertToolNote(input: ToolNoteInput): Promise<ToolNote> {
  const res = await fetch("/api/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<ToolNote>(res);
}

export async function cancelToolNote(
  id: string,
  actorUsername?: string
): Promise<ToolNote> {
  const res = await fetch("/api/tools", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, actorUsername }),
  });
  return parseJson<ToolNote>(res);
}

export type ToolNoteStoreParam = StoreId;
