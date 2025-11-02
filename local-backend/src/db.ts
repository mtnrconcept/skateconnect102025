import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "app.db");
const SCHEMA_PATH = path.join(__dirname, "..", "schema.sql");

let SQL: any;
let _db: any;

function ensureDataDir() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

async function openDb() {
  if (!_db) {
    SQL = await initSqlJs({});
    ensureDataDir();
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      _db = new SQL.Database(new Uint8Array(fileBuffer));
    } else {
      _db = new SQL.Database();
    }
    // apply schema each time (idempotent CREATE IF NOT EXISTS)
    const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
    _db.exec(schema);
    persist();
  }
  return _db;
}

function persist() {
  if (!_db) return;
  const data = _db.export();
  ensureDataDir();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function toRows(stmt: any) {
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export const db = {
  async run(sql: string, params?: any[] | Record<string, any>) {
    const d = await openDb();
    const stmt = d.prepare(sql);
    params ? stmt.run(params) : stmt.run();
    stmt.free();
    persist();
  },
  async all<T = any>(sql: string, params?: any[] | Record<string, any>): Promise<T[]> {
    const d = await openDb();
    const stmt = d.prepare(sql);
    params ? stmt.bind(params) : null;
    const rows = toRows(stmt);
    return rows as T[];
  },
  async get<T = any>(sql: string, params?: any[] | Record<string, any>): Promise<T | null> {
    const rows = await this.all<T>(sql, params);
    return rows.length ? rows[0] : null;
  },
};

if (process.argv.includes("--init")) {
  await openDb();
  console.log("✅ SQLite (sql.js) initialisé:", DB_PATH);
  process.exit(0);
}

await openDb();
