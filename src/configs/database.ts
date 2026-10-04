import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../db/schema.js';
import { appConfig } from './app.config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: appConfig.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]', err);
});

export const db = drizzle(pool, { schema });
