import { NextResponse } from "next/server";
import { repoListDuplicatePhoneGroups } from "@/lib/db/customersRepo";
import { isMaxConnSessionError } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

/** GET — nhóm khách trùng SĐT (chuẩn hóa digits). */
export async function GET() {
  try {
    const data = await repoListDuplicatePhoneGroups();
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi tải SĐT trùng";
    if (isMaxConnSessionError(err)) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
