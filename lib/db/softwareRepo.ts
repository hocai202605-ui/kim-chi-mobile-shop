import type { OnlineRepair } from "@/types";
import { getPool } from "./pool";
import { repoEnsureLookupLabels } from "./inventoryRepo";

export type SoftwareOrderUpsertInput = Omit<OnlineRepair, "id" | "createdAt" | "isPaid"> & {
  id?: string;
  createdAt?: string;
  isPaid?: boolean;
  /** Cửa hàng sở hữu droplist (ensure option khi lưu đơn). */
  lookupStoreId?: string;
};

function moneyLabel(n: number): string {
  const r = Math.round(Number(n) || 0);
  return String(r);
}

async function ensureSoftwareLookups(
  saved: OnlineRepair,
  lookupStoreId?: string
): Promise<void> {
  const storeCode =
    lookupStoreId === "store-1" || lookupStoreId === "store-2" || lookupStoreId === "store-3"
      ? lookupStoreId
      : "store-1";
  await repoEnsureLookupLabels(
    [
      { categoryCode: "software_customer", label: saved.customerName },
      { categoryCode: "software_device", label: saved.deviceName },
      { categoryCode: "software_quote", label: moneyLabel(saved.quote) },
      { categoryCode: "software_fee", label: moneyLabel(saved.deposit) },
    ],
    storeCode
  );
}

type DbRow = {
  id: string;
  customer_name: string;
  customer_type: string;
  device_name: string;
  issue: string;
  quote: string | number;
  deposit: string | number;
  receive_at: Date | string | null;
  complete_at: Date | string | null;
  payment_at: Date | string | null;
  payment_status: "paid" | "debt";
  reward_points: number;
  created_at: Date | string;
};

function toLocalDateTimeString(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    // already "YYYY-MM-DD HH:mm" or datetime-local without Z
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) {
      return s.slice(0, 16).replace("T", " ");
    }
    return s;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoOrNull(value: string | undefined | null): string | null {
  if (!value || !String(value).trim()) return null;
  const s = String(value).trim().replace(" ", "T");
  // datetime-local: 2026-07-08T09:15
  const d = new Date(s.length === 16 ? `${s}:00` : s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function paymentStatusToUi(status: "paid" | "debt"): OnlineRepair["paymentStatus"] {
  return status === "paid" ? "Đã thanh toán" : "Nợ dai";
}

function paymentStatusToDb(
  status: OnlineRepair["paymentStatus"] | string,
  isPaid?: boolean
): "paid" | "debt" {
  if (status === "Đã thanh toán" || status === "paid") return "paid";
  if (status === "Nợ dai" || status === "debt") return "debt";
  if (isPaid === true) return "paid";
  return "debt";
}

function mapRow(row: DbRow): OnlineRepair {
  const paymentStatus = paymentStatusToUi(row.payment_status);
  return {
    id: String(row.id),
    createdAt: toLocalDateTimeString(row.created_at),
    customerName: String(row.customer_name),
    customerType: (row.customer_type || "Vãng lai") as OnlineRepair["customerType"],
    deviceName: String(row.device_name),
    issue: String(row.issue ?? ""),
    quote: Number(row.quote),
    deposit: Number(row.deposit),
    receiveDate: toLocalDateTimeString(row.receive_at).replace(" ", "T"),
    completeDate: toLocalDateTimeString(row.complete_at).replace(" ", "T"),
    paymentDate: toLocalDateTimeString(row.payment_at).replace(" ", "T"),
    paymentStatus,
    rewardPoints: Number(row.reward_points ?? 0),
    isPaid: paymentStatus === "Đã thanh toán",
  };
}

export async function repoListSoftwareOrders(): Promise<OnlineRepair[]> {
  const { rows } = await getPool().query<DbRow>(
    `select *
     from public.software_orders
     order by receive_at desc nulls last, created_at desc`
  );
  return rows.map(mapRow);
}

export async function repoUpsertSoftwareOrder(
  input: SoftwareOrderUpsertInput
): Promise<OnlineRepair> {
  const paymentStatus = paymentStatusToDb(input.paymentStatus, input.isPaid);
  const receiveAt = toIsoOrNull(input.receiveDate) ?? new Date().toISOString();
  const completeAt = toIsoOrNull(input.completeDate);
  const paymentAt =
    toIsoOrNull(input.paymentDate) ??
    (paymentStatus === "paid" ? new Date().toISOString() : null);

  if (input.id) {
    const { rows } = await getPool().query<DbRow>(
      `update public.software_orders set
        customer_name = $1,
        customer_type = $2,
        device_name = $3,
        issue = $4,
        quote = $5,
        deposit = $6,
        receive_at = $7::timestamptz,
        complete_at = $8::timestamptz,
        payment_at = $9::timestamptz,
        payment_status = $10,
        reward_points = $11,
        updated_at = now()
      where id = $12
      returning *`,
      [
        input.customerName.trim(),
        input.customerType || "Vãng lai",
        input.deviceName.trim(),
        input.issue ?? "",
        Math.round(Number(input.quote) || 0),
        Math.round(Number(input.deposit) || 0),
        receiveAt,
        completeAt,
        paymentAt,
        paymentStatus,
        Math.round(Number(input.rewardPoints) || 0),
        input.id,
      ]
    );
    if (!rows[0]) throw new Error("Không tìm thấy đơn phần mềm để cập nhật.");
    const updated = mapRow(rows[0]);
    await ensureSoftwareLookups(updated, input.lookupStoreId);
    return updated;
  }

  const { rows } = await getPool().query<DbRow>(
    `insert into public.software_orders (
      customer_name, customer_type, device_name, issue,
      quote, deposit, receive_at, complete_at, payment_at,
      payment_status, reward_points
    ) values (
      $1,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9::timestamptz,$10,$11
    ) returning *`,
    [
      input.customerName.trim(),
      input.customerType || "Vãng lai",
      input.deviceName.trim(),
      input.issue ?? "",
      Math.round(Number(input.quote) || 0),
      Math.round(Number(input.deposit) || 0),
      receiveAt,
      completeAt,
      paymentAt,
      paymentStatus,
      Math.round(Number(input.rewardPoints) || 0),
    ]
  );
  const created = mapRow(rows[0]);
  await ensureSoftwareLookups(created, input.lookupStoreId);
  return created;
}
