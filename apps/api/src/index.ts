import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

export default app;

if (!process.env.VERCEL) {
  app.listen(env.PORT, () => {
    console.log(`✨ Mahatir Perfumes ERP API server running on http://localhost:${env.PORT}`);
    console.log(`🌿 Environment: ${env.NODE_ENV}`);
    console.log(`🔒 CORS Origin: ${env.CORS_ORIGIN}`);
  });
}
