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
const sql = fs.readFileSync(
  path.join(root, "supabase/migrations/20260720120000_part_inbounds_brand.sql"),
  "utf8"
);

async function main() {
  if (!url) {
    console.error("Missing DATABASE_URL / DIRECT_URL in .env.local");
    process.exit(1);
  }
  const c = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  await c.query(sql);
  const r = await c.query(
    `select column_name from information_schema.columns
     where table_schema='public' and table_name='part_inbounds' and column_name='brand'`
  );
  console.log("brand column:", r.rows);
  await c.end();
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
