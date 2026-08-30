import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mysqlConnectionOptions } from '../src/db.js'
import { applyMigrations, isIgnorableMigrationError, runMigration } from '../src/migrations.js'

const database = new DatabaseSync(':memory:')
database.exec(`
  CREATE TABLE users (id INTEGER PRIMARY KEY);
  CREATE TABLE messages (id INTEGER PRIMARY KEY);
  CREATE TABLE colleagues (id INTEGER PRIMARY KEY);
`)

await applyMigrations({
  exec: (sql) => database.exec(sql)
}, 'sqlite')

const userColumns = database.prepare('PRAGMA table_info(users)').all().map((column) => column.name)
assert.equal(userColumns.includes('little_energy_outfit'), true)
assert.equal(userColumns.includes('phone'), true)
assert.equal(userColumns.includes('avatar_url'), true)
assert.notEqual(database.prepare("SELECT 1 FROM pragma_index_list('users') WHERE name = 'idx_users_phone'").get(), undefined)
assert.notEqual(database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'complaint_favorites'").get(), undefined)

await applyMigrations({
  exec: (sql) => database.exec(sql)
}, 'sqlite')

assert.equal(isIgnorableMigrationError({ code: 'ER_DUP_FIELDNAME' }), true)
assert.equal(isIgnorableMigrationError({ code: 'ER_DUP_KEYNAME' }), true)
assert.equal(isIgnorableMigrationError(new Error('You have an error in your SQL syntax')), false)
await assert.rejects(
  () => runMigration({ exec: (sql) => database.exec(sql) }, 'ALTER TABLE users ADD')
)

assert.equal(mysqlConnectionOptions({
  host: 'db.example.test', port: 3307, user: 'user', password: 'secret', database: 'jiyu'
}).multipleStatements, true)

database.close()
console.log('Database bootstrap: old-schema migrations and MySQL DDL configuration passed.')
