import { NextRequest, NextResponse } from "next/server";
import { repoListCustomers, repoUpsertCustomer } from "@/lib/db/customersRepo";
import { isMaxConnSessionError } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await repoListCustomers();
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi tải khách hàng";
    if (isMaxConnSessionError(err)) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await repoUpsertCustomer({
      id: body?.id ? String(body.id) : undefined,
      name: String(body?.name ?? ""),
      phone: body?.phone != null ? String(body.phone) : "",
      note: body?.note != null ? String(body.note) : "",
      actorUsername: body?.actorUsername ? String(body.actorUsername) : undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi lưu khách hàng";
    if (isMaxConnSessionError(err)) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
