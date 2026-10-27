import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const SALT_ROUNDS = 12;
const JWT_EXPIRES_IN = '7d';

export interface UserTokenPayload {
  userId: string;
  email: string;
  isCreator: boolean;
  isConsumer: boolean;
  isAdmin: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateJwtToken(payload: UserTokenPayload): string {
  return jwt.sign(payload, env.AUTH_SECRET_KEY, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function verifyJwtToken(token: string): UserTokenPayload {
  return jwt.verify(token, env.AUTH_SECRET_KEY) as UserTokenPayload;
}
