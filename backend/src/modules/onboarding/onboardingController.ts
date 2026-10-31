import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole, optionalAuth } from '../../middleware/auth';
import { encryptSecret } from '../../lib/crypto';
import { sendSuccess, sendError } from '../../utils/response';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { ApimaticService } from './apimaticService';

export const onboardingRouter = Router();

const validateSpecSchema = z.object({
  specContent: z.string().optional(),
  specUrl: z.string().url().optional(),
}).refine((data) => Boolean((data.specContent && data.specContent.trim().length > 0) || data.specUrl), {
  message: 'Either specContent (raw YAML/JSON) or specUrl is required',
});

const endpointInputSchema = z.object({
  name: z.string().min(2, 'Endpoint name is required').max(100),
  endpointPath: z.string().startsWith('/', 'Endpoint path must start with /'),
  httpMethod: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown()).default({ type: 'object' }),
  outputSchema: z.record(z.unknown()).optional(),
  exampleRequest: z.record(z.unknown()).optional(),
  exampleResponse: z.record(z.unknown()).optional(),
  authMethod: z.enum(['NONE', 'API_KEY_HEADER', 'BEARER_TOKEN', 'BASIC_AUTH']).default('NONE'),
  authHeaderName: z.string().optional(),
  priceMicroUsd: z
    .union([z.string(), z.number(), z.bigint()])
    .refine((v) => {
      try {
        return BigInt(v) >= 0n;
      } catch {
        return false;
      }
    }, { message: 'priceMicroUsd must be non-negative integer' })
    .transform((v) => BigInt(v))
    .default(1000n),
  timeoutMs: z.number().int().min(500).max(30000).default(15000),
  isPrimary: z.boolean().optional().default(false),
});

const confirmOnboardingSchema = z.object({
  name: z.string().min(2, 'API Name must be at least 2 characters').max(100),
  shortDescription: z.string().max(250).optional(),
  detailedDescription: z.string().optional(),
  category: z.string().min(2, 'Category is required'),
  tags: z.array(z.string()).default([]),
  baseUrl: z.string().url('A valid base URL is required'),
  authMethod: z.enum(['NONE', 'API_KEY_HEADER', 'BEARER_TOKEN', 'BASIC_AUTH']).default('NONE'),
  authHeaderName: z.string().optional(),
  upstreamSecret: z.string().optional(),
  priceMicroUsd: z
    .union([z.string(), z.number(), z.bigint()])
    .refine((v) => {
      try {
        return BigInt(v) >= 0n;
      } catch {
        return false;
      }
    }, { message: 'priceMicroUsd must be a non-negative integer' })
    .transform((v) => BigInt(v))
    .default(1000n),
  timeoutMs: z.number().int().min(500).max(30000).default(15000),
  endpoints: z.array(endpointInputSchema).min(1, 'At least one endpoint must be included in the API service'),
});

/**
 * POST /api/onboarding/validate
 * Accepts an OpenAPI JSON/YAML string or a public URL.
 * Runs APIMatic validation and produces a detailed report and draft config.
 */
onboardingRouter.post('/validate', async (req: Request, res: Response, next) => {
  try {
    const parsed = validateSpecSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Invalid request parameters', 400, 'VALIDATION_ERROR', parsed.error.format());
    }

    const { specContent, specUrl } = parsed.data;
    const { report, draft } = await ApimaticService.validateAndTransform({ specContent, specUrl });

    return sendSuccess(res, {
      report,
      draft,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/onboarding/confirm
 * Saves the creator-approved and reviewed API configuration into ToolToll's existing models.
 * Associates with authenticated creator, creates Tool and ToolEndpoint records in DRAFT status.
 */
onboardingRouter.post('/confirm', requireAuth, requireRole('creator'), async (req: Request, res: Response, next) => {
  try {
    const parsed = confirmOnboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Validation error in API configuration', 400, 'VALIDATION_ERROR', parsed.error.format());
    }

    const data = parsed.data;
    const creatorId = req.user!.userId;

    // Encrypt secret at rest if provided
    let encryptedSecret: string | null = null;
    let secretKeyVersion: string | null = null;
    if (data.upstreamSecret && data.upstreamSecret.trim().length > 0) {
      const encrypted = encryptSecret(data.upstreamSecret);
      encryptedSecret = encrypted.encrypted;
      secretKeyVersion = encrypted.keyVersion;
    }

    const slug = `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
    const shortDesc = data.shortDescription || data.detailedDescription?.slice(0, 180) || `API service for ${data.name}`;
    const detailedDesc = data.detailedDescription || shortDesc;

    // Determine primary endpoint
    const primaryIndex = data.endpoints.findIndex((ep) => ep.isPrimary);
    const effectivePrimary = primaryIndex >= 0 ? data.endpoints[primaryIndex] : data.endpoints[0];

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create main Tool record in DRAFT status
      const tool = await tx.tool.create({
        data: {
          creatorId,
          name: data.name,
          slug,
          shortDescription: shortDesc,
          detailedDescription: detailedDesc,
          category: data.category,
          tags: data.tags.length > 0 ? data.tags : [data.category.toLowerCase(), 'onboarded'],
          baseUrl: data.baseUrl,
          endpointPath: effectivePrimary.endpointPath,
          httpMethod: effectivePrimary.httpMethod,
          inputSchema: effectivePrimary.inputSchema as object,
          outputSchema: effectivePrimary.outputSchema ? (effectivePrimary.outputSchema as object) : undefined,
          exampleRequest: effectivePrimary.exampleRequest ? (effectivePrimary.exampleRequest as object) : undefined,
          exampleResponse: effectivePrimary.exampleResponse ? (effectivePrimary.exampleResponse as object) : undefined,
          authMethod: data.authMethod || effectivePrimary.authMethod,
          authHeaderName: data.authHeaderName || effectivePrimary.authHeaderName || null,
          encryptedSecret,
          secretKeyVersion,
          priceMicroUsd: effectivePrimary.priceMicroUsd || data.priceMicroUsd,
          timeoutMs: effectivePrimary.timeoutMs || data.timeoutMs,
          status: 'DRAFT', // Invariant 10: newly onboarded tools are always DRAFT until tested & approved
          version: 1,
          isDemo: false,
        },
      });

      // 2. Create ToolVersion 1
      await tx.toolVersion.create({
        data: {
          toolId: tool.id,
          version: 1,
          inputSchema: effectivePrimary.inputSchema as object,
          outputSchema: effectivePrimary.outputSchema ? (effectivePrimary.outputSchema as object) : undefined,
          priceMicroUsd: effectivePrimary.priceMicroUsd || data.priceMicroUsd,
          endpointPath: effectivePrimary.endpointPath,
          httpMethod: effectivePrimary.httpMethod,
          authMethod: data.authMethod || effectivePrimary.authMethod,
        },
      });

      // 3. Create all ToolEndpoint records
      const createdEndpoints = [];
      for (let i = 0; i < data.endpoints.length; i++) {
        const ep = data.endpoints[i];
        const isPrimary = (primaryIndex >= 0 && i === primaryIndex) || (primaryIndex === -1 && i === 0);

        const createdEp = await tx.toolEndpoint.create({
          data: {
            toolId: tool.id,
            name: ep.name,
            description: ep.description || null,
            endpointPath: ep.endpointPath,
            httpMethod: ep.httpMethod,
            inputSchema: ep.inputSchema as object,
            outputSchema: ep.outputSchema ? (ep.outputSchema as object) : undefined,
            exampleRequest: ep.exampleRequest ? (ep.exampleRequest as object) : undefined,
            exampleResponse: ep.exampleResponse ? (ep.exampleResponse as object) : undefined,
            authMethod: ep.authMethod || data.authMethod,
            authHeaderName: ep.authHeaderName || data.authHeaderName || null,
            encryptedSecret,
            secretKeyVersion,
            priceMicroUsd: ep.priceMicroUsd || data.priceMicroUsd,
            timeoutMs: ep.timeoutMs || data.timeoutMs,
            status: 'DRAFT',
            isPrimary,
          },
        });
        createdEndpoints.push(createdEp);
      }

      // 4. Audit Log for security and compliance
      await tx.auditLog.create({
        data: {
          userId: creatorId,
          action: 'TOOL_ONBOARDED_APIMATIC',
          resourceType: 'TOOL',
          resourceId: tool.id,
          metadata: {
            toolName: tool.name,
            endpointCount: createdEndpoints.length,
            category: tool.category,
            status: tool.status,
          },
          ipAddress: req.ip,
        },
      });

      return { tool, endpoints: createdEndpoints };
    });

    const { encryptedSecret: _, secretKeyVersion: __, ...safeTool } = result.tool;
    const safeEndpoints = result.endpoints.map((ep) => {
      const { encryptedSecret: _, secretKeyVersion: __, ...safe } = ep;
      return {
        ...safe,
        priceMicroUsd: safe.priceMicroUsd.toString(),
      };
    });

    return sendSuccess(
      res,
      {
        ...safeTool,
        priceMicroUsd: safeTool.priceMicroUsd.toString(),
        endpointCount: safeEndpoints.length,
        endpoints: safeEndpoints,
        message: 'API successfully onboarded into ToolToll Creator Studio in DRAFT status.',
      },
      201
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/onboarding/sdk/:toolId/:language
 * Generates client SDK code (TypeScript or Python) for a registered ToolToll tool.
 */
onboardingRouter.get('/sdk/:toolId/:language', optionalAuth, async (req: Request, res: Response, next) => {
  try {
    const { toolId, language } = req.params;
    const lang = (language || 'typescript').toLowerCase();

    if (lang !== 'typescript' && lang !== 'python') {
      throw new BadRequestError("Unsupported SDK language. Supported: 'typescript', 'python'.");
    }

    const tool = await prisma.tool.findFirst({
      where: {
        OR: [{ id: toolId }, { slug: toolId }],
      },
      include: {
        endpoints: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!tool) {
      throw new NotFoundError('Tool not found');
    }

    const isOwner = req.user && req.user.userId === tool.creatorId;
    const isAdmin = req.user && req.user.isAdmin;
    if (tool.status !== 'APPROVED' && !tool.isDemo && !isOwner && !isAdmin) {
      throw new NotFoundError('Tool not found or unauthorized to download SDK');
    }

    const sdkResult = ApimaticService.generateClientSdk(tool, lang as 'typescript' | 'python');

    return sendSuccess(res, sdkResult);
  } catch (error) {
    next(error);
  }
});
