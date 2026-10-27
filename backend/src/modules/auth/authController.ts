import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { hashPassword, verifyPassword, generateJwtToken } from '../../lib/auth';
import { requireAuth } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { ConflictError, UnauthorizedError, BadRequestError } from '../../utils/errors';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  isCreator: z.boolean().optional().default(false),
  isConsumer: z.boolean().optional().default(true),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /api/auth/register
authRouter.post('/register', async (req: Request, res: Response, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Validation error', 400, 'VALIDATION_ERROR', parsed.error.format());
    }

    const { email, password, name, isCreator, isConsumer } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        isCreator,
        isConsumer,
        wallet: {
          create: {
            balance: 0n,
            reservedBalance: 0n,
            currency: 'USD',
          },
        },
      },
      include: {
        wallet: true,
      },
    });

    const token = generateJwtToken({
      userId: user.id,
      email: user.email,
      isCreator: user.isCreator,
      isConsumer: user.isConsumer,
      isAdmin: user.isAdmin,
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.APP_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return sendSuccess(
      res,
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isCreator: user.isCreator,
          isConsumer: user.isConsumer,
          isAdmin: user.isAdmin,
        },
        wallet: {
          id: user.wallet?.id,
          balance: user.wallet?.balance.toString(),
          currency: user.wallet?.currency,
        },
        token,
      },
      201
    );
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Invalid credentials', 400, 'VALIDATION_ERROR');
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { wallet: true },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = generateJwtToken({
      userId: user.id,
      email: user.email,
      isCreator: user.isCreator,
      isConsumer: user.isConsumer,
      isAdmin: user.isAdmin,
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.APP_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isCreator: user.isCreator,
        isConsumer: user.isConsumer,
        isAdmin: user.isAdmin,
      },
      wallet: {
        id: user.wallet?.id,
        balance: user.wallet?.balance.toString(),
        currency: user.wallet?.currency,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  return sendSuccess(res, { message: 'Logged out successfully' });
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { wallet: true },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    return sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isCreator: user.isCreator,
        isConsumer: user.isConsumer,
        isAdmin: user.isAdmin,
      },
      wallet: {
        id: user.wallet?.id,
        balance: user.wallet?.balance.toString(),
        reservedBalance: user.wallet?.reservedBalance.toString(),
        currency: user.wallet?.currency,
      },
    });
  } catch (error) {
    next(error);
  }
});
