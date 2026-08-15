import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not set in environment variables!");
}

/**
 * Checks if the target database in DATABASE_URL exists, and creates it if not.
 * Connects to the default 'postgres' database temporarily to issue the CREATE DATABASE command.
 */
async function ensureDatabaseExists() {
  if (!databaseUrl) return;
  
  try {
    const urlObj = new URL(databaseUrl);
    const targetDb = urlObj.pathname.substring(1); // e.g. "interncheck"
    
    if (!targetDb || targetDb === 'postgres') return;

    // Connect to the default 'postgres' database
    urlObj.pathname = '/postgres';
    const defaultDbUrl = urlObj.toString();

    const client = new pg.Client({ connectionString: defaultDbUrl });
    await client.connect();
    
    // Check database catalog
    const checkRes = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDb]);
    if (checkRes.rowCount === 0) {
      console.log(`[Database] Database "${targetDb}" does not exist. Creating it...`);
      await client.query(`CREATE DATABASE "${targetDb}"`);
      console.log(`[Database] Database "${targetDb}" created successfully.`);
    }
    await client.end();
  } catch (err) {
    console.warn(`[Database Warning] Could not verify/create database automatically: ${err.message}`);
  }
}

// Trigger database check/creation
try {
  await ensureDatabaseExists();
} catch (e) {
  console.error("[Database Error] Failed in ensureDatabaseExists:", e.message);
}

// Connect the main application connection pool
export const pool = new pg.Pool({
  connectionString: databaseUrl
});

/**
 * Executes the schema.sql script to build tables if they do not exist.
 */
export async function initDb() {
  console.log("[Database] Initializing database tables...");
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("[Database] All tables initialized/verified.");
  } catch (err) {
    console.error("[Database Error] Failed running schema initialization:", err.message);
    throw err;
  } finally {
    client.release();
  }
}
