import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env file into process.env if present
dotenv.config();

/**
 * Huddly Server Runtime Configuration Schema
 */
export const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 3000)),
  HOST: z.string().default('0.0.0.0'),
  WS_PORT: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 3001)),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://postgres:postgres@localhost:5432/huddly_dev?schema=public'),
  REDIS_PUBSUB_URL: z.string().url().default('redis://localhost:6379/0'),
  REDIS_STATE_URL: z.string().url().default('redis://localhost:6379/1'),
  JWT_SECRET: z
    .string()
    .min(32, { message: 'JWT_SECRET must be at least 32 characters long for security' })
    .default('replace-me-with-openssl-rand-hex-32-dev-key!'),
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((val) =>
      val
        ? val.split(',').map((s) => s.trim())
        : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    ),
  LIVEKIT_URL: z.string().url().optional(),
  LIVEKIT_API_KEY: z.string().min(1).optional(),
  LIVEKIT_API_SECRET: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  OAUTH_REDIRECT_BASE_URL: z.string().url().default('http://localhost:5173'),
});

export type HuddlyConfig = z.infer<typeof ConfigSchema>;

/**
 * Validates and returns parsed configuration object.
 * Throws detailed error if any required variable is invalid.
 */
export function parseConfig(
  rawEnv: Record<string, string | undefined> = process.env,
): HuddlyConfig {
  const result = ConfigSchema.safeParse(rawEnv);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - [${issue.path.join('.')}] ${issue.message}`)
      .join('\n');
    throw new Error(`[Huddly Config Error] Environment validation failed:\n${errorDetails}`);
  }
  return result.data;
}

export const config = parseConfig();
