import type { StoreId } from "@/types";
import { formatVnDateTime } from "@/lib/datetime";
import { getPool } from "./pool";

export type LinkNote = {
  id: string;
  storeId: Exclude<StoreId, "all">;
  title: string;
  linkUrl: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type LinkNoteInput = {
  id?: string;
  storeId: Exclude<StoreId, "all">;
  title: string;
  linkUrl: string;
  actorUsername?: string;
};

export type LinkNoteListFilters = {
  storeId?: StoreId;
  query?: string;
  username?: string;
};

type LinkNoteRow = {
  id: string;
  store_id: string;
  title: string;
  link_url: string;
  created_at: Date | string;
  updated_at: Date | string;
  created_by: string | null;
  updated_by: string | null;
};

const LINK_NOTE_COLUMNS =
  "id, store_id, title, link_url, created_at, updated_at, created_by, updated_by";

function normalizeActor(value?: string | null): string | null {
  const t = String(value ?? "").trim();
  return t || null;
}

async function loadStoreMaps(): Promise<{
  codeToId: Map<string, string>;
  idToCode: Map<string, Exclude<StoreId, "all">>;
}> {
  const { rows } = await getPool().query<{ id: string; code: string }>(
    `select id, code from public.stores where is_active = true`
  );
  const codeToId = new Map<string, string>();
  const idToCode = new Map<string, Exclude<StoreId, "all">>();
  for (const r of rows) {
    codeToId.set(r.code, r.id);
    if (r.code === "store-1" || r.code === "store-2" || r.code === "store-3") {
      idToCode.set(r.id, r.code);
    }
  }
  return { codeToId, idToCode };
}

function mapLinkNote(
  row: LinkNoteRow,
  idToCode: Map<string, Exclude<StoreId, "all">>
): LinkNote {
  return {
    id: String(row.id),
    storeId: idToCode.get(String(row.store_id)) ?? "store-1",
    title: String(row.title ?? ""),
    linkUrl: String(row.link_url ?? ""),
    createdAt: formatVnDateTime(row.created_at),
    updatedAt: formatVnDateTime(row.updated_at),
    createdBy: String(row.created_by ?? ""),
    updatedBy: String(row.updated_by ?? ""),
  };
}

export async function repoListLinkNotes(
  filters: LinkNoteListFilters = {}
): Promise<LinkNote[]> {
  const { codeToId, idToCode } = await loadStoreMaps();
  const where = ["status = 'active'"];
  const params: unknown[] = [];
  let i = 1;

  const storeCode = String(filters.storeId ?? "").trim();
  if (storeCode && storeCode !== "all") {
    const storeUuid = codeToId.get(storeCode);
    if (!storeUuid) return [];
    where.push(`store_id = $${i++}`);
    params.push(storeUuid);
  }

  const q = String(filters.query ?? "").trim();
  if (q) {
    where.push(
      `(title ilike $${i} or link_url ilike $${i})`
    );
    params.push(`%${q}%`);
    i += 1;
  }

  const username = String(filters.username ?? "").trim();
  if (username) {
    where.push(`lower(created_by) = lower($${i++})`);
    params.push(username);
  }

  const { rows } = await getPool().query<LinkNoteRow>(
    `select ${LINK_NOTE_COLUMNS}
     from public.link_notes
     where ${where.join(" and ")}
     order by updated_at desc, created_at desc
     limit 500`,
    params
  );

  return rows.map((row) => mapLinkNote(row, idToCode));
}

export async function repoUpsertLinkNote(input: LinkNoteInput): Promise<LinkNote> {
  const { codeToId, idToCode } = await loadStoreMaps();
  const storeUuid = codeToId.get(input.storeId);
  if (!storeUuid) throw new Error(`Không tìm thấy cửa hàng ${input.storeId}.`);

  const title = String(input.title ?? "").trim();
  const linkUrl = String(input.linkUrl ?? "").trim();
  if (!linkUrl) throw new Error("Link không được trống.");
  const actor = normalizeActor(input.actorUsername);

  if (input.id) {
    const { rows } = await getPool().query<LinkNoteRow>(
      `update public.link_notes set
         store_id = $1,
         title = $2,
         link_url = $3,
         updated_by = coalesce($4, updated_by),
         updated_at = now()
       where id = $5::uuid
         and status = 'active'
       returning ${LINK_NOTE_COLUMNS}`,
      [storeUuid, title, linkUrl, actor, input.id]
    );
    if (!rows[0]) throw new Error("Không tìm thấy link để sửa.");
    return mapLinkNote(rows[0], idToCode);
  }

  const { rows } = await getPool().query<LinkNoteRow>(
    `insert into public.link_notes (
       store_id, title, link_url, status, created_by, updated_by
     ) values ($1,$2,$3,'active',$4,$4)
     returning ${LINK_NOTE_COLUMNS}`,
    [storeUuid, title, linkUrl, actor]
  );
  if (!rows[0]) throw new Error("Không tạo được link.");
  return mapLinkNote(rows[0], idToCode);
}

export async function repoCancelLinkNote(
  id: string,
  actorUsername?: string
): Promise<LinkNote> {
  const { idToCode } = await loadStoreMaps();
  const actor = normalizeActor(actorUsername);
  const { rows } = await getPool().query<LinkNoteRow>(
    `update public.link_notes set
       status = 'cancelled',
       updated_by = coalesce($2, updated_by),
       updated_at = now()
     where id = $1::uuid
       and status = 'active'
     returning ${LINK_NOTE_COLUMNS}`,
    [id, actor]
  );
  if (!rows[0]) throw new Error("Không tìm thấy link để hủy.");
  return mapLinkNote(rows[0], idToCode);
}
