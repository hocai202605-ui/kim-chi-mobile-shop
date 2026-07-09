import { NextRequest, NextResponse } from "next/server";
import { repoListAccessories, repoUpsertAccessory } from "@/lib/db/inventoryRepo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accessories = await repoListAccessories();
    return NextResponse.json({ data: accessories });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi tải phụ kiện";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const saved = await repoUpsertAccessory(body);
    return NextResponse.json({ data: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi lưu phụ kiện";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
