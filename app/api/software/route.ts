import { NextRequest, NextResponse } from "next/server";
import {
  repoDeleteSoftwareOrder,
  repoListSoftwareOrders,
  repoMarkSoftwareOrdersPaid,
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
    // Bulk: { action: "mark-paid", ids: string[], actorUsername? }
    if (body?.action === "mark-paid") {
      const ids = Array.isArray(body.ids)
        ? body.ids.map((x: unknown) => String(x ?? "").trim()).filter(Boolean)
        : [];
      if (!ids.length) {
        return NextResponse.json({ error: "Chưa chọn đơn để thanh toán." }, { status: 400 });
      }
      const actorUsername =
        typeof body.actorUsername === "string" ? body.actorUsername : undefined;
      const updated = await repoMarkSoftwareOrdersPaid(ids, actorUsername);
      return NextResponse.json({ data: updated });
    }
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
