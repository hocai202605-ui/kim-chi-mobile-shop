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

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const cats = await client.query(
    `select code, allow_user_add, is_active, name
     from public.lookup_categories
     where code like 'accessory_%'
     order by code`
  );
  console.log("categories:", cats.rows);
  const counts = await client.query(
    `select c.code, count(i.id)::int as items
     from public.lookup_categories c
     left join public.lookup_items i on i.category_id = c.id and i.is_active
     where c.code like 'accessory_%'
     group by c.code
     order by c.code`
  );
  console.log("item counts:", counts.rows);

  // try add like API
  try {
    const store = await client.query(
      `select id, code from public.stores where code = 'store-1' limit 1`
    );
    console.log("store-1", store.rows[0]);
  } catch (e) {
    console.error(e);
  }
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
