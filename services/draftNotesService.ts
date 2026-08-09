import type { StoreId } from "@/types";
import type {
  DraftNote,
  DraftNoteInput,
  DraftNoteListFilters,
} from "@/lib/db/draftNotesRepo";

export type { DraftNote, DraftNoteInput, DraftNoteListFilters };

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return body.data as T;
}

function toQuery(filters: DraftNoteListFilters = {}): string {
  const p = new URLSearchParams();
  if (filters.storeId && filters.storeId !== "all") p.set("storeId", filters.storeId);
  if (filters.query) p.set("query", filters.query);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function listDraftNotes(
  filters: DraftNoteListFilters = {}
): Promise<DraftNote[]> {
  const res = await fetch(`/api/draft-notes${toQuery(filters)}`, { cache: "no-store" });
  return parseJson<DraftNote[]>(res);
}

export async function upsertDraftNote(input: DraftNoteInput): Promise<DraftNote> {
  const res = await fetch("/api/draft-notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<DraftNote>(res);
}

export async function cancelDraftNote(
  id: string,
  actorUsername?: string
): Promise<DraftNote> {
  const res = await fetch("/api/draft-notes", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, actorUsername }),
  });
  return parseJson<DraftNote>(res);
}

export type DraftNoteStoreParam = StoreId;
