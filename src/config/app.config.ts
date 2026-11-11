import { registerAs } from '@nestjs/config';

function publicMenuBaseUrl(): string {
  const baseUrl = (
    process.env.PUBLIC_MENU_BASE_URL ?? 'http://localhost:5173'
  ).replace(/\/+$/, '');
  return baseUrl.endsWith('/m') ? baseUrl : `${baseUrl}/m`;
}

export default registerAs('app', () => ({
  maxPendingOrdersPerTable: Number(
    process.env.MAX_PENDING_ORDERS_PER_TABLE ?? 3,
  ),
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  publicMenuBaseUrl: publicMenuBaseUrl(),
  allowPublicSignup: process.env.ALLOW_PUBLIC_SIGNUP === 'true',
  cors_origins: process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? [],
  jwt: {
    secret: process.env.JWT_SECRET!,
    expireIn: process.env.JWT_EXPIRE_IN ?? '1d',
  },
}));
