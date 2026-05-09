// JWT + bcrypt auth helpers. Token shape is the AuthUser claim.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_TTL = '7d';

if (process.env.NODE_ENV === 'production' && SECRET === 'dev-secret-change-me') {
  console.warn('[auth] JWT_SECRET not set — using dev fallback. Tokens are insecure!');
}

export type { Role };

export interface AuthUser {
  id: number;
  username: string;
  role: Role;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, SECRET) as AuthUser & { iat?: number; exp?: number };
    return { id: decoded.id, username: decoded.username, role: decoded.role };
  } catch {
    return null;
  }
}
