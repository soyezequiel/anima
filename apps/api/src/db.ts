import { DatabaseSync } from 'node:sqlite';

/**
 * SQLite embebido (node:sqlite, sin dependencias nativas). El esquema es
 * deliberadamente simple: identidad por clave pública y un almacén
 * clave-valor por usuario que espeja la interfaz KeyValueStore del cliente.
 * Las tablas estructuradas (mascotas, generaciones, skills consultables)
 * llegarán cuando exista una consulta que las necesite; el diseño de datos
 * está pensado para migrar a PostgreSQL sin cambiar la API.
 */
export function createDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      pubkey TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS challenges (
      challenge TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tokens (
      token TEXT PRIMARY KEY,
      pubkey TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_data (
      pubkey TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (pubkey, key)
    );
  `);
  return db;
}
