import type { OnlineRepair } from "@/types";
import { toVnDateTimeLocal, vnDateTimeLocalToIso } from "@/lib/datetime";
import { getPool } from "./pool";
import { repoEnsureLookupLabels } from "./inventoryRepo";

export type SoftwareOrderUpsertInput = Omit<OnlineRepair, "id" | "createdAt" | "isPaid"> & {
  id?: string;
  createdAt?: string;
  isPaid?: boolean;
  /** Cửa hàng sở hữu droplist (ensure option khi lưu đơn). */
  lookupStoreId?: string;
  /** Username app_accounts — ghi created_by / updated_by. */
  actorUsername?: string;
};

function normalizeActorUsername(value?: string | null): string | null {
  const t = String(value ?? "").trim();
  return t || null;
}

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
    const updated = mapRow(rows[0]);
    await ensureSoftwareLookups(updated, input.lookupStoreId);
    return updated;
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
  const created = mapRow(rows[0]);
  await ensureSoftwareLookups(created, input.lookupStoreId);
  return created;
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
