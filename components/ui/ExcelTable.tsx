"use client";

import { useRef, useState, type ComponentPropsWithoutRef } from "react";
import { FileSpreadsheet } from "lucide-react";
import { downloadTableExcel, readExcelTable, type ExcelTableData } from "@/lib/exportTableExcel";

/** Shared export control for native grids; explicit data includes all filtered pages. */
export function ExcelTable({ exportData, exportTitle, exportEnabled = true, ...props }: ComponentPropsWithoutRef<"table"> & {
  exportData?: () => ExcelTableData;
  exportTitle?: string;
  exportEnabled?: boolean;
}) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  function download() {
    const table = tableRef.current;
    if (!table) return;
    try {
      const data = exportData ? exportData() : readExcelTable(table);
      if (!data.rows.length) {
        setMessage({ error: true, text: "Không có dữ liệu để xuất Excel." });
        return;
      }
      const title = exportTitle || table.closest("section")?.querySelector("h2, h3")?.textContent || document.querySelector("h1")?.textContent || "Dữ liệu";
      const result = downloadTableExcel(data, title);
      setMessage({ error: false, text: `Đã xuất ${result.count} dòng → ${result.fileName}` });
    } catch {
      setMessage({ error: true, text: "Xuất Excel thất bại. Vui lòng thử lại." });
    }
  }
  return (
    <div className="min-w-0">
      {exportEnabled ? (
        <div className="flex flex-wrap items-center justify-end gap-2 p-2">
          {message ? <span role={message.error ? "alert" : "status"} className={`text-sm font-semibold ${message.error ? "text-danger" : "text-brand"}`}>{message.text}</span> : null}
          <button type="button" onClick={download} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-black text-ink shadow-sm transition hover:bg-slate-50" title={exportData ? "Xuất toàn bộ dữ liệu theo bộ lọc hiện tại ra Excel" : "Xuất dữ liệu đang hiển thị trong bảng ra Excel"}>
            <FileSpreadsheet size={17} className="text-brand" /> Xuất Excel
          </button>
        </div>
      ) : null}
      <div className="overflow-auto"><table ref={tableRef} {...props} /></div>
    </div>
  );
}
