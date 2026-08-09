import { NextRequest, NextResponse } from "next/server";
import {
  repoCancelDraftNote,
  repoListDraftNotes,
  repoUpsertDraftNote,
} from "@/lib/db/draftNotesRepo";
import { isMaxConnSessionError } from "@/lib/db/pool";
import type { StoreId } from "@/types";

export const dynamic = "force-dynamic";

function parseStoreId(raw: string | null | undefined): StoreId | undefined {
  const s = String(raw ?? "").trim();
  if (s === "all" || s === "store-1" || s === "store-2" || s === "store-3") return s;
  return undefined;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const data = await repoListDraftNotes({
      storeId: parseStoreId(sp.get("storeId")),
      query: sp.get("query") || undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi tải ghi nháp";
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
    const data = await repoUpsertDraftNote({
      id: body?.id ? String(body.id) : undefined,
      storeId,
      content: String(body?.content ?? ""),
      actorUsername:
        typeof body?.actorUsername === "string" ? body.actorUsername : undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi lưu ghi nháp";
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
      return NextResponse.json({ error: "Thiếu id ghi nháp." }, { status: 400 });
    }
    const actorUsername =
      typeof body?.actorUsername === "string" ? body.actorUsername : undefined;
    const data = await repoCancelDraftNote(id, actorUsername);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi hủy ghi nháp";
    if (isMaxConnSessionError(err)) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
