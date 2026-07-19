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

async function main() {
  const c = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const acc = await c.query(
    `select username, role, store_code, allowed_menus
     from app_accounts
     where lower(username) in ('caobac','kieuvy','kimchi','admin','quynhbupbe')
     order by username`
  );
  console.log("ACCOUNTS:");
  for (const r of acc.rows) {
    console.log(
      `  ${r.username} role=${r.role} store=${r.store_code} menus=${JSON.stringify(r.allowed_menus)}`
    );
  }

  for (const code of ["store-1", "store-2", "store-3"]) {
    const r = await c.query(
      `select count(*)::int n from repair_orders ro
       join stores s on s.id = ro.store_id where s.code = $1`,
      [code]
    );
    const s = await c.query(
      `select count(*)::int n from software_orders so
       join stores st on st.id = so.store_id where st.code = $1`,
      [code]
    );
    console.log(`${code}: repair=${r.rows[0].n} software=${s.rows[0].n}`);
  }

  // Simulate list filter for store-2 / store-3
  for (const store of ["store-2", "store-3"]) {
    const storeUuid = (
      await c.query(`select id from stores where code=$1`, [store])
    ).rows[0]?.id;
    const rows = await c.query(
      `select count(*)::int n
       from repair_orders ro
       left join app_accounts a
         on lower(a.username) = lower(nullif(trim(ro.created_by), ''))
       left join stores st on st.id = ro.store_id
       where
         ($1::uuid is not null and ro.store_id = $1)
         or (ro.store_id is null and coalesce(a.store_code, 'store-1') = $2)
         or (ro.store_id is not null and st.code = $2)`,
      [storeUuid, store]
    );
    console.log(`filter repair for ${store}: ${rows.rows[0].n} rows`);
  }

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
