const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i < 1 || line.startsWith("#")) continue;
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  process.env[k] = v;
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL / DIRECT_URL");
  process.exit(1);
}

const sql = fs.readFileSync(
  path.join(root, "supabase/migrations/20260719170000_part_inbounds.sql"),
  "utf8"
);

async function main() {
  const c = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  await c.query(sql);
  const r = await c.query(
    `select coalesce(st.code,'null') as code, count(*)::int n
     from part_inbounds p
     left join stores st on st.id = p.store_id
     group by 1 order by 1`
  );
  console.log("part_inbounds by store:", r.rows);
  await c.end();
  console.log("OK part_inbounds migration");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
