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
  } else {
    console.log("DB_CONNECTION_OK");
  }
} finally {
  await connection.end();
}
