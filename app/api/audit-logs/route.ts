import { NextRequest, NextResponse } from "next/server";
import { repoCreateAuditLog, repoListAuditLogs } from "@/lib/db/auditLogsRepo";
import { isMaxConnSessionError } from "@/lib/db/pool";
import type { StoreId } from "@/types";

export const dynamic = "force-dynamic";

function parseStoreId(raw: string | null | undefined): StoreId | undefined {
  const s = String(raw ?? "").trim();
  if (!s) return undefined;
  if (s === "all" || s === "store-1" || s === "store-2" || s === "store-3") {
    return s;
  }
  return undefined;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const data = await repoListAuditLogs({
      storeId: parseStoreId(sp.get("storeId")),
      from: sp.get("from") || undefined,
      to: sp.get("to") || undefined,
      user: sp.get("user") || undefined,
      action: sp.get("action") || undefined,
      q: sp.get("q") || undefined,
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi tải nhật ký";
    if (isMaxConnSessionError(err)) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const storeRaw = body?.storeId != null ? String(body.storeId) : "";
    const storeId =
      storeRaw === "store-1" || storeRaw === "store-2" || storeRaw === "store-3"
        ? storeRaw
        : null;

    const data = await repoCreateAuditLog({
      actorName: String(body?.actorName ?? body?.user ?? ""),
      storeId,
      action: String(body?.action ?? ""),
      target: body?.target != null ? String(body.target) : "",
      meta:
        body?.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
          ? body.meta
          : undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi ghi nhật ký";
    if (isMaxConnSessionError(err)) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
