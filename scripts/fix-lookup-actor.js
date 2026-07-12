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

  const before = await client.query(
    `select id, label, created_by, updated_by
     from public.lookup_items
     where created_by is distinct from 'quynhbupbe'
        or updated_by is distinct from 'quynhbupbe'
     limit 20`
  );
  console.log("before mismatch:", before.rows);

  const upd = await client.query(
    `update public.lookup_items
     set created_by = 'quynhbupbe', updated_by = 'quynhbupbe'
     where created_by is distinct from 'quynhbupbe'
        or updated_by is distinct from 'quynhbupbe'`
  );
  console.log("updated rows:", upd.rowCount);

  const after = await client.query(
    `select count(*)::int as total,
            count(*) filter (where created_by = 'quynhbupbe' and updated_by = 'quynhbupbe')::int as ok
     from public.lookup_items`
  );
  console.log("after:", after.rows[0]);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
