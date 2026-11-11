import z from 'zod';

const envSchema = z.object({
  // === Validação das variaveis da aplicação ===
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGINS: z.string().optional(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRE_IN: z.string().default('1d'),
  PUBLIC_MENU_BASE_URL: z.string().url().default('http://localhost:5173/m'),

  // === Auto-registo de restaurantes ===
  ALLOW_PUBLIC_SIGNUP: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  // === Seed do SUPER_ADMIN ===
  SUPER_ADMIN_NAME: z.string().optional(),
  SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SUPER_ADMIN_PASSWORD: z.string().min(8).optional(),

  // === Validação das variáveis do Banco  ===
  DB_HOST: z.string(),
  DB_PORT: z.coerce.number().default(5432),
  DB_USERNAME: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),
  DB_SSL: z.enum(['true', 'false']).default('false'),

  // === Armazenamento ===
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('uploads'),
  STORAGE_PUBLIC_BASE_URL: z.string().url().optional(),
  MAX_PENDING_ORDERS_PER_TABLE: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(3),
  MAX_MENU_ITEM_IMAGES: z.coerce.number().int().min(1).max(100).default(5),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(2097152),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result?.error?.issues
      .map((i) => ` - ${i.path.join('.')}:     ${i.message}`)
      .join('\n');

    throw new Error(`Variáveis de ambiente com errros:\n ${issues} `);
  }

  return result?.data;
}
