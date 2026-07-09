# `components/features/`

UI theo **nghiệp vụ**. Mỗi folder = 1 module menu.

| Folder | Module |
|---|---|
| `dashboard/` | Dashboard KPI |
| `inventory/` | Kho máy + phụ kiện |
| `sales/` | Phiếu bán |
| `repairs/` | Sửa chữa (phiếu nhận máy) |
| `software/` | Sửa chữa nhanh / phần mềm service |
| `ledger/` | Thu chi |
| `customers/` | Khách hàng |
| `accounts/` | Tài khoản (owner) |
| `logs/` | Nhật ký thao tác |

## Quy tắc

- Feature component có thể nhận props/state từ page hoặc hooks
- Gọi `services/*` cho CRUD; không nhét query dài trong JSX
- Đặt tên file rõ: `InventoryTable.tsx`, `CreateSaleForm.tsx`, …
