# `services/`

Lớp nghiệp vụ / data access. **Không** import React component.

## Inventory (Supabase)

| File | Vai trò |
|---|---|
| `storesService.ts` | Map `store-1` ↔ uuid |
| `inventoryService.ts` | list/upsert/cancel phones & accessories |
| `lookupService.ts` | driplist động (`lookup_list`, add/update/deactivate) |
| `inventoryReportService.ts` | monthly / yearly / capital RPCs |
| `authService.ts` | sign-in Supabase Auth + load `profiles` |

Bật UI: `NEXT_PUBLIC_USE_SUPABASE_INVENTORY=true` + URL/anon key trong `.env.local`.

## Giai đoạn khác

- Mock vẫn là default khi flag tắt.
- Sales / repair / ledger services — chưa wire.
