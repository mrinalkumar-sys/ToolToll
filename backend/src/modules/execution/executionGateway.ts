import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../lib/prisma';
import { executeUpstreamTool } from './executor';
import { LedgerService } from '../ledger/ledgerService';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ApprovalRequiredError,
} from '../../utils/errors';
import { env } from '../../config/env';

export interface ExecuteToolRequest {
  agentId: string;
  toolId: string;
  idempotencyKey: string;
  input: unknown;
  forceApproval?: boolean;
}

export interface ExecuteToolResponse {
  callId: string;
  status: 'SUCCESS' | 'FAILED' | 'REVERSED' | 'APPROVAL_REQUIRED';
  result?: unknown;
  priceMicroUsd: string;
  platformFeeMicroUsd: string;
  creatorEarningsMicroUsd: string;
  latencyMs?: number;
  failureReason?: string;
  isIdempotentReplay?: boolean;
}

/**
 * Validates data against a simple JSON schema structure
 */
function validateJsonSchema(schema: unknown, data: unknown): { valid: boolean; error?: string } {
  if (!schema || typeof schema !== 'object') {
    return { valid: true };
  }

  const s = schema as { type?: string; required?: string[]; properties?: Record<string, unknown> };

  if (s.type === 'object') {
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return { valid: false, error: 'Expected JSON object for input payload' };
    }

    if (Array.isArray(s.required)) {
      const obj = data as Record<string, unknown>;
      for (const requiredKey of s.required) {
        if (obj[requiredKey] === undefined) {
          return { valid: false, error: `Missing required field: '${requiredKey}'` };
        }
      }
    }
  }

  return { valid: true };
}

export class ExecutionGateway {
  /**
   * Execute paid tool call through complete verification and billing pipeline
   */
  static async execute(params: ExecuteToolRequest): Promise<ExecuteToolResponse> {
    const { agentId, toolId, idempotencyKey, input, forceApproval } = params;

    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      throw new BadRequestError('Idempotency-Key is required');
    }

    // Step 1 & 7: Check Idempotency Key (Invariant 6)
    const existingCall = await prisma.toolCall.findUnique({
      where: {
        agentId_idempotencyKey: {
          agentId,
          idempotencyKey,
        },
      },
    });

    if (existingCall) {
      return {
        callId: existingCall.id,
        status: existingCall.status as 'SUCCESS' | 'FAILED' | 'REVERSED' | 'APPROVAL_REQUIRED',
        result: existingCall.sanitizedOutput,
        priceMicroUsd: existingCall.priceMicroUsd.toString(),
        platformFeeMicroUsd: existingCall.platformFeeMicroUsd.toString(),
        creatorEarningsMicroUsd: existingCall.creatorEarningsMicroUsd.toString(),
        latencyMs: existingCall.latencyMs || undefined,
        failureReason: existingCall.failureReason || undefined,
        isIdempotentReplay: true,
      };
    }

    // Step 2: Load Agent & User Wallet
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        user: {
          include: {
            wallet: true,
          },
        },
        permissions: true,
      },
    });

    if (!agent || !agent.isActive) {
      throw new ForbiddenError('Agent is not active or does not exist');
    }

    const wallet = agent.user.wallet;
    if (!wallet) {
      throw new BadRequestError('User wallet not initialized');
    }

    // Step 3: Load Authoritative Tool Price & Specs from DB (Invariant 1)
    const tool = await prisma.tool.findUnique({
      where: { id: toolId },
    });

    if (!tool) {
      throw new NotFoundError(`Tool ${toolId} not found`);
    }

    if (tool.status !== 'APPROVED' && !tool.isDemo) {
      throw new ForbiddenError(`Tool ${tool.name} is not available (Status: ${tool.status})`);
    }

    // Step 4: Permission Enforcement
    const specificPermission = agent.permissions.find((p) => p.toolId === toolId);
    const categoryPermission = agent.permissions.find((p) => p.category === tool.category);

    if (specificPermission && !specificPermission.isAllowed) {
      throw new ForbiddenError(`Agent is explicitly forbidden from calling tool '${tool.name}'`);
    }

    if (categoryPermission && !categoryPermission.isAllowed && !specificPermission?.isAllowed) {
      throw new ForbiddenError(`Agent is forbidden from calling tools in category '${tool.category}'`);
    }

    // Step 5: Input JSON Schema Validation
    const schemaValidation = validateJsonSchema(tool.inputSchema, input);
    if (!schemaValidation.valid) {
      throw new BadRequestError(`Input schema validation failed: ${schemaValidation.error}`);
    }

    const priceMicroUsd = tool.priceMicroUsd;
    const feeSetting = await prisma.platformSetting.findUnique({
      where: { key: 'PLATFORM_FEE_BPS' },
    });
    const platformFeeBps = feeSetting ? parseInt(feeSetting.value, 10) : env.PLATFORM_FEE_BPS;
    const platformFeeMicroUsd = (priceMicroUsd * BigInt(platformFeeBps)) / 10000n;
    const creatorEarningsMicroUsd = priceMicroUsd - platformFeeMicroUsd;

    // Step 6: Budget and Limits Verification
    if (priceMicroUsd > agent.maxPerCallMicroUsd) {
      throw new ForbiddenError(
        `Tool price (${priceMicroUsd.toString()} micro-USD) exceeds agent's per-call limit (${agent.maxPerCallMicroUsd.toString()} micro-USD)`
      );
    }

    // Verify daily spend limit
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyCalls = await prisma.toolCall.findMany({
      where: {
        agentId,
        createdAt: { gte: oneDayAgo },
        status: 'SUCCESS',
      },
      select: { priceMicroUsd: true },
    });

    const dailySpent = dailyCalls.reduce((sum, c) => sum + c.priceMicroUsd, 0n);
    if (dailySpent + priceMicroUsd > agent.dailyBudgetMicroUsd) {
      throw new ForbiddenError('Daily budget limit reached for this agent');
    }

    // Step 7: Approval Threshold Check (PRD 7.4)
    const isAutoApprovedTag = tool.tags.some((tag) => agent.autoApproveTags.includes(tag));
    if (priceMicroUsd >= agent.approvalThresholdMicroUsd && !isAutoApprovedTag && !forceApproval) {
      const pendingCallId = uuidv4();
      await prisma.toolCall.create({
        data: {
          id: pendingCallId,
          agentId,
          toolId,
          idempotencyKey,
          priceMicroUsd,
          platformFeeBps,
          platformFeeMicroUsd,
          creatorEarningsMicroUsd,
          status: 'APPROVAL_REQUIRED',
          sanitizedInput: input as object,
          failureReason: 'Cost exceeds agent auto-approval threshold',
        },
      });

      throw new ApprovalRequiredError(
        `Execution requires human approval (Price: ${priceMicroUsd.toString()} micro-USD >= Threshold: ${agent.approvalThresholdMicroUsd.toString()} micro-USD)`,
        pendingCallId,
        priceMicroUsd
      );
    }

    const callId = uuidv4();

    // Step 8: Atomic Fund Reservation (Invariants 3, 5)
    await LedgerService.reserveFunds({
      walletId: wallet.id,
      amountMicroUsd: priceMicroUsd,
      callId,
      agentId,
      toolId,
    });

    // Create ToolCall record in EXECUTING status
    await prisma.toolCall.create({
      data: {
        id: callId,
        agentId,
        toolId,
        idempotencyKey,
        priceMicroUsd,
        platformFeeBps,
        platformFeeMicroUsd,
        creatorEarningsMicroUsd,
        status: 'EXECUTING',
        sanitizedInput: input as object,
      },
    });

    // Step 9: Outbound Sandboxed Execution (Invariant 9)
    const execution = await executeUpstreamTool({
      baseUrl: tool.baseUrl,
      endpointPath: tool.endpointPath,
      httpMethod: tool.httpMethod,
      authMethod: tool.authMethod,
      authHeaderName: tool.authHeaderName,
      encryptedSecret: tool.encryptedSecret,
      payload: input,
      timeoutMs: tool.timeoutMs,
      isDemo: tool.isDemo,
    });

    // Step 10 & 11: Quality Evaluation & Finalization / Reversal (PRD 7.5 & 7.7)
    if (execution.isSuccess) {
      // Capture funds atomically and pay creator
      await LedgerService.captureReservation({
        callId,
        creatorId: tool.creatorId,
        toolId: tool.id,
        priceMicroUsd,
        platformFeeBps,
      });

      await prisma.toolCall.update({
        where: { id: callId },
        data: {
          status: 'SUCCESS',
          sanitizedOutput: execution.body as object,
          httpStatus: execution.statusCode,
          latencyMs: execution.latencyMs,
          completedAt: new Date(),
        },
      });

      return {
        callId,
        status: 'SUCCESS',
        result: execution.body,
        priceMicroUsd: priceMicroUsd.toString(),
        platformFeeMicroUsd: platformFeeMicroUsd.toString(),
        creatorEarningsMicroUsd: creatorEarningsMicroUsd.toString(),
        latencyMs: execution.latencyMs,
      };
    } else {
      // Reversal policy for objective failures (Invariant 11)
      await LedgerService.releaseReservation(
        callId,
        execution.failureReason || 'Upstream execution failed'
      );

      await prisma.toolCall.update({
        where: { id: callId },
        data: {
          status: 'REVERSED',
          isReversed: true,
          sanitizedOutput: execution.body as object,
          httpStatus: execution.statusCode,
          latencyMs: execution.latencyMs,
          failureReason: execution.failureReason,
          completedAt: new Date(),
        },
      });

      return {
        callId,
        status: 'REVERSED',
        priceMicroUsd: priceMicroUsd.toString(),
        platformFeeMicroUsd: '0',
        creatorEarningsMicroUsd: '0',
        latencyMs: execution.latencyMs,
        failureReason: execution.failureReason,
      };
    }
  }
}
