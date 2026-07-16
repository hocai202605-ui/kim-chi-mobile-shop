/** Format helpers — tiền & input số (vi-VN) */

/** Inventory shop unit: 1 = 1.000 ₫ (bớt 3 số 0 khi ghi/hiện). */
export const SHOP_MONEY_SCALE = 1000;

export function formatMoney(value: number) {
  return value.toLocaleString("vi-VN");
}

export function formatInputMoney(value?: number | string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("vi-VN") : "";
}

export function parseInputMoney(value: FormDataEntryValue | null | string) {
  return Number(String(value ?? "").replace(/\D/g, "") || 0);
}

/** Short (DB/UI kho) → VND thật (16.900 → 16_900_000). */
export function shopMoneyToVnd(short: number): number {
  if (!Number.isFinite(short) || short <= 0) return 0;
  return Math.round(short) * SHOP_MONEY_SCALE;
}

/**
 * VND thật (cột sales/sale_items) → short UI kho.
 * Luôn chia 1000 (khác `toShopMoney` heuristic cho form).
 * VD: 150_000 → 150, -24_850_000 → -24_850.
 */
export function vndToShopMoney(vnd: number): number {
  if (!Number.isFinite(vnd)) return 0;
  return Math.round(vnd / SHOP_MONEY_SCALE);
}

/**
 * Chuẩn hóa về đơn vị short khi ghi/load.
 * - 16900 → 16900
 * - 16_900_000 (lỡ full VND) → 16900
 */
export function toShopMoney(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  const r = Math.round(n);
  if (r >= 1_000_000) return Math.round(r / SHOP_MONEY_SCALE);
  return r;
}

/** Parse form → short shop unit (16.900 → 16900, không nhân 1000). */
export function parseShopMoney(value: FormDataEntryValue | null | string): number {
  return toShopMoney(parseInputMoney(value));
}
