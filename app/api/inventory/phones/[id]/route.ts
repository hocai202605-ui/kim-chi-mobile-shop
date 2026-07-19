import { NextResponse } from "next/server";
import { repoDeletePhone } from "@/lib/db/inventoryRepo";

export const dynamic = "force-dynamic";

/** DELETE — xóa cứng máy (khỏi grid/DB). */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = await repoDeletePhone(params.id);
    return NextResponse.json({ data: deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi xóa máy";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
