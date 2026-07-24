import { NextRequest, NextResponse } from "next/server";
import { repoGetAccountByUsername } from "@/lib/db/accountsRepo";
import {
  repoCreatePartCatalog,
  repoListPartCatalog,
  type PartCatalogCategory,
} from "@/lib/db/partsCatalogRepo";

export const dynamic = "force-dynamic";

const CATEGORIES = new Set(["man_android", "man_iphone", "pin"]);

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
    return { store: storeScoped };
  }

  if (!storeScoped) {
    return { store: null, error: "Thiếu actor hoặc store khi tải linh kiện." };
  }
  return { store: storeScoped };
}

export async function GET(req: NextRequest) {
  try {
    const storeParam = req.nextUrl.searchParams.get("store");
    const actorParam = req.nextUrl.searchParams.get("actor");
    const categoryRaw = req.nextUrl.searchParams.get("category");
    const includeHidden = req.nextUrl.searchParams.get("includeHidden") === "1";

    const { store, error } = await resolveListStore(storeParam, actorParam);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const category =
      categoryRaw && CATEGORIES.has(categoryRaw)
        ? (categoryRaw as PartCatalogCategory)
        : null;

    const rows = await repoListPartCatalog({
      storeCode: store,
      category,
      includeHidden,
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi tải linh kiện";
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
    const saved = await repoCreatePartCatalog(body);
    return NextResponse.json({ data: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi thêm linh kiện";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
