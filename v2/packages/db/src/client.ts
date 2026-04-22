import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) throw new Error('DATABASE_URL is not set');

const client = postgres(connectionString, {
  max: process.env['NODE_ENV'] === 'production' ? 10 : 3,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

export type DB = typeof db;

// RLS-Middleware: sets app.workspace_id for every transaction
export async function withWorkspace<T>(
  workspaceId: string,
  fn: (db: DB) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      `SELECT set_config('app.workspace_id', '${workspaceId}', true)`
    );
    return fn(tx as unknown as DB);
  });
}
