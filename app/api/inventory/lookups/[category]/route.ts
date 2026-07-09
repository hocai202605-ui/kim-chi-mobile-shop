import { NextRequest, NextResponse } from "next/server";
import {
  repoAddLookupLabel,
  repoDeactivateLookupLabel,
  repoListLookupLabels,
  repoRenameLookupLabel,
} from "@/lib/db/inventoryRepo";
import { toInventoryError } from "@/lib/supabase/errors";

export const dynamic = "force-dynamic";

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

/** Body: { label: string } — thêm / reactivate option */
export async function POST(
  req: NextRequest,
  { params }: { params: { category: string } }
) {
  try {
    const body = await req.json();
    const label = String(body?.label ?? "").trim();
    if (!label) {
      return NextResponse.json({ error: "Thiếu nhãn option." }, { status: 400 });
    }
    const saved = await repoAddLookupLabel(params.category, label);
    const labels = await repoListLookupLabels(params.category);
    return NextResponse.json({ data: { label: saved, labels } });
  } catch (err) {
    const mapped = toInventoryError(err);
    return NextResponse.json({ error: mapped.message }, { status: 400 });
  }
}

/** Body: { oldLabel: string, label: string } — đổi tên option (+ cascade phones) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { category: string } }
) {
  try {
    const body = await req.json();
    const oldLabel = String(body?.oldLabel ?? "").trim();
    const label = String(body?.label ?? "").trim();
    if (!oldLabel || !label) {
      return NextResponse.json({ error: "Thiếu oldLabel hoặc label." }, { status: 400 });
    }
    const saved = await repoRenameLookupLabel(params.category, oldLabel, label);
    const labels = await repoListLookupLabels(params.category);
    return NextResponse.json({ data: { label: saved, labels } });
  } catch (err) {
    const mapped = toInventoryError(err);
    return NextResponse.json({ error: mapped.message }, { status: 400 });
  }
}

/** Body: { label: string } — soft-deactivate option */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { category: string } }
) {
  try {
    const body = await req.json().catch(() => ({}));
    const label = String(body?.label ?? "").trim();
    if (!label) {
      return NextResponse.json({ error: "Thiếu nhãn option." }, { status: 400 });
    }
    await repoDeactivateLookupLabel(params.category, label);
    const labels = await repoListLookupLabels(params.category);
    return NextResponse.json({ data: { labels } });
  } catch (err) {
    const mapped = toInventoryError(err);
    return NextResponse.json({ error: mapped.message }, { status: 400 });
  }
}
