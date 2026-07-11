import { NextResponse } from "next/server";
import { repoUpdateAccount } from "@/lib/db/accountsRepo";
import { isMaxConnSessionError } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const id = ctx.params.id;
    const body = (await req.json()) as {
      allowedMenus?: string[];
      isActive?: boolean;
      password?: string;
      actorUsername?: string;
    };
    const actorUsername = String(body.actorUsername ?? "").trim();
    if (!actorUsername) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }

    const patch: {
      allowedMenus?: string[];
      isActive?: boolean;
      password?: string;
    } = {};
    if (Array.isArray(body.allowedMenus)) {
      patch.allowedMenus = body.allowedMenus.map(String);
    }
    if (typeof body.isActive === "boolean") {
      patch.isActive = body.isActive;
    }
    if (typeof body.password === "string") {
      patch.password = body.password;
    }

    if (
      patch.allowedMenus === undefined &&
      patch.isActive === undefined &&
      patch.password === undefined
    ) {
      return NextResponse.json(
        { error: "Không có trường nào để cập nhật." },
        { status: 400 }
      );
    }

    const data = await repoUpdateAccount(id, actorUsername, patch);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "update_failed";
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
        { error: "Chỉ admin / quynhbupbe được quản lý tài khoản." },
        { status: 403 }
      );
    }
    if (message === "account_not_found") {
      return NextResponse.json(
        { error: "Không tìm thấy tài khoản." },
        { status: 404 }
      );
    }
    if (message === "cannot_deactivate_self") {
      return NextResponse.json(
        { error: "Không thể tự vô hiệu hóa tài khoản đang đăng nhập." },
        { status: 400 }
      );
    }
    if (message === "password_too_short") {
      return NextResponse.json(
        { error: "Mật khẩu tối thiểu 6 ký tự." },
        { status: 400 }
      );
    }
    if (message === "nothing_to_update") {
      return NextResponse.json(
        { error: "Không có trường nào để cập nhật." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
