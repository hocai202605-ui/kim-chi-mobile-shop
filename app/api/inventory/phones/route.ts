import { NextRequest, NextResponse } from "next/server";
import { repoListPhones, repoUpsertPhone } from "@/lib/db/inventoryRepo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const phones = await repoListPhones();
    return NextResponse.json({ data: phones });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi tải máy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const saved = await repoUpsertPhone(body);
    return NextResponse.json({ data: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi lưu máy";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
