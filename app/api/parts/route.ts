import { NextRequest, NextResponse } from "next/server";
import { repoGetAccountByUsername } from "@/lib/db/accountsRepo";
import {
  repoDeletePartInbound,
  repoListPartInbounds,
  repoUpsertPartInbound,
} from "@/lib/db/partsRepo";

export const dynamic = "force-dynamic";

/** Staff khóa CH gán; thiếu actor+store → [] không dump full. */
async function resolveListStore(
  storeParam: string | null,
  actorParam: string | null
): Promise<{ store: string | null; deny: boolean }> {
  const actor = String(actorParam || "").trim();
  const storeRaw = String(storeParam || "").trim();
  const storeScoped = storeRaw && storeRaw !== "all" ? storeRaw : null;

  if (actor) {
    const acc = await repoGetAccountByUsername(actor);
    if (!acc) return { store: null, deny: true };
    if (acc.role === "staff") {
      return { store: acc.storeId, deny: false };
    }
    return { store: storeScoped, deny: false };
  }

  if (!storeScoped) return { store: null, deny: true };
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
