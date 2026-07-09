# Supabase schema — Kho hàng & Báo cáo kho

Canonical agent copy: [`.agents/context/db-inventory-schema.md`](../.agents/context/db-inventory-schema.md)

**Migration applied:** `supabase/migrations/20260709100001_inventory_foundation.sql`

## Tables (11)

`stores`, `profiles`, `app_params`, `lookup_categories`, `lookup_items`, `phones`, `accessories`, `customers`, `sales`, `sale_items`, `audit_logs`

## Dynamic driplist

- Categories + items tables power ManageableSelect options.
- Staff can add; owner can hide; re-add same code **reactivates**.

## Reports

RPCs: `report_inventory_monthly`, `report_inventory_yearly`, `report_inventory_capital`.

## Security note

Do not store production DB passwords in git. Use `.env.local` + Supabase dashboard secrets.
