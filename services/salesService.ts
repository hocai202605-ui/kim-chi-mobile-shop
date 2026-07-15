import type { StoreId } from "@/types";

export type SaleRow = {
  id: string;
  soldAt: string;
  storeId: Exclude<StoreId, "all">;
  itemName: string;
  itemType: "Máy" | "Phụ kiện";
  quantity: number;
  amount: number;
  profit: number;
  payment: string;
  status: "Hoàn tất";
  customerName?: string;
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
      quantity: number;
      /** Đơn giá 1 cái (short shop OK). */
      unitPrice: number;
      accessoryId?: string;
    };

export type CreateSaleBody = {
  storeId: Exclude<StoreId, "all">;
  payment: string;
  customerName?: string;
  customerPhone?: string;
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
