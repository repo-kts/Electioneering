import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { hashPassword, verifyPassword, signToken } from '../services/auth.js';

const router = Router();

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.active) {
      res.status(401).json({ error: 'InvalidCredentials' });
      return;
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: 'InvalidCredentials' });
      return;
    }
    const authUser = { id: user.id, username: user.username, role: user.role };
    const token = signToken(authUser);
    res.json({ token, user: authUser });
  }),
);

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ─── Admin: user management ─────────────────────────────────────────
const createUserSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(6),
  role: z.enum(['admin', 'data_operator']),
});

router.get(
  '/users',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const items = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, username: true, role: true, active: true, createdAt: true },
    });
    res.json({ items });
  }),
);

router.post(
  '/users',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = createUserSchema.parse(req.body);
    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        username: data.username,
        passwordHash,
        role: data.role,
      },
      select: { id: true, username: true, role: true, active: true, createdAt: true },
    });
    res.status(201).json(user);
  }),
);

const updateUserSchema = z.object({
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'data_operator']).optional(),
  active: z.boolean().optional(),
});

router.put(
  '/users/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = updateUserSchema.parse(req.body);
    const data: { passwordHash?: string; role?: 'admin' | 'data_operator'; active?: boolean } = {};
    if (body.password) data.passwordHash = await hashPassword(body.password);
    if (body.role) data.role = body.role;
    if (body.active != null) data.active = body.active;
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, role: true, active: true, createdAt: true },
    });
    res.json(user);
  }),
);

router.delete(
  '/users/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (req.user?.id === id) {
      res.status(400).json({ error: 'BadRequest', message: 'Cannot delete own account' });
      return;
    }
    await prisma.user.delete({ where: { id } });
    res.status(204).end();
  }),
);

export default router;
