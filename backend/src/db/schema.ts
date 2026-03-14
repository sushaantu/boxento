import type Database from 'better-sqlite3';

const SCHEMA_VERSION = 1;

const SCHEMA_SQL = `
-- Dashboards
CREATE TABLE IF NOT EXISTS dashboards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  visibility TEXT DEFAULT 'private',
  shared_with TEXT,
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Layouts (per breakpoint)
CREATE TABLE IF NOT EXISTS layouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dashboard_id TEXT NOT NULL,
  breakpoint TEXT NOT NULL,
  layout_data TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(dashboard_id, breakpoint),
  FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
);

-- Widgets
CREATE TABLE IF NOT EXISTS widgets (
  id TEXT PRIMARY KEY,
  dashboard_id TEXT NOT NULL,
  type TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
);

-- Widget Configs (notes content, todo items, etc.)
-- Note: No foreign key constraint - configs may be saved before widgets during initial sync
CREATE TABLE IF NOT EXISTS widget_configs (
  widget_id TEXT PRIMARY KEY,
  config_data TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- App Settings
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  settings_data TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);
`;

export function initializeSchema(db: Database.Database): void {
  // Check current schema version
  const versionTable = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
  ).get();

  let currentVersion = 0;
  if (versionTable) {
    const row = db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined;
    currentVersion = row?.version || 0;
  }

  if (currentVersion < SCHEMA_VERSION) {
    console.log(`Migrating database from version ${currentVersion} to ${SCHEMA_VERSION}`);

    // Run schema creation
    db.exec(SCHEMA_SQL);

    // Ensure default dashboard exists
    const defaultDashboard = db.prepare('SELECT id FROM dashboards WHERE id = ?').get('personal');
    if (!defaultDashboard) {
      db.prepare(`
        INSERT INTO dashboards (id, name, is_default, visibility)
        VALUES (?, ?, ?, ?)
      `).run('personal', 'Personal', 1, 'private');
      console.log('Created default personal dashboard');
    }

    // Update schema version
    db.prepare('DELETE FROM schema_version').run();
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);

    console.log('Database schema initialized');
  }
}

export function runMigrations(_db: Database.Database): void {
  // Future migrations can be added here
  // Example:
  // if (currentVersion < 2) {
  //   db.exec('ALTER TABLE widgets ADD COLUMN new_field TEXT');
  // }
}
