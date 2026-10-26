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
