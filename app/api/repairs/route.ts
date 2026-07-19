import { NextRequest, NextResponse } from "next/server";
import { repoGetAccountByUsername } from "@/lib/db/accountsRepo";
import {
  repoDeleteRepairOrder,
  repoListRepairOrders,
  repoMarkRepairOrdersPaid,
  repoUpsertRepairOrder,
} from "@/lib/db/repairRepo";

export const dynamic = "force-dynamic";

/**
 * Xác định phạm vi list:
 * - staff + actor hợp lệ → luôn CH gán (bắt buộc)
 * - owner + store=all|null → all
 * - owner + store-x → store-x
 * - thiếu actor → chỉ cho phép khi có store-x (không bao giờ full dump)
 * - không xác định được → [] (deny)
 */
async function resolveListStore(
  storeParam: string | null,
  actorParam: string | null
): Promise<{ store: string | null; deny: boolean }> {
  const actor = String(actorParam || "").trim();
  const storeRaw = String(storeParam || "").trim();
  const storeScoped =
    storeRaw && storeRaw !== "all" ? storeRaw : null;

  if (actor) {
    const acc = await repoGetAccountByUsername(actor);
    if (!acc) {
      return { store: null, deny: true };
    }
    if (acc.role === "staff") {
      // Staff tuyệt đối không xem CH khác / full list
      return { store: acc.storeId, deny: false };
    }
    // owner
    return { store: storeScoped, deny: false };
  }

  // Không có actor: không cho full list
  if (!storeScoped) {
    return { store: null, deny: true };
  }
  return { store: storeScoped, deny: false };
}

export async function GET(req: NextRequest) {
  try {
    const storeParam = req.nextUrl.searchParams.get("store");
    const actorParam = req.nextUrl.searchParams.get("actor");
    const { store, deny } = await resolveListStore(storeParam, actorParam);
    if (deny) {
      return NextResponse.json({ data: [] });
    }
    const rows = await repoListRepairOrders(store);
    return NextResponse.json({ data: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi tải đơn sửa chữa";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body?.action === "mark-paid") {
      const ids = Array.isArray(body.ids)
        ? body.ids.map((x: unknown) => String(x ?? "").trim()).filter(Boolean)
        : [];
      if (!ids.length) {
        return NextResponse.json({ error: "Chưa chọn đơn để thanh toán." }, { status: 400 });
      }
      const actorUsername =
        typeof body.actorUsername === "string" ? body.actorUsername : undefined;
      const updated = await repoMarkRepairOrdersPaid(ids, actorUsername);
      return NextResponse.json({ data: updated });
    }
    if (typeof body?.actorUsername === "string" && body.actorUsername.trim()) {
      const acc = await repoGetAccountByUsername(body.actorUsername.trim());
      if (acc?.role === "staff") {
        body.storeId = acc.storeId;
      }
    }
    const saved = await repoUpsertRepairOrder(body);
    return NextResponse.json({ data: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi lưu đơn sửa chữa";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const id =
      (typeof body?.id === "string" && body.id) ||
      req.nextUrl.searchParams.get("id") ||
      "";
    const deleted = await repoDeleteRepairOrder(id);
    return NextResponse.json({ data: deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi xóa đơn sửa chữa";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
