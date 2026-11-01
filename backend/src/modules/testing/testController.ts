import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import {
  generatePostmanCollection,
  generatePostmanEnvironment,
  runPostmanTests,
  getTestHistory,
  syncCollectionToPostman,
} from './postmanService';
import { prisma } from '../../lib/prisma';
import { NotFoundError, ForbiddenError } from '../../utils/errors';

export const testingRouter = Router();

const runTestSchema = z.object({
  toolId: z.string().uuid('Valid tool ID required'),
  endpointId: z.string().uuid().optional(),
  sampleInput: z.record(z.unknown()).optional(),
});

// POST /api/testing/run - Run Postman/Newman tests on an API or endpoint
testingRouter.post('/run', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const parsed = runTestSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Invalid test parameters', 400, 'VALIDATION_ERROR', parsed.error.format());
    }

    const { toolId, endpointId, sampleInput } = parsed.data;

    const report = await runPostmanTests({
      toolId,
      endpointId,
      sampleInput,
      userId: req.user!.userId,
      isAdmin: req.user!.isAdmin,
    });

    return sendSuccess(res, report);
  } catch (error) {
    next(error);
  }
});

// GET /api/testing/:toolId/collection - Export Postman Collection v2.1
testingRouter.get('/:toolId/collection', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const { toolId } = req.params;
    const tool = await prisma.tool.findUnique({ where: { id: toolId } });

    if (!tool) {
      throw new NotFoundError('API service not found');
    }

    if (tool.creatorId !== req.user!.userId && !req.user!.isAdmin && tool.status !== 'APPROVED') {
      throw new ForbiddenError('Unauthorized to access API collection');
    }

    const endpointId = req.query.endpointId ? String(req.query.endpointId) : undefined;
    const collection = await generatePostmanCollection(toolId, endpointId, undefined, true);

    if (req.query.download === 'true') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${tool.slug}-postman-collection.json"`);
      return res.status(200).send(JSON.stringify(collection, null, 2));
    }

    return sendSuccess(res, collection);
  } catch (error) {
    next(error);
  }
});

// GET /api/testing/:toolId/environment - Export Postman Environment
testingRouter.get('/:toolId/environment', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const { toolId } = req.params;
    const tool = await prisma.tool.findUnique({ where: { id: toolId } });

    if (!tool) {
      throw new NotFoundError('API service not found');
    }

    if (tool.creatorId !== req.user!.userId && !req.user!.isAdmin && tool.status !== 'APPROVED') {
      throw new ForbiddenError('Unauthorized to access API environment');
    }

    const environment = await generatePostmanEnvironment(toolId);

    if (req.query.download === 'true') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${tool.slug}-postman-environment.json"`);
      return res.status(200).send(JSON.stringify(environment, null, 2));
    }

    return sendSuccess(res, environment);
  } catch (error) {
    next(error);
  }
});

// GET /api/testing/:toolId/history - View test history for an API
testingRouter.get('/:toolId/history', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const { toolId } = req.params;
    const tool = await prisma.tool.findUnique({ where: { id: toolId } });

    if (!tool) {
      throw new NotFoundError('API service not found');
    }

    if (tool.creatorId !== req.user!.userId && !req.user!.isAdmin) {
      throw new ForbiddenError('Unauthorized to access test history');
    }

    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const history = await getTestHistory(toolId, limit);

    return sendSuccess(res, { history });
  } catch (error) {
    next(error);
  }
});

// POST /api/testing/:toolId/sync - Sync collection to Postman Cloud API
testingRouter.post('/:toolId/sync', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const { toolId } = req.params;
    const tool = await prisma.tool.findUnique({ where: { id: toolId } });

    if (!tool) {
      throw new NotFoundError('API service not found');
    }

    if (tool.creatorId !== req.user!.userId && !req.user!.isAdmin) {
      throw new ForbiddenError('Unauthorized to sync this collection');
    }

    const workspaceId = req.body.workspaceId ? String(req.body.workspaceId) : undefined;
    const result = await syncCollectionToPostman(toolId, workspaceId);

    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});
