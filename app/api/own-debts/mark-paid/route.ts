import { NextRequest, NextResponse } from "next/server";
import { repoMarkOwnDebtPaid } from "@/lib/db/ownDebtsRepo";
import { isMaxConnSessionError } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = String(body?.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "Thiếu id khoản mình nợ." }, { status: 400 });
    }
    const actorUsername =
      typeof body?.actorUsername === "string" ? body.actorUsername : undefined;
    const data = await repoMarkOwnDebtPaid(id, actorUsername);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi đánh dấu đã trả";
    if (isMaxConnSessionError(err)) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
