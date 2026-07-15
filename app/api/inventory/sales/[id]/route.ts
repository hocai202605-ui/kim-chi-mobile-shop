import { NextRequest, NextResponse } from "next/server";
import { repoCancelSale, repoGetSale } from "@/lib/db/inventoryRepo";
import { isMaxConnSessionError } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/** Chi tiết phiếu + dòng hàng. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const id = String(ctx.params?.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "Thiếu mã phiếu." }, { status: 400 });
    }
    const data = await repoGetSale(id);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi tải phiếu bán";
    if (isMaxConnSessionError(err)) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    const status = message.includes("Không tìm thấy") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

/** Hủy mềm phiếu bán. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const id = String(ctx.params?.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "Thiếu mã phiếu." }, { status: 400 });
    }
    let actorUsername: string | undefined;
    try {
      const body = await req.json();
      if (body?.actorUsername) actorUsername = String(body.actorUsername);
    } catch {
      /* no body */
    }
    const data = await repoCancelSale(id, actorUsername);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi hủy phiếu bán";
    if (isMaxConnSessionError(err)) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
