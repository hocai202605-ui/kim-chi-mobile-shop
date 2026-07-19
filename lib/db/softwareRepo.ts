import type { OnlineRepair } from "@/types";
import { toVnDateTimeLocal, vnDateTimeLocalToIso } from "@/lib/datetime";
import { getPool } from "./pool";

export type SoftwareOrderUpsertInput = Omit<OnlineRepair, "id" | "createdAt" | "isPaid"> & {
  id?: string;
  createdAt?: string;
  isPaid?: boolean;
  /** Username app_accounts — ghi created_by / updated_by. */
  actorUsername?: string;
  /** store-1|2|3 — gắn cửa hàng đơn (staff/owner CH). */
  storeId?: string;
};

function normalizeActorUsername(value?: string | null): string | null {
  const t = String(value ?? "").trim();
  return t || null;
}

async function resolveStoreUuid(storeCode?: string | null): Promise<string | null> {
  const code = String(storeCode || "").trim();
  if (!code || code === "all") return null;
  const { rows } = await getPool().query<{ id: string }>(
    `select id from public.stores where code = $1 and is_active = true limit 1`,
    [code]
  );
  return rows[0]?.id ?? null;
}

/** CH của actor (app_accounts.store_code); fallback store-1. */
async function resolveActorStoreCode(actorUsername?: string | null): Promise<string> {
  const u = normalizeActorUsername(actorUsername);
  if (!u) return "store-1";
  const { rows } = await getPool().query<{ store_code: string }>(
    `select store_code from public.app_accounts where lower(username) = lower($1) limit 1`,
    [u]
  );
  return rows[0]?.store_code?.trim() || "store-1";
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
  store_id?: string | null;
  created_by?: string | null;
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

/**
 * Liệt kê đơn PM.
 * - null/"all" → toàn bộ (chỉ gọi khi đã xác thực owner)
 * - store-1|2|3 → CHỈ đơn `store_id` đúng CH
 */
export async function repoListSoftwareOrders(
  storeCode?: string | null
): Promise<OnlineRepair[]> {
  const store =
    storeCode && storeCode !== "all" ? String(storeCode).trim() : null;
  if (!store) {
    const { rows } = await getPool().query<DbRow>(
      `select *
       from public.software_orders
       order by receive_at desc nulls last, created_at desc`
    );
    return rows.map(mapRow);
  }

  const storeUuid = await resolveStoreUuid(store);
  if (!storeUuid) return [];
  const { rows } = await getPool().query<DbRow>(
    `select so.*
     from public.software_orders so
     where so.store_id = $1::uuid
     order by so.receive_at desc nulls last, so.created_at desc`,
    [storeUuid]
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
  const storeCode =
    (input.storeId && input.storeId !== "all" ? input.storeId : null) ||
    (await resolveActorStoreCode(actor));
  const storeUuid = await resolveStoreUuid(storeCode);

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
        store_id = coalesce($13::uuid, store_id),
        updated_at = now()
      where id = $14
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
        storeUuid,
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
      created_by, updated_by, store_id
    ) values (
      $1,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9::timestamptz,$10,$11,$12,$12,$13::uuid
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
      storeUuid,
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
  const clean = Array.from(
    new Set(
      ids
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    )
  );
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
