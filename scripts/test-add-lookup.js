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
  const cols = await client.query(
    `select column_name, data_type
     from information_schema.columns
     where table_schema='public' and table_name='lookup_items'
     order by ordinal_position`
  );
  console.log("lookup_items columns:");
  cols.rows.forEach((r) => console.log(" ", r.column_name, r.data_type));

  // Simulate add like API with actor username
  try {
    await client.query("begin");
    const cat = await client.query(
      `select id from public.lookup_categories where code='accessory_category' limit 1`
    );
    const store = await client.query(
      `select id from public.stores where code='store-1' limit 1`
    );
    const code = "test-opt-" + Date.now();
    const ins = await client.query(
      `insert into public.lookup_items (category_id, store_id, code, label, sort_order, is_system)
       values ($1,$2,$3,$4,10,false) returning id, label`,
      [cat.rows[0].id, store.rows[0].id, code, "TEST OPT " + Date.now()]
    );
    console.log("insert ok", ins.rows[0]);
    try {
      await client.query(
        `update public.lookup_items
         set created_by = coalesce(created_by, $2),
             updated_by = $2,
             updated_at = now()
         where id = $1`,
        [ins.rows[0].id, "admin"]
      );
      console.log("update actor as text 'admin': OK");
    } catch (e) {
      console.log("update actor as text FAILED:", e.message);
    }
    await client.query("rollback");
    console.log("rolled back test");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    console.error("test failed", e.message);
  }
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
