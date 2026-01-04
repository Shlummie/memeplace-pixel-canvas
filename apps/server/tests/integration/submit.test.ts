import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createContext } from '../../src/lib/context';
import { createTileStore } from '../../src/lib/tileStore';
import { registerRoutes } from '../../src/routes';
import { env as baseEnv } from '../../src/env';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { sha256 } from '@memeplace/shared';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

let pgContainer: StartedTestContainer | undefined;
let redisContainer: StartedTestContainer | undefined;

const testEnv = {
  ...baseEnv,
  DATABASE_URL: '',
  REDIS_URL: '',
  MEME_MINT: 'TestMint111111111111111111111111111111111',
  PIXEL_COST: 1,
  RPC_URL: 'http://localhost',
};

type TestSetup = {
  app: FastifyInstance;
  ctx: Awaited<ReturnType<typeof createContext>>;
  cleanup: () => Promise<void>;
};

function createBatchBytes(pixels: Array<{ x: number; y: number; color: number }>) {
  const buffer = Buffer.alloc(2 + pixels.length * 5);
  buffer.writeUInt16BE(pixels.length, 0);
  pixels.forEach((pixel, index) => {
    const offset = 2 + index * 5;
    buffer[offset] = pixel.x;
    buffer[offset + 1] = pixel.y;
    buffer[offset + 2] = (pixel.color >> 16) & 0xff;
    buffer[offset + 3] = (pixel.color >> 8) & 0xff;
    buffer[offset + 4] = pixel.color & 0xff;
  });
  return buffer;
}

function buildMemo(commits: Array<{ tile: number; commit: string }>) {
  return Buffer.from(JSON.stringify({ v: 1, canvas: 'main', commits }), 'utf8').toString('base64');
}

async function runMigrations(databaseUrl: string) {
  const migrationsDir = path.resolve(__dirname, '..', '..', 'migrations');
  const entries = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    for (const file of entries) {
      const migrationSql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(migrationSql);
    }
  } finally {
    await client.end();
  }
}

async function createTestApp(): Promise<TestSetup> {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  const ctx = await createContext(testEnv);
  const tileStore = await createTileStore(ctx.redis);

  await ctx.pg.query('TRUNCATE batch_tile_bytes, batch_tiles, placements, batches CASCADE');

  await app.register(async (instance) => {
    instance.decorate('ctx', ctx);
    instance.decorate('tileStore', tileStore);
    instance.decorate('connections', new Set());
    registerRoutes(instance);
  });

  const cleanup = async () => {
    await app.close();
    await ctx.redis.quit();
    await ctx.pg.end();
  };

  return { app, ctx, cleanup };
}

describe('submit integration', () => {
  beforeAll(async () => {
    pgContainer = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'testdb',
        POSTGRES_USER: 'testuser',
        POSTGRES_PASSWORD: 'testpass',
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections'))
      .start();

    redisContainer = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start();

    const pgPort = pgContainer.getMappedPort(5432);
    const pgHost = pgContainer.getHost();
    const redisPort = redisContainer.getMappedPort(6379);
    const redisHost = redisContainer.getHost();

    testEnv.DATABASE_URL = `postgresql://testuser:testpass@${pgHost}:${pgPort}/testdb`;
    testEnv.REDIS_URL = `redis://${redisHost}:${redisPort}`;

    await runMigrations(testEnv.DATABASE_URL);
  }, 120000);

  afterAll(async () => {
    if (pgContainer) {
      await pgContainer.stop();
    }
    if (redisContainer) {
      await redisContainer.stop();
    }
  });

  it('rejects oversized batch', async () => {
    const { app, cleanup } = await createTestApp();

    const oversized = Buffer.alloc(2 + 257 * 5);
    oversized.writeUInt16BE(257, 0);

    const memoB64 = buildMemo([{ tile: 0, commit: 'test' }]);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/submit',
      payload: {
        sig: 'test',
        wallet: 'wallet',
        memoB64,
        batches: [
          {
            tile: 0,
            batchBytesB64: oversized.toString('base64'),
            commit: 'test',
          },
        ],
        signedMsgB64: Buffer.from('invalid').toString('base64'),
      },
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    await cleanup();
  });

  it('accepts multi-tile batches and writes placements', async () => {
    const { app, ctx, cleanup } = await createTestApp();

    const batchA = createBatchBytes([
      { x: 1, y: 2, color: 0xff0000 },
      { x: 3, y: 4, color: 0x00ff00 },
    ]);
    const batchB = createBatchBytes([
      { x: 5, y: 6, color: 0x0000ff },
    ]);

    const commitA = sha256(batchA);
    const commitB = sha256(batchB);

    const memoB64 = buildMemo([
      { tile: 0, commit: commitA },
      { tile: 1, commit: commitB },
    ]);

    await ctx.pg.query('INSERT INTO batches (signature, wallet, memo_b64, credits) VALUES ($1, $2, $3, $4)', [
      'sig-multi',
      'wallet123',
      memoB64,
      10,
    ]);

    const keypair = nacl.sign.keyPair();
    const wallet = bs58.encode(keypair.publicKey);
    const message = `BURN_COMMIT:sig-multi:${memoB64}`;
    const signed = nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey);
    const signedB64 = Buffer.from(signed).toString('base64');

    const response = await app.inject({
      method: 'POST',
      url: '/v1/submit',
      payload: {
        sig: 'sig-multi',
        wallet,
        memoB64,
        batches: [
          {
            tile: 0,
            batchBytesB64: batchA.toString('base64'),
            commit: commitA,
          },
          {
            tile: 1,
            batchBytesB64: batchB.toString('base64'),
            commit: commitB,
          },
        ],
        signedMsgB64: signedB64,
      },
    });

    expect(response.statusCode).toBe(202);
    const json = response.json() as { status: string; commits: Array<{ tile: number; commit: string }> };
    expect(json.status).toBe('accepted');
    expect(json.commits).toEqual([
      { tile: 0, commit: commitA },
      { tile: 1, commit: commitB },
    ]);

    const placements = await ctx.pg.query('SELECT tile, x, y, color FROM placements WHERE signature = $1 ORDER BY tile, x, y', [
      'sig-multi',
    ]);
    expect(placements.rows).toHaveLength(3);
    expect(placements.rows).toEqual([
      { tile: 0, x: 1, y: 2, color: 0xff0000 },
      { tile: 0, x: 3, y: 4, color: 0x00ff00 },
      { tile: 1, x: 5, y: 6, color: 0x0000ff },
    ]);

    await cleanup();
  });

  it('rejects memo commit mismatches', async () => {
    const { app, ctx, cleanup } = await createTestApp();

    const batch = createBatchBytes([{ x: 1, y: 1, color: 0xffffff }]);
    const commit = sha256(batch);
    const memoB64 = buildMemo([{ tile: 0, commit: 'different' }]);

    await ctx.pg.query('INSERT INTO batches (signature, wallet, memo_b64, credits) VALUES ($1, $2, $3, $4)', [
      'sig-mismatch',
      'wallet123',
      memoB64,
      5,
    ]);

    const keypair = nacl.sign.keyPair();
    const wallet = bs58.encode(keypair.publicKey);
    const message = `BURN_COMMIT:sig-mismatch:${memoB64}`;
    const signed = nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey);
    const signedB64 = Buffer.from(signed).toString('base64');

    const response = await app.inject({
      method: 'POST',
      url: '/v1/submit',
      payload: {
        sig: 'sig-mismatch',
        wallet,
        memoB64,
        batches: [
          {
            tile: 0,
            batchBytesB64: batch.toString('base64'),
            commit,
          },
        ],
        signedMsgB64: signedB64,
      },
    });

    expect(response.statusCode).toBe(400);
    const json = response.json() as { error: string };
    expect(json.error).toMatch(/memo commit mismatch/i);
    await cleanup();
  });

  it('rejects when credits are insufficient', async () => {
    const { app, ctx, cleanup } = await createTestApp();

    const batch = createBatchBytes([
      { x: 1, y: 1, color: 0x111111 },
      { x: 2, y: 2, color: 0x222222 },
    ]);
    const commit = sha256(batch);
    const memoB64 = buildMemo([{ tile: 0, commit }]);

    await ctx.pg.query('INSERT INTO batches (signature, wallet, memo_b64, credits) VALUES ($1, $2, $3, $4)', [
      'sig-low',
      'wallet123',
      memoB64,
      1,
    ]);

    const keypair = nacl.sign.keyPair();
    const wallet = bs58.encode(keypair.publicKey);
    const message = `BURN_COMMIT:sig-low:${memoB64}`;
    const signed = nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey);
    const signedB64 = Buffer.from(signed).toString('base64');

    const response = await app.inject({
      method: 'POST',
      url: '/v1/submit',
      payload: {
        sig: 'sig-low',
        wallet,
        memoB64,
        batches: [
          {
            tile: 0,
            batchBytesB64: batch.toString('base64'),
            commit,
          },
        ],
        signedMsgB64: signedB64,
      },
    });

    expect(response.statusCode).toBe(400);
    const json = response.json() as { error: string };
    expect(json.error).toMatch(/insufficient credits/i);
    await cleanup();
  });
});
