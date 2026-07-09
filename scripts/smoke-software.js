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
  const cols = await c.query(`
    select column_name from information_schema.columns
    where table_schema='public' and table_name='software_orders'
    order by ordinal_position
  `);
  console.log(
    "columns:",
    cols.rows.map((r) => r.column_name).join(", ")
  );

  const ins = await c.query(
    `insert into public.software_orders
      (customer_name, device_name, quote, deposit, payment_status, receive_at)
     values ('Smoke Test', 'iPhone 13', 500000, 100000, 'debt', now())
     returning id, customer_name, payment_status`
  );
  console.log("insert:", ins.rows[0]);

  const upd = await c.query(
    `update public.software_orders set payment_status='paid', quote=600000
     where id=$1 returning id, quote, payment_status`,
    [ins.rows[0].id]
  );
  console.log("update:", upd.rows[0]);

  const del = await c.query(`delete from public.software_orders where id=$1`, [
    ins.rows[0].id,
  ]);
  console.log("cleanup deleted:", del.rowCount);

  const n = await c.query(`select count(*)::int as n from public.software_orders`);
  console.log("remaining:", n.rows[0].n);
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
