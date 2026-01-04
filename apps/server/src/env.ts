import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().min(0).max(65535).default(3001),
  RPC_URL: z.string().min(1, 'RPC_URL is required'),
  MEME_MINT: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  DATABASE_URL: z.string().min(1),
  SEASON_LABEL: z.string().min(1).default('Season 0'),
  WS_ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((value) => value?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? []),
});

export const env = envSchema.parse(process.env);

export type Env = typeof env;

