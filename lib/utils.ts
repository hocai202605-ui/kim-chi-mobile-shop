/** Generic helpers (cn-class, id gen, …) — mở rộng khi refactor */

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function createId(prefix: string) {
  return `${prefix}${Date.now()}`;
}
