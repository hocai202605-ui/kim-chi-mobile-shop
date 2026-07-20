import { NextRequest, NextResponse } from "next/server";
import {
  repoCreateSale,
  repoListRecentSales,
  type CreateSaleInput,
  type CreateSaleLineInput,
} from "@/lib/db/inventoryRepo";
import { isMaxConnSessionError } from "@/lib/db/pool";
import type { StoreId } from "@/types";

export const dynamic = "force-dynamic";

function mapPayment(raw: string): CreateSaleInput["payment"] {
  const t = raw.trim().toLowerCase();
  if (t === "tiền mặt" || t === "tien mat" || t === "cash") return "cash";
  if (t === "chuyển khoản" || t === "chuyen khoan" || t === "transfer") return "transfer";
  if (t === "thẻ" || t === "the" || t === "card") return "card";
  if (
    t === "nợ" ||
    t === "no" ||
    t === "nợ dai" ||
    t === "no dai" ||
    t === "debt"
  ) {
    return "debt";
  }
  if (
    t === "thanh toán 1 phần" ||
    t === "thanh toan 1 phan" ||
    t === "partial" ||
    t === "1 phần" ||
    t === "1 phan"
  ) {
    return "partial";
  }
  // "Đã thanh toán" + hình thức → cash/transfer handled by raw method strings above
  if (t === "đã thanh toán" || t === "da thanh toan") return "cash";
  return "other";
}

function mapLine(raw: Record<string, unknown>): CreateSaleLineInput {
  const typeRaw = String(raw.itemType || raw.type || "");
  const isAccessory =
    typeRaw === "Phụ kiện" || typeRaw === "accessory" || typeRaw.toLowerCase() === "phu kien";

  if (isAccessory) {
    return {
      itemType: "accessory",
      itemName: String(raw.itemName ?? raw.name ?? "").trim(),
      category: raw.category != null ? String(raw.category).trim() : undefined,
      quantity: Number(raw.quantity ?? 1),
      unitPrice: Number(raw.unitPrice ?? raw.amount ?? 0),
      unitCost: raw.unitCost != null ? Number(raw.unitCost) : undefined,
      accessoryId: raw.accessoryId ? String(raw.accessoryId) : undefined,
    };
  }

  return {
    itemType: "phone",
    phoneId: String(raw.phoneId ?? raw.itemId ?? ""),
    unitPrice: Number(raw.unitPrice ?? raw.amount ?? 0),
  };
}

export async function GET(req: NextRequest) {
  try {
    const channelRaw = req.nextUrl.searchParams.get("channel");
    const channel = channelRaw === "ban_ga" ? "ban_ga" : "retail";
    const data = await repoListRecentSales(100, channel);
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

    if (!storeId || storeId === ("all" as StoreId)) {
      return NextResponse.json({ error: "Thiếu cửa hàng." }, { status: 400 });
    }

    const linesRaw = Array.isArray(body?.lines) ? body.lines : null;
    let lines: CreateSaleLineInput[] | undefined;

    if (linesRaw && linesRaw.length > 0) {
      const mapped: CreateSaleLineInput[] = linesRaw.map((row: Record<string, unknown>) =>
        mapLine(row)
      );
      for (const line of mapped) {
        if (line.itemType === "phone" && !line.phoneId) {
          return NextResponse.json({ error: "Thiếu máy cần bán." }, { status: 400 });
        }
        if (line.itemType === "accessory" && !line.itemName && !line.accessoryId) {
          return NextResponse.json({ error: "Nhập tên phụ kiện." }, { status: 400 });
        }
      }
      lines = mapped;
    }

    const itemTypeRaw = String(body?.itemType || "");
    const legacyItemType =
      itemTypeRaw === "Phụ kiện" || itemTypeRaw === "accessory" ? "accessory" : "phone";

    const input: CreateSaleInput = {
      storeId,
      payment: mapPayment(String(body?.payment ?? "cash")),
      customerName: body?.customerName != null ? String(body.customerName) : undefined,
      customerPhone: body?.customerPhone != null ? String(body.customerPhone) : undefined,
      customerAddress: body?.customerAddress != null ? String(body.customerAddress) : undefined,
      soldAt: body?.soldAt != null ? String(body.soldAt) : undefined,
      note:
        body?.note != null && String(body.note).trim()
          ? String(body.note).trim()
          : undefined,
      actorUsername: body?.actorUsername ? String(body.actorUsername) : undefined,
      channel: body?.channel === "ban_ga" ? "ban_ga" : "retail",
      lines,
      itemType: lines ? undefined : legacyItemType,
      phoneId: body?.phoneId ? String(body.phoneId) : undefined,
      accessoryId: body?.accessoryId ? String(body.accessoryId) : undefined,
      quantity: body?.quantity != null ? Number(body.quantity) : undefined,
      unitPrice:
        body?.unitPrice != null || body?.amount != null
          ? Number(body?.unitPrice ?? body?.amount ?? 0)
          : undefined,
    };

    if (!lines) {
      if (legacyItemType === "phone" && !input.phoneId) {
        return NextResponse.json({ error: "Thiếu máy cần bán." }, { status: 400 });
      }
      if (legacyItemType === "accessory" && !input.accessoryId) {
        return NextResponse.json({ error: "Thiếu phụ kiện cần bán." }, { status: 400 });
      }
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
