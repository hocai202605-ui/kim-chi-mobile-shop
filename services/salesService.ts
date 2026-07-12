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
};

export type CreateSaleBody = {
  storeId: Exclude<StoreId, "all">;
  itemType: "Máy" | "Phụ kiện";
  phoneId?: string;
  accessoryId?: string;
  quantity: number;
  /** Giá / đơn giá (short shop OK — server ×1000). */
  unitPrice: number;
  payment: string;
  customerName?: string;
  customerPhone?: string;
  note?: string;
  actorUsername?: string;
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
