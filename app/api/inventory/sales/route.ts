import { NextRequest, NextResponse } from "next/server";
import { repoCreateSale, repoListRecentSales, type CreateSaleInput } from "@/lib/db/inventoryRepo";
import { isMaxConnSessionError } from "@/lib/db/pool";
import type { StoreId } from "@/types";

export const dynamic = "force-dynamic";

function mapPayment(raw: string): CreateSaleInput["payment"] {
  const t = raw.trim().toLowerCase();
  if (t === "tiền mặt" || t === "tien mat" || t === "cash") return "cash";
  if (t === "chuyển khoản" || t === "chuyen khoan" || t === "transfer") return "transfer";
  if (t === "thẻ" || t === "the" || t === "card") return "card";
  return "other";
}

export async function GET() {
  try {
    const data = await repoListRecentSales(80);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi tải phiếu bán";
    if (isMaxConnSessionError(err)) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const storeId = String(body?.storeId || "") as Exclude<StoreId, "all">;
    const itemTypeRaw = String(body?.itemType || "");
    const itemType = itemTypeRaw === "Phụ kiện" || itemTypeRaw === "accessory" ? "accessory" : "phone";
    const unitPrice = Number(body?.unitPrice ?? body?.amount ?? 0);
    const quantity = Number(body?.quantity ?? 1);

    if (!storeId || storeId === ("all" as StoreId)) {
      return NextResponse.json({ error: "Thiếu cửa hàng." }, { status: 400 });
    }

    const input: CreateSaleInput = {
      storeId,
      itemType,
      phoneId: body?.phoneId ? String(body.phoneId) : undefined,
      accessoryId: body?.accessoryId ? String(body.accessoryId) : undefined,
      quantity,
      unitPrice,
      payment: mapPayment(String(body?.payment ?? "cash")),
      customerName: body?.customerName ? String(body.customerName) : undefined,
      customerPhone: body?.customerPhone ? String(body.customerPhone) : undefined,
      note: body?.note ? String(body.note) : undefined,
    };

    if (itemType === "phone" && !input.phoneId) {
      return NextResponse.json({ error: "Thiếu máy cần bán." }, { status: 400 });
    }
    if (itemType === "accessory" && !input.accessoryId) {
      return NextResponse.json({ error: "Thiếu phụ kiện cần bán." }, { status: 400 });
    }

    const data = await repoCreateSale(input);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi tạo phiếu bán";
    if (isMaxConnSessionError(err)) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
