/** Test repoAddLookupLabel for accessory_category */
const fs = require("fs");
const path = require("path");

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
  // dynamic import compiled? use pg directly calling same SQL flow
  const { Client } = require("pg");
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const label = "TEST-CAT-" + Date.now();
  await client.query("begin");
  const cat = await client.query(
    `select id, allow_user_add from public.lookup_categories where code=$1 and is_active`,
    ["accessory_category"]
  );
  const store = await client.query(`select id from public.stores where code=$1`, ["store-1"]);
  console.log("cat", cat.rows[0], "store", store.rows[0]?.id);
  const ins = await client.query(
    `insert into public.lookup_items (category_id, store_id, code, label, sort_order, is_system)
     values ($1,$2,$3,$4,10,false) returning label`,
    [cat.rows[0].id, store.rows[0].id, "t-" + Date.now(), label]
  );
  console.log("added", ins.rows[0]);
  await client.query("rollback");
  console.log("ok rollback");
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
