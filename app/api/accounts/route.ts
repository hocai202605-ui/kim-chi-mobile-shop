import { NextResponse } from "next/server";
import { repoListAccounts, repoRequireOwner } from "@/lib/db/accountsRepo";
import { isMaxConnSessionError } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

function actorFrom(req: Request): string {
  const url = new URL(req.url);
  return (
    url.searchParams.get("actor") ||
    req.headers.get("x-actor-username") ||
    ""
  ).trim();
}

export async function GET(req: Request) {
  try {
    const actor = actorFrom(req);
    if (!actor) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }
    await repoRequireOwner(actor);
    const data = await repoListAccounts();
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "list_failed";
    if (isMaxConnSessionError(err)) {
      return NextResponse.json(
        { error: "Hết slot kết nối DB. Thử lại sau vài giây." },
        { status: 503 }
      );
    }
    if (message === "not_authenticated") {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }
    if (message === "owner_only") {
      return NextResponse.json(
        { error: "Chỉ chủ cửa hàng được quản lý tài khoản." },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
