import { NextRequest, NextResponse } from "next/server";
import { repoRequireLookupManage } from "@/lib/db/accountsRepo";
import {
  repoAddLookupLabel,
  repoDeactivateLookupLabel,
  repoListLookupLabels,
  repoRenameLookupLabel,
  repoSortLookupLabels,
} from "@/lib/db/inventoryRepo";
import { toInventoryError } from "@/lib/supabase/errors";

export const dynamic = "force-dynamic";

const STORE_CODES = new Set(["store-1", "store-2", "store-3"]);

function actorFromBody(body: { actorUsername?: string }): string {
  return String(body?.actorUsername ?? "").trim();
}

function storeFromBody(body: { storeId?: string }): string {
  return String(body?.storeId ?? "").trim();
}

function storeFromRequest(req: NextRequest, bodyStore?: string): string {
  const fromQuery = req.nextUrl.searchParams.get("storeId")?.trim() ?? "";
  const storeId = bodyStore || fromQuery;
  if (!STORE_CODES.has(storeId)) {
    throw Object.assign(new Error("invalid_store"), { code: "invalid_store" });
  }
  return storeId;
}

/** Owner: mọi store. Staff: chỉ store được gán. */
async function requireLookupManage(actorUsername: string, storeId: string) {
  if (!actorUsername) {
    throw new Error("not_authenticated");
  }
  await repoRequireLookupManage(actorUsername, storeId);
}

function mapMutateError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (message === "not_authenticated") {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  if (message === "store_forbidden" || message === "owner_only") {
    return NextResponse.json(
      { error: "Không được quản lý droplist cửa hàng khác." },
      { status: 403 }
    );
  }
  if (message === "invalid_store" || (err as { code?: string })?.code === "invalid_store") {
    return NextResponse.json(
      { error: "Thiếu hoặc sai cửa hàng (storeId: store-1|store-2|store-3)." },
      { status: 400 }
    );
  }
  const mapped = toInventoryError(err);
  return NextResponse.json({ error: mapped.message }, { status: 400 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { category: string } }
) {
  try {
    const storeId = storeFromRequest(req);
    const labels = await repoListLookupLabels(params.category, storeId);
    return NextResponse.json({ data: labels });
  } catch (err) {
    if ((err as { code?: string })?.code === "invalid_store" || (err instanceof Error && err.message === "invalid_store")) {
      return NextResponse.json(
        { error: "Thiếu hoặc sai cửa hàng (storeId: store-1|store-2|store-3)." },
        { status: 400 }
      );
    }
    const mapped = toInventoryError(err);
    return NextResponse.json({ error: mapped.message }, { status: 500 });
  }
}

/** Body: { label, actorUsername, storeId } — thêm / reactivate option (owner hoặc staff đúng store) */
export async function POST(
  req: NextRequest,
  { params }: { params: { category: string } }
) {
  try {
    const body = await req.json();
    const storeId = storeFromRequest(req, storeFromBody(body));
    await requireLookupManage(actorFromBody(body), storeId);
    const label = String(body?.label ?? "").trim();
    if (!label) {
      return NextResponse.json({ error: "Thiếu nhãn option." }, { status: 400 });
    }
    const saved = await repoAddLookupLabel(params.category, label, storeId);
    const labels = await repoListLookupLabels(params.category, storeId);
    return NextResponse.json({ data: { label: saved, labels } });
  } catch (err) {
    return mapMutateError(err);
  }
}

/** Body: { action: "sort", actorUsername, storeId } — sắp xếp option */
export async function PUT(
  req: NextRequest,
  { params }: { params: { category: string } }
) {
  try {
    const body = await req.json().catch(() => ({}));
    const storeId = storeFromRequest(req, storeFromBody(body));
    await requireLookupManage(actorFromBody(body), storeId);
    const action = String(body?.action ?? "").trim();
    if (action !== "sort") {
      return NextResponse.json({ error: "action không hợp lệ (cần sort)." }, { status: 400 });
    }
    const labels = await repoSortLookupLabels(params.category, storeId);
    return NextResponse.json({ data: { labels } });
  } catch (err) {
    return mapMutateError(err);
  }
}

/** Body: { oldLabel, label, actorUsername, storeId } — đổi tên option */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { category: string } }
) {
  try {
    const body = await req.json();
    const storeId = storeFromRequest(req, storeFromBody(body));
    await requireLookupManage(actorFromBody(body), storeId);
    const oldLabel = String(body?.oldLabel ?? "").trim();
    const label = String(body?.label ?? "").trim();
    if (!oldLabel || !label) {
      return NextResponse.json({ error: "Thiếu oldLabel hoặc label." }, { status: 400 });
    }
    const saved = await repoRenameLookupLabel(params.category, oldLabel, label, storeId);
    const labels = await repoListLookupLabels(params.category, storeId);
    return NextResponse.json({ data: { label: saved, labels } });
  } catch (err) {
    return mapMutateError(err);
  }
}

/** Body: { label, actorUsername, storeId } — soft-deactivate option */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { category: string } }
) {
  try {
    const body = await req.json().catch(() => ({}));
    const storeId = storeFromRequest(req, storeFromBody(body));
    await requireLookupManage(actorFromBody(body), storeId);
    const label = String(body?.label ?? "").trim();
    if (!label) {
      return NextResponse.json({ error: "Thiếu nhãn option." }, { status: 400 });
    }
    await repoDeactivateLookupLabel(params.category, label, storeId);
    const labels = await repoListLookupLabels(params.category, storeId);
    return NextResponse.json({ data: { labels } });
  } catch (err) {
    return mapMutateError(err);
  }
}
