import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  apiKey: process.env.API_KEY!,
  publicMenuBaseUrl: (
    process.env.PUBLIC_MENU_BASE_URL ?? 'http://localhost:5173'
  ).replace(/\/+$/, ''),
  allowPublicSignup: process.env.ALLOW_PUBLIC_SIGNUP === 'true',
  cors_origins: process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? [],
  jwt: {
    secret: process.env.JWT_SECRET!,
    expireIn: process.env.JWT_EXPIRE_IN ?? '1d',
  },
}));
