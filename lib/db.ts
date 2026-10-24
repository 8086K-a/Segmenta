import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { seedIfEmpty } from "./seed";

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
export const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), "storage", "videos");
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "segmenta.db");

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN','ADMIN','ANNOTATOR')),
  status        TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

CREATE TABLE IF NOT EXISTS videos (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size        INTEGER NOT NULL DEFAULT 0,
  duration    REAL,
  created_at  TEXT NOT NULL,
  uploaded_by TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_videos_tenant ON videos(tenant_id);

CREATE TABLE IF NOT EXISTS tasks (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  video_id       TEXT NOT NULL REFERENCES videos(id) ON DELETE RESTRICT,
  title          TEXT NOT NULL,
  description    TEXT,
  status         TEXT NOT NULL DEFAULT 'AVAILABLE'
                 CHECK (status IN ('AVAILABLE','IN_PROGRESS','SUBMITTED')),
  assignee_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  claimed_at     TEXT,
  submitted_at   TEXT,
  submitted_date TEXT,
  revision       INTEGER NOT NULL DEFAULT 1,
  review_status  TEXT NOT NULL DEFAULT 'NONE'
                 CHECK (review_status IN ('NONE','PENDING','APPROVED','REJECTED')),
  reviewed_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at    TEXT,
  review_comment TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_submitted ON tasks(submitted_date);

CREATE TABLE IF NOT EXISTS segments (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  start_time REAL NOT NULL,
  end_time   REAL NOT NULL,
  label      TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (end_time > start_time),
  CHECK (start_time >= 0)
);
CREATE INDEX IF NOT EXISTS idx_segments_task ON segments(task_id, start_time);

CREATE TABLE IF NOT EXISTS submissions (
  id             TEXT PRIMARY KEY,
  task_id        TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  version        INTEGER NOT NULL,
  submitted_by   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submitted_at   TEXT NOT NULL,
  submitted_date TEXT NOT NULL,
  total_duration REAL NOT NULL,
  segment_count  INTEGER NOT NULL,
  segments_json  TEXT NOT NULL,
  is_current     INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_version ON submissions(task_id, version);
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_current ON submissions(task_id) WHERE is_current = 1;
CREATE INDEX IF NOT EXISTS idx_submissions_day ON submissions(submitted_date);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT,
  actor_id    TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  detail      TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
`;

declare global {
  // eslint-disable-next-line no-var
  var __segmentaDb: Database.Database | undefined;
}

function open(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA);
  migrate(db);
  seedIfEmpty(db);
  return db;
}

/** 轻量迁移：给旧库补上审核相关字段 */
function migrate(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
  const has = (name: string) => columns.some((c) => c.name === name);

  if (!has("review_status")) {
    db.exec(`
      ALTER TABLE tasks ADD COLUMN review_status TEXT NOT NULL DEFAULT 'NONE';
      ALTER TABLE tasks ADD COLUMN reviewed_by TEXT;
      ALTER TABLE tasks ADD COLUMN reviewed_at TEXT;
      ALTER TABLE tasks ADD COLUMN review_comment TEXT;
      UPDATE tasks SET review_status = 'PENDING' WHERE status = 'SUBMITTED';
    `);
  }
}

export function getDb(): Database.Database {
  if (!globalThis.__segmentaDb) {
    globalThis.__segmentaDb = open();
  }
  return globalThis.__segmentaDb;
}

export function dbFilePath(): string {
  return DB_PATH;
}
