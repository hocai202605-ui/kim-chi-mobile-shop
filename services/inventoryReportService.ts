import type { StoreId } from "@/types";

export type MonthlyInventoryReport = {
  soldPhones: number;
  revenue: number;
  profit: number;
};

export type YearlyInventoryRow = {
  month: number;
  revenue: number;
  profit: number;
  sold: number;
};

export async function reportInventoryMonthly(
  yearMonth: string,
  storeId?: StoreId
): Promise<MonthlyInventoryReport> {
  const params = new URLSearchParams({
    ym: yearMonth,
    store: storeId ?? "all",
  });
  const res = await fetch(`/api/inventory/reports/monthly?${params}`, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body.data as MonthlyInventoryReport;
}

export async function reportInventoryYearly(
  year: number,
  storeId?: StoreId
): Promise<YearlyInventoryRow[]> {
  const params = new URLSearchParams({
    year: String(year),
    store: storeId ?? "all",
  });
  const res = await fetch(`/api/inventory/reports/yearly?${params}`, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body.data as YearlyInventoryRow[];
}

export function toYearlyChartRows(rows: YearlyInventoryRow[]) {
  return rows.map((row) => ({
    month: `Tháng ${row.month}`,
    revenue: row.revenue,
    profit: row.profit,
    sold: row.sold,
  }));
}

export async function reportInventoryCapital(_storeId?: StoreId) {
  throw new Error("reportInventoryCapital: dùng dashboard client từ list phones/accessories.");
}
