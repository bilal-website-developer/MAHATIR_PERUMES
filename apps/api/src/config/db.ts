import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

export const dbPool = env.SUPABASE_DB_URL
  ? new Pool({
      connectionString: env.SUPABASE_DB_URL,
      ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 1500,
    })
  : null;

export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  latencyMs?: number;
  message?: string;
  source: 'direct_pg' | 'supabase_api' | 'mock_dev';
}> {
  const startTime = Date.now();

  // In test environment or when SUPABASE_DB_URL is a placeholder, report mock_dev
  if (env.NODE_ENV === 'test' || !env.SUPABASE_DB_URL || env.SUPABASE_DB_URL.includes('127.0.0.1:54322')) {
    // If it's the default local placeholder and no pg daemon is running, provide graceful dev check
    if (dbPool) {
      try {
        const client = await dbPool.connect();
        await client.query('SELECT 1');
        client.release();
        return { connected: true, latencyMs: Date.now() - startTime, source: 'direct_pg' };
      } catch (_err) {
        return {
          connected: false,
          latencyMs: Date.now() - startTime,
          message: 'PostgreSQL instance not currently active at SUPABASE_DB_URL. Using mock development fallback.',
          source: 'mock_dev',
        };
      }
    }

    return {
      connected: true,
      latencyMs: Date.now() - startTime,
      message: 'Local developer environment active. Connect remote Supabase to switch to live cloud instance.',
      source: 'mock_dev',
    };
  }

  // Try direct Postgres connection pool if URL provided
  if (dbPool) {
    try {
      const client = await dbPool.connect();
      await client.query('SELECT 1');
      client.release();
      const latencyMs = Date.now() - startTime;
      return { connected: true, latencyMs, source: 'direct_pg' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { connected: false, message: msg, source: 'direct_pg' };
    }
  }

  return {
    connected: true,
    latencyMs: Date.now() - startTime,
    message: 'Local developer environment active.',
    source: 'mock_dev',
  };
}
