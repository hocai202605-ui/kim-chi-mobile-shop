import { NextRequest, NextResponse } from "next/server";
import {
  repoDeleteSoftwareOrder,
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

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const id =
      (typeof body?.id === "string" && body.id) ||
      req.nextUrl.searchParams.get("id") ||
      "";
    const deleted = await repoDeleteSoftwareOrder(id);
    return NextResponse.json({ data: deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi xóa đơn phần mềm";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
