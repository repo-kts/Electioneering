import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

// Turn a Zod validation failure into one short, human sentence naming the field
// — no raw Zod wording ("String must contain…") ever reaches the user.
function zodMessage(err: ZodError): string {
  const first = err.issues[0];
  if (!first) return 'Please check your input.';
  const field = first.path.filter((p) => p !== undefined && p !== null).join('.') || 'input';
  switch (first.code) {
    case 'invalid_type':
      return (first as { received?: string }).received === 'undefined'
        ? `"${field}" is required.`
        : `"${field}" has the wrong value.`;
    case 'too_small':
      return `"${field}" is required.`;
    case 'too_big':
      return `"${field}" is too long.`;
    case 'invalid_string':
      return `"${field}" is not in a valid format.`;
    case 'invalid_enum_value':
      return `"${field}" has an invalid value.`;
    default:
      return `Please check the "${field}" field.`;
  }
}

// Central error responder. Every response carries a plain-language `message`;
// technical details (Zod issue trees, Prisma errors, stack traces) are logged
// server-side only, never sent to the client.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'ValidationError', message: zodMessage(err) });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? (err.meta.target as string[]).join(', ') : null;
      res.status(409).json({
        error: 'Conflict',
        message: target ? `A record with this ${target} already exists.` : 'This already exists.',
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'NotFound', message: 'That item no longer exists — refresh and try again.' });
      return;
    }
    if (err.code === 'P2003') {
      res.status(400).json({ error: 'BadRequest', message: "That change refers to something that doesn't exist." });
      return;
    }
    console.error('[prisma]', err.code, err.message);
    res.status(400).json({ error: 'BadRequest', message: "Couldn't complete that action." });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error('[prisma-validation]', err.message);
    res.status(400).json({ error: 'BadRequest', message: 'Some of the data was in an unexpected format.' });
    return;
  }

  // Errors we throw deliberately carry a status + a user-facing message.
  const status = (err as { status?: number }).status;
  if (status && status >= 400 && status < 500) {
    res.status(status).json({ error: (err as Error).name || 'Error', message: (err as Error).message || 'Request failed.' });
    return;
  }

  // Anything else is unexpected — log it, tell the user nothing technical.
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'InternalError', message: 'Something went wrong. Please try again.' });
};
