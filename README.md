# Kim Chi Mobile Shop

Frontend MVP cho hệ thống quản lý nội bộ 3 cửa hàng điện thoại.

## Công nghệ

- Next.js App Router
- TypeScript
- Tailwind CSS
- lucide-react
- recharts
- Supabase sẽ được tích hợp ở giai đoạn backend/database sau

## Chạy local

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`.

## Cửa hàng (cơ sở)

| Code | Tên |
|------|-----|
| `store-1` | Kim Chi Mobile |
| `store-2` | Kiều Vy Mobile |
| `store-3` | Cao Bắc Mobile |

Dữ liệu máy hiện tại gắn **Kim Chi Mobile** (`store-1`). Owner lọc “Toàn hệ thống” / từng cơ sở; staff chỉ xem cửa hàng được gán.

## Tài khoản demo (Postgres `app_accounts`)

| User | Role | Cửa hàng | Menu |
|------|------|----------|------|
| `admin` | owner · full | Kim Chi Mobile | Tất cả + quản lý menu, đổi pass, active/inactive |
| `quynhbupbe` | owner · full | Kim Chi Mobile | Tất cả + quản lý menu, đổi pass, active/inactive |
| `kimchi` | staff | Kim Chi Mobile (`store-1`) | Kho hàng |
| `kieuvy` | staff | Kiều Vy Mobile (`store-2`) | Kho hàng |
| `caobac` | staff | Cao Bắc Mobile (`store-3`) | Kho hàng |

Mật khẩu mặc định seed: `123456`. Owner đổi pass / bật-tắt user trong màn **Tài khoản**.

## Cấu trúc thư mục (AI Agent)

Xem chi tiết: [`docs/directory-structure.md`](docs/directory-structure.md)

| Đường dẫn | Vai trò |
|---|---|
| `AGENTS.md` | Luật tech stack / theme / UI cho agent |
| `.agents/` | Context, rules phụ, plans (không runtime) |
| `.grok/skills/` | Skill Grok theo project |
| `app/` | Next.js App Router |
| `components/ui` | Component UI dùng chung |
| `components/layout` | Sidebar, header, shell |
| `components/features/*` | UI theo nghiệp vụ |
| `hooks/` | React hooks |
| `lib/` | Utils, format, constants |
| `types/` | Domain types |
| `data/mock/` | Seed data mock |
| `services/` | Lớp nghiệp vụ / API |
| `public/` | Static assets |
| `docs/` | Tài liệu |

Import alias: `@/*` (ví dụ `@/types`, `@/lib/format`).
