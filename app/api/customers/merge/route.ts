import { NextRequest, NextResponse } from "next/server";
import { repoMergeCustomers } from "@/lib/db/customersRepo";
import { isMaxConnSessionError } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

/** POST { keepId, mergeIds[], actorUsername } — gộp hồ sơ trùng SĐT. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const keepId = String(body?.keepId ?? "").trim();
    const mergeIds = Array.isArray(body?.mergeIds)
      ? body.mergeIds.map((x: unknown) => String(x ?? "").trim()).filter(Boolean)
      : [];
    const data = await repoMergeCustomers({
      keepId,
      mergeIds,
      actorUsername: body?.actorUsername ? String(body.actorUsername) : undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi gộp khách hàng";
    if (isMaxConnSessionError(err)) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
