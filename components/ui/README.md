# `components/ui/`

Primitive UI tái sử dụng toàn app (không gắn 1 màn cụ thể).

## Ứng viên tách từ `app/page.tsx`

| Component | Mô tả |
|---|---|
| `StatCard` | KPI card |
| `Panel` | Card section + title |
| `Field` | Label + control |
| `SelectField` | Select form |
| `MoneyInput` | Input tiền vi-VN |
| `ManageableSelect` | Select + CRUD option |
| `StatusBadge` | Pill trạng thái |
| `DataTable` | Bảng dữ liệu |

## Quy tắc

- Chỉ Tailwind + lucide-react theo `AGENTS.md`
- Không fetch / không gọi service ở đây (pure presentational nếu có thể)
