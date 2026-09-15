import type { StoreId } from "@/types";
import { formatVnDateTime } from "@/lib/datetime";
import { getPool } from "./pool";

export type ToolNote = {
  id: string;
  storeId: Exclude<StoreId, "all">;
  title: string;
  account: string;
  password: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type ToolNoteInput = {
  id?: string;
  storeId: Exclude<StoreId, "all">;
  title: string;
  account: string;
  password: string;
  actorUsername?: string;
};

export type ToolNoteListFilters = {
  storeId?: StoreId;
  query?: string;
  username?: string;
};

type ToolNoteRow = {
  id: string;
  store_id: string;
  title: string;
  account: string;
  password: string;
  created_at: Date | string;
  updated_at: Date | string;
  created_by: string | null;
  updated_by: string | null;
};

const TOOL_NOTE_COLUMNS =
  "id, store_id, title, account, password, created_at, updated_at, created_by, updated_by";

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

function mapToolNote(
  row: ToolNoteRow,
  idToCode: Map<string, Exclude<StoreId, "all">>
): ToolNote {
  return {
    id: String(row.id),
    storeId: idToCode.get(String(row.store_id)) ?? "store-1",
    title: String(row.title ?? ""),
    account: String(row.account ?? ""),
    password: String(row.password ?? ""),
    createdAt: formatVnDateTime(row.created_at),
    updatedAt: formatVnDateTime(row.updated_at),
    createdBy: String(row.created_by ?? ""),
    updatedBy: String(row.updated_by ?? ""),
  };
}

export async function repoListToolNotes(
  filters: ToolNoteListFilters = {}
): Promise<ToolNote[]> {
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
      `(title ilike $${i} or account ilike $${i} or password ilike $${i})`
    );
    params.push(`%${q}%`);
    i += 1;
  }

  const username = String(filters.username ?? "").trim();
  if (username) {
    where.push(`lower(created_by) = lower($${i++})`);
    params.push(username);
  }

  const { rows } = await getPool().query<ToolNoteRow>(
    `select ${TOOL_NOTE_COLUMNS}
     from public.tool_notes
     where ${where.join(" and ")}
     order by updated_at desc, created_at desc
     limit 500`,
    params
  );

  return rows.map((row) => mapToolNote(row, idToCode));
}

export async function repoUpsertToolNote(input: ToolNoteInput): Promise<ToolNote> {
  const { codeToId, idToCode } = await loadStoreMaps();
  const storeUuid = codeToId.get(input.storeId);
  if (!storeUuid) throw new Error(`Không tìm thấy cửa hàng ${input.storeId}.`);

  const title = String(input.title ?? "").trim();
  const account = String(input.account ?? "").trim();
  const password = String(input.password ?? "").trim();
  if (!account) throw new Error("Tài khoản không được trống.");
  const actor = normalizeActor(input.actorUsername);

  if (input.id) {
    const { rows } = await getPool().query<ToolNoteRow>(
      `update public.tool_notes set
         store_id = $1,
         title = $2,
         account = $3,
         password = $4,
         updated_by = coalesce($5, updated_by),
         updated_at = now()
       where id = $6::uuid
         and status = 'active'
       returning ${TOOL_NOTE_COLUMNS}`,
      [storeUuid, title, account, password, actor, input.id]
    );
    if (!rows[0]) throw new Error("Không tìm thấy tools để sửa.");
    return mapToolNote(rows[0], idToCode);
  }

  const { rows } = await getPool().query<ToolNoteRow>(
    `insert into public.tool_notes (
       store_id, title, account, password, status, created_by, updated_by
     ) values ($1,$2,$3,$4,'active',$5,$5)
     returning ${TOOL_NOTE_COLUMNS}`,
    [storeUuid, title, account, password, actor]
  );
  if (!rows[0]) throw new Error("Không tạo được tools.");
  return mapToolNote(rows[0], idToCode);
}

export async function repoCancelToolNote(
  id: string,
  actorUsername?: string
): Promise<ToolNote> {
  const { idToCode } = await loadStoreMaps();
  const actor = normalizeActor(actorUsername);
  const { rows } = await getPool().query<ToolNoteRow>(
    `update public.tool_notes set
       status = 'cancelled',
       updated_by = coalesce($2, updated_by),
       updated_at = now()
     where id = $1::uuid
       and status = 'active'
     returning ${TOOL_NOTE_COLUMNS}`,
    [id, actor]
  );
  if (!rows[0]) throw new Error("Không tìm thấy tools để hủy.");
  return mapToolNote(rows[0], idToCode);
}
