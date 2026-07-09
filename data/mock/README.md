# `data/mock/`

Seed data frontend MVP (phones, accessories, sales, …).

Khi refactor: chuyển các `*Seed` từ `app/page.tsx` vào đây, ví dụ:

- `users.ts`
- `phones.ts`
- `accessories.ts`
- `sales.ts`
- `repairs.ts`
- `ledger.ts`
- `index.ts` — re-export

Sau khi có Supabase: giữ mock cho storybook/dev offline hoặc xóa dần.
