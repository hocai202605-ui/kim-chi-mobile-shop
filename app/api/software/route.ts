import { NextRequest, NextResponse } from "next/server";
import {
  repoListSoftwareOrders,
  repoUpsertSoftwareOrder,
} from "@/lib/db/softwareRepo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await repoListSoftwareOrders();
    return NextResponse.json({ data: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi tải đơn phần mềm";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const saved = await repoUpsertSoftwareOrder(body);
    return NextResponse.json({ data: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi lưu đơn phần mềm";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
