import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../lib/prisma';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import { ExecutionGateway } from '../execution/executionGateway';
import { sendSuccess, sendError } from '../../utils/response';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { formatMicroUsd } from '../../utils/money';

export const agentWorkflowRouter = Router();

const planSchema = z.object({
  task: z.string().min(3, 'Task description is required'),
  agentId: z.string().optional(),
});

const executePlanSchema = z.object({
  steps: z.array(
    z.object({
      toolId: z.string(),
      input: z.unknown(),
    })
  ).min(1, 'At least one step is required'),
  agentId: z.string().optional(),
});

// POST /api/agent/plan (PRD 7.8: Understand task, match tools, rank, compute authoritative cost)
agentWorkflowRouter.post('/plan', optionalAuth, async (req: Request, res: Response, next) => {
  try {
    const parsed = planSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Task description is required', 400, 'VALIDATION_ERROR');
    }

    const { task } = parsed.data;
    const taskLower = task.toLowerCase();

    // Find agent
    let agent = null;
    if (parsed.data.agentId) {
      agent = await prisma.agent.findUnique({
        where: { id: parsed.data.agentId },
        include: { permissions: true },
      });
    } else if (req.user?.userId) {
      agent = await prisma.agent.findFirst({
        where: { userId: req.user.userId, isActive: true },
        include: { permissions: true },
      });
    }

    // Load available tools from DB
    const allTools = await prisma.tool.findMany({
      where: {
        OR: [{ status: 'APPROVED' }, { isDemo: true }],
      },
    });

    const plannedSteps: Array<{
      stepNumber: number;
      toolId: string;
      toolName: string;
      category: string;
      authoritativePriceMicroUsd: string;
      whySelected: string;
      proposedInput: Record<string, unknown>;
    }> = [];

    let totalEstimatedCost = 0n;

    // Deterministic rule-based task matching & tool ranking
    for (const tool of allTools) {
      // Check permissions if agent exists
      if (agent) {
        const forbidden = agent.permissions.some(
          (p) => (!p.isAllowed && p.toolId === tool.id) || (!p.isAllowed && p.category === tool.category)
        );
        if (forbidden) continue;

        // Check per-call limit
        if (tool.priceMicroUsd > agent.maxPerCallMicroUsd) continue;
      }

      let matches = false;
      let reason = '';
      const inputObj: Record<string, unknown> = {};

      if (
        (taskLower.includes('translate') || taskLower.includes('spanish') || taskLower.includes('french') || taskLower.includes('german')) &&
        tool.category.toLowerCase().includes('translation')
      ) {
        matches = true;
        reason = `Matches translation request with target language parsing from '${task}'`;
        let targetLang = 'es';
        if (taskLower.includes('french')) targetLang = 'fr';
        if (taskLower.includes('german')) targetLang = 'de';
        if (taskLower.includes('hindi')) targetLang = 'hi';

        inputObj.text = task.replace(/translate\s+/i, '').replace(/to\s+(spanish|french|german|hindi)/i, '').trim() || 'Hello world';
        inputObj.targetLanguage = targetLang;
      } else if (
        (taskLower.includes('scam') || taskLower.includes('phishing') || taskLower.includes('fraud') || taskLower.includes('risk')) &&
        tool.category.toLowerCase().includes('security')
      ) {
        matches = true;
        reason = `Matches security threat heuristic evaluation requested in task`;
        inputObj.message = task;
      } else if (
        (taskLower.includes('sentiment') || taskLower.includes('feeling') || taskLower.includes('opinion') || taskLower.includes('review')) &&
        tool.category.toLowerCase().includes('nlp')
      ) {
        matches = true;
        reason = `Matches sentiment analysis requested in task`;
        inputObj.text = task;
      } else if (
        tool.tags.some((t) => taskLower.includes(t.toLowerCase())) ||
        taskLower.includes(tool.name.toLowerCase())
      ) {
        matches = true;
        reason = `Matched keyword tags: ${tool.tags.join(', ')}`;
        inputObj.text = task;
      }

      if (matches) {
        plannedSteps.push({
          stepNumber: plannedSteps.length + 1,
          toolId: tool.id,
          toolName: tool.name,
          category: tool.category,
          authoritativePriceMicroUsd: tool.priceMicroUsd.toString(),
          whySelected: reason,
          proposedInput: inputObj,
        });

        totalEstimatedCost += tool.priceMicroUsd;
      }
    }

    // If no specific keyword matched, recommend the top demo tool
    if (plannedSteps.length === 0 && allTools.length > 0) {
      const fallback = allTools[0];
      plannedSteps.push({
        stepNumber: 1,
        toolId: fallback.id,
        toolName: fallback.name,
        category: fallback.category,
        authoritativePriceMicroUsd: fallback.priceMicroUsd.toString(),
        whySelected: 'Default matched capability for generic text analysis',
        proposedInput: { text: task, message: task },
      });
      totalEstimatedCost += fallback.priceMicroUsd;
    }

    const requiresApproval = agent ? totalEstimatedCost >= agent.approvalThresholdMicroUsd : false;

    return sendSuccess(res, {
      task,
      plannerMode: 'deterministic_rule_ranker',
      totalEstimatedCostMicroUsd: totalEstimatedCost.toString(),
      formattedEstimatedCost: formatMicroUsd(totalEstimatedCost),
      requiresHumanApproval: requiresApproval,
      approvalThresholdMicroUsd: agent?.approvalThresholdMicroUsd.toString() || '5000000',
      stepsCount: plannedSteps.length,
      steps: plannedSteps,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/agent/execute (Execute multi-step workflow with output chaining)
agentWorkflowRouter.post('/execute', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const parsed = executePlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Valid plan steps required', 400, 'VALIDATION_ERROR', parsed.error.format());
    }

    let agentId = parsed.data.agentId;
    if (!agentId) {
      const agent = await prisma.agent.findFirst({
        where: { userId: req.user!.userId, isActive: true },
      });
      if (!agent) {
        throw new BadRequestError('No active agent found for user. Please create an agent first.');
      }
      agentId = agent.id;
    }

    const executionResults: Array<{
      stepNumber: number;
      toolId: string;
      status: string;
      result?: unknown;
      priceMicroUsd: string;
      latencyMs?: number;
      failureReason?: string;
    }> = [];

    let totalChargedMicroUsd = 0n;
    let previousOutput: unknown = null;

    for (let i = 0; i < parsed.data.steps.length; i++) {
      const step = parsed.data.steps[i];
      let stepInput = step.input;

      // Output chaining: If input is an object with $prevOutput, inject previous step result
      if (
        previousOutput &&
        typeof stepInput === 'object' &&
        stepInput !== null &&
        '$prevOutput' in (stepInput as Record<string, unknown>)
      ) {
        stepInput = {
          ...(stepInput as Record<string, unknown>),
          text: typeof previousOutput === 'string' ? previousOutput : JSON.stringify(previousOutput),
        };
      }

      const idempotencyKey = `plan_${uuidv4()}`;

      const res = await ExecutionGateway.execute({
        agentId,
        toolId: step.toolId,
        idempotencyKey,
        input: stepInput,
      });

      executionResults.push({
        stepNumber: i + 1,
        toolId: step.toolId,
        status: res.status,
        result: res.result,
        priceMicroUsd: res.priceMicroUsd,
        latencyMs: res.latencyMs,
        failureReason: res.failureReason,
      });

      if (res.status === 'SUCCESS') {
        totalChargedMicroUsd += BigInt(res.priceMicroUsd);
        previousOutput = res.result;
      } else {
        // Abort pipeline on failure
        break;
      }
    }

    return sendSuccess(res, {
      status: executionResults.every((r) => r.status === 'SUCCESS') ? 'COMPLETED' : 'PARTIAL_OR_FAILED',
      totalChargedMicroUsd: totalChargedMicroUsd.toString(),
      formattedTotalCharged: formatMicroUsd(totalChargedMicroUsd),
      stepsCompleted: executionResults.length,
      stepResults: executionResults,
      finalOutput: previousOutput,
    });
  } catch (error) {
    next(error);
  }
});
