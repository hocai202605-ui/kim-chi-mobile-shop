import { NextResponse } from "next/server";
import { repoCancelAccessory } from "@/lib/db/inventoryRepo";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const saved = await repoCancelAccessory(params.id);
    return NextResponse.json({ data: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi hủy phụ kiện";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
