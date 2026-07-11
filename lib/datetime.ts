/** Vietnam wall-clock helpers (Asia/Ho_Chi_Minh, UTC+7). */

export const VN_TIMEZONE = "Asia/Ho_Chi_Minh";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Instant → calendar/time parts in Vietnam. */
export function toVnParts(value: Date | string | number = new Date()): DateTimeParts | null {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: VN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? NaN);

  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  const second = get("second");
  if (![year, month, day, hour, minute, second].every((n) => Number.isFinite(n))) {
    return null;
  }
  return { year, month, day, hour, minute, second };
}

/** Now → YYYY-MM-DD (VN). */
export function vnNowDate(): string {
  const p = toVnParts(new Date());
  if (!p) return new Date().toISOString().slice(0, 10);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** Now → YYYY-MM (VN). */
export function vnNowMonth(): string {
  const p = toVnParts(new Date());
  if (!p) return new Date().toISOString().slice(0, 7);
  return `${p.year}-${pad2(p.month)}`;
}

/** Now → YYYY (VN). */
export function vnNowYear(): number {
  return toVnParts(new Date())?.year ?? new Date().getFullYear();
}

/** Now → YYYY-MM-DDTHH:mm for datetime-local (VN). */
export function vnNowDateTimeLocal(): string {
  const p = toVnParts(new Date());
  if (!p) return new Date().toISOString().slice(0, 16);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}

/**
 * UTC Date/ISO → YYYY-MM-DDTHH:mm (Vietnam wall clock).
 * Empty / invalid → "".
 */
export function toVnDateTimeLocal(value: Date | string | null | undefined): string {
  if (value == null || value === "") return "";
  // Already local form without Z — treat as wall string
  if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
      return s.slice(0, 16).replace(" ", "T");
    }
  }
  const p = toVnParts(value);
  if (!p) return "";
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** UTC → YYYY-MM-DD (calendar day in Vietnam). */
export function toVnDate(value: Date | string | null | undefined): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (m && !value.includes("T") && !value.includes(" ")) return m[1];
  }
  const p = toVnParts(value);
  if (!p) return "";
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/**
 * datetime-local / "YYYY-MM-DD HH:mm" as **Vietnam** wall clock → ISO UTC.
 */
export function vnDateTimeLocalToIso(value: string | null | undefined): string | null {
  if (!value || !String(value).trim()) return null;
  const s = String(value).trim().replace(" ", "T");
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }
  const sec = m[4] ?? "00";
  // Fixed offset +07:00 (Vietnam does not observe DST)
  const d = new Date(`${m[1]}T${m[2]}:${m[3]}:${sec}+07:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Display helper: "YYYY-MM-DD HH:mm" in VN. */
export function formatVnDateTime(value: Date | string | null | undefined): string {
  const local = toVnDateTimeLocal(value);
  return local ? local.replace("T", " ") : "";
}
