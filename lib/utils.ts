/** Generic helpers (cn-class, id gen, …) — mở rộng khi refactor */

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function createId(prefix: string) {
  return `${prefix}${Date.now()}`;
}

/** Postgres uuid text (8-4-4-4-12 hex). Rejects mock ids like `part-seed-1`. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  return UUID_RE.test(String(value || "").trim());
}
