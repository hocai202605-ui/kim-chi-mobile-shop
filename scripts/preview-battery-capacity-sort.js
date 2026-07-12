/**
 * Preview phone_battery_capacity sort order (same rules as repoSortLookupLabels).
 * Usage: node scripts/preview-battery-capacity-sort.js
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i <= 0 || line.startsWith("#")) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function batteryCapacitySortKey(label) {
  const s = String(label).trim();
  const isMah = /mah/i.test(s);
  const isPct = /%|dưới|duoi/i.test(s);

  if (isMah) {
    const m = s.match(/(\d+(?:[.,]\d+)?)/);
    const n = m ? Number(m[1].replace(",", ".")) : 0;
    return { grp: 1, rank: Number.isFinite(n) ? n : 0, kind: "mAh" };
  }

  if (isPct) {
    const range = s.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)/);
    if (range) {
      const a = Number(range[1].replace(",", "."));
      const b = Number(range[2].replace(",", "."));
      const mid = (a + b) / 2;
      return { grp: 0, rank: Number.isFinite(mid) ? -mid : 0, kind: "%" };
    }
    const m = s.match(/(\d+(?:[.,]\d+)?)/);
    let n = m ? Number(m[1].replace(",", ".")) : 0;
    if (!Number.isFinite(n)) n = 0;
    if (/dưới|duoi/i.test(s)) n -= 0.5;
    return { grp: 0, rank: -n, kind: "%" };
  }

  const bare = s.match(/^(\d+(?:[.,]\d+)?)$/);
  if (bare) {
    const n = Number(bare[1].replace(",", "."));
    if (Number.isFinite(n) && n >= 500) return { grp: 1, rank: n, kind: "mAh?" };
    if (Number.isFinite(n)) return { grp: 0, rank: -n, kind: "%?" };
  }

  return { grp: 2, rank: 0, kind: "khác" };
}

function compare(a, b) {
  const ka = batteryCapacitySortKey(a);
  const kb = batteryCapacitySortKey(b);
  if (ka.grp !== kb.grp) return ka.grp - kb.grp;
  if (ka.rank !== kb.rank) return ka.rank - kb.rank;
  return a.localeCompare(b, "vi", { numeric: true, sensitivity: "base" });
}

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows } = await client.query(
    `select s.code as store, i.label, i.sort_order
     from public.lookup_items i
     join public.lookup_categories c on c.id = i.category_id
     join public.stores s on s.id = i.store_id
     where c.code = 'phone_battery_capacity' and i.is_active
     order by s.code, i.sort_order, i.label`
  );

  const byStore = {};
  for (const r of rows) {
    if (!byStore[r.store]) byStore[r.store] = [];
    byStore[r.store].push(r.label);
  }

  for (const [store, labels] of Object.entries(byStore)) {
    console.log("\n===", store, "— HIỆN TẠI (sort_order DB) ===");
    labels.forEach((l, i) => console.log(String(i + 1).padStart(2), l));

    const sorted = [...new Set(labels)].sort(compare);
    console.log("\n===", store, "— SAU KHI BẤM SORT ===");
    sorted.forEach((l, i) => {
      const k = batteryCapacitySortKey(l);
      console.log(
        String(i + 1).padStart(2),
        l.padEnd(20),
        `  [${k.kind} grp=${k.grp}]`
      );
    });
  }

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
