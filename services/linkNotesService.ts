import type { StoreId } from "@/types";
import type {
  LinkNote,
  LinkNoteInput,
  LinkNoteListFilters,
} from "@/lib/db/linkNotesRepo";

export type { LinkNote, LinkNoteInput, LinkNoteListFilters };

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return body.data as T;
}

function toQuery(filters: LinkNoteListFilters = {}): string {
  const p = new URLSearchParams();
  if (filters.storeId && filters.storeId !== "all") p.set("storeId", filters.storeId);
  if (filters.query) p.set("query", filters.query);
  if (filters.username) p.set("username", filters.username);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function listLinkNotes(
  filters: LinkNoteListFilters = {}
): Promise<LinkNote[]> {
  const res = await fetch(`/api/link-notes${toQuery(filters)}`, { cache: "no-store" });
  return parseJson<LinkNote[]>(res);
}

export async function upsertLinkNote(input: LinkNoteInput): Promise<LinkNote> {
  const res = await fetch("/api/link-notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<LinkNote>(res);
}

export async function cancelLinkNote(
  id: string,
  actorUsername?: string
): Promise<LinkNote> {
  const res = await fetch("/api/link-notes", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, actorUsername }),
  });
  return parseJson<LinkNote>(res);
}
