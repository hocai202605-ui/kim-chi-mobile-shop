import type { ShopRepairOrder } from "@/types";
import { toVnDateTimeLocal, vnDateTimeLocalToIso } from "@/lib/datetime";
import { getPool } from "./pool";

export type RepairOrderUpsertInput = Omit<ShopRepairOrder, "id" | "createdAt" | "isPaid"> & {
  id?: string;
  createdAt?: string;
  isPaid?: boolean;
  /** Username app_accounts — ghi created_by / updated_by. */
  actorUsername?: string;
};

function normalizeActorUsername(value?: string | null): string | null {
  const t = String(value ?? "").trim();
  return t || null;
}

type DbRow = {
  id: string;
  customer_name: string;
  customer_type: string;
  device_name: string;
  issue: string;
  device_condition: string;
  warranty: string;
  imei: string;
  phone_or_pass: string;
  quote: string | number;
  deposit: string | number;
  receive_at: Date | string | null;
  complete_at: Date | string | null;
  payment_at: Date | string | null;
  payment_status: "paid" | "debt";
  payment_method?: string | null;
  reward_points: number;
  created_at: Date | string;
};

function paymentMethodToUi(
  raw: string | null | undefined
): NonNullable<ShopRepairOrder["paymentMethod"]> {
  const t = String(raw ?? "").trim();
  if (t === "Chuyển khoản" || t.toLowerCase() === "transfer") return "Chuyển khoản";
  return "Tiền mặt";
}

function paymentMethodToDb(
  raw: ShopRepairOrder["paymentMethod"] | string | undefined
): "Tiền mặt" | "Chuyển khoản" {
  const t = String(raw ?? "").trim();
  if (t === "Chuyển khoản" || t.toLowerCase() === "transfer") return "Chuyển khoản";
  return "Tiền mặt";
}

/** DB timestamptz → datetime-local wall clock Vietnam. */
function toLocalDateTimeString(value: Date | string | null | undefined): string {
  return toVnDateTimeLocal(value).replace("T", " ");
}

/** datetime-local from UI (giờ VN) → ISO UTC. */
function toIsoOrNull(value: string | undefined | null): string | null {
  return vnDateTimeLocalToIso(value);
}

function paymentStatusToUi(status: "paid" | "debt"): ShopRepairOrder["paymentStatus"] {
  return status === "paid" ? "Đã thanh toán" : "NỢ DAI";
}

function paymentStatusToDb(
  status: ShopRepairOrder["paymentStatus"] | string,
  isPaid?: boolean
): "paid" | "debt" {
  if (status === "Đã thanh toán" || status === "paid") return "paid";
  if (status === "NỢ DAI" || status === "Nợ dai" || status === "debt") return "debt";
  if (isPaid === true) return "paid";
  return "debt";
}

function mapRow(row: DbRow): ShopRepairOrder {
  const paymentStatus = paymentStatusToUi(row.payment_status);
  return {
    id: String(row.id),
    createdAt: toLocalDateTimeString(row.created_at),
    customerName: String(row.customer_name),
    customerType: (row.customer_type || "Vãng lai") as ShopRepairOrder["customerType"],
    deviceName: String(row.device_name),
    issue: String(row.issue ?? ""),
    condition: String(row.device_condition ?? ""),
    warranty: String(row.warranty ?? ""),
    imei: String(row.imei ?? ""),
    phoneOrPass: String(row.phone_or_pass ?? ""),
    quote: Number(row.quote),
    deposit: Number(row.deposit),
    receiveDate: toLocalDateTimeString(row.receive_at).replace(" ", "T"),
    completeDate: toLocalDateTimeString(row.complete_at).replace(" ", "T"),
    paymentDate: toLocalDateTimeString(row.payment_at).replace(" ", "T"),
    paymentStatus,
    paymentMethod: paymentMethodToUi(row.payment_method),
    rewardPoints: Number(row.reward_points ?? 0),
    isPaid: paymentStatus === "Đã thanh toán",
  };
}

export async function repoListRepairOrders(): Promise<ShopRepairOrder[]> {
  const { rows } = await getPool().query<DbRow>(
    `select *
     from public.repair_orders
     order by receive_at desc nulls last, created_at desc`
  );
  return rows.map(mapRow);
}

export async function repoUpsertRepairOrder(
  input: RepairOrderUpsertInput
): Promise<ShopRepairOrder> {
  const paymentStatus = paymentStatusToDb(input.paymentStatus, input.isPaid);
  const receiveAt = toIsoOrNull(input.receiveDate) ?? new Date().toISOString();
  const completeAt = toIsoOrNull(input.completeDate);
  const paymentAt =
    toIsoOrNull(input.paymentDate) ??
    (paymentStatus === "paid" ? new Date().toISOString() : null);
  const actor = normalizeActorUsername(input.actorUsername);

  const paymentMethod = paymentMethodToDb(input.paymentMethod);

  if (input.id) {
    const { rows } = await getPool().query<DbRow>(
      `update public.repair_orders set
        customer_name = $1,
        customer_type = $2,
        device_name = $3,
        issue = $4,
        device_condition = $5,
        warranty = $6,
        imei = $7,
        phone_or_pass = $8,
        quote = $9,
        deposit = $10,
        receive_at = $11::timestamptz,
        complete_at = $12::timestamptz,
        payment_at = $13::timestamptz,
        payment_status = $14,
        reward_points = $15,
        payment_method = $16,
        updated_by = coalesce($17, updated_by),
        updated_at = now()
      where id = $18
      returning *`,
      [
        input.customerName.trim() || "Khách lẻ",
        input.customerType || "Vãng lai",
        input.deviceName.trim() || "Máy",
        input.issue ?? "",
        input.condition ?? "",
        input.warranty ?? "",
        input.imei ?? "",
        input.phoneOrPass ?? "",
        Math.round(Number(input.quote) || 0),
        Math.round(Number(input.deposit) || 0),
        receiveAt,
        completeAt,
        paymentAt,
        paymentStatus,
        Math.round(Number(input.rewardPoints) || 0),
        paymentMethod,
        actor,
        input.id,
      ]
    );
    if (!rows[0]) throw new Error("Không tìm thấy đơn sửa chữa để cập nhật.");
    return mapRow(rows[0]);
  }

  const { rows } = await getPool().query<DbRow>(
    `insert into public.repair_orders (
      customer_name, customer_type, device_name, issue,
      device_condition, warranty, imei, phone_or_pass,
      quote, deposit, receive_at, complete_at, payment_at,
      payment_status, reward_points, payment_method,
      created_by, updated_by
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11::timestamptz,$12::timestamptz,$13::timestamptz,$14,$15,$16,$17,$17
    ) returning *`,
    [
      input.customerName.trim() || "Khách lẻ",
      input.customerType || "Vãng lai",
      input.deviceName.trim() || "Máy",
      input.issue ?? "",
      input.condition ?? "",
      input.warranty ?? "",
      input.imei ?? "",
      input.phoneOrPass ?? "",
      Math.round(Number(input.quote) || 0),
      Math.round(Number(input.deposit) || 0),
      receiveAt,
      completeAt,
      paymentAt,
      paymentStatus,
      Math.round(Number(input.rewardPoints) || 0),
      paymentMethod,
      actor,
    ]
  );
  return mapRow(rows[0]);
}

/**
 * Đánh dấu hàng loạt đơn NỢ DAI → Đã thanh toán.
 * Chỉ cập nhật id có payment_status = debt.
 */
export async function repoMarkRepairOrdersPaid(
  ids: string[],
  actorUsername?: string
): Promise<ShopRepairOrder[]> {
  const clean = Array.from(
    new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))
  );
  if (!clean.length) return [];

  const actor = normalizeActorUsername(actorUsername);
  const { rows } = await getPool().query<DbRow>(
    `update public.repair_orders
     set payment_status = 'paid',
         payment_at = now(),
         updated_by = coalesce($2, updated_by),
         updated_at = now()
     where id = any($1::uuid[])
       and payment_status = 'debt'
     returning *`,
    [clean, actor]
  );
  return rows.map(mapRow);
}

/** Xóa cứng đơn sửa chữa theo id (UUID). */
export async function repoDeleteRepairOrder(id: string): Promise<ShopRepairOrder> {
  const orderId = String(id || "").trim();
  if (!orderId) throw new Error("Thiếu mã đơn sửa chữa.");

  const { rows } = await getPool().query<DbRow>(
    `delete from public.repair_orders where id = $1 returning *`,
    [orderId]
  );
  if (!rows[0]) throw new Error("Không tìm thấy đơn sửa chữa để xóa.");
  return mapRow(rows[0]);
}
