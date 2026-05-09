import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import votersRouter from './routes/voters.js';
import electionsRouter from './routes/elections.js';
import uploadsRouter from './routes/uploads.js';
import templatesRouter from './routes/templates.js';
import analyticsRouter from './routes/analytics.js';
import cohortsRouter from './routes/cohorts.js';
import { errorHandler } from './middleware/error.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? '*',
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

app.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
});
