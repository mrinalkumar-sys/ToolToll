import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import { encryptSecret, hashAgentToken } from '../../lib/crypto';
import { verifyJwtToken } from '../../lib/auth';
import { executeUpstreamTool } from '../execution/executor';
import { ExecutionGateway } from '../execution/executionGateway';
import { sendSuccess, sendError } from '../../utils/response';
import { NotFoundError, ForbiddenError, BadRequestError, UnauthorizedError } from '../../utils/errors';

export const toolRouter = Router();

const createToolSchema = z.object({
  name: z.string().min(2, 'API Name is required (at least 2 characters)').max(100),
  shortDescription: z.string().max(250).optional(),
  detailedDescription: z.string().optional(),
  description: z.string().optional(),
  category: z.string().min(2, 'Category is required'),
  tags: z.array(z.string()).default([]),
  baseUrl: z.string().url('Valid Base URL is required (e.g. https://api.yourdomain.com)'),
  endpointPath: z.string().startsWith('/', 'Endpoint path must start with /'),
  httpMethod: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
  version: z.union([z.string(), z.number()]).transform((v) => parseInt(String(v), 10) || 1).default(1),
  inputSchema: z.record(z.unknown()),
  exampleRequest: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
  exampleResponse: z.record(z.unknown()).optional(),
  authMethod: z.enum(['NONE', 'API_KEY_HEADER', 'BEARER_TOKEN', 'BASIC_AUTH']).default('NONE'),
  authHeaderName: z.string().optional(),
  upstreamSecret: z.string().optional(),
  priceMicroUsd: z
    .union([z.string(), z.number(), z.bigint()])
    .refine((v) => {
      try {
        const b = BigInt(v);
        return b >= 0n;
      } catch {
        return false;
      }
    }, { message: 'priceMicroUsd must be a non-negative integer' })
    .transform((v) => BigInt(v))
    .default(1000n),
  timeoutMs: z.number().int().min(500).max(30000).default(15000),
  rateLimitPerMinute: z.number().int().min(1).default(60),
  terms: z.string().optional(),
  supportContact: z.string().optional(),
  isDemo: z.boolean().optional().default(false),
});

const createEndpointSchema = z.object({
  name: z.string().min(2, 'Endpoint name is required (min 2 characters)').max(100),
  endpointPath: z.string().startsWith('/', 'Endpoint path must start with / (e.g. /v1/run)'),
  httpMethod: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown()),
  exampleRequest: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
  exampleResponse: z.record(z.unknown()).optional(),
  authMethod: z.enum(['NONE', 'API_KEY_HEADER', 'BEARER_TOKEN', 'BASIC_AUTH']).default('NONE'),
  authHeaderName: z.string().optional(),
  upstreamSecret: z.string().optional(),
  priceMicroUsd: z
    .union([z.string(), z.number(), z.bigint()])
    .refine((v) => {
      try {
        const b = BigInt(v);
        return b >= 0n;
      } catch {
        return false;
      }
    }, { message: 'Price per call must be a positive integer in micro-USD' })
    .transform((v) => BigInt(v))
    .default(1000n),
  timeoutMs: z.number().int().min(500).max(30000).default(15000),
});

// Helper to compute measured metrics from real ToolCall history (PRD 7.3)
async function getToolMetrics(toolId: string) {
  const calls = await prisma.toolCall.findMany({
    where: { toolId },
    select: { status: true, latencyMs: true },
    take: 100,
    orderBy: { createdAt: 'desc' },
  });

  if (calls.length < 5) {
    return {
      sampleCount: calls.length,
      measuredSuccessRate: null,
      measuredAvgLatencyMs: null,
      statusLabel: 'insufficient_data', // PRD 7.3 requirement
    };
  }

  const successCalls = calls.filter((c) => c.status === 'SUCCESS');
  const successRate = (successCalls.length / calls.length) * 100;
  const latencies = successCalls.filter((c) => c.latencyMs != null).map((c) => c.latencyMs!);
  const avgLatency =
    latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;

  return {
    sampleCount: calls.length,
    measuredSuccessRate: Math.round(successRate * 10) / 10,
    measuredAvgLatencyMs: avgLatency,
    statusLabel: 'verified',
  };
}

// GET /api/tools (Marketplace browse)
toolRouter.get('/', optionalAuth, async (req: Request, res: Response, next) => {
  try {
    const { category, search, creatorId, status } = req.query;

    const where: Record<string, unknown> = {};

    if (creatorId && req.user?.userId === creatorId) {
      where.creatorId = creatorId;
      if (status) where.status = String(status);
    } else {
      // Public marketplace only shows APPROVED tools or Demo tools
      where.OR = [{ status: 'APPROVED' }, { isDemo: true }];
      if (category) where.category = String(category);
    }

    if (search) {
      where.name = { contains: String(search), mode: 'insensitive' };
    }

    const tools = await prisma.tool.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, email: true } },
        endpoints: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            toolId: true,
            name: true,
            description: true,
            endpointPath: true,
            httpMethod: true,
            inputSchema: true,
            exampleRequest: true,
            outputSchema: true,
            exampleResponse: true,
            authMethod: true,
            authHeaderName: true,
            priceMicroUsd: true,
            currency: true,
            timeoutMs: true,
            status: true,
            isPrimary: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        _count: {
          select: { endpoints: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = await Promise.all(
      tools.map(async (t) => {
        const metrics = await getToolMetrics(t.id);
        const { encryptedSecret, secretKeyVersion, ...safeTool } = t as any;
        return {
          ...safeTool,
          priceMicroUsd: safeTool.priceMicroUsd.toString(),
          endpointCount: safeTool._count?.endpoints || safeTool.endpoints?.length || 0,
          endpoints: (safeTool.endpoints || []).map((ep: any) => ({
            ...ep,
            priceMicroUsd: ep.priceMicroUsd.toString(),
          })),
          metrics,
        };
      })
    );

    return sendSuccess(res, enriched);
  } catch (error) {
    next(error);
  }
});

// GET /api/tools/search (Discovery and ranking - PRD 7.3)
toolRouter.get('/search', async (req: Request, res: Response, next) => {
  try {
    const { query, category, maxPrice, limit = '20' } = req.query;
    const maxResults = parseInt(String(limit), 10);

    const tools = await prisma.tool.findMany({
      where: {
        OR: [{ status: 'APPROVED' }, { isDemo: true }],
        ...(category ? { category: String(category) } : {}),
        ...(maxPrice ? { priceMicroUsd: { lte: BigInt(String(maxPrice)) } } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        detailedDescription: true,
        category: true,
        tags: true,
        priceMicroUsd: true,
        timeoutMs: true,
        isDemo: true,
      },
    });

    const q = String(query || '').toLowerCase();

    // Hybrid ranking score: relevance + price + measured performance
    const ranked = await Promise.all(
      tools.map(async (t) => {
        const metrics = await getToolMetrics(t.id);
        let score = 0;

        if (q) {
          if (t.name.toLowerCase().includes(q)) score += 50;
          if (t.shortDescription.toLowerCase().includes(q)) score += 30;
          if (t.tags.some((tag) => tag.toLowerCase().includes(q))) score += 20;
          if (t.category.toLowerCase().includes(q)) score += 15;
        } else {
          score = 50;
        }

        // Higher success rate adds to score
        if (metrics.measuredSuccessRate) {
          score += metrics.measuredSuccessRate * 0.3;
        }

        // Lower price adds score
        const priceDollars = Number(t.priceMicroUsd) / 1_000_000;
        score += Math.max(0, 20 - priceDollars * 10);

        return {
          ...t,
          priceMicroUsd: t.priceMicroUsd.toString(),
          metrics,
          rankingScore: Math.round(score * 10) / 10,
        };
      })
    );

    ranked.sort((a, b) => b.rankingScore - a.rankingScore);

    return sendSuccess(res, ranked.slice(0, maxResults));
  } catch (error) {
    next(error);
  }
});

// GET /api/tools/:id
toolRouter.get('/:id', optionalAuth, async (req: Request, res: Response, next) => {
  try {
    const tool = await prisma.tool.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        endpoints: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            toolId: true,
            name: true,
            description: true,
            endpointPath: true,
            httpMethod: true,
            inputSchema: true,
            exampleRequest: true,
            outputSchema: true,
            exampleResponse: true,
            authMethod: true,
            authHeaderName: true,
            priceMicroUsd: true,
            currency: true,
            timeoutMs: true,
            status: true,
            isPrimary: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        versions: {
          orderBy: { version: 'desc' },
          select: { version: true, priceMicroUsd: true, createdAt: true },
        },
        _count: { select: { endpoints: true } },
      },
    });

    if (!tool) {
      throw new NotFoundError('Tool not found');
    }

    const isOwner = req.user && req.user.userId === tool.creatorId;
    const isAdmin = req.user && req.user.isAdmin;
    if (tool.status !== 'APPROVED' && !tool.isDemo && !isOwner && !isAdmin) {
      throw new NotFoundError('Tool not found');
    }

    const metrics = await getToolMetrics(tool.id);

    // Invariant 8: NEVER return encryptedSecret or raw credentials
    const { encryptedSecret, secretKeyVersion, ...safeTool } = tool;

    return sendSuccess(res, {
      ...safeTool,
      priceMicroUsd: safeTool.priceMicroUsd.toString(),
      endpointCount: safeTool._count?.endpoints || safeTool.endpoints?.length || 0,
      endpoints: (safeTool.endpoints || []).map((ep: any) => ({
        ...ep,
        priceMicroUsd: ep.priceMicroUsd.toString(),
      })),
      metrics,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tools (Register new API service and its initial endpoint — Phase 2)
toolRouter.post('/', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const parsed = createToolSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Validation error', 400, 'VALIDATION_ERROR', parsed.error.format());
    }

    const data = parsed.data;

    let encryptedSecret: string | null = null;
    let secretKeyVersion: string | null = null;

    if (data.upstreamSecret) {
      const encrypted = encryptSecret(data.upstreamSecret);
      encryptedSecret = encrypted.encrypted;
      secretKeyVersion = encrypted.keyVersion;
    }

    const slug = `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
    const shortDesc = data.shortDescription || data.description?.slice(0, 190) || `API service for ${data.name}`;
    const detailedDesc = data.detailedDescription || data.description || shortDesc;

    // Save the new API service and its initial endpoint in a transaction (Phase 2 & 5)
    const result = await prisma.$transaction(async (tx) => {
      const tool = await tx.tool.create({
        data: {
          creatorId: req.user!.userId,
          name: data.name,
          slug,
          shortDescription: shortDesc,
          detailedDescription: detailedDesc,
          category: data.category,
          tags: data.tags.length ? data.tags : [data.category.toLowerCase(), 'api'],
          baseUrl: data.baseUrl,
          endpointPath: data.endpointPath,
          httpMethod: data.httpMethod,
          inputSchema: data.inputSchema as object,
          exampleRequest: data.exampleRequest as object | undefined,
          outputSchema: data.outputSchema as object | undefined,
          exampleResponse: data.exampleResponse as object | undefined,
          authMethod: data.authMethod,
          authHeaderName: data.authHeaderName,
          encryptedSecret,
          secretKeyVersion,
          priceMicroUsd: data.priceMicroUsd,
          timeoutMs: data.timeoutMs,
          rateLimitPerMinute: data.rateLimitPerMinute,
          terms: data.terms,
          supportContact: data.supportContact,
          status: data.isDemo ? 'APPROVED' : 'DRAFT',
          version: data.version,
          isDemo: data.isDemo,
        },
      });

      await tx.toolVersion.create({
        data: {
          toolId: tool.id,
          version: data.version,
          inputSchema: data.inputSchema as object,
          outputSchema: data.outputSchema as object | undefined,
          priceMicroUsd: data.priceMicroUsd,
          endpointPath: data.endpointPath,
          httpMethod: data.httpMethod,
          authMethod: data.authMethod,
        },
      });

      const initialEndpoint = await tx.toolEndpoint.create({
        data: {
          toolId: tool.id,
          name: `${data.name} (Primary Endpoint)`,
          description: shortDesc,
          endpointPath: data.endpointPath,
          httpMethod: data.httpMethod,
          inputSchema: data.inputSchema as object,
          exampleRequest: data.exampleRequest as object | undefined,
          outputSchema: data.outputSchema as object | undefined,
          exampleResponse: data.exampleResponse as object | undefined,
          authMethod: data.authMethod,
          authHeaderName: data.authHeaderName,
          encryptedSecret,
          secretKeyVersion,
          priceMicroUsd: data.priceMicroUsd,
          timeoutMs: data.timeoutMs,
          status: data.isDemo ? 'APPROVED' : 'DRAFT',
          isPrimary: true,
        },
      });

      return { tool, initialEndpoint };
    });

    const { encryptedSecret: _, secretKeyVersion: __, ...safeTool } = result.tool;
    const { encryptedSecret: ___, secretKeyVersion: ____, ...safeEndpoint } = result.initialEndpoint;

    return sendSuccess(
      res,
      {
        ...safeTool,
        priceMicroUsd: safeTool.priceMicroUsd.toString(),
        endpointCount: 1,
        endpoints: [
          {
            ...safeEndpoint,
            priceMicroUsd: safeEndpoint.priceMicroUsd.toString(),
          },
        ],
      },
      201
    );
  } catch (error) {
    next(error);
  }
});

// POST /api/tools/:id/test (Run test call before submission)
toolRouter.post('/:id/test', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const tool = await prisma.tool.findFirst({
      where: { id: req.params.id, creatorId: req.user!.userId },
    });

    if (!tool) {
      throw new NotFoundError('Tool not found or unauthorized');
    }

    const sampleInput = req.body.input || {};

    const result = await executeUpstreamTool({
      baseUrl: tool.baseUrl,
      endpointPath: tool.endpointPath,
      httpMethod: tool.httpMethod,
      authMethod: tool.authMethod,
      authHeaderName: tool.authHeaderName,
      encryptedSecret: tool.encryptedSecret,
      payload: sampleInput,
      timeoutMs: tool.timeoutMs,
      isDemo: tool.isDemo,
    });

    const testRun = await prisma.toolTestRun.create({
      data: {
        toolId: tool.id,
        sampleInput: sampleInput as object,
        responseStatus: result.statusCode,
        responseBody: result.body as object,
        latencyMs: result.latencyMs,
        isSuccess: result.isSuccess,
        errorMessage: result.failureReason,
      },
    });

    return sendSuccess(res, {
      testRunId: testRun.id,
      isSuccess: result.isSuccess,
      statusCode: result.statusCode,
      latencyMs: result.latencyMs,
      response: result.body,
      errorMessage: result.failureReason,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tools/:id/submit (Submit tool for Admin Review)
toolRouter.post('/:id/submit', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const tool = await prisma.tool.findFirst({
      where: { id: req.params.id, creatorId: req.user!.userId },
    });

    if (!tool) {
      throw new NotFoundError('Tool not found');
    }

    // Must have at least one successful test run before submission (or be demo)
    const successfulTest = await prisma.toolTestRun.findFirst({
      where: { toolId: tool.id, isSuccess: true },
    });

    if (!successfulTest && !tool.isDemo) {
      throw new BadRequestError('Tool must have at least one successful test run before submitting for approval');
    }

    const updated = await prisma.tool.update({
      where: { id: tool.id },
      data: { status: 'PENDING_REVIEW' },
    });

    return sendSuccess(res, {
      id: updated.id,
      name: updated.name,
      status: updated.status,
      message: 'Tool submitted for admin review',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// PHASE 3: ENDPOINT MANAGEMENT UNDER EXISTING API SERVICES
// ============================================================================

// GET /api/tools/:id/endpoints - List all endpoints for an API service
toolRouter.get('/:id/endpoints', optionalAuth, async (req: Request, res: Response, next) => {
  try {
    const tool = await prisma.tool.findUnique({
      where: { id: req.params.id },
    });

    if (!tool) {
      throw new NotFoundError('API service not found');
    }

    const isOwner = req.user && req.user.userId === tool.creatorId;
    const isAdmin = req.user && req.user.isAdmin;
    if (tool.status !== 'APPROVED' && !tool.isDemo && !isOwner && !isAdmin) {
      throw new NotFoundError('API service not found');
    }

    const endpoints = await prisma.toolEndpoint.findMany({
      where: { toolId: tool.id },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    const safeEndpoints = endpoints.map((ep) => {
      const { encryptedSecret: _, secretKeyVersion: __, ...safe } = ep;
      return {
        ...safe,
        priceMicroUsd: safe.priceMicroUsd.toString(),
        toolName: tool.name,
      };
    });

    return sendSuccess(res, safeEndpoints);
  } catch (error) {
    next(error);
  }
});

// POST /api/tools/:id/endpoints - Add new endpoint to an existing API service (Phase 3)
toolRouter.post('/:id/endpoints', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const tool = await prisma.tool.findUnique({
      where: { id: req.params.id },
    });

    if (!tool) {
      throw new NotFoundError('API service not found');
    }

    // Phase 3, Step 3.2: Verify that the authenticated creator owns that API
    if (tool.creatorId !== req.user!.userId && !req.user!.isAdmin) {
      throw new ForbiddenError('You can only add endpoints to API services you own');
    }

    const parsed = createEndpointSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Validation error', 400, 'VALIDATION_ERROR', parsed.error.format());
    }

    const data = parsed.data;

    // Phase 3, Step 3.4: Check for duplicate endpoint paths and methods within the same API
    const existing = await prisma.toolEndpoint.findUnique({
      where: {
        toolId_endpointPath_httpMethod: {
          toolId: tool.id,
          endpointPath: data.endpointPath,
          httpMethod: data.httpMethod,
        },
      },
    });

    if (existing) {
      throw new BadRequestError(
        `An endpoint with path "${data.endpointPath}" and method "${data.httpMethod}" already exists on this API service.`
      );
    }

    let encryptedSecret = null;
    let secretKeyVersion = null;
    if (data.upstreamSecret) {
      const encrypted = encryptSecret(data.upstreamSecret);
      encryptedSecret = encrypted.encrypted;
      secretKeyVersion = encrypted.keyVersion;
    }

    // Phase 3, Step 3.5 & 3.6: Save new endpoint in PostgreSQL associated with selected API
    const endpoint = await prisma.toolEndpoint.create({
      data: {
        toolId: tool.id,
        name: data.name,
        description: data.description || null,
        endpointPath: data.endpointPath,
        httpMethod: data.httpMethod,
        inputSchema: data.inputSchema as object,
        exampleRequest: data.exampleRequest as object | undefined,
        outputSchema: data.outputSchema as object | undefined,
        exampleResponse: data.exampleResponse as object | undefined,
        authMethod: data.authMethod,
        authHeaderName: data.authHeaderName || null,
        encryptedSecret,
        secretKeyVersion,
        priceMicroUsd: data.priceMicroUsd,
        timeoutMs: data.timeoutMs,
        status: tool.isDemo ? 'APPROVED' : 'DRAFT',
        isPrimary: false,
      },
    });

    const { encryptedSecret: _, secretKeyVersion: __, ...safeEndpoint } = endpoint;
    return sendSuccess(
      res,
      {
        ...safeEndpoint,
        priceMicroUsd: safeEndpoint.priceMicroUsd.toString(),
        toolName: tool.name,
      },
      201
    );
  } catch (error) {
    next(error);
  }
});

// POST /api/tools/:id/endpoints/:endpointId/test - Test a specific endpoint (Phase 4.D)
toolRouter.post('/:id/endpoints/:endpointId/test', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const tool = await prisma.tool.findUnique({
      where: { id: req.params.id },
    });

    if (!tool) {
      throw new NotFoundError('API service not found');
    }

    if (tool.creatorId !== req.user!.userId && !req.user!.isAdmin) {
      throw new ForbiddenError('Unauthorized');
    }

    const endpoint = await prisma.toolEndpoint.findFirst({
      where: { id: req.params.endpointId, toolId: tool.id },
    });

    if (!endpoint) {
      throw new NotFoundError('Endpoint not found');
    }

    const sampleInput = req.body.input || {};

    const result = await executeUpstreamTool({
      baseUrl: tool.baseUrl,
      endpointPath: endpoint.endpointPath,
      httpMethod: endpoint.httpMethod,
      authMethod: endpoint.authMethod,
      authHeaderName: endpoint.authHeaderName,
      encryptedSecret: endpoint.encryptedSecret || tool.encryptedSecret,
      payload: sampleInput,
      timeoutMs: endpoint.timeoutMs || tool.timeoutMs,
      isDemo: tool.isDemo,
    });

    const testRun = await prisma.toolTestRun.create({
      data: {
        toolId: tool.id,
        endpointId: endpoint.id,
        sampleInput: sampleInput as object,
        responseStatus: result.statusCode,
        responseBody: result.body as object,
        latencyMs: result.latencyMs,
        isSuccess: result.isSuccess,
        errorMessage: result.failureReason,
      },
    });

    return sendSuccess(res, {
      testRunId: testRun.id,
      isSuccess: result.isSuccess,
      statusCode: result.statusCode,
      latencyMs: result.latencyMs,
      response: result.body,
      errorMessage: result.failureReason,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/tools/:id/endpoints/:endpointId - Edit an endpoint (Phase 4.D)
toolRouter.put('/:id/endpoints/:endpointId', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const tool = await prisma.tool.findUnique({
      where: { id: req.params.id },
    });

    if (!tool) {
      throw new NotFoundError('API service not found');
    }

    if (tool.creatorId !== req.user!.userId && !req.user!.isAdmin) {
      throw new ForbiddenError('Unauthorized');
    }

    const endpoint = await prisma.toolEndpoint.findFirst({
      where: { id: req.params.endpointId, toolId: tool.id },
    });

    if (!endpoint) {
      throw new NotFoundError('Endpoint not found');
    }

    const {
      name,
      description,
      endpointPath,
      httpMethod,
      inputSchema,
      exampleRequest,
      outputSchema,
      exampleResponse,
      priceMicroUsd,
      authMethod,
      authHeaderName,
      upstreamSecret,
      timeoutMs,
      status,
    } = req.body;

    let encryptedSecret = endpoint.encryptedSecret;
    let secretKeyVersion = endpoint.secretKeyVersion;
    if (upstreamSecret) {
      const encrypted = encryptSecret(upstreamSecret);
      encryptedSecret = encrypted.encrypted;
      secretKeyVersion = encrypted.keyVersion;
    }

    let newPrice = endpoint.priceMicroUsd;
    if (priceMicroUsd !== undefined) {
      newPrice = BigInt(priceMicroUsd);
    }

    const updated = await prisma.toolEndpoint.update({
      where: { id: endpoint.id },
      data: {
        ...(name ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(endpointPath ? { endpointPath } : {}),
        ...(httpMethod ? { httpMethod } : {}),
        ...(inputSchema ? { inputSchema: inputSchema as object } : {}),
        ...(exampleRequest !== undefined ? { exampleRequest: exampleRequest as object } : {}),
        ...(outputSchema !== undefined ? { outputSchema: outputSchema as object } : {}),
        ...(exampleResponse !== undefined ? { exampleResponse: exampleResponse as object } : {}),
        ...(authMethod ? { authMethod } : {}),
        ...(authHeaderName !== undefined ? { authHeaderName } : {}),
        encryptedSecret,
        secretKeyVersion,
        priceMicroUsd: newPrice,
        ...(timeoutMs ? { timeoutMs: Number(timeoutMs) } : {}),
        ...(status ? { status } : {}),
      },
    });

    const { encryptedSecret: _, secretKeyVersion: __, ...safe } = updated;
    return sendSuccess(res, { ...safe, priceMicroUsd: safe.priceMicroUsd.toString() });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/tools/:id/endpoints/:endpointId - Deactivate / delete endpoint
toolRouter.delete('/:id/endpoints/:endpointId', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const tool = await prisma.tool.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { endpoints: true } } },
    });

    if (!tool) {
      throw new NotFoundError('API service not found');
    }

    if (tool.creatorId !== req.user!.userId && !req.user!.isAdmin) {
      throw new ForbiddenError('Unauthorized');
    }

    const endpoint = await prisma.toolEndpoint.findFirst({
      where: { id: req.params.endpointId, toolId: tool.id },
    });

    if (!endpoint) {
      throw new NotFoundError('Endpoint not found');
    }

    if (tool._count.endpoints <= 1) {
      throw new BadRequestError('Cannot delete the only endpoint for this API service. Each API must have at least one endpoint.');
    }

    await prisma.toolEndpoint.delete({
      where: { id: endpoint.id },
    });

    return sendSuccess(res, { message: 'Endpoint removed successfully' });
  } catch (error) {
    next(error);
  }
});


toolRouter.put('/:id', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const tool = await prisma.tool.findFirst({
      where: { id: req.params.id, creatorId: req.user!.userId },
    });

    if (!tool) {
      throw new NotFoundError('Tool not found or unauthorized');
    }

    const {
      name,
      shortDescription,
      detailedDescription,
      category,
      tags,
      baseUrl,
      endpointPath,
      httpMethod,
      inputSchema,
      outputSchema,
      authMethod,
      authHeaderName,
      upstreamSecret,
      priceMicroUsd,
      timeoutMs,
      rateLimitPerMinute,
      terms,
      supportContact,
    } = req.body;

    let encryptedSecret = tool.encryptedSecret;
    let secretKeyVersion = tool.secretKeyVersion;

    if (upstreamSecret) {
      const encrypted = encryptSecret(upstreamSecret);
      encryptedSecret = encrypted.encrypted;
      secretKeyVersion = encrypted.keyVersion;
    }

    let newPrice = tool.priceMicroUsd;
    if (priceMicroUsd !== undefined) {
      try {
        const parsedPrice = BigInt(priceMicroUsd);
        if (parsedPrice < 0n) {
          throw new BadRequestError('priceMicroUsd must be a non-negative integer');
        }
        newPrice = parsedPrice;
      } catch (err) {
        if (err instanceof BadRequestError) throw err;
        throw new BadRequestError('Invalid priceMicroUsd');
      }
    }

    const isPriceChanged = newPrice !== tool.priceMicroUsd;
    const isSchemaChanged = inputSchema !== undefined || outputSchema !== undefined;
    const isEndpointChanged = (baseUrl && baseUrl !== tool.baseUrl) || (endpointPath && endpointPath !== tool.endpointPath);
    const newVersion = (isPriceChanged || isSchemaChanged || isEndpointChanged) ? tool.version + 1 : tool.version;

    // PRD 7.2: If creator modifies endpoint or schema of an APPROVED tool (and not demo),
    // status transitions back to PENDING_REVIEW to require verification
    let nextStatus = tool.status;
    if ((isEndpointChanged || isSchemaChanged) && tool.status === 'APPROVED' && !tool.isDemo) {
      nextStatus = 'PENDING_REVIEW';
    }

    const updated = await prisma.tool.update({
      where: { id: tool.id },
      data: {
        ...(name ? { name } : {}),
        ...(shortDescription ? { shortDescription } : {}),
        ...(detailedDescription ? { detailedDescription } : {}),
        ...(category ? { category } : {}),
        ...(tags ? { tags } : {}),
        ...(baseUrl ? { baseUrl } : {}),
        ...(endpointPath ? { endpointPath } : {}),
        ...(httpMethod ? { httpMethod } : {}),
        ...(inputSchema ? { inputSchema: inputSchema as object } : {}),
        ...(outputSchema ? { outputSchema: outputSchema as object } : {}),
        ...(authMethod ? { authMethod } : {}),
        ...(authHeaderName !== undefined ? { authHeaderName } : {}),
        encryptedSecret,
        secretKeyVersion,
        priceMicroUsd: newPrice,
        ...(timeoutMs ? { timeoutMs: Number(timeoutMs) } : {}),
        ...(rateLimitPerMinute ? { rateLimitPerMinute: Number(rateLimitPerMinute) } : {}),
        ...(terms !== undefined ? { terms } : {}),
        ...(supportContact !== undefined ? { supportContact } : {}),
        version: newVersion,
        status: nextStatus,
      },
    });

    // PRD 7.2: If schema, price or endpoint changed, create new ToolVersion record
    if (isPriceChanged || isSchemaChanged || isEndpointChanged) {
      await prisma.toolVersion.create({
        data: {
          toolId: tool.id,
          version: newVersion,
          inputSchema: (inputSchema || tool.inputSchema) as object,
          outputSchema: (outputSchema || tool.outputSchema) as object | undefined,
          priceMicroUsd: newPrice,
          endpointPath: endpointPath || tool.endpointPath,
          httpMethod: httpMethod || tool.httpMethod,
          authMethod: authMethod || tool.authMethod,
        },
      });
    }

    const { encryptedSecret: _, secretKeyVersion: __, ...safeTool } = updated;
    return sendSuccess(res, { ...safeTool, priceMicroUsd: safeTool.priceMicroUsd.toString() });
  } catch (error) {
    next(error);
  }
});

// POST /api/tools/:id/status (Creator pause or retire tool)
toolRouter.post('/:id/status', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const { status } = req.body;
    if (!['PAUSED', 'APPROVED', 'RETIRED'].includes(status)) {
      throw new BadRequestError('Invalid status transition');
    }

    const tool = await prisma.tool.findFirst({
      where: { id: req.params.id, creatorId: req.user!.userId },
    });

    if (!tool) {
      throw new NotFoundError('Tool not found');
    }

    if (tool.status === 'RETIRED') {
      throw new BadRequestError('Cannot change status of a retired tool');
    }

    if (tool.status === 'SUSPENDED') {
      throw new BadRequestError('Suspended tools can only be modified by an administrator');
    }

    // Creators can only resume to APPROVED if the tool was previously APPROVED (currently PAUSED)
    if (status === 'APPROVED' && tool.status !== 'PAUSED') {
      throw new BadRequestError('Only paused tools can be resumed to APPROVED status by creator. New or unapproved tools require admin approval.');
    }

    const updated = await prisma.tool.update({
      where: { id: tool.id },
      data: { status },
    });

    return sendSuccess(res, { id: updated.id, status: updated.status });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/tools/:id (Delete tool with no execution history)
toolRouter.delete('/:id', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const tool = await prisma.tool.findFirst({
      where: { id: req.params.id, creatorId: req.user!.userId },
    });

    if (!tool) {
      throw new NotFoundError('Tool not found');
    }

    const callCount = await prisma.toolCall.count({ where: { toolId: tool.id } });
    if (callCount > 0) {
      throw new BadRequestError('Cannot delete a tool that has call history. Retire the tool instead.');
    }

    await prisma.adminReview.deleteMany({ where: { toolId: tool.id } });
    await prisma.toolTestRun.deleteMany({ where: { toolId: tool.id } });
    await prisma.toolVersion.deleteMany({ where: { toolId: tool.id } });
    await prisma.abuseReport.deleteMany({ where: { toolId: tool.id } });
    await prisma.tool.delete({ where: { id: tool.id } });

    return sendSuccess(res, { id: tool.id, message: 'Tool deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/tools/:id/report (Report tool abuse)
toolRouter.post('/:id/report', optionalAuth, async (req: Request, res: Response, next) => {
  try {
    const { reason, callId } = req.body;
    if (!reason) {
      throw new BadRequestError('Abuse report reason is required');
    }

    const tool = await prisma.tool.findUnique({
      where: { id: req.params.id },
    });

    if (!tool) {
      throw new NotFoundError('Tool not found');
    }

    const report = await prisma.abuseReport.create({
      data: {
        toolId: tool.id,
        reporterId: req.user?.userId || null,
        callId: callId || null,
        reason,
        status: 'PENDING',
      },
    });

    return sendSuccess(res, { reportId: report.id, message: 'Abuse report filed successfully' }, 201);
  } catch (error) {
    next(error);
  }
});


// POST /api/tools/:id/calls (Execute paid tool call)
toolRouter.post('/:id/calls', async (req: Request, res: Response, next) => {
  try {
    let agentId: string | null = null;

    // Check if called via Agent token
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-agent-key'] as string | undefined;
    const rawToken = apiKeyHeader || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

    if (rawToken && rawToken.startsWith('tt_live_')) {
      const tokenHash = hashAgentToken(rawToken);
      const credential = await prisma.agentCredential.findUnique({
        where: { tokenHash },
        include: { agent: true },
      });
      if (!credential || credential.revokedAt || !credential.agent.isActive) {
        throw new ForbiddenError('Invalid or revoked agent credentials');
      }
      agentId = credential.agentId;
    } else {
      // Otherwise check user session (Playground call)
      const userToken = req.cookies?.token || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
      if (!userToken) {
        throw new UnauthorizedError('Authentication required to execute tool');
      }

      let payload: ReturnType<typeof verifyJwtToken>;
      try {
        payload = verifyJwtToken(userToken);
      } catch {
        throw new UnauthorizedError('Invalid or expired authentication token');
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: { agents: { where: { isActive: true } } },
      });

      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      if (req.body.agentId) {
        const ownedAgent = user.agents.find((a) => a.id === req.body.agentId);
        if (!ownedAgent) {
          throw new ForbiddenError('Specified agent does not belong to the authenticated user or is inactive');
        }
        agentId = ownedAgent.id;
      } else if (user.agents && user.agents.length > 0) {
        agentId = user.agents[0].id;
      } else {
        throw new BadRequestError('No active agent found for this user. Create an agent before executing paid calls.');
      }
    }

    const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;
    if (!idempotencyKey) {
      throw new BadRequestError('Idempotency-Key header is required');
    }

    const result = await ExecutionGateway.execute({
      agentId: agentId!,
      toolId: req.params.id,
      endpointId: req.body.endpointId || undefined,
      idempotencyKey,
      input: req.body.input,
      forceApproval: req.body.forceApproval === true,
    });

    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});
