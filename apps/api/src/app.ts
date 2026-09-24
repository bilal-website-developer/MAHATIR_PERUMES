import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.routes.js';
import { settingsRouter } from './routes/settings.routes.js';
import { branchRouter } from './routes/branch.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { auditRouter } from './routes/audit.routes.js';
import { rawMaterialsRouter } from './routes/raw-materials.routes.js';
import { suppliersRouter } from './routes/suppliers.routes.js';
import { purchaseOrdersRouter } from './routes/purchase-orders.routes.js';
import { stockRouter } from './routes/stock.routes.js';
import { formulaRouter } from './routes/formula.routes.js';
import { batchRouter } from './routes/batch.routes.js';
import { productRouter } from './routes/product.routes.js';
import { bottlingRouter } from './routes/bottling.routes.js';
import { salesRouter } from './routes/sales.routes.js';
import { dilutionRouter } from './routes/dilution.routes.js';
import { reportsRouter } from './routes/reports.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';
import { suggestionsRouter } from './routes/suggestions.routes.js';
import { sendError } from './utils/response.js';

export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: [env.CORS_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-branch-id'],
    }),
  );

  // Logging
  if (env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Body parsing
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // Routes
  app.use('/', healthRouter);
  app.use('/api/v1', authRouter);
  app.use('/api/v1', settingsRouter);
  app.use('/api/v1', branchRouter);
  app.use('/api/v1', usersRouter);
  app.use('/api/v1', auditRouter);
  app.use('/api/v1', rawMaterialsRouter);
  app.use('/api/v1', suppliersRouter);
  app.use('/api/v1', purchaseOrdersRouter);
  app.use('/api/v1', stockRouter);
  app.use('/api/v1', formulaRouter);
  app.use('/api/v1', batchRouter);
  app.use('/api/v1', productRouter);
  app.use('/api/v1', bottlingRouter);
  app.use('/api/v1', salesRouter);
  app.use('/api/v1', dilutionRouter);
  app.use('/api/v1', reportsRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/suggestions', suggestionsRouter);
  app.use('/api/v1/system', notificationsRouter);

  // 404 Handler
  app.use((_req, res) => {
    sendError(res, 'Route not found', 404, 'NOT_FOUND');
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
