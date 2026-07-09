# Tech Stack Rules — Kim Chi Mobile Shop

Quy tắc bắt buộc khi phát triển / chỉnh sửa project. Mọi thay đổi mới phải tuân thủ stack và design system dưới đây, trừ khi có quyết định nâng cấp rõ ràng (ví dụ: chuyển sang Supabase).

---

## 1. Stack được phép dùng

| Lớp | Công nghệ | Phiên bản tham chiếu |
|---|---|---|
| Framework | **Next.js App Router** (`app/`) | 13.5.x |
| UI runtime | **React** + **React DOM** | 18.x |
| Ngôn ngữ | **TypeScript** (`strict: true`) | 5.x |
| Styling | **Tailwind CSS** + PostCSS + Autoprefixer | 3.4.x |
| Icons | **lucide-react** | 0.468.x |
| Charts | **recharts** | 3.x |

### Scripts chuẩn

```bash
npm run dev    # local
npm run build  # production build
npm run start  # serve build
npm run lint   # eslint-config-next
```

### Backend / data (hiện tại)

- **Chỉ mock state** trong client (`useState` / `useMemo`).
- **Chưa** kết nối database, API thật, hay Supabase client.
- Khi thêm backend: ưu tiên **Supabase** (theo kế hoạch MVP), không tự ý đổi sang stack khác nếu chưa thống nhất.

---

## 2. Stack cấm dùng (trừ khi có quyết định nâng cấp)

Không thêm các thư viện sau nếu chỉ để “làm giống chỗ khác”:

- UI kit: shadcn/ui, Radix-only kits, MUI, Ant Design, Chakra, Bootstrap
- CSS-in-JS / preprocessor: styled-components, Emotion, Sass (thay vì Tailwind)
- State global: Redux, Zustand, Jotai, Recoil (chưa cần ở MVP mock)
- Form lib: React Hook Form, Formik + Zod (chưa bắt buộc; form native + FormData đang là chuẩn)
- Animation lib: Framer Motion (dùng CSS/Tailwind transition hiện có)
- Dark mode framework / theme runtime phức tạp

Nếu cần dependency mới: ghi rõ lý do và giữ tương thích với Tailwind + TypeScript.

---

## 3. Cấu trúc & kiến trúc

Map đầy đủ: [`docs/directory-structure.md`](docs/directory-structure.md).

### Cây chuẩn (AI Agent + Next.js)

```
app/                 # App Router entry (layout, page, globals.css)
components/
  ui/                # Primitive: Panel, DataTable, Field, …
  layout/            # Sidebar, Header, AppShell
  features/<module>/ # UI theo nghiệp vụ (inventory, sales, …)
hooks/               # Custom React hooks
lib/                 # format, constants, utils (+ supabase/ sau)
types/               # Domain TypeScript types
data/mock/           # Seed data MVP
services/            # Nghiệp vụ / data access (mock → Supabase)
public/              # Static assets
docs/                # Tài liệu
.agents/             # Context, rules phụ, plans cho agent (không runtime)
.grok/skills/        # Project-scoped Grok skills
AGENTS.md            # Luật tech stack (file này)
```

### Alias import

```ts
import type { PhoneItem } from "@/types";
import { formatMoney } from "@/lib/format";
import { stores } from "@/lib/constants";
```

### Hiện trạng code

- Phần lớn UI + logic + mock **vẫn** trong `app/page.tsx` (`"use client"`).
- Đã scaffold thư mục + `types/`, `lib/*` để tách dần khi chạm module.
- Điều hướng module bằng `activePage` (chưa multi-route).

### Quy tắc khi mở rộng

1. **Giữ App Router** — không chuyển sang Pages Router.
2. UI primitive → `components/ui/`; shell → `components/layout/`; màn nghiệp vụ → `components/features/<module>/`.
3. Type domain → `types/`. Helpers → `lib/`. Seed → `data/mock/`. CRUD → `services/`.
4. **Không** import file trong `.agents/` vào app runtime.
5. Theme chỉ mở rộng tại `tailwind.config.js` + base `app/globals.css`.
6. Refactor: chỉ tách module đang sửa — không “move cả file” không cần thiết.

---

## 4. Theme & design tokens (bắt buộc)

Nguồn sự thật: `tailwind.config.js`.

| Token | Hex | Dùng cho |
|---|---|---|
| `ink` | `#17201c` | Chữ chính |
| `muted` | `#66736d` | Chữ phụ / hint |
| `line` | `#dce2dc` | Border |
| `canvas` | `#f6f7f3` | Nền trang |
| `brand` | `#0f8b62` | CTA, active nav, logo |
| `brand.dark` | `#086246` | Hover CTA |
| `brand.soft` | `#e2f3eb` | Nền icon / chip |
| `gold` | `#e2b33c` | Nhấn phụ (dùng có chủ đích) |
| `danger` | `#c2412d` | Hủy / lỗi |

### Shadow

- Card/panel: `shadow-panel` (`0 14px 32px rgba(24, 35, 30, 0.09)`).

### Quy tắc màu

1. **Primary brand = xanh lá `brand`** — không đổi sang palette khác cho CTA chính.
2. Light mode only (`color-scheme: light`). Không thêm dark mode trừ khi có yêu cầu sản phẩm.
3. Status:
   - OK → emerald / `ok`
   - Cảnh báo → amber / `warn`
   - Nguy hiểm → red / `danger`
   - Trung tính → slate
4. Sidebar: gradient tối xanh rêu (`#12352a` → `#0d1713`), chữ trắng / slate-300.
5. Nền app: `bg-canvas`, chữ `text-ink`, card `bg-white border-line`.
6. Màu utility Tailwind (slate, sky, amber, fuchsia…) chỉ dùng cho trạng thái / chart / highlight — **không** thay `brand` làm màu chính thương hiệu.

### Typography

- Font stack (globals.css):  
  `Inter, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif`
- UI tiếng Việt; metadata `lang="vi"`.
- Title / số lớn: `font-black` hoặc `font-bold`.
- Label form: `font-black` / `font-bold`; hint: `text-muted` + `font-semibold`.
- Khi thêm font chính thức: dùng `next/font` và cập nhật rule này.

---

## 5. UI patterns (chuẩn tái sử dụng)

### Layout shell

- Desktop: sidebar ~260px + content.
- Sidebar sticky trên `lg+`.
- Header: tiêu đề màn + filter cửa hàng + đăng xuất.
- Lọc cửa hàng global: `all | store-1 | store-2 | store-3`.

### Component nội bộ (ưu tiên reuse, không invent tên mới nếu đã có)

| Component | Mục đích |
|---|---|
| `StatCard` | KPI dashboard |
| `Panel` | Card section + title |
| `Field` | Label + control |
| `SelectField` | Select bắt buộc |
| `MoneyInput` | Tiền format `vi-VN` |
| `ManageableSelect` | Select + thêm/sửa/xóa option |
| `StatusBadge` | Pill trạng thái |
| `DataTable` | Bảng + empty state + chọn dòng |

Khi tách file: giữ API props tương đương để không gãy màn hình.

### Shape & density

- Bo góc: `rounded-lg` (control/card), `rounded-xl` (table/modal), `rounded-full` (badge).
- Chiều cao control: `h-10` / `h-11`.
- CTA primary: `bg-brand text-white font-bold hover:bg-brand-dark`.
- Secondary: `border border-line bg-white`.
- Destructive: `bg-red-50 text-danger` (hoặc tương đương).
- Modal: overlay tối + `backdrop-blur`, card trắng bo lớn, có nút Đóng.

### Icons & charts

- Icon: **lucide-react only** (size ~16–20 trong nút/nav).
- Chart: **recharts**; format tiền tooltip bằng `toLocaleString("vi-VN")`.

### Localization hiển thị

- Tiền: `toLocaleString("vi-VN")` / helpers `formatMoney`, `formatInputMoney`, `parseInputMoney`.
- Copy UI: tiếng Việt.
- Không hard-code locale khác trừ khi có i18n chính thức.

---

## 6. Nghiệp vụ & quyền (khi đụng UI)

- Role: `owner` | `staff`.
- Chỉ **owner** được hủy mềm dữ liệu quan trọng và vào màn Tài khoản.
- Hủy = soft status (`Đã hủy` / `Đã hủy`), **không** xóa vĩnh viễn khỏi state/DB.
- Thao tác nghiệp vụ quan trọng phải `pushLog` (người, cửa hàng, hành động, target).
- Demo login: giữ flow đơn giản cho đến khi có auth Supabase thật.

---

## 7. Checklist trước khi merge / hoàn thành task UI

- [ ] Dùng token `brand` / `canvas` / `line` / `ink` / `muted` thay vì hard-code màu brand tùy tiện
- [ ] Control/button theo pattern height + rounded hiện có
- [ ] Icon lucide-react; chart recharts nếu có biểu đồ
- [ ] Format tiền & copy tiếng Việt
- [ ] Phân quyền owner/staff nếu có hủy / tài khoản
- [ ] Soft-delete + audit log nếu có thao tác ghi
- [ ] Không thêm UI kit / CSS-in-JS / Redux nếu chưa được chốt
- [ ] `npm run lint` / `npm run build` không lỗi (khi task chạm build)

---

## 8. File nguồn liên quan

| File | Vai trò |
|---|---|
| `package.json` | Dependencies |
| `tailwind.config.js` | Design tokens |
| `app/globals.css` | Base + `.phone-pattern` |
| `app/layout.tsx` | Root layout |
| `app/page.tsx` | App MVP hiện tại |
| `Plane-Kim-Chi-Mobile-Shop.md` | Phạm vi MVP & roadmap Supabase |

---

## 9. Tóm tắt một dòng

**Next.js 13 App Router + TypeScript + Tailwind (green retail tokens) + lucide-react + recharts; UI admin tự build; light-only; mock state trước, Supabase sau.**
