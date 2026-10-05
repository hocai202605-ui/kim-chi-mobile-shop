import * as XLSX from "xlsx";
import type { StoreId } from "@/types";
import { storeName } from "@/lib/constants";
import { vnNowDate } from "@/lib/datetime";

export type SalesExcelRow = {
  id: string;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  storeId: Exclude<StoreId, "all">;
  itemName: string;
  itemType: string;
  quantity: number;
  amount: number;
  cost?: number;
  profit: number;
  payment: string;
  status: string;
  note?: string;
};

type DownloadSalesExcelOptions = {
  month: string;
  title?: string;
};

function safeSheetName(value: string): string {
  const name = value.replace(/[\\/?*[\]:]/g, " ").trim();
  return (name || "Ban hang").slice(0, 31);
}

/** Export danh sách phiếu bán trong tháng ra file .xlsx - client-side. */
export function downloadSalesExcel(
  sales: SalesExcelRow[],
  options: DownloadSalesExcelOptions
): { fileName: string; count: number } {
  const rows = sales.map((sale, index) => {
    const cost = sale.cost ?? Math.max(0, (Number(sale.amount) || 0) - (Number(sale.profit) || 0));
    return {
      STT: index + 1,
      "Mã phiếu": sale.id,
      "Ngày bán": sale.createdAt || "",
      "Cửa hàng": storeName(sale.storeId),
      "Khách hàng": sale.customerName || "Khách lẻ",
      "Số điện thoại": sale.customerPhone || "",
      "Địa chỉ": sale.customerAddress || "",
      Hàng: sale.itemName || "",
      Loại: sale.itemType || "",
      "Số lượng": sale.quantity ?? 0,
      "Tổng tiền": sale.amount ?? 0,
      "Giá nhập": cost,
      Lãi: sale.profit ?? 0,
      "Thanh toan": sale.payment || "",
      "Trạng thái": sale.status || "",
      "Ghi chú": sale.note || "",
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 22 },
    { wch: 14 },
    { wch: 24 },
    { wch: 32 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 14 },
    { wch: 28 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(options.title || `Bán hàng ${options.month}`));
  const fileName = `ban-hang_${options.month || vnNowDate()}_${vnNowDate()}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return { fileName, count: rows.length };
}
