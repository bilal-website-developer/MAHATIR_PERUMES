import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  SUPABASE_URL: z.string().default('http://127.0.0.1:54321'),
  SUPABASE_ANON_KEY: z.string().default('anon-key-placeholder'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default('service-role-key-placeholder'),
  SUPABASE_DB_URL: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
