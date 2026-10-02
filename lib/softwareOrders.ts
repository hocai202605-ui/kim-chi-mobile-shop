import type { OnlineRepair } from "@/types";

/** Gom khách theo đơn mới nhất; giữ thứ tự mới → cũ trong mỗi cụm. */
export function sortSoftwareOrdersByCustomer(orders: readonly OnlineRepair[]): OnlineRepair[] {
  const timeKey = (value: string) => value.replace("T", " ");
  const sorted = [...orders].sort((a, b) =>
    timeKey(b.receiveDate || b.createdAt).localeCompare(timeKey(a.receiveDate || a.createdAt)) ||
    timeKey(b.createdAt).localeCompare(timeKey(a.createdAt))
  );
  const groups = new Map<string, OnlineRepair[]>();

  for (const order of sorted) {
    const name = order.customerName.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
    // Không gom các đơn thiếu tên thành một khách hàng chung.
    const key = name ? `customer:${name}` : `order:${order.id}`;
    const group = groups.get(key);
    if (group) group.push(order);
    else groups.set(key, [order]);
  }

  // Map giữ thứ tự thêm cụm: đơn đầu tiên luôn là đơn mới nhất của khách.
  return Array.from(groups.values()).flat();
}
