import { NextRequest, NextResponse } from "next/server";
import { repoRequireOwner } from "@/lib/db/accountsRepo";
import {
  repoAddLookupLabel,
  repoDeactivateLookupLabel,
  repoListLookupLabels,
  repoRenameLookupLabel,
  repoSortLookupLabels,
} from "@/lib/db/inventoryRepo";
import { toInventoryError } from "@/lib/supabase/errors";

export const dynamic = "force-dynamic";

function actorFromBody(body: { actorUsername?: string }): string {
  return String(body?.actorUsername ?? "").trim();
}

async function requireLookupOwner(actorUsername: string) {
  if (!actorUsername) {
    const err = new Error("not_authenticated");
    throw err;
  }
  await repoRequireOwner(actorUsername);
}

function mapMutateError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (message === "not_authenticated") {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  if (message === "owner_only") {
    return NextResponse.json(
      { error: "Chỉ chủ cửa hàng được thêm/sửa/xóa droplist." },
      { status: 403 }
    );
  }
  const mapped = toInventoryError(err);
  return NextResponse.json({ error: mapped.message }, { status: 400 });
}

export async function GET(
  _req: Request,
  { params }: { params: { category: string } }
) {
  try {
    const labels = await repoListLookupLabels(params.category);
    return NextResponse.json({ data: labels });
  } catch (err) {
    const mapped = toInventoryError(err);
    return NextResponse.json({ error: mapped.message }, { status: 500 });
  }
}

/** Body: { label: string, actorUsername: string } — thêm / reactivate option (owner) */
export async function POST(
  req: NextRequest,
  { params }: { params: { category: string } }
) {
  try {
    const body = await req.json();
    await requireLookupOwner(actorFromBody(body));
    const label = String(body?.label ?? "").trim();
    if (!label) {
      return NextResponse.json({ error: "Thiếu nhãn option." }, { status: 400 });
    }
    const saved = await repoAddLookupLabel(params.category, label);
    const labels = await repoListLookupLabels(params.category);
    return NextResponse.json({ data: { label: saved, labels } });
  } catch (err) {
    return mapMutateError(err);
  }
}

/** Body: { action: "sort", actorUsername: string } — sắp xếp option (owner) */
export async function PUT(
  req: NextRequest,
  { params }: { params: { category: string } }
) {
  try {
    const body = await req.json().catch(() => ({}));
    await requireLookupOwner(actorFromBody(body));
    const action = String(body?.action ?? "").trim();
    if (action !== "sort") {
      return NextResponse.json({ error: "action không hợp lệ (cần sort)." }, { status: 400 });
    }
    const labels = await repoSortLookupLabels(params.category);
    return NextResponse.json({ data: { labels } });
  } catch (err) {
    return mapMutateError(err);
  }
}

/** Body: { oldLabel, label, actorUsername } — đổi tên option (owner) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { category: string } }
) {
  try {
    const body = await req.json();
    await requireLookupOwner(actorFromBody(body));
    const oldLabel = String(body?.oldLabel ?? "").trim();
    const label = String(body?.label ?? "").trim();
    if (!oldLabel || !label) {
      return NextResponse.json({ error: "Thiếu oldLabel hoặc label." }, { status: 400 });
    }
    const saved = await repoRenameLookupLabel(params.category, oldLabel, label);
    const labels = await repoListLookupLabels(params.category);
    return NextResponse.json({ data: { label: saved, labels } });
  } catch (err) {
    return mapMutateError(err);
  }
}

/** Body: { label, actorUsername } — soft-deactivate option (owner) */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { category: string } }
) {
  try {
    const body = await req.json().catch(() => ({}));
    await requireLookupOwner(actorFromBody(body));
    const label = String(body?.label ?? "").trim();
    if (!label) {
      return NextResponse.json({ error: "Thiếu nhãn option." }, { status: 400 });
    }
    await repoDeactivateLookupLabel(params.category, label);
    const labels = await repoListLookupLabels(params.category);
    return NextResponse.json({ data: { labels } });
  } catch (err) {
    return mapMutateError(err);
  }
}
