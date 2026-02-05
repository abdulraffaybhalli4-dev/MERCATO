import dotenv from "dotenv";
import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });
const dbFile = process.env.DATABASE_FILE || "mercato-nero.sqlite";
const dbPath = path.isAbsolute(dbFile) ? dbFile : path.resolve(__dirname, dbFile);

export function getDbPath() {
  return dbPath;
}

let dbInstance;

async function ensureDb() {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs({
    locateFile: () => wasmPath
  });

  if (fs.existsSync(dbPath)) {
    const filebuffer = fs.readFileSync(dbPath);
    dbInstance = new SQL.Database(new Uint8Array(filebuffer));
  } else {
    dbInstance = new SQL.Database();
  }

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS family_calculations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      percent REAL NOT NULL,
      due REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS price_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      category TEXT,
      name TEXT NOT NULL,
      unit_price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number INTEGER,
      family_id INTEGER NOT NULL,
      total_clean REAL NOT NULL,
      total_dirty REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (family_id) REFERENCES families(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      line_total REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES price_items(id)
    );

    CREATE TABLE IF NOT EXISTS order_sequence (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      next_number INTEGER NOT NULL
    );
  `);

  const columns = dbInstance.exec("PRAGMA table_info(price_items)");
  const columnNames = new Set(
    (columns?.[0]?.values || []).map((row) => row[1])
  );
  if (!columnNames.has("category")) {
    dbInstance.run("ALTER TABLE price_items ADD COLUMN category TEXT");
  }

  const orderColumns = dbInstance.exec("PRAGMA table_info(orders)");
  const orderColumnNames = new Set(
    (orderColumns?.[0]?.values || []).map((row) => row[1])
  );
  if (!orderColumnNames.has("order_number")) {
    dbInstance.run("ALTER TABLE orders ADD COLUMN order_number INTEGER");
  }

  const seqRow = dbInstance.exec("SELECT COUNT(1) FROM order_sequence");
  const seqCount = seqRow?.[0]?.values?.[0]?.[0] ?? 0;
  if (seqCount === 0) {
    dbInstance.run("INSERT INTO order_sequence (id, next_number) VALUES (1, 1)");
  }

  saveDb(dbInstance);
  return dbInstance;
}

function saveDb(db) {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

export async function dbAll(sql, params = []) {
  const db = await ensureDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export async function dbGet(sql, params = []) {
  const db = await ensureDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

export async function dbRun(sql, params = []) {
  const db = await ensureDb();
  db.run(sql, params);
  const result = db.exec("SELECT last_insert_rowid() as id");
  const lastInsertRowid = result?.[0]?.values?.[0]?.[0] ?? null;
  saveDb(db);
  return { lastInsertRowid };
}

export async function dbTransaction(callback) {
  const db = await ensureDb();
  db.run("BEGIN");
  try {
    await callback(db);
    db.run("COMMIT");
    saveDb(db);
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
}
