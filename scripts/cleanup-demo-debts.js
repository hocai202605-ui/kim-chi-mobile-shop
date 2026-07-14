/**
 * Xóa nợ tay demo: note chứa [DEMO-DEBT]
 * Usage: node scripts/cleanup-demo-debts.js
 */
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
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Missing DIRECT_URL / DATABASE_URL");
    process.exit(1);
  }
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const before = await client.query(
      `select id, customer_name, title, note
       from public.manual_debts
       where note like '%[DEMO-DEBT]%'
          or note like '%[DEMO-SEED]%'`
    );
    console.log("Found demo debts:", before.rowCount);
    for (const r of before.rows) {
      console.log(" -", r.customer_name, "|", r.title);
    }
    const del = await client.query(
      `delete from public.manual_debts
       where note like '%[DEMO-DEBT]%'
          or note like '%[DEMO-SEED]%'`
    );
    console.log("Deleted:", del.rowCount);
    const left = await client.query(
      `select count(*)::int as n from public.manual_debts`
    );
    console.log("Remaining manual_debts:", left.rows[0].n);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
