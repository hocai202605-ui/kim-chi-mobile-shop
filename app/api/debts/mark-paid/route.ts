import { NextRequest, NextResponse } from "next/server";
import { repoMarkDebtsPaid, type DebtSource } from "@/lib/db/debtsRepo";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const raw = Array.isArray(body?.refs) ? body.refs : [];
    const refs = raw
      .map((r: { source?: string; sourceId?: string; id?: string }) => {
        // accept composite id "software:uuid" or {source, sourceId}
        if (r?.source && r?.sourceId) {
          return {
            source: r.source as DebtSource,
            sourceId: String(r.sourceId).trim(),
          };
        }
        const composite = String(r?.id || "").trim();
        const m = composite.match(/^(software|manual|repair|sale):(.+)$/);
        if (m) return { source: m[1] as DebtSource, sourceId: m[2] };
        return null;
      })
      .filter(Boolean) as { source: DebtSource; sourceId: string }[];

    if (!refs.length) {
      return NextResponse.json({ error: "Chưa chọn khoản nợ." }, { status: 400 });
    }

    const actorUsername =
      typeof body?.actorUsername === "string" ? body.actorUsername : undefined;
    const result = await repoMarkDebtsPaid(refs, actorUsername);
    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi thanh toán công nợ";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
