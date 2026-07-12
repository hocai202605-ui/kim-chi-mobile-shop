import { NextResponse } from "next/server";
import { repoCancelPhone } from "@/lib/db/inventoryRepo";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json().catch(() => ({}));
    const actorUsername =
      typeof body?.actorUsername === "string" ? body.actorUsername : undefined;
    const saved = await repoCancelPhone(params.id, actorUsername);
    return NextResponse.json({ data: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi hủy máy";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
