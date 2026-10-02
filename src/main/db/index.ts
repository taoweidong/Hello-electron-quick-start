import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getDataDir } from '../workspace'

// 基于 node:sqlite（Node 24 内置，SQLite 3.53）的数据库单例与 settings 键值表封装。
// 引擎替换（如 better-sqlite3）只需改动本文件，见 openspec design D1。
let db: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (db) return db

  const dir = getDataDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  db = new DatabaseSync(join(dir, 'app.db'))
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
  return db
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row ? row.value : null
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )
    .run(key, value)
}
