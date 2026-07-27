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
  path.join(
    root,
    "supabase/migrations/20260727120000_own_debt_lookup_categories.sql"
  ),
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
  const cats = await c.query(
    `select code, name from public.lookup_categories
     where code like 'own_debt_%' order by sort_order`
  );
  console.log("own debt lookup categories:", cats.rows);
  const counts = await c.query(
    `select c.code, count(i.id)::int as n
     from public.lookup_categories c
     left join public.lookup_items i on i.category_id = c.id and i.is_active
     where c.code like 'own_debt_%'
     group by c.code
     order by c.code`
  );
  console.log("active items:", counts.rows);
  await c.end();
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
