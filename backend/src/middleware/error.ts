import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'ValidationError', issues: err.issues });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Conflict', message: 'Unique constraint violated', meta: err.meta });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'NotFound', message: 'Record not found' });
      return;
    }
  }
  console.error('[unhandled]', err);
  const status = (err as { status?: number }).status ?? 500;
  res.status(status).json({
    error: (err as Error).name || 'InternalError',
    message: (err as Error).message || 'Something went wrong',
  });
};
