import type { OnlineRepair } from "@/types";
import { toVnDateTimeLocal, vnDateTimeLocalToIso } from "@/lib/datetime";
import { getPool } from "./pool";

export type SoftwareOrderUpsertInput = Omit<OnlineRepair, "id" | "createdAt" | "isPaid"> & {
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
  quote: string | number;
  deposit: string | number;
  receive_at: Date | string | null;
  complete_at: Date | string | null;
  payment_at: Date | string | null;
  payment_status: "paid" | "debt";
  reward_points: number;
  created_at: Date | string;
};

/** DB timestamptz → datetime-local wall clock Vietnam. */
function toLocalDateTimeString(value: Date | string | null | undefined): string {
  return toVnDateTimeLocal(value).replace("T", " ");
}

/** datetime-local from UI (giờ VN) → ISO UTC. */
function toIsoOrNull(value: string | undefined | null): string | null {
  return vnDateTimeLocalToIso(value);
}

function paymentStatusToUi(status: "paid" | "debt"): OnlineRepair["paymentStatus"] {
  return status === "paid" ? "Đã thanh toán" : "NỢ DAI";
}

function paymentStatusToDb(
  status: OnlineRepair["paymentStatus"] | string,
  isPaid?: boolean
): "paid" | "debt" {
  if (status === "Đã thanh toán" || status === "paid") return "paid";
  if (status === "NỢ DAI" || status === "Nợ dai" || status === "debt") return "debt";
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
  const actor = normalizeActorUsername(input.actorUsername);

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
        updated_by = coalesce($12, updated_by),
        updated_at = now()
      where id = $13
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
        actor,
        input.id,
      ]
    );
    if (!rows[0]) throw new Error("Không tìm thấy đơn phần mềm để cập nhật.");
    return mapRow(rows[0]);
  }

  const { rows } = await getPool().query<DbRow>(
    `insert into public.software_orders (
      customer_name, customer_type, device_name, issue,
      quote, deposit, receive_at, complete_at, payment_at,
      payment_status, reward_points,
      created_by, updated_by
    ) values (
      $1,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9::timestamptz,$10,$11,$12,$12
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
      actor,
    ]
  );
  return mapRow(rows[0]);
}

/**
 * Đánh dấu hàng loạt đơn NỢ DAI → Đã thanh toán.
 * Chỉ cập nhật id có payment_status = debt; bỏ qua đơn đã TT.
 */
export async function repoMarkSoftwareOrdersPaid(
  ids: string[],
  actorUsername?: string
): Promise<OnlineRepair[]> {
  const clean = [
    ...new Set(
      ids
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    ),
  ];
  if (!clean.length) return [];

  const actor = normalizeActorUsername(actorUsername);
  const { rows } = await getPool().query<DbRow>(
    `update public.software_orders
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

/** Xóa cứng đơn phần mềm theo id (UUID). */
export async function repoDeleteSoftwareOrder(id: string): Promise<OnlineRepair> {
  const orderId = String(id || "").trim();
  if (!orderId) throw new Error("Thiếu mã đơn phần mềm.");

  const { rows } = await getPool().query<DbRow>(
    `delete from public.software_orders where id = $1 returning *`,
    [orderId]
  );
  if (!rows[0]) throw new Error("Không tìm thấy đơn phần mềm để xóa.");
  return mapRow(rows[0]);
}
