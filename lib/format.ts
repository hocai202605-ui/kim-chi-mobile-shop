/** Format helpers — tiền & input số (vi-VN) */

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
