const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1].trim()] = v;
  }
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL / DIRECT_URL");
  process.exit(1);
}

const sql = fs.readFileSync(
  path.join(root, "supabase/migrations/20260719160000_software_repair_store_id.sql"),
  "utf8"
);

async function main() {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(sql);
  const a = await c.query(
    "select count(*)::int n from software_orders where store_id is null"
  );
  const b = await c.query(
    "select count(*)::int n from repair_orders where store_id is null"
  );
  const c1 = await c.query(
    `select coalesce(st.code,'null') as code, count(*)::int n
     from software_orders so
     left join stores st on st.id = so.store_id
     group by 1 order by 1`
  );
  const c2 = await c.query(
    `select coalesce(st.code,'null') as code, count(*)::int n
     from repair_orders ro
     left join stores st on st.id = ro.store_id
     group by 1 order by 1`
  );
  console.log("software null store_id:", a.rows[0]);
  console.log("repair null store_id:", b.rows[0]);
  console.log("software by store:", c1.rows);
  console.log("repair by store:", c2.rows);
  await c.end();
  console.log("OK migration applied");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
