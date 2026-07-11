import type { Role, StoreId } from "@/types";

export type AccountUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: Role;
  storeId: Exclude<StoreId, "all">;
  allowedMenus: string[];
  isActive?: boolean;
};

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return body.data as T;
}

export type LoginUserOption = {
  username: string;
  name: string;
  role: Role;
  storeId: Exclude<StoreId, "all">;
};

/** Public list for login droplist (active users only). */
export async function apiListLoginUsers(): Promise<LoginUserOption[]> {
  const res = await fetch("/api/auth/users", { cache: "no-store" });
  return parseJson<LoginUserOption[]>(res);
}

export async function apiLogin(
  username: string,
  password: string
): Promise<AccountUser> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return parseJson<AccountUser>(res);
}

export async function apiListAccounts(actorUsername: string): Promise<AccountUser[]> {
  const qs = new URLSearchParams({ actor: actorUsername });
  const res = await fetch(`/api/accounts?${qs}`, {
    headers: { "x-actor-username": actorUsername },
    cache: "no-store",
  });
  return parseJson<AccountUser[]>(res);
}

export async function apiUpdateAccountMenus(
  accountId: string,
  allowedMenus: string[],
  actorUsername: string
): Promise<AccountUser> {
  return apiUpdateAccount(accountId, actorUsername, { allowedMenus });
}

export async function apiUpdateAccount(
  accountId: string,
  actorUsername: string,
  patch: { allowedMenus?: string[]; isActive?: boolean; password?: string }
): Promise<AccountUser> {
  const res = await fetch(`/api/accounts/${accountId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...patch, actorUsername }),
  });
  return parseJson<AccountUser>(res);
}
