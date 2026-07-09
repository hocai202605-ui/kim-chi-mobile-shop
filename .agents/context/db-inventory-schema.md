# Supabase schema — Kho hàng & Báo cáo kho

**Status:** Applied to project DB (2026-07-09)  
**Migration:** `supabase/migrations/20260709100001_inventory_foundation.sql`  
**Scope:** inventory + inventory reports + shared config. No full ledger module.

## Tables

| Table | Purpose |
|---|---|
| `stores` | 3 cửa hàng (`store-1`…`store-3`) |
| `profiles` | 1:1 `auth.users`; role owner/staff; home store |
| `app_params` | Key/value config scalar |
| `lookup_categories` | Driplist groups (brand, color, …) |
| `lookup_items` | Driplist options (add/edit/hide) |
| `phones` | 1 row / IMEI |
| `accessories` | Qty stock per store + code |
| `customers` | Thin CRM for sales FK |
| `sales` | Sale header (report source) |
| `sale_items` | Sale lines + stock FKs |
| `audit_logs` | Append-only audit |

## Enums

- `app_role`: owner | staff  
- `param_value_type`: text | number | boolean | json  
- `lookup_scope`: shared | inventory_phone | inventory_accessory | report  
- `phone_status`: in_stock | sold | pending | cancelled → Còn hàng / Đã bán / Chưa xử lý / Đã hủy  
- `accessory_status`: in_stock | out_of_stock | cancelled  
- `sale_status`: completed | cancelled  
- `sale_item_type`: phone | accessory  
- `payment_method`: cash | transfer | card | other  

Money: **bigint VND**. Soft-delete via status.

## Key constraints

- `phones.imei` global unique (incl. cancelled)  
- `accessories (store_id, code)` unique when not cancelled  
- `sale_items (phone_id)` unique where `sale_status = completed` (re-sell after cancel)  

## Lookup (dynamic driplist)

Categories seed: `phone_brand`, `phone_model_name`, `phone_color`, `phone_storage`, `phone_made_in`, `phone_condition`, `phone_battery_condition`, `phone_battery_capacity`, `accessory_code_prefix`.

| RPC | Who | Behavior |
|---|---|---|
| `lookup_list(code)` | auth | active items |
| `lookup_item_add(code, label)` | staff/owner | insert or **reactivate** inactive same code |
| `lookup_item_update(id, …)` | owner all; staff own items | |
| `lookup_item_deactivate(id)` | owner | soft hide |

Form values on phones are **text snapshots** (not FK to lookup_items).

## Inventory / sales RPCs

| RPC | Notes |
|---|---|
| `cancel_phone` / `restore_phone` | owner |
| `cancel_accessory` / `restore_accessory` | owner; restore checks code conflict |
| `create_sale` | stock mutation; server computes amount/profit |
| `cancel_sale` | owner; restores stock |

## Report RPCs

| RPC | UI map |
|---|---|
| `report_inventory_monthly(ym, store?)` | sold_phones, revenue, profit |
| `report_inventory_yearly(year, store?)` | 12 months series |
| `report_inventory_capital(store?)` | capital; pending excluded unless param true |

## RLS summary

- Staff: home `store_id` only for phones/accessories/sales; no cancel.  
- Owner: all stores + soft cancel.  
- Lookup: all auth read active; staff can add when `allow_user_add`.  
- RLS enabled on all tables from create.

## App params seed

- `inventory.phone_list_page_size` = 10  
- `inventory.capital_include_pending` = false  
- `inventory.imei_unique_global` = true  
- `report.timezone` = Asia/Ho_Chi_Minh  

## App backend (Next.js)

| Layer | Path |
|---|---|
| Client | `lib/supabase/client.ts` |
| Services | `services/inventoryService.ts`, `lookupService.ts`, `inventoryReportService.ts`, `authService.ts` |
| Mappers | `lib/mappers/inventory.ts` |
| Flag | `NEXT_PUBLIC_USE_SUPABASE_INVENTORY=true` |

Default flag off → UI mock. Flag on → login Auth + load/save kho.

## Apply migration locally

```bash
# Session-mode pooler URL (migrations)
set DIRECT_URL=postgresql://...
node scripts/apply-migration.js
```

**Never commit** real `DIRECT_URL` / passwords. Use `.env.local` (gitignored).

## Promote first owner (SQL editor / service role)

```sql
update public.profiles
set role = 'owner'
where email = 'owner@yourdomain.com';
```
