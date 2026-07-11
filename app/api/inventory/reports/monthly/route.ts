import { NextRequest, NextResponse } from "next/server";
import { vnNowMonth } from "@/lib/datetime";
import { repoReportMonthly } from "@/lib/db/inventoryRepo";
import type { StoreId } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ym = req.nextUrl.searchParams.get("ym") || vnNowMonth();
    const store = (req.nextUrl.searchParams.get("store") || "all") as StoreId;
    const data = await repoReportMonthly(ym, store);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi báo cáo tháng";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
