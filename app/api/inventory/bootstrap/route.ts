import { NextResponse } from "next/server";
import { repoInventoryBootstrap } from "@/lib/db/inventoryRepo";
import { isMaxConnSessionError } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

/** Phone + accessory + software droplist categories (per store). */
const BOOTSTRAP_LOOKUP_CODES = [
  "phone_brand",
  "phone_model_name",
  "phone_color",
  "phone_storage",
  "phone_made_in",
  "phone_condition",
  "phone_battery_condition",
  "phone_battery_capacity",
  "accessory_category",
  "accessory_brand",
  "accessory_code",
  "accessory_name",
  "accessory_price",
  "accessory_cost",
  "software_customer",
  "software_device",
  "software_quote",
  "software_fee",
  "repair_customer",
  "repair_device",
  "repair_condition",
  "repair_warranty",
  "repair_quote",
  "repair_fee",
  "sale_warranty",
  "part_distributor",
  "part_type",
  "part_brand",
  "part_color",
];

export async function GET() {
  try {
    const data = await repoInventoryBootstrap(BOOTSTRAP_LOOKUP_CODES);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi tải kho";
    if (isMaxConnSessionError(err)) {
      return NextResponse.json(
        {
          error:
            "Hết slot kết nối DB (session pool). Đợi vài giây rồi Thử lại, hoặc chạy: node scripts/kill-idle-sessions.js",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
