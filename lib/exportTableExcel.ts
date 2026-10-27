import * as XLSX from "xlsx";
import { vnNowDate } from "@/lib/datetime";

export type ExcelCell = string | number | boolean | null | undefined;
export type ExcelTableData = { headers: string[]; rows: ExcelCell[][] };

/** Read the current grid without action/selection columns or hidden values. */
export function readExcelTable(table: HTMLTableElement): ExcelTableData {
  const text = (cell: Element) => {
    const copy = cell.cloneNode(true) as HTMLElement;
    copy.querySelectorAll("svg, input[type=checkbox], input[type=password], [hidden], .hidden, [aria-hidden=true]").forEach((node) => node.remove());
    copy.querySelectorAll("input, textarea, select").forEach((node) => {
      const control = node as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      node.replaceWith(document.createTextNode(control instanceof HTMLSelectElement
        ? control.selectedOptions[0]?.textContent || ""
        : control.value));
    });
    copy.querySelectorAll("br").forEach((node) => node.replaceWith(" "));
    copy.querySelectorAll("div, p").forEach((node) => node.append(" "));
    return (copy.textContent || "").replace(/\s+/g, " ").trim();
  };
  const headers = Array.from(table.tHead?.rows[0]?.cells || []).map(text);
  const columns = headers.flatMap((header, index) => header && header !== "Thao tác" ? [index] : []);
  const rows = Array.from(table.tBodies).flatMap((body) => Array.from(body.rows))
    .filter((row) => row.cells.length === headers.length && !Array.from(row.cells).some((cell) => cell.colSpan > 1))
    .map((row) => columns.map((index) => text(row.cells[index])))
    .filter((row) => row.some(Boolean));
  return { headers: columns.map((index) => headers[index]), rows };
}

export function downloadTableExcel(data: ExcelTableData, title: string) {
  const worksheet = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);
  worksheet["!cols"] = data.headers.map((header) => ({ wch: Math.min(40, Math.max(16, header.length + 4)) }));
  if (worksheet["!ref"]) worksheet["!autofilter"] = { ref: worksheet["!ref"] };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, title.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Dữ liệu");
  const slug = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "du-lieu";
  const fileName = `${slug}_${vnNowDate()}.xlsx`;
  XLSX.writeFile(workbook, fileName);
  return { fileName, count: data.rows.length };
}
