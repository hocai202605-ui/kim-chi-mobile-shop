import { NextRequest, NextResponse } from "next/server";
import { repoGetAccountByUsername } from "@/lib/db/accountsRepo";
import {
  repoDeletePartInbound,
  repoListPartInbounds,
  repoUpsertPartInbound,
} from "@/lib/db/partsRepo";

export const dynamic = "force-dynamic";

/** Staff khóa CH gán; thiếu actor → lỗi (không trả [] im lặng). Owner store=all → full. */
async function resolveListStore(
  storeParam: string | null,
  actorParam: string | null
): Promise<{ store: string | null; error?: string }> {
  const actor = String(actorParam || "").trim();
  const storeRaw = String(storeParam || "").trim();
  const storeScoped = storeRaw && storeRaw !== "all" ? storeRaw : null;

  if (actor) {
    const acc = await repoGetAccountByUsername(actor);
    if (!acc) {
      return { store: null, error: `Không tìm thấy tài khoản «${actor}».` };
    }
    if (acc.role === "staff") {
      if (!acc.storeId) {
        return { store: null, error: "Tài khoản staff thiếu cửa hàng gán." };
      }
      return { store: acc.storeId };
    }
    // owner: all | store-1|2|3
    return { store: storeScoped };
  }

  // Không có actor: chỉ cho phép khi đã scope store (tránh dump full)
  if (!storeScoped) {
    return { store: null, error: "Thiếu actor hoặc store khi tải phiếu nhập." };
  }
  return { store: storeScoped };
}

export async function GET(req: NextRequest) {
  try {
    const storeParam = req.nextUrl.searchParams.get("store");
    const actorParam = req.nextUrl.searchParams.get("actor");
    const { store, error } = await resolveListStore(storeParam, actorParam);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    const rows = await repoListPartInbounds(store);
    return NextResponse.json({ data: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi tải phiếu nhập hàng";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (typeof body?.actorUsername === "string" && body.actorUsername.trim()) {
      const acc = await repoGetAccountByUsername(body.actorUsername.trim());
      if (acc?.role === "staff") {
        body.storeId = acc.storeId;
      }
    }
    const saved = await repoUpsertPartInbound(body);
    return NextResponse.json({ data: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi lưu phiếu nhập hàng";
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
    if (!id) {
      return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
    }
    const deleted = await repoDeletePartInbound(id);
    return NextResponse.json({ data: deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi xóa phiếu nhập hàng";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
