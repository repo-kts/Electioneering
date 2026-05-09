import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifyToken, type AuthUser, type Role } from '../services/auth.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing Bearer token' });
    return;
  }
  const token = header.slice(7).trim();
  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
    return;
  }
  req.user = user;
  next();
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Requires role: ${roles.join(' / ')}`,
        actual: req.user.role,
      });
      return;
    }
    next();
  };
}

export const requireAdmin: RequestHandler = (req, res, next) => {
  requireRole('admin')(req, res, next);
};
