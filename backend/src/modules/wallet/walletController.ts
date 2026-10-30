import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { LedgerService } from '../ledger/ledgerService';
import { sendSuccess, sendError } from '../../utils/response';
import { NotFoundError } from '../../utils/errors';
import { dollarsToMicroUsd } from '../../utils/money';

export const walletRouter = Router();

const topupSchema = z.object({
  amountUsd: z.string().or(z.number()),
});

// GET /api/wallet
walletRouter.get('/', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    return sendSuccess(res, {
      id: wallet.id,
      balanceMicroUsd: wallet.balance.toString(),
      reservedBalanceMicroUsd: wallet.reservedBalance.toString(),
      currency: wallet.currency,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/wallet/transactions
walletRouter.get('/transactions', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    const transactions = await prisma.ledgerEntry.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const formatted = transactions.map((t) => ({
      ...t,
      amount: t.amount.toString(),
      balanceAfter: t.balanceAfter ? t.balanceAfter.toString() : null,
    }));

    return sendSuccess(res, formatted);
  } catch (error) {
    next(error);
  }
});

// POST /api/wallet/topups (Simulated Dev / Test Top-up)
walletRouter.post('/topups', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const parsed = topupSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'amountUsd is required', 400, 'VALIDATION_ERROR');
    }

    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    const amountMicroUsd = dollarsToMicroUsd(parsed.data.amountUsd);
    const mockReference = `mock_topup_${Date.now()}`;

    const topup = await LedgerService.creditTopup({
      walletId: wallet.id,
      amountMicroUsd,
      provider: 'MOCK',
      referenceId: mockReference,
    });

    const updatedWallet = await prisma.wallet.findUnique({
      where: { id: wallet.id },
    });

    return sendSuccess(res, {
      topupId: topup.id,
      amountMicroUsd: topup.amountMicroUsd.toString(),
      provider: 'MOCK',
      status: topup.status,
      newBalanceMicroUsd: updatedWallet?.balance.toString(),
      message: 'Wallet funded successfully (dev simulated top-up)',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/calls (Consumer usage history)
walletRouter.get('/calls', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const userAgents = await prisma.agent.findMany({
      where: { userId: req.user!.userId },
      select: { id: true },
    });

    const agentIds = userAgents.map((a) => a.id);

    const calls = await prisma.toolCall.findMany({
      where: { agentId: { in: agentIds } },
      include: {
        tool: { select: { name: true, category: true, slug: true } },
        agent: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const formatted = calls.map((c) => ({
      ...c,
      priceMicroUsd: c.priceMicroUsd.toString(),
      platformFeeMicroUsd: c.platformFeeMicroUsd.toString(),
      creatorEarningsMicroUsd: c.creatorEarningsMicroUsd.toString(),
    }));

    return sendSuccess(res, formatted);
  } catch (error) {
    next(error);
  }
});

// GET /api/calls/:callId
walletRouter.get('/calls/:callId', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const call = await prisma.toolCall.findUnique({
      where: { id: req.params.callId },
      include: {
        tool: { select: { name: true, category: true, slug: true } },
        agent: { select: { name: true, userId: true } },
      },
    });

    if (!call || call.agent.userId !== req.user!.userId) {
      throw new NotFoundError('Tool call not found');
    }

    return sendSuccess(res, {
      ...call,
      priceMicroUsd: call.priceMicroUsd.toString(),
      platformFeeMicroUsd: call.platformFeeMicroUsd.toString(),
      creatorEarningsMicroUsd: call.creatorEarningsMicroUsd.toString(),
    });
  } catch (error) {
    next(error);
  }
});


// Helper function for determining refund eligibility based on execution and platform policy
export function evaluateCallRefundEligibility(call: {
  id: string;
  priceMicroUsd: bigint;
  status: string;
  isReversed: boolean;
  httpStatus?: number | null;
  latencyMs?: number | null;
  failureReason?: string | null;
  sanitizedOutput?: any;
  tool: {
    name: string;
    timeoutMs?: number | null;
    outputSchema?: any;
  };
}): {
  isEligible: boolean;
  status: 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'REFUNDED' | 'PENDING_REVIEW';
  reason: string;
  refundableAmountMicroUsd: string;
} {
  // 1. If already refunded
  if (call.isReversed || call.status === 'REVERSED') {
    return {
      isEligible: false,
      status: 'REFUNDED',
      reason: 'This execution has already been refunded.',
      refundableAmountMicroUsd: '0',
    };
  }

  // 2. If not charged
  if (call.priceMicroUsd <= 0n) {
    return {
      isEligible: false,
      status: 'NOT_ELIGIBLE',
      reason: 'Execution was not charged (price was 0 micro-USD).',
      refundableAmountMicroUsd: '0',
    };
  }

  // 3. Condition: HTTP 5xx Upstream Server Error
  if (call.httpStatus && call.httpStatus >= 500) {
    return {
      isEligible: true,
      status: 'ELIGIBLE',
      reason: `Upstream tool server error (HTTP ${call.httpStatus}).`,
      refundableAmountMicroUsd: call.priceMicroUsd.toString(),
    };
  }

  // 4. Condition: Execution failed to complete
  if (call.status === 'FAILED') {
    return {
      isEligible: true,
      status: 'ELIGIBLE',
      reason: call.failureReason || 'Tool invocation failed during execution.',
      refundableAmountMicroUsd: call.priceMicroUsd.toString(),
    };
  }

  // 5. Condition: Latency SLA Breach
  const slaLimit = call.tool.timeoutMs || 5000;
  if (call.latencyMs && call.latencyMs > slaLimit) {
    return {
      isEligible: true,
      status: 'ELIGIBLE',
      reason: `Response latency (${call.latencyMs}ms) breached contract SLA threshold (${slaLimit}ms).`,
      refundableAmountMicroUsd: call.priceMicroUsd.toString(),
    };
  }

  // 6. Condition: Schema Mismatch / Missing Required Fields
  if (call.tool.outputSchema && typeof call.tool.outputSchema === 'object') {
    const schema = call.tool.outputSchema as any;
    const output = call.sanitizedOutput;
    if (output === null || output === undefined) {
      return {
        isEligible: true,
        status: 'ELIGIBLE',
        reason: 'Tool execution returned empty or null payload.',
        refundableAmountMicroUsd: call.priceMicroUsd.toString(),
      };
    }
    if (Array.isArray(schema.required) && typeof output === 'object') {
      for (const requiredKey of schema.required) {
        if (!(requiredKey in output)) {
          return {
            isEligible: true,
            status: 'ELIGIBLE',
            reason: `Output schema contract breached: missing required property '${requiredKey}'.`,
            refundableAmountMicroUsd: call.priceMicroUsd.toString(),
          };
        }
      }
    }
  }

  // 7. Successful execution meeting SLA & contract requirements
  return {
    isEligible: false,
    status: 'NOT_ELIGIBLE',
    reason: 'Execution completed successfully within SLA limits and satisfied contract schema.',
    refundableAmountMicroUsd: '0',
  };
}

// GET /api/wallet/calls/:callId/refund-eligibility (Check if a tool call qualifies for refund)
walletRouter.get('/calls/:callId/refund-eligibility', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const call = await prisma.toolCall.findUnique({
      where: { id: req.params.callId },
      include: {
        tool: { select: { name: true, category: true, slug: true, timeoutMs: true, outputSchema: true } },
        agent: { select: { name: true, userId: true } },
      },
    });

    if (!call || (call.agent.userId !== req.user!.userId && !req.user!.isAdmin)) {
      throw new NotFoundError('Tool call not found');
    }

    const eligibility = evaluateCallRefundEligibility(call);

    return sendSuccess(res, {
      callId: call.id,
      toolName: call.tool.name,
      originalChargeMicroUsd: call.priceMicroUsd.toString(),
      refundableAmountMicroUsd: eligibility.refundableAmountMicroUsd,
      isEligible: eligibility.isEligible,
      status: eligibility.status,
      reason: eligibility.reason,
      alreadyRefunded: call.isReversed || call.status === 'REVERSED',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/wallet/calls/:callId/refund (Process refund for an eligible tool call)
walletRouter.post('/calls/:callId/refund', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const callId = req.params.callId;
    const call = await prisma.toolCall.findUnique({
      where: { id: callId },
      include: {
        tool: { select: { name: true, category: true, slug: true, timeoutMs: true, outputSchema: true } },
        agent: { select: { name: true, userId: true } },
      },
    });

    if (!call || (call.agent.userId !== req.user!.userId && !req.user!.isAdmin)) {
      throw new NotFoundError('Tool call not found');
    }

    // Verify refund eligibility
    const eligibility = evaluateCallRefundEligibility(call);

    // If already refunded, return idempotent status
    if (eligibility.status === 'REFUNDED') {
      const wallet = await prisma.wallet.findUnique({ where: { userId: call.agent.userId } });
      return sendSuccess(res, {
        callId: call.id,
        status: 'REFUNDED',
        alreadyRefunded: true,
        refundedAmountMicroUsd: call.priceMicroUsd.toString(),
        newBalanceMicroUsd: (wallet?.balance ?? 0n).toString(),
        message: 'This execution has already been refunded.',
      });
    }

    // If ineligible and not admin override
    if (!eligibility.isEligible && !req.user!.isAdmin) {
      return sendError(res, `Execution is not eligible for refund: ${eligibility.reason}`, 400, 'INELIGIBLE_FOR_REFUND');
    }

    const reason = req.body.reason || eligibility.reason;
    const result = await LedgerService.processCallRefund({
      callId,
      userId: req.user!.userId,
      reason,
      isAdmin: req.user!.isAdmin,
    });

    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

// POST /api/wallet/refund (Direct alias accepting { callId, reason })
walletRouter.post('/refund', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const { callId, reason } = req.body;
    if (!callId || typeof callId !== 'string') {
      return sendError(res, 'callId is required', 400, 'VALIDATION_ERROR');
    }

    const call = await prisma.toolCall.findUnique({
      where: { id: callId },
      include: {
        tool: { select: { name: true, category: true, slug: true, timeoutMs: true, outputSchema: true } },
        agent: { select: { name: true, userId: true } },
      },
    });

    if (!call || (call.agent.userId !== req.user!.userId && !req.user!.isAdmin)) {
      throw new NotFoundError('Tool call not found');
    }

    const eligibility = evaluateCallRefundEligibility(call);

    if (eligibility.status === 'REFUNDED') {
      const wallet = await prisma.wallet.findUnique({ where: { userId: call.agent.userId } });
      return sendSuccess(res, {
        callId: call.id,
        status: 'REFUNDED',
        alreadyRefunded: true,
        refundedAmountMicroUsd: call.priceMicroUsd.toString(),
        newBalanceMicroUsd: (wallet?.balance ?? 0n).toString(),
        message: 'This execution has already been refunded.',
      });
    }

    if (!eligibility.isEligible && !req.user!.isAdmin) {
      return sendError(res, `Execution is not eligible for refund: ${eligibility.reason}`, 400, 'INELIGIBLE_FOR_REFUND');
    }

    const refundReason = reason || eligibility.reason;
    const result = await LedgerService.processCallRefund({
      callId,
      userId: req.user!.userId,
      reason: refundReason,
      isAdmin: req.user!.isAdmin,
    });

    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

// GET /api/wallet/refunds (Retrieve refund history for consumer)
walletRouter.get('/refunds', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    const refunds = await prisma.ledgerEntry.findMany({
      where: {
        walletId: wallet.id,
        referenceType: 'REFUND',
        account: 'USER_WALLET',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const formatted = refunds.map((r) => ({
      id: r.id,
      callId: r.callId,
      amountMicroUsd: r.amount.toString(),
      balanceAfterMicroUsd: r.balanceAfter?.toString() || null,
      description: r.description,
      createdAt: r.createdAt.toISOString(),
    }));

    return sendSuccess(res, formatted);
  } catch (error) {
    next(error);
  }
});
