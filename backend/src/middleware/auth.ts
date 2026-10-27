import { Request, Response, NextFunction } from 'express';
import { verifyJwtToken, UserTokenPayload } from '../lib/auth';
import { hashAgentToken } from '../lib/crypto';
import { prisma } from '../lib/prisma';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

export interface AuthenticatedAgent {
  id: string;
  userId: string;
  credentialId: string;
  name: string;
  scopes: string[];
  maxPerCallMicroUsd: bigint;
  dailyBudgetMicroUsd: bigint;
  monthlyBudgetMicroUsd: bigint;
  approvalThresholdMicroUsd: bigint;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserTokenPayload;
      agent?: AuthenticatedAgent;
    }
  }
}

/**
 * Require valid user session (JWT in cookie or Bearer header)
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    const payload = verifyJwtToken(token);
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else {
      next(new UnauthorizedError('Invalid or expired authentication session'));
    }
  }
}

/**
 * Optional authentication: extracts user if token exists, does not throw if absent
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

    if (token) {
      req.user = verifyJwtToken(token);
    }
  } catch {
    // Ignore invalid token for optional auth
  }
  next();
}

/**
 * Enforce specific role for the authenticated user
 */
export function requireRole(role: 'admin' | 'creator' | 'consumer') {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (role === 'admin' && !req.user.isAdmin) {
      return next(new ForbiddenError('Admin access required'));
    }
    if (role === 'creator' && !req.user.isCreator) {
      return next(new ForbiddenError('Creator access required'));
    }
    if (role === 'consumer' && !req.user.isConsumer) {
      return next(new ForbiddenError('Consumer access required'));
    }

    next();
  };
}

/**
 * Invariant 2: Owner and agent identity come strictly from authenticated credentials,
 * never from request bodies.
 */
export async function requireAgentAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-agent-key'] as string | undefined;

    let rawToken: string | null = null;
    if (apiKeyHeader) {
      rawToken = apiKeyHeader;
    } else if (authHeader?.startsWith('Bearer ')) {
      rawToken = authHeader.slice(7);
    }

    if (!rawToken || !rawToken.startsWith('tt_live_')) {
      throw new UnauthorizedError('Valid agent credentials required (tt_live_...)');
    }

    const tokenHash = hashAgentToken(rawToken);

    const credential = await prisma.agentCredential.findUnique({
      where: { tokenHash },
      include: {
        agent: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!credential) {
      throw new UnauthorizedError('Invalid agent credential');
    }

    if (credential.revokedAt) {
      throw new UnauthorizedError('Agent credential has been revoked');
    }

    if (credential.expiresAt && credential.expiresAt < new Date()) {
      throw new UnauthorizedError('Agent credential has expired');
    }

    if (!credential.agent.isActive) {
      throw new ForbiddenError('Agent is currently deactivated');
    }

    // Touch lastUsedAt asynchronously
    prisma.agentCredential.update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    req.agent = {
      id: credential.agent.id,
      userId: credential.agent.userId,
      credentialId: credential.id,
      name: credential.agent.name,
      scopes: credential.scopes,
      maxPerCallMicroUsd: credential.agent.maxPerCallMicroUsd,
      dailyBudgetMicroUsd: credential.agent.dailyBudgetMicroUsd,
      monthlyBudgetMicroUsd: credential.agent.monthlyBudgetMicroUsd,
      approvalThresholdMicroUsd: credential.agent.approvalThresholdMicroUsd,
    };

    req.user = {
      userId: credential.agent.user.id,
      email: credential.agent.user.email,
      isCreator: credential.agent.user.isCreator,
      isConsumer: credential.agent.user.isConsumer,
      isAdmin: credential.agent.user.isAdmin,
    };

    next();
  } catch (error) {
    next(error);
  }
}
