import { NextRequest, NextResponse } from "next/server";
import { repoReportYearly } from "@/lib/db/inventoryRepo";
import type { StoreId } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const year = Number(req.nextUrl.searchParams.get("year") || new Date().getFullYear());
    const store = (req.nextUrl.searchParams.get("store") || "all") as StoreId;
    const data = await repoReportYearly(year, store);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi báo cáo năm";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
