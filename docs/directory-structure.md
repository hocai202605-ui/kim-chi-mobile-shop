# Cấu trúc thư mục — Kim Chi Mobile Shop

Chuẩn cho project Next.js + AI Agent. Agent **đọc `AGENTS.md` trước**, rồi dùng map này để biết file thuộc đâu.

```
KimChiMobileShop/
├── AGENTS.md                 # Luật tech stack / theme / UI (bắt buộc cho agent)
├── .agents/                  # Context & kế hoạch cho AI Agent (không deploy)
│   ├── README.md
│   ├── rules/                # Rule bổ sung (pointer / module rules)
│   ├── context/              # Tóm tắt domain, glossary, overview
│   └── plans/                # Plan / design doc tạm khi làm feature
├── .grok/
│   └── skills/               # Project-scoped Grok skills (SKILL.md)
├── app/                      # Next.js App Router (entry UI)
│   ├── layout.tsx
│   ├── page.tsx              # MVP hiện tại (sẽ tách dần)
│   └── globals.css
├── components/
│   ├── ui/                   # Primitive tái sử dụng (Panel, DataTable, …)
│   ├── layout/               # Shell: Sidebar, Header, AppShell
│   └── features/             # UI theo nghiệp vụ
│       ├── dashboard/
│       ├── inventory/
│       ├── sales/
│       ├── repairs/
│       ├── software/
│       ├── ledger/
│       ├── customers/
│       ├── accounts/
│       └── logs/
├── hooks/                    # React hooks dùng chung
├── lib/                      # Utilities, constants, helpers thuần
│   └── supabase/             # Client/helpers Supabase (giai đoạn sau)
├── types/                    # Domain types TypeScript
├── data/
│   └── mock/                 # Seed data mock (frontend MVP)
├── services/                 # Lớp nghiệp vụ / API (mock → Supabase)
├── public/                   # Static assets
├── docs/                     # Tài liệu người & agent
├── package.json
├── tailwind.config.js
└── tsconfig.json             # paths: @/*
```

## Quy tắc đặt file (cho agent)

| Muốn thêm… | Đặt vào |
|---|---|
| Button, Panel, bảng, badge | `components/ui/` |
| Sidebar, header, shell | `components/layout/` |
| Màn / form theo module | `components/features/<module>/` |
| Type `PhoneItem`, `Sale`… | `types/` |
| `formatMoney`, constants | `lib/` |
| Seed mock | `data/mock/` |
| Gọi API / CRUD nghiệp vụ | `services/` |
| Hook `useStoreFilter`… | `hooks/` |
| Skill Grok riêng repo | `.grok/skills/<name>/SKILL.md` |
| Plan feature | `.agents/plans/` |
| Ảnh logo, favicon | `public/` |

## Import alias

```ts
import type { PhoneItem } from "@/types";
import { formatMoney } from "@/lib/format";
import { stores } from "@/lib/constants";
```

## Chiến lược refactor từ `app/page.tsx`

1. Tách `types` → `types/index.ts`
2. Tách mock seed → `data/mock/*`
3. Tách helpers → `lib/*`
4. Tách UI primitive → `components/ui/*`
5. Tách từng feature → `components/features/*`
6. `app/page.tsx` chỉ còn compose shell + state hoặc chuyển dần sang route

**Không** di chuyển hàng loạt khi không cần — chỉ tách khi chạm module đó.
