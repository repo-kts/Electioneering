import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import votersRouter from './routes/voters.js';
import electionsRouter from './routes/elections.js';
import uploadsRouter from './routes/uploads.js';
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

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
});
