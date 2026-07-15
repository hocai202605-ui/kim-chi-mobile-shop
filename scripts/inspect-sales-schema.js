const { Client } = require("pg");
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
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const pay = await c.query(
    `select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid
     where t.typname='payment_method' order by enumsortorder`
  );
  console.log("payment_method:", pay.rows.map((r) => r.enumlabel));

  const cols = await c.query(
    `select column_name, data_type from information_schema.columns
     where table_schema='public' and table_name='customers' order by ordinal_position`
  );
  console.log("customers:", cols.rows);

  const chk = await c.query(
    `select conname, pg_get_constraintdef(oid) as def
     from pg_constraint
     where conrelid='public.sale_items'::regclass and contype='c'`
  );
  console.log("sale_items checks:", chk.rows);

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
