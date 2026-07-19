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

export type DashboardSummary = {
  phonesInStock: number;
  /** Tổng máy đã bán (lifetime, status sold). */
  phonesSold: number;
  /** Máy chưa xử lý (status pending). */
  phonesPending: number;
  accessoryQty: number;
  /** Vốn đầu tư = Σ cost tồn (máy + PK) · short shop. */
  capitalShort: number;
  capitalVnd: number;
  /** Doanh thu tạm tính nếu bán hết tồn theo giá dự kiến · short. */
  provisionalRevenueShort: number;
  /** Lãi tạm tính = DT tạm − vốn đầu tư · short. */
  provisionalProfitShort: number;
  /** Lifetime sales (VND DB). */
  profit: number;
  revenue: number;
};

export async function reportDashboardSummary(storeId?: StoreId): Promise<DashboardSummary> {
  const params = new URLSearchParams({
    store: storeId ?? "all",
  });
  const res = await fetch(`/api/inventory/reports/dashboard?${params}`, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body.data as DashboardSummary;
}
