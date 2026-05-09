// Express app factory — exported for both local server (src/index.ts)
// and serverless handler (api/index.ts).
import 'dotenv/config';
import express, { type Express } from 'express';
import cors from 'cors';
import votersRouter from './routes/voters.js';
import electionsRouter from './routes/elections.js';
import uploadsRouter from './routes/uploads.js';
import templatesRouter from './routes/templates.js';
import analyticsRouter from './routes/analytics.js';
import cohortsRouter from './routes/cohorts.js';
import { errorHandler } from './middleware/error.js';

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
        : true, // reflect request origin in serverless / preview deploys
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  app.use('/api/voters', votersRouter);
  app.use('/api/elections', electionsRouter);
  app.use('/api/uploads', uploadsRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/cohorts', cohortsRouter);

  app.use(errorHandler);

  return app;
}

// Singleton — reused across warm serverless invocations.
let _app: Express | undefined;
export function getApp(): Express {
  if (!_app) _app = createApp();
  return _app;
}
