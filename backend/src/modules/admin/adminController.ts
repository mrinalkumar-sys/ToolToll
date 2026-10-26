import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { NotFoundError } from '../../utils/errors';

export const adminRouter = Router();

// Enforce admin role on all admin routes
adminRouter.use(requireAuth, requireRole('admin'));

// GET /api/admin/tools/pending
adminRouter.get('/tools/pending', async (_req: Request, res: Response, next) => {
  try {
    const pendingTools = await prisma.tool.findMany({
      where: { status: 'PENDING_REVIEW' },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        testRuns: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
      orderBy: { createdAt: 'asc' },
    });

    const safeTools = pendingTools.map((t) => {
      const { encryptedSecret, secretKeyVersion, ...safe } = t;
      return {
        ...safe,
        priceMicroUsd: safe.priceMicroUsd.toString(),
      };
    });

    return sendSuccess(res, safeTools);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/tools/:id/approve
adminRouter.post('/tools/:id/approve', async (req: Request, res: Response, next) => {
  try {
    const tool = await prisma.tool.findUnique({
      where: { id: req.params.id },
    });

    if (!tool) {
      throw new NotFoundError('Tool not found');
    }

    const updated = await prisma.tool.update({
      where: { id: tool.id },
      data: { status: 'APPROVED' },
    });

    await prisma.adminReview.create({
      data: {
        toolId: tool.id,
        adminId: req.user!.userId,
        decision: 'APPROVED',
        reason: req.body.reason || 'Meets platform standards and passed verification test call',
      },
    });

    return sendSuccess(res, { id: updated.id, name: updated.name, status: updated.status });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/tools/:id/reject
adminRouter.post('/tools/:id/reject', async (req: Request, res: Response, next) => {
  try {
    const reason = req.body.reason || 'Does not meet platform requirements';

    const updated = await prisma.tool.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED' },
    });

    await prisma.adminReview.create({
      data: {
        toolId: req.params.id,
        adminId: req.user!.userId,
        decision: 'REJECTED',
        reason,
      },
    });

    return sendSuccess(res, { id: updated.id, status: updated.status, reason });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/tools/:id/suspend
adminRouter.post('/tools/:id/suspend', async (req: Request, res: Response, next) => {
  try {
    const reason = req.body.reason || 'Suspended by platform administrator';

    const updated = await prisma.tool.update({
      where: { id: req.params.id },
      data: { status: 'SUSPENDED' },
    });

    await prisma.adminReview.create({
      data: {
        toolId: req.params.id,
        adminId: req.user!.userId,
        decision: 'SUSPENDED',
        reason,
      },
    });

    return sendSuccess(res, { id: updated.id, status: updated.status, reason });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/stats
adminRouter.get('/stats', async (_req: Request, res: Response, next) => {
  try {
    const [totalUsers, totalTools, totalCalls, totalWallets] = await Promise.all([
      prisma.user.count(),
      prisma.tool.count(),
      prisma.toolCall.count(),
      prisma.wallet.findMany({ select: { balance: true, reservedBalance: true } }),
    ]);

    const calls = await prisma.toolCall.findMany({
      where: { status: 'SUCCESS' },
      select: { priceMicroUsd: true, platformFeeMicroUsd: true },
    });

    const totalGrossMicroUsd = calls.reduce((acc, c) => acc + c.priceMicroUsd, 0n);
    const totalPlatformRevenueMicroUsd = calls.reduce((acc, c) => acc + c.platformFeeMicroUsd, 0n);

    const totalConsumerBalanceMicroUsd = totalWallets.reduce((acc, w) => acc + w.balance, 0n);
    const totalReservedMicroUsd = totalWallets.reduce((acc, w) => acc + w.reservedBalance, 0n);

    return sendSuccess(res, {
      totalUsers,
      totalTools,
      totalCalls,
      totalGrossMicroUsd: totalGrossMicroUsd.toString(),
      totalPlatformRevenueMicroUsd: totalPlatformRevenueMicroUsd.toString(),
      totalConsumerBalanceMicroUsd: totalConsumerBalanceMicroUsd.toString(),
      totalReservedMicroUsd: totalReservedMicroUsd.toString(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/reconciliation (Financial reconciliation report - PRD 7.10)
adminRouter.get('/reconciliation', async (_req: Request, res: Response, next) => {
  try {
    const topups = await prisma.topup.findMany({
      where: { status: 'COMPLETED' },
      select: { amountMicroUsd: true },
    });
    const totalDeposited = topups.reduce((acc, t) => acc + t.amountMicroUsd, 0n);

    const wallets = await prisma.wallet.findMany({
      select: { balance: true, reservedBalance: true },
    });
    const totalWalletBalances = wallets.reduce((acc, w) => acc + w.balance, 0n);
    const totalReserved = wallets.reduce((acc, w) => acc + w.reservedBalance, 0n);

    const earnings = await prisma.creatorEarning.findMany({
      select: { netMicroUsd: true, status: true },
    });
    const creatorPayable = earnings
      .filter((e) => e.status === 'PAYABLE')
      .reduce((acc, e) => acc + e.netMicroUsd, 0n);
    const creatorPaidOut = earnings
      .filter((e) => e.status === 'PAID_OUT')
      .reduce((acc, e) => acc + e.netMicroUsd, 0n);

    const platformEntries = await prisma.ledgerEntry.findMany({
      where: { account: 'PLATFORM_REVENUE', entryType: 'CREDIT' },
      select: { amount: true },
    });
    const platformRevenue = platformEntries.reduce((acc, e) => acc + e.amount, 0n);

    const totalSystemLiabilities = totalWalletBalances + totalReserved + creatorPayable + platformRevenue + creatorPaidOut;
    const isBalanced = totalDeposited === totalSystemLiabilities;

    return sendSuccess(res, {
      totalExternalDepositsMicroUsd: totalDeposited.toString(),
      totalWalletBalancesMicroUsd: totalWalletBalances.toString(),
      totalReservedMicroUsd: totalReserved.toString(),
      creatorPayableMicroUsd: creatorPayable.toString(),
      creatorPaidOutMicroUsd: creatorPaidOut.toString(),
      platformRevenueMicroUsd: platformRevenue.toString(),
      totalSystemLiabilitiesMicroUsd: totalSystemLiabilities.toString(),
      isBalanced,
      status: isBalanced ? 'RECONCILED' : 'DISCREPANCY_DETECTED',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/audit-logs
adminRouter.get('/audit-logs', async (_req: Request, res: Response, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { email: true, name: true } } },
    });

    return sendSuccess(res, logs);
  } catch (error) {
    next(error);
  }
});
