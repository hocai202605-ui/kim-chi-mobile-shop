import { NextResponse } from "next/server";
import { repoDeleteAccessory } from "@/lib/db/inventoryRepo";

export const dynamic = "force-dynamic";

/** DELETE — xóa cứng phụ kiện (khỏi grid/DB). */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = await repoDeleteAccessory(params.id);
    return NextResponse.json({ data: deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi xóa phụ kiện";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
