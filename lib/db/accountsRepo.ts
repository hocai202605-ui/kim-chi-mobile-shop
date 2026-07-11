import { ALL_MENU_IDS } from "@/lib/constants";
import { query, withTransaction } from "@/lib/db/pool";
import type { Role, StoreId } from "@/types";

export type AccountDto = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: Role;
  storeId: Exclude<StoreId, "all">;
  allowedMenus: string[];
  isActive: boolean;
};

type AccountRow = {
  id: string;
  username: string;
  display_name: string;
  role: string;
  store_code: string;
  allowed_menus: string[] | null;
  is_active: boolean;
};

function mapRow(row: AccountRow): AccountDto {
  const storeId = (row.store_code || "store-1") as Exclude<StoreId, "all">;
  const role = (row.role === "owner" ? "owner" : "staff") as Role;
  let menus = Array.isArray(row.allowed_menus) ? [...row.allowed_menus] : [];
  // Owner luôn có đủ menu (kể cả accounts)
  if (role === "owner") {
    menus = [...ALL_MENU_IDS];
  }
  return {
    id: row.id,
    username: row.username,
    name: row.display_name,
    email: `${row.username}@kimchi.local`,
    role,
    storeId,
    allowedMenus: menus,
    isActive: row.is_active,
  };
}

const SELECT_PUBLIC = `
  id, username, display_name, role, store_code, allowed_menus, is_active
`;

export async function repoLogin(
  username: string,
  password: string
): Promise<AccountDto> {
  const u = username.trim();
  if (!u || !password) {
    throw new Error("invalid_credentials");
  }

  const { rows } = await query<AccountRow>(
    `select ${SELECT_PUBLIC}
     from public.app_accounts
     where lower(username) = lower($1)
       and is_active
       and password_hash = crypt($2, password_hash)
     limit 1`,
    [u, password]
  );

  if (!rows[0]) throw new Error("invalid_credentials");
  return mapRow(rows[0]);
}

export async function repoGetAccountByUsername(
  username: string,
  opts?: { requireActive?: boolean }
): Promise<AccountDto | null> {
  const requireActive = opts?.requireActive !== false;
  const { rows } = await query<AccountRow>(
    `select ${SELECT_PUBLIC}
     from public.app_accounts
     where lower(username) = lower($1)
       ${requireActive ? "and is_active" : ""}
     limit 1`,
    [username.trim()]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function repoListAccounts(): Promise<AccountDto[]> {
  const { rows } = await query<AccountRow>(
    `select ${SELECT_PUBLIC}
     from public.app_accounts
     order by
       case when role = 'owner' then 0 else 1 end,
       is_active desc,
       lower(username)`
  );
  return rows.map(mapRow);
}

/** Require actor is active owner. */
export async function repoRequireOwner(actorUsername: string): Promise<AccountDto> {
  const actor = await repoGetAccountByUsername(actorUsername, { requireActive: true });
  if (!actor) throw new Error("not_authenticated");
  if (actor.role !== "owner") throw new Error("owner_only");
  return actor;
}

/**
 * Droplist mutate: owner mọi cửa hàng; staff chỉ store được gán.
 * @throws not_authenticated | store_forbidden
 */
export async function repoRequireLookupManage(
  actorUsername: string,
  storeCode: string
): Promise<AccountDto> {
  const actor = await repoGetAccountByUsername(actorUsername, { requireActive: true });
  if (!actor) throw new Error("not_authenticated");
  if (actor.role === "owner") return actor;
  if (actor.role === "staff" && actor.storeId === storeCode) return actor;
  throw new Error("store_forbidden");
}

export async function repoUpdateAllowedMenus(
  accountId: string,
  allowedMenus: string[],
  actorUsername: string
): Promise<AccountDto> {
  return repoUpdateAccount(accountId, actorUsername, { allowedMenus });
}

export type AccountUpdateInput = {
  allowedMenus?: string[];
  isActive?: boolean;
  password?: string;
};

/**
 * Owner updates another account (or self password):
 * - allowedMenus (staff only)
 * - isActive (cannot deactivate self)
 * - password (min 6 chars)
 */
export async function repoUpdateAccount(
  accountId: string,
  actorUsername: string,
  patch: AccountUpdateInput
): Promise<AccountDto> {
  const actor = await repoRequireOwner(actorUsername);

  const hasMenus = Array.isArray(patch.allowedMenus);
  const hasActive = typeof patch.isActive === "boolean";
  const password = typeof patch.password === "string" ? patch.password : undefined;
  const hasPassword = password !== undefined;

  if (!hasMenus && !hasActive && !hasPassword) {
    throw new Error("nothing_to_update");
  }
  if (hasPassword && password!.trim().length < 6) {
    throw new Error("password_too_short");
  }

  return withTransaction(async (client) => {
    const { rows: target } = await client.query<AccountRow>(
      `select ${SELECT_PUBLIC} from public.app_accounts where id = $1 for update`,
      [accountId]
    );
    if (!target[0]) throw new Error("account_not_found");

    if (hasActive && patch.isActive === false && target[0].id === actor.id) {
      throw new Error("cannot_deactivate_self");
    }

    let menus = target[0].allowed_menus ?? [];
    if (hasMenus && target[0].role !== "owner") {
      const cleaned = Array.from(
        new Set((patch.allowedMenus ?? []).map((m) => m.trim()).filter(Boolean))
      );
      menus = cleaned.filter((m) =>
        (ALL_MENU_IDS as readonly string[]).includes(m)
      );
    }

    const nextActive = hasActive ? Boolean(patch.isActive) : target[0].is_active;

    if (hasPassword) {
      const { rows } = await client.query<AccountRow>(
        `update public.app_accounts
         set allowed_menus = $2::text[],
             is_active = $3,
             password_hash = crypt($4, gen_salt('bf'))
         where id = $1
         returning ${SELECT_PUBLIC}`,
        [accountId, menus, nextActive, password!.trim()]
      );
      if (!rows[0]) throw new Error("account_not_found");
      return mapRow(rows[0]);
    }

    const { rows } = await client.query<AccountRow>(
      `update public.app_accounts
       set allowed_menus = $2::text[],
           is_active = $3
       where id = $1
       returning ${SELECT_PUBLIC}`,
      [accountId, menus, nextActive]
    );
    if (!rows[0]) throw new Error("account_not_found");
    return mapRow(rows[0]);
  });
}
