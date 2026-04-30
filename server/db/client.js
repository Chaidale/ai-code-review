import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  DATABASE_MAX_CONNECTIONS,
  DATABASE_SSL,
  DATABASE_URL,
} from "../config.js";
import * as schema from "./schema.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: DATABASE_MAX_CONNECTIONS,
  ssl: DATABASE_SSL ? { rejectUnauthorized: false } : false,
});

pool.on("error", (error) => {
  console.error("PostgreSQL 连接池异常：", error);
});

export const db = drizzle(pool, { schema });

export async function verifyDatabaseConnection() {
  const client = await pool.connect();

  try {
    await client.query("select 1");
  } finally {
    client.release();
  }
}

export async function closeDatabasePool() {
  await pool.end();
}
