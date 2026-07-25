import { NextRequest, NextResponse } from "next/server";
import {
  repoCancelOwnDebt,
  repoListOwnDebts,
  repoUpsertOwnDebt,
  type OwnDebtStatus,
} from "@/lib/db/ownDebtsRepo";
import { isMaxConnSessionError } from "@/lib/db/pool";
import type { StoreId } from "@/types";

export const dynamic = "force-dynamic";

function parseStoreId(raw: string | null | undefined): StoreId | undefined {
  const s = String(raw ?? "").trim();
  if (s === "all" || s === "store-1" || s === "store-2" || s === "store-3") return s;
  return undefined;
}

function parseStatus(raw: string | null | undefined): OwnDebtStatus | "all" | undefined {
  const s = String(raw ?? "").trim();
  if (s === "all" || s === "open" || s === "paid" || s === "cancelled") return s;
  return undefined;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const data = await repoListOwnDebts({
      storeId: parseStoreId(sp.get("storeId")),
      status: parseStatus(sp.get("status")),
      dateFrom: sp.get("dateFrom") || undefined,
      dateTo: sp.get("dateTo") || undefined,
      query: sp.get("query") || undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi tải mình nợ";
    if (isMaxConnSessionError(err)) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const storeId = String(body?.storeId || "").trim();
    if (storeId !== "store-1" && storeId !== "store-2" && storeId !== "store-3") {
      return NextResponse.json({ error: "Cửa hàng không hợp lệ." }, { status: 400 });
    }
    const data = await repoUpsertOwnDebt({
      id: body?.id ? String(body.id) : undefined,
      storeId,
      creditorName: String(body?.creditorName ?? ""),
      debtType: String(body?.debtType ?? ""),
      amount: Number(body?.amount) || 0,
      debtDate: body?.debtDate ? String(body.debtDate) : undefined,
      note: String(body?.note ?? ""),
      actorUsername:
        typeof body?.actorUsername === "string" ? body.actorUsername : undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi lưu mình nợ";
    if (isMaxConnSessionError(err)) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "Thiếu id khoản mình nợ." }, { status: 400 });
    }
    const actorUsername =
      typeof body?.actorUsername === "string" ? body.actorUsername : undefined;
    const data = await repoCancelOwnDebt(id, actorUsername);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi hủy mình nợ";
    if (isMaxConnSessionError(err)) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
