import { NextResponse } from "next/server";
import { repoListLoginUsers } from "@/lib/db/accountsRepo";
import { isMaxConnSessionError } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

/** Public: active usernames for login droplist (no password). */
export async function GET() {
  try {
    const data = await repoListLoginUsers();
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "list_failed";
    if (isMaxConnSessionError(err)) {
      return NextResponse.json(
        { error: "Hết slot kết nối DB. Thử lại sau vài giây." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
