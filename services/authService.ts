import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toInventoryError } from "@/lib/supabase/errors";
import type { DbProfile } from "@/lib/supabase/types";
import type { Role, StoreId, User } from "@/types";
import { getStoreCodeById } from "./storesService";

export type AuthSessionUser = User & { authId: string };

/** Sign in with Supabase Auth email/password; load profiles row. */
export async function signInWithPassword(
  email: string,
  password: string
): Promise<AuthSessionUser> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw toInventoryError(error);
  if (!data.user) throw toInventoryError(new Error("not_authenticated"));

  return loadCurrentUser();
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw toInventoryError(error);
}

export async function loadCurrentUser(): Promise<AuthSessionUser> {
  const supabase = getSupabaseBrowserClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw toInventoryError(authError);
  if (!authData.user) throw toInventoryError(new Error("not_authenticated"));

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  if (error) throw toInventoryError(error);
  const row = profile as DbProfile;
  if (!row.is_active) throw toInventoryError(new Error("Tài khoản đã bị vô hiệu."));

  const storeCode = await getStoreCodeById(row.store_id);

  return {
    id: row.id,
    authId: row.id,
    name: row.full_name,
    email: row.email,
    role: row.role as Role,
    storeId: storeCode as Exclude<StoreId, "all">,
  };
}

export async function getSessionUserOrNull(): Promise<AuthSessionUser | null> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    return await loadCurrentUser();
  } catch {
    return null;
  }
}
