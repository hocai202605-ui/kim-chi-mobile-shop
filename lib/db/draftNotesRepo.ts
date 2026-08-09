import type { StoreId } from "@/types";
import { formatVnDateTime } from "@/lib/datetime";
import { getPool } from "./pool";

export type DraftNote = {
  id: string;
  storeId: Exclude<StoreId, "all">;
  content: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type DraftNoteInput = {
  id?: string;
  storeId: Exclude<StoreId, "all">;
  content: string;
  actorUsername?: string;
};

export type DraftNoteListFilters = {
  storeId?: StoreId;
  query?: string;
};

type DraftNoteRow = {
  id: string;
  store_id: string;
  content: string;
  created_at: Date | string;
  updated_at: Date | string;
  created_by: string | null;
  updated_by: string | null;
};

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

function mapDraftNote(
  row: DraftNoteRow,
  idToCode: Map<string, Exclude<StoreId, "all">>
): DraftNote {
  return {
    id: String(row.id),
    storeId: idToCode.get(String(row.store_id)) ?? "store-1",
    content: String(row.content ?? ""),
    createdAt: formatVnDateTime(row.created_at),
    updatedAt: formatVnDateTime(row.updated_at),
    createdBy: String(row.created_by ?? ""),
    updatedBy: String(row.updated_by ?? ""),
  };
}

export async function repoListDraftNotes(
  filters: DraftNoteListFilters = {}
): Promise<DraftNote[]> {
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
    where.push(`content ilike $${i++}`);
    params.push(`%${q}%`);
  }

  const { rows } = await getPool().query<DraftNoteRow>(
    `select id, store_id, content, created_at, updated_at, created_by, updated_by
     from public.draft_notes
     where ${where.join(" and ")}
     order by updated_at desc, created_at desc
     limit 500`,
    params
  );

  return rows.map((row) => mapDraftNote(row, idToCode));
}

export async function repoUpsertDraftNote(input: DraftNoteInput): Promise<DraftNote> {
  const { codeToId, idToCode } = await loadStoreMaps();
  const storeUuid = codeToId.get(input.storeId);
  if (!storeUuid) throw new Error(`Không tìm thấy cửa hàng ${input.storeId}.`);

  const content = String(input.content ?? "").trim();
  if (!content) throw new Error("Nội dung ghi nháp không được trống.");
  const actor = normalizeActor(input.actorUsername);

  if (input.id) {
    const { rows } = await getPool().query<DraftNoteRow>(
      `update public.draft_notes set
         store_id = $1,
         content = $2,
         updated_by = coalesce($3, updated_by),
         updated_at = now()
       where id = $4::uuid
         and status = 'active'
       returning id, store_id, content, created_at, updated_at, created_by, updated_by`,
      [storeUuid, content, actor, input.id]
    );
    if (!rows[0]) throw new Error("Không tìm thấy ghi nháp để sửa.");
    return mapDraftNote(rows[0], idToCode);
  }

  const { rows } = await getPool().query<DraftNoteRow>(
    `insert into public.draft_notes (
       store_id, content, status, created_by, updated_by
     ) values ($1,$2,'active',$3,$3)
     returning id, store_id, content, created_at, updated_at, created_by, updated_by`,
    [storeUuid, content, actor]
  );
  if (!rows[0]) throw new Error("Không tạo được ghi nháp.");
  return mapDraftNote(rows[0], idToCode);
}

export async function repoCancelDraftNote(
  id: string,
  actorUsername?: string
): Promise<DraftNote> {
  const { idToCode } = await loadStoreMaps();
  const actor = normalizeActor(actorUsername);
  const { rows } = await getPool().query<DraftNoteRow>(
    `update public.draft_notes set
       status = 'cancelled',
       updated_by = coalesce($2, updated_by),
       updated_at = now()
     where id = $1::uuid
       and status = 'active'
     returning id, store_id, content, created_at, updated_at, created_by, updated_by`,
    [id, actor]
  );
  if (!rows[0]) throw new Error("Không tìm thấy ghi nháp để hủy.");
  return mapDraftNote(rows[0], idToCode);
}
