import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const dbPath = resolve(projectRoot, process.env.DB_PATH || './data/kelolakos.db');

// Ensure the data directory exists before opening the database.
mkdirSync(dirname(dbPath), { recursive: true });

// Uses Node's built-in SQLite (node:sqlite) - no native compilation required.
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

/**
 * Create tables if they do not exist. Kept idempotent so it can run on every
 * boot. Schema mirrors section 7 of the PRD.
 */
export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'tenant')),
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      phone TEXT,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_number TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'single' CHECK (type IN ('single', 'shared')),
      price INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      phone TEXT,
      identity_number TEXT,
      start_date TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'moved_out')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
      period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
      period_year INTEGER NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      paid_date TEXT,
      payment_method TEXT CHECK (payment_method IN ('cash', 'transfer', 'e-wallet')),
      status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'late')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (tenant_id, period_month, period_year)
    );

    CREATE INDEX IF NOT EXISTS idx_tenants_room ON tenants(room_id);
    CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_payments_period ON payments(period_year, period_month);
  `);
}

export default db;
