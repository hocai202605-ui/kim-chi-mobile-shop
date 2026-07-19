import type { StoreId } from "@/types";

/** amount / profit = short shop (giống giá kho), không phải VND đầy đủ. */
export type SaleRow = {
  id: string;
  soldAt: string;
  storeId: Exclude<StoreId, "all">;
  itemName: string;
  itemType: "Máy" | "Phụ kiện";
  quantity: number;
  /** Short shop (VD nhập 150 → hiện 150). */
  amount: number;
  /** Short shop — giá nhập / vốn phiếu. */
  cost?: number;
  /** Short shop. */
  profit: number;
  payment: string;
  status: "Hoàn tất" | "Đã hủy";
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  /** Ghi chú phiếu (vd: bảo hành). */
  note?: string;
  lineCount?: number;
};

export type CreateSaleLineBody =
  | {
      itemType: "Máy" | "phone";
      phoneId: string;
      /** Giá bán 1 máy (short shop OK). */
      unitPrice: number;
    }
  | {
      itemType: "Phụ kiện" | "accessory";
      itemName: string;
      category?: string;
      quantity: number;
      /** Đơn giá 1 cái (short shop OK). */
      unitPrice: number;
      /** Giá nhập short 1 cái (free-text). */
      unitCost?: number;
      accessoryId?: string;
    };

export type CreateSaleBody = {
  storeId: Exclude<StoreId, "all">;
  payment: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  /** YYYY-MM-DDTHH:mm (VN) */
  soldAt?: string;
  note?: string;
  actorUsername?: string;
  /** Multi-line (ưu tiên). */
  lines?: CreateSaleLineBody[];
  /** Legacy 1 dòng */
  itemType?: "Máy" | "Phụ kiện";
  phoneId?: string;
  accessoryId?: string;
  quantity?: number;
  unitPrice?: number;
};

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body.data as T;
}

export async function listRecentSales(): Promise<SaleRow[]> {
  const res = await fetch("/api/inventory/sales", { cache: "no-store" });
  return parseJson<SaleRow[]>(res);
}

export async function createSale(input: CreateSaleBody): Promise<SaleRow> {
  const res = await fetch("/api/inventory/sales", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<SaleRow>(res);
}

export async function cancelSale(
  id: string,
  actorUsername?: string
): Promise<SaleRow> {
  const res = await fetch(`/api/inventory/sales/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actorUsername }),
  });
  return parseJson<SaleRow>(res);
}

export type SaleDetailLine =
  | {
      kind: "phone";
      phoneId?: string;
      name: string;
      imei?: string;
      brand?: string;
      color?: string;
      storage?: string;
      condition?: string;
      unitPrice: number;
      cost: number;
    }
  | {
      kind: "accessory";
      category?: string;
      name: string;
      quantity: number;
      unitPrice: number;
      cost: number;
      accessoryId?: string;
    };

export type SaleDetail = SaleRow & {
  soldAtLocal?: string;
  customerId?: string;
  note?: string;
  lines: SaleDetailLine[];
};

export async function getSale(id: string): Promise<SaleDetail> {
  const res = await fetch(`/api/inventory/sales/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  return parseJson<SaleDetail>(res);
}
