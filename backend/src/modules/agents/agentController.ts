import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { generateAgentToken } from '../../lib/crypto';
import { sendSuccess, sendError } from '../../utils/response';
import { NotFoundError, ForbiddenError } from '../../utils/errors';

export const agentRouter = Router();

const createAgentSchema = z.object({
  name: z.string().min(2, 'Agent name must be at least 2 characters'),
  description: z.string().optional(),
  maxPerCallMicroUsd: z.string().or(z.number()).transform((v) => BigInt(v)).default(1000000), // $1.00
  dailyBudgetMicroUsd: z.string().or(z.number()).transform((v) => BigInt(v)).default(50000000), // $50.00
  monthlyBudgetMicroUsd: z.string().or(z.number()).transform((v) => BigInt(v)).default(500000000), // $500.00
  approvalThresholdMicroUsd: z.string().or(z.number()).transform((v) => BigInt(v)).default(5000000), // $5.00
  autoApproveTags: z.array(z.string()).default([]),
});

const permissionSchema = z.object({
  permissions: z.array(
    z.object({
      toolId: z.string().optional(),
      category: z.string().optional(),
      isAllowed: z.boolean(),
    })
  ),
});

// GET /api/agents
agentRouter.get('/', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const agents = await prisma.agent.findMany({
      where: { userId: req.user!.userId },
      include: {
        credentials: {
          select: {
            id: true,
            prefix: true,
            name: true,
            scopes: true,
            lastUsedAt: true,
            revokedAt: true,
            createdAt: true,
          },
        },
        permissions: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return sendSuccess(res, agents);
  } catch (error) {
    next(error);
  }
});

// POST /api/agents
agentRouter.post('/', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const parsed = createAgentSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Validation error', 400, 'VALIDATION_ERROR', parsed.error.format());
    }

    const {
      name,
      description,
      maxPerCallMicroUsd,
      dailyBudgetMicroUsd,
      monthlyBudgetMicroUsd,
      approvalThresholdMicroUsd,
      autoApproveTags,
    } = parsed.data;

    const agent = await prisma.agent.create({
      data: {
        userId: req.user!.userId,
        name,
        description,
        maxPerCallMicroUsd,
        dailyBudgetMicroUsd,
        monthlyBudgetMicroUsd,
        approvalThresholdMicroUsd,
        autoApproveTags,
      },
    });

    // Automatically generate first agent credential
    const { token, prefix, tokenHash } = generateAgentToken();
    const credential = await prisma.agentCredential.create({
      data: {
        agentId: agent.id,
        prefix,
        tokenHash,
        name: 'Initial Token',
        scopes: ['tools:execute', 'tools:read'],
      },
    });

    // Invariant: Return RAW token ONCE upon creation
    return sendSuccess(
      res,
      {
        agent,
        credential: {
          id: credential.id,
          prefix: credential.prefix,
          name: credential.name,
          scopes: credential.scopes,
          createdAt: credential.createdAt,
          rawToken: token, // Warning to user: displayed once
        },
      },
      201
    );
  } catch (error) {
    next(error);
  }
});

// GET /api/agents/:id
agentRouter.get('/:id', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const agent = await prisma.agent.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: {
        credentials: {
          select: {
            id: true,
            prefix: true,
            name: true,
            scopes: true,
            lastUsedAt: true,
            revokedAt: true,
            createdAt: true,
          },
        },
        permissions: true,
      },
    });

    if (!agent) {
      throw new NotFoundError('Agent not found');
    }

    return sendSuccess(res, agent);
  } catch (error) {
    next(error);
  }
});

// POST /api/agents/:id/credentials
agentRouter.post('/:id/credentials', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const agent = await prisma.agent.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!agent) {
      throw new NotFoundError('Agent not found');
    }

    const name = req.body.name || `Key ${new Date().toISOString().slice(0, 10)}`;
    const scopes = req.body.scopes || ['tools:execute', 'tools:read'];

    const { token, prefix, tokenHash } = generateAgentToken();
    const credential = await prisma.agentCredential.create({
      data: {
        agentId: agent.id,
        prefix,
        tokenHash,
        name,
        scopes,
      },
    });

    return sendSuccess(
      res,
      {
        id: credential.id,
        prefix: credential.prefix,
        name: credential.name,
        scopes: credential.scopes,
        createdAt: credential.createdAt,
        rawToken: token, // Displayed once
      },
      201
    );
  } catch (error) {
    next(error);
  }
});

// DELETE /api/agents/:id/credentials/:credentialId
agentRouter.delete('/:id/credentials/:credentialId', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const agent = await prisma.agent.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!agent) {
      throw new NotFoundError('Agent not found');
    }

    const credential = await prisma.agentCredential.findFirst({
      where: { id: req.params.credentialId, agentId: agent.id },
    });

    if (!credential) {
      throw new NotFoundError('Credential not found');
    }

    await prisma.agentCredential.update({
      where: { id: credential.id },
      data: { revokedAt: new Date() },
    });

    return sendSuccess(res, { message: 'Credential revoked successfully' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/agents/:id/permissions
agentRouter.put('/:id/permissions', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const agent = await prisma.agent.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!agent) {
      throw new NotFoundError('Agent not found');
    }

    const parsed = permissionSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Invalid permission payload', 400, 'VALIDATION_ERROR', parsed.error.format());
    }

    // Delete existing permissions and replace
    await prisma.agentPermission.deleteMany({
      where: { agentId: agent.id },
    });

    await prisma.agentPermission.createMany({
      data: parsed.data.permissions.map((p) => ({
        agentId: agent.id,
        toolId: p.toolId || null,
        category: p.category || null,
        isAllowed: p.isAllowed,
      })),
    });

    const updated = await prisma.agentPermission.findMany({
      where: { agentId: agent.id },
    });

    return sendSuccess(res, updated);
  } catch (error) {
    next(error);
  }
});
