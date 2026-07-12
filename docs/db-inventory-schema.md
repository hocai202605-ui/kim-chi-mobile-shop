# Supabase schema — Kho hàng & Báo cáo kho

Canonical agent copy: [`.agents/context/db-inventory-schema.md`](../.agents/context/db-inventory-schema.md)

**Foundation:** `supabase/migrations/20260709100001_inventory_foundation.sql`  
**Row audit:**  
- `20260712120000_row_audit_actor_columns.sql` (timestamps + username tạm)  
- `20260712140000_standardize_created_updated_by.sql` (**chuẩn hóa `created_by` / `updated_by` text**)

## Tables

`stores`, `profiles`, `app_params`, `lookup_categories`, `lookup_items`, `phones`, `accessories`, `customers`, `sales`, `sale_items`, `audit_logs`, `software_orders`, `app_accounts`

## Row audit (truy vết)

| Cột | Ý nghĩa |
|---|---|
| `created_at` | Thời điểm tạo |
| `updated_at` | Thời điểm sửa gần nhất (trigger) |
| **`created_by`** | **Username** `app_accounts` tạo bản ghi (text) |
| **`updated_by`** | **Username** `app_accounts` sửa gần nhất (text) |
| `cancelled_by` | Username hủy (phones / accessories / sales) |
| `*_profile_id` | UUID profiles cũ (nếu có), giữ để không mất dữ liệu |

- Login MVP = **app_accounts** → actor = **text username**, không dùng `auth.uid()`.
- App ghi actor: máy, phụ kiện, phần mềm, bán hàng, lookup, tài khoản, hủy.

## Dynamic driplist

- Categories + items tables power ManageableSelect options.
- Staff can add; owner can hide; re-add same code **reactivates**.

## Reports

RPCs: `report_inventory_monthly`, `report_inventory_yearly`, `report_inventory_capital`.

## Security note

Do not store production DB passwords in git. Use `.env.local` + Supabase dashboard secrets.
