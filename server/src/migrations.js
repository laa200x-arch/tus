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
    'ALTER TABLE colleagues ADD COLUMN quote TEXT'
  ]
  for (const sql of migrations) await runMigration(db, sql)
}
