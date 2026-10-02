import type { Sale, ShopRepairOrder } from "@/types";

type SummarySale = Pick<Sale, "status" | "storeId" | "createdAt" | "amount" | "profit">;
type SummaryRepair = Pick<ShopRepairOrder, "receiveDate" | "createdAt" | "quote" | "deposit">;

/** Đơn sửa chữa đầu vào đã được API giới hạn theo cửa hàng đang chọn. */
export function calculateDailySalesSummary(
  retail: readonly SummarySale[],
  banGa: readonly SummarySale[],
  repairs: readonly SummaryRepair[],
  date: string,
  store: string
) {
  let revenue = 0;
  let profit = 0;
  let count = 0;

  for (const sale of [...retail, ...banGa]) {
    if (sale.status !== "Hoàn tất") continue;
    if (store !== "all" && sale.storeId !== store) continue;
    if ((sale.createdAt || "").slice(0, 10) !== date) continue;
    revenue += Number(sale.amount) || 0;
    profit += Number(sale.profit) || 0;
    count += 1;
  }

  for (const repair of repairs) {
    if ((repair.receiveDate || repair.createdAt || "").slice(0, 10) !== date) continue;
    const quote = Number(repair.quote) || 0;
    revenue += quote;
    profit += quote - (Number(repair.deposit) || 0);
    count += 1;
  }

  return { revenue, profit, count };
}
