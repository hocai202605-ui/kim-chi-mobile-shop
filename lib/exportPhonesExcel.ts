import * as XLSX from "xlsx";
import type { PhoneItem, StoreId } from "@/types";
import { storeName } from "@/lib/constants";
import { vnNowDate } from "@/lib/datetime";

/** Export danh sách máy (đã filter) ra file .xlsx — client-side. */
export function downloadPhonesExcel(phones: PhoneItem[]): { fileName: string; count: number } {
  const rows = phones.map((p) => ({
    "Cửa hàng": storeName(p.storeId as StoreId),
    Hãng: p.brand || "",
    "Tên máy": p.name || "",
    IMEI: p.imei || "",
    Màu: p.color || "",
    "Dung lượng": p.storage || "",
    "Dung lượng pin": p.batteryCapacity || "",
    Pin: p.batteryCondition || "",
    "Tình trạng": p.condition || "",
    "Quốc gia": p.madeIn || "",
    "Phiên bản mạng": p.networkVersion || "",
    "Giá nhập": p.cost ?? 0,
    "Giá bán": p.expectedPrice ?? 0,
    "Trạng thái": p.status || "",
    "Ngày nhập": p.importDate || "",
    "Ngày bán": p.saleDate || "",
    "Ghi chú": p.note || "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  // Độ rộng cột gợi ý
  ws["!cols"] = [
    { wch: 16 }, // CH
    { wch: 12 },
    { wch: 22 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 24 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Điện thoại");
  const fileName = `kho-dien-thoai_${vnNowDate()}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return { fileName, count: rows.length };
}