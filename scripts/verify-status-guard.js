const fs = require("fs");
const { Client } = require("pg");

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
}

(async () => {
  const c = new Client({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const t = await c.query(`
    select tgname from pg_trigger
    where tgrelid = 'public.phones'::regclass and not tgisinternal
  `);
  console.log("phone triggers:", t.rows);

  await c.query("begin");
  try {
    const r = await c.query(`
      update public.phones
      set status = 'cancelled', updated_at = now()
      where id in (select id from public.phones limit 1)
      returning id, status
    `);
    console.log("status update OK:", r.rows);
  } finally {
    await c.query("rollback");
  }
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
