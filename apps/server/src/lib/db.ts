import { Pool } from 'pg';

export type PgPool = Pool;

export function createPool(connectionString: string): PgPool {
  return new Pool({ connectionString });
}

