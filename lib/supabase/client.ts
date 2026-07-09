import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "./config";
import { InventoryServiceError } from "./errors";

let browserClient: SupabaseClient | null = null;

/** Browser Supabase client (anon key + user session). */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new InventoryServiceError(
      "Chưa cấu hình NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  if (browserClient) return browserClient;

  browserClient = createClient(getSupabaseUrl()!, getSupabaseAnonKey()!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}
