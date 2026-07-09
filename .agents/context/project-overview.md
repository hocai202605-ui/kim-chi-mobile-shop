# Project overview — Kim Chi Mobile Shop

## Domain

Web quản trị nội bộ cho **3 cửa hàng điện thoại**: kho (máy + phụ kiện), bán hàng, sửa chữa / phần mềm, thu chi, dashboard, nhật ký, tài khoản.

## Vai trò

| Role | Quyền chính |
|---|---|
| `owner` | Toàn quyền, hủy mềm, xem tài khoản, lọc toàn hệ thống |
| `staff` | Thêm/sửa nghiệp vụ hằng ngày, không hủy dữ liệu quan trọng |

## Cửa hàng

- `store-1`, `store-2`, `store-3` (+ filter `all` cho owner)

## Demo login (frontend mock)

- Mật khẩu demo: `123456`
- Email: `owner@kimchi.vn`, `staff@kimchi.vn`, …

## Trạng thái kỹ thuật

- Frontend MVP: Next.js App Router + mock state trong `app/page.tsx`
- Backend: **Supabase** — schema kho + báo cáo kho đã scaffold (migration + applied)
- Soft-delete + audit log bắt buộc với thao tác ghi quan trọng

## Schema DB (kho)

Chi tiết bảng / RPC / RLS: [`db-inventory-schema.md`](./db-inventory-schema.md)  
SQL: `supabase/migrations/20260709100001_inventory_foundation.sql`  
Apply helper: `scripts/apply-migration.js` (cần `DIRECT_URL`)

Xem chi tiết phạm vi: `/Plane-Kim-Chi-Mobile-Shop.md`
