/** Public Supabase env — never put service_role here. */

export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;
}

export function getSupabaseAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || undefined;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

/**
 * @deprecated Inventory always uses server API + Postgres (DIRECT_URL).
 * Kept for any residual imports; returns true when public Supabase URL is set.
 */
export function useSupabaseInventory(): boolean {
  return isSupabaseConfigured();
}
