import { Request, Response, Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { NotFoundError, BadRequestError } from '../../utils/errors';

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

    if (tool.status !== 'PENDING_REVIEW' && tool.status !== 'SUSPENDED') {
      throw new BadRequestError('Only pending review or suspended tools can be approved');
    }

    const updated = await prisma.tool.update({
      where: { id: tool.id },
      data: { status: 'APPROVED' },
    });

    const reason = req.body.reason || 'Meets platform standards and passed verification test call';

    await prisma.adminReview.create({
      data: {
        toolId: tool.id,
        adminId: req.user!.userId,
        decision: 'APPROVED',
        reason,
      },
    });

    // PRD 7.10: Audit trail for moderation actions
    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'TOOL_APPROVED',
        resourceType: 'TOOL',
        resourceId: tool.id,
        metadata: { toolName: tool.name, reason },
        ipAddress: req.ip,
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
    const tool = await prisma.tool.findUnique({
      where: { id: req.params.id },
    });

    if (!tool) {
      throw new NotFoundError('Tool not found');
    }

    const reason = req.body.reason || 'Does not meet platform requirements';

    const updated = await prisma.tool.update({
      where: { id: tool.id },
      data: { status: 'REJECTED' },
    });

    await prisma.adminReview.create({
      data: {
        toolId: tool.id,
        adminId: req.user!.userId,
        decision: 'REJECTED',
        reason,
      },
    });

    // PRD 7.10: Audit trail for moderation actions
    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'TOOL_REJECTED',
        resourceType: 'TOOL',
        resourceId: tool.id,
        metadata: { toolName: tool.name, reason },
        ipAddress: req.ip,
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
    const tool = await prisma.tool.findUnique({
      where: { id: req.params.id },
    });

    if (!tool) {
      throw new NotFoundError('Tool not found');
    }

    const reason = req.body.reason || 'Suspended by platform administrator';

    const updated = await prisma.tool.update({
      where: { id: tool.id },
      data: { status: 'SUSPENDED' },
    });

    await prisma.adminReview.create({
      data: {
        toolId: tool.id,
        adminId: req.user!.userId,
        decision: 'SUSPENDED',
        reason,
      },
    });

    // PRD 7.10: Audit trail for moderation actions
    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'TOOL_SUSPENDED',
        resourceType: 'TOOL',
        resourceId: tool.id,
        metadata: { toolName: tool.name, reason },
        ipAddress: req.ip,
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
    const [topups, seedEntries] = await Promise.all([
      prisma.topup.findMany({
        where: { status: 'COMPLETED' },
        select: { amountMicroUsd: true },
      }),
      prisma.ledgerEntry.findMany({
        where: { referenceType: 'SEED', entryType: 'CREDIT' },
        select: { amount: true },
      }),
    ]);

    const totalExternalDeposits = topups.reduce((acc, t) => acc + t.amountMicroUsd, 0n);
    const totalSeedCredits = seedEntries.reduce((acc, s) => acc + s.amount, 0n);
    const totalDeposited = totalExternalDeposits + totalSeedCredits;

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

// PUT /api/admin/commission (PRD 7.10: Platform commission setting)
adminRouter.put('/commission', async (req: Request, res: Response, next) => {
  try {
    const { platformFeeBps } = req.body;
    const bps = parseInt(String(platformFeeBps), 10);
    if (isNaN(bps) || bps < 0 || bps > 5000) {
      return sendError(res, 'platformFeeBps must be an integer between 0 and 5000 (0% - 50%)', 400);
    }

    await prisma.platformSetting.upsert({
      where: { key: 'PLATFORM_FEE_BPS' },
      update: { value: String(bps) },
      create: { key: 'PLATFORM_FEE_BPS', value: String(bps), description: 'Platform fee basis points' },
    });

    // PRD 7.10: Audit trail for configuration change
    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'COMMISSION_UPDATED',
        resourceType: 'PLATFORM_SETTING',
        resourceId: 'PLATFORM_FEE_BPS',
        metadata: { platformFeeBps: bps },
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, { platformFeeBps: bps, message: 'Platform commission updated' });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/abuse-reports
adminRouter.get('/abuse-reports', async (req: Request, res: Response, next) => {
  try {
    const { status } = req.query;
    const where: Record<string, unknown> = {};
    if (status) {
      where.status = String(status);
    }

    const reports = await prisma.abuseReport.findMany({
      where,
      include: {
        tool: { select: { name: true, slug: true, creatorId: true } },
        reporter: { select: { email: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return sendSuccess(res, reports);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/abuse-reports/:id/resolve
adminRouter.post('/abuse-reports/:id/resolve', async (req: Request, res: Response, next) => {
  try {
    const report = await prisma.abuseReport.findUnique({
      where: { id: req.params.id },
    });

    if (!report) {
      throw new NotFoundError('Abuse report not found');
    }

    const { status = 'RESOLVED' } = req.body;
    const updated = await prisma.abuseReport.update({
      where: { id: report.id },
      data: { status },
    });

    // PRD 7.10: Audit trail for abuse report resolution
    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'ABUSE_REPORT_RESOLVED',
        resourceType: 'ABUSE_REPORT',
        resourceId: report.id,
        metadata: { toolId: report.toolId, status },
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, updated);
  } catch (error) {
    next(error);
  }
});


