import { NextRequest, NextResponse } from "next/server";
import { repoCancelManualDebt, repoUpsertManualDebt } from "@/lib/db/debtsRepo";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const storeId = String(body?.storeId || "").trim();
    if (storeId !== "store-1" && storeId !== "store-2" && storeId !== "store-3") {
      return NextResponse.json({ error: "Cửa hàng không hợp lệ." }, { status: 400 });
    }
    const saved = await repoUpsertManualDebt({
      id: body?.id ? String(body.id) : undefined,
      storeId,
      customerName: String(body?.customerName ?? ""),
      customerPhone: String(body?.customerPhone ?? ""),
      title: String(body?.title ?? ""),
      amount: Number(body?.amount) || 0,
      debtDate: body?.debtDate ? String(body.debtDate) : undefined,
      dueDate: body?.dueDate ? String(body.dueDate) : undefined,
      note: String(body?.note ?? ""),
      actorUsername: typeof body?.actorUsername === "string" ? body.actorUsername : undefined,
    });
    return NextResponse.json({ data: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi lưu nợ tay";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "Thiếu id nợ tay." }, { status: 400 });
    }
    const actorUsername =
      typeof body?.actorUsername === "string" ? body.actorUsername : undefined;
    const saved = await repoCancelManualDebt(id, actorUsername);
    return NextResponse.json({ data: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi hủy nợ tay";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
