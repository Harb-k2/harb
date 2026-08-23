import mysql from "mysql2/promise";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL غير متاح في هذه البيئة.");

const url = new URL(connectionString);
const connection = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ""),
  connectTimeout: 10_000,
  ssl: { rejectUnauthorized: true },
  enableKeepAlive: false,
});

try {
  await connection.ping();
  if (process.argv.includes("--base-model-table")) {
    const [rows] = await connection.query("SHOW TABLES LIKE 'base_model_selections'");
    console.log(rows.length ? "BASE_MODEL_TABLE_EXISTS" : "BASE_MODEL_TABLE_MISSING");
  } else if (process.argv.includes("--migration-ledger")) {
    const [tables] = await connection.query("SHOW TABLES LIKE '__drizzle_migrations'");
    if (!tables.length) {
      console.log("DRIZZLE_LEDGER_MISSING");
    } else {
      const [rows] = await connection.query("SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at ASC");
      console.log(`DRIZZLE_LEDGER_COUNT=${rows.length}`);
      if (process.argv.includes("--migration-ledger-details")) console.log(rows.map(row => `${row.created_at}:${row.hash}`).join("\n"));
    }
  } else {
    console.log("DB_CONNECTION_OK");
  }
} finally {
  await connection.end();
}
