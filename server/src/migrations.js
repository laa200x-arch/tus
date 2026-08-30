export function isIgnorableMigrationError(error) {
  if (error?.code === 'ER_DUP_FIELDNAME' || error?.code === 'ER_DUP_KEYNAME') return true
  const message = String(error?.message || '').toLowerCase()
  return message.includes('duplicate column name') || (message.includes('index') && message.includes('already exists'))
}

export async function runMigration(db, sql) {
  try {
    await db.exec(sql)
  } catch (error) {
    if (!isIgnorableMigrationError(error)) throw error
  }
}

export async function applyMigrations(db, dbDriver) {
  const textType = dbDriver === 'mysql' ? 'TEXT NULL' : 'TEXT'
  const complaintFavoritesTable = dbDriver === 'mysql'
    ? `CREATE TABLE IF NOT EXISTS complaint_favorites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        complaint_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at DATETIME NOT NULL,
        UNIQUE KEY uq_complaint_favorite (complaint_id, user_id),
        KEY idx_favorite_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    : `CREATE TABLE IF NOT EXISTS complaint_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (complaint_id, user_id)
      )`
  const migrations = [
    'ALTER TABLE messages ADD COLUMN media_type TEXT',
    'ALTER TABLE messages ADD COLUMN media_url TEXT',
    'ALTER TABLE messages ADD COLUMN order_id TEXT',
    'ALTER TABLE users ADD COLUMN avatar_url TEXT',
    `ALTER TABLE users ADD COLUMN little_energy_outfit ${textType}`,
    'ALTER TABLE users ADD COLUMN phone TEXT',
    'CREATE UNIQUE INDEX idx_users_phone ON users(phone)',
    'ALTER TABLE colleagues ADD COLUMN age INTEGER',
    'ALTER TABLE colleagues ADD COLUMN weight REAL',
    'ALTER TABLE colleagues ADD COLUMN personality_score REAL',
    'ALTER TABLE colleagues ADD COLUMN workplace_type TEXT',
    'ALTER TABLE colleagues ADD COLUMN risk_level TEXT',
    'ALTER TABLE colleagues ADD COLUMN avatar_url TEXT',
    'ALTER TABLE colleagues ADD COLUMN quote TEXT',
    complaintFavoritesTable
  ]
  for (const sql of migrations) await runMigration(db, sql)
}
