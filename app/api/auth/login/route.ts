import { NextResponse } from "next/server";
import { repoLogin } from "@/lib/db/accountsRepo";
import { isMaxConnSessionError } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { username?: string; password?: string };
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    if (!username || !password) {
      return NextResponse.json(
        { error: "Vui lòng nhập tài khoản và mật khẩu." },
        { status: 400 }
      );
    }

    const user = await repoLogin(username, password);
    return NextResponse.json({ data: user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "login_failed";
    if (isMaxConnSessionError(err)) {
      return NextResponse.json(
        { error: "Hết slot kết nối DB. Thử lại sau vài giây." },
        { status: 503 }
      );
    }
    if (message === "invalid_credentials") {
      return NextResponse.json(
        { error: "Sai tài khoản hoặc mật khẩu." },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
