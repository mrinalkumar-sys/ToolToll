import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('4000'),
  DATABASE_URL: z.string().url(),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  BACKEND_URL: z.string().url().default('http://localhost:4000'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:4000'),
  AUTH_SECRET_KEY: z.string().min(32, 'AUTH_SECRET_KEY must be at least 32 characters'),
  CREDENTIAL_ENCRYPTION_KEY: z.string().min(32, 'CREDENTIAL_ENCRYPTION_KEY must be at least 32 characters'),
  CREDENTIAL_ENCRYPTION_KEY_VERSION: z.string().default('v1'),
  LLM_PROVIDER: z.enum(['mock', 'openai', 'anthropic']).default('mock'),
  LLM_API_KEY: z.string().default('mock-key'),
  PAYMENT_ADAPTER: z.enum(['mock', 'paypal']).default('mock'),
  PAYOUT_ADAPTER: z.enum(['mock', 'paypal']).default('mock'),
  PAYPAL_CLIENT_ID: z.string().default('mock_client_id'),
  PAYPAL_CLIENT_SECRET: z.string().default('mock_client_secret'),
  PAYPAL_BASE_URL: z.string().default('https://api-m.sandbox.paypal.com'),
  PAYPAL_WEBHOOK_ID: z.string().default('mock_webhook_id'),
  PLATFORM_FEE_BPS: z.string().transform((val) => parseInt(val, 10)).default('1000'),
  TOOL_EXECUTION_TIMEOUT_MS: z.string().transform((val) => parseInt(val, 10)).default('15000'),
  MAX_REQUEST_SIZE: z.string().transform((val) => parseInt(val, 10)).default('1048576'),
});

const parseEnv = () => {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
    if (process.env.APP_ENV === 'production') {
      throw new Error('Refusing to boot in production with invalid environment variables');
    }
  }
  return parsed.success ? parsed.data : envSchema.parse({
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://tooltoll:tooltoll@localhost:5432/tooltoll_db?schema=public',
    AUTH_SECRET_KEY: process.env.AUTH_SECRET_KEY || 'super-secret-jwt-signing-key-tooltoll-mvp-32chars-min',
    CREDENTIAL_ENCRYPTION_KEY: process.env.CREDENTIAL_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  });
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
