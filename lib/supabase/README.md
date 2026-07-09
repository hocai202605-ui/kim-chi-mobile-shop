# `lib/supabase/`

| File | Vai trò |
|---|---|
| `config.ts` | env + `useSupabaseInventory()` flag |
| `client.ts` | browser client (`@supabase/supabase-js`) |
| `types.ts` | row types inventory |
| `errors.ts` | map lỗi RPC → tiếng Việt |

## Env

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_USE_SUPABASE_INVENTORY=true
```

**Không** đưa `service_role` hay DB password vào browser.

## Schema

- Context: `.agents/context/db-inventory-schema.md`
- Migration: `supabase/migrations/20260709100001_inventory_foundation.sql`

## Auth

RLS cần session. Tạo user trong Supabase Auth, promote owner:

```sql
update public.profiles set role = 'owner' where email = 'you@email.com';
```
