import { NextResponse } from "next/server";
import { repoListLookupLabels } from "@/lib/db/inventoryRepo";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { category: string } }
) {
  try {
    const labels = await repoListLookupLabels(params.category);
    return NextResponse.json({ data: labels });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi tải danh mục";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
