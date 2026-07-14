import { NextRequest, NextResponse } from "next/server";
import { repoListDebts, type DebtSource, type DebtStatus } from "@/lib/db/debtsRepo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const storeId = sp.get("storeId") || "all";
    const source = (sp.get("source") || "all") as DebtSource | "all";
    const status = (sp.get("status") || "open") as DebtStatus | "all";
    const dateFrom = sp.get("dateFrom") || undefined;
    const dateTo = sp.get("dateTo") || undefined;
    const query = sp.get("query") || undefined;

    const data = await repoListDebts({
      storeId: storeId as "all" | "store-1" | "store-2" | "store-3",
      source,
      status,
      dateFrom,
      dateTo,
      query,
    });
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi tải công nợ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
