import { NextRequest, NextResponse } from "next/server";
import { repoGetAccountByUsername } from "@/lib/db/accountsRepo";
import {
  repoHidePartCatalog,
  repoPatchPartCatalog,
} from "@/lib/db/partsCatalogRepo";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const id = String(ctx.params?.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
    }
    const body = await req.json();
    if (typeof body?.actorUsername === "string" && body.actorUsername.trim()) {
      const acc = await repoGetAccountByUsername(body.actorUsername.trim());
      if (acc?.role === "staff" && body.status === "hidden") {
        return NextResponse.json(
          { error: "Chỉ chủ cửa hàng được ẩn dòng linh kiện." },
          { status: 403 }
        );
      }
    }
    const saved = await repoPatchPartCatalog({ ...body, id });
    return NextResponse.json({ data: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi cập nhật linh kiện";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const id = String(ctx.params?.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const actor =
      typeof body?.actorUsername === "string" ? body.actorUsername.trim() : "";
    if (actor) {
      const acc = await repoGetAccountByUsername(actor);
      if (acc?.role === "staff") {
        return NextResponse.json(
          { error: "Chỉ chủ cửa hàng được ẩn dòng linh kiện." },
          { status: 403 }
        );
      }
    }
    const saved = await repoHidePartCatalog(id, actor || undefined);
    return NextResponse.json({ data: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi ẩn linh kiện";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
