import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { BadRequestError } from '../../utils/errors';
import { dollarsToMicroUsd } from '../../utils/money';

export const creatorRouter = Router();

const payoutSchema = z.object({
  amountUsd: z.string().or(z.number()),
  destination: z.string().min(3, 'Destination PayPal email or account required'),
});

// GET /api/creator/earnings
creatorRouter.get('/earnings', requireAuth, requireRole('creator'), async (req: Request, res: Response, next) => {
  try {
    const creatorId = req.user!.userId;

    const earnings = await prisma.creatorEarning.findMany({
      where: { creatorId },
      include: {
        toolCall: {
          select: {
            id: true,
            createdAt: true,
            latencyMs: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    let totalGross = 0n;
    let totalPlatformFee = 0n;
    let totalNet = 0n;
    let payableBalance = 0n;

    for (const e of earnings) {
      totalGross += e.grossMicroUsd;
      totalPlatformFee += e.platformFeeMicroUsd;
      totalNet += e.netMicroUsd;
      if (e.status === 'PAYABLE') {
        payableBalance += e.netMicroUsd;
      }
    }

    const completedPayouts = await prisma.payoutRequest.findMany({
      where: { creatorId, status: 'COMPLETED' },
    });
    const totalWithdrawn = completedPayouts.reduce((acc, p) => acc + p.amountMicroUsd, 0n);

    const formattedEarnings = earnings.map((e) => ({
      ...e,
      grossMicroUsd: e.grossMicroUsd.toString(),
      platformFeeMicroUsd: e.platformFeeMicroUsd.toString(),
      netMicroUsd: e.netMicroUsd.toString(),
    }));

    return sendSuccess(res, {
      summary: {
        totalGrossMicroUsd: totalGross.toString(),
        totalPlatformFeeMicroUsd: totalPlatformFee.toString(),
        totalNetMicroUsd: totalNet.toString(),
        payableBalanceMicroUsd: payableBalance.toString(),
        totalWithdrawnMicroUsd: totalWithdrawn.toString(),
        totalPaidCalls: earnings.length,
      },
      earnings: formattedEarnings,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/creator/payouts
creatorRouter.post('/payouts', requireAuth, requireRole('creator'), async (req: Request, res: Response, next) => {
  try {
    const parsed = payoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Invalid payout request', 400, 'VALIDATION_ERROR', parsed.error.format());
    }

    const creatorId = req.user!.userId;
    const requestedMicroUsd = dollarsToMicroUsd(parsed.data.amountUsd);

    // Calculate current payable balance
    const payableItems = await prisma.creatorEarning.findMany({
      where: { creatorId, status: 'PAYABLE' },
    });

    const payableBalance = payableItems.reduce((acc, item) => acc + item.netMicroUsd, 0n);

    if (payableBalance < requestedMicroUsd) {
      throw new BadRequestError(
        `Insufficient payable earnings. Available: ${payableBalance.toString()} micro-USD, Requested: ${requestedMicroUsd.toString()} micro-USD`
      );
    }

    // Invariant 11: Non-goals for MVP: Real PayPal payouts use mock adapter labeled simulated
    const payout = await prisma.payoutRequest.create({
      data: {
        creatorId,
        amountMicroUsd: requestedMicroUsd,
        status: 'COMPLETED',
        payoutMethod: 'PAYPAL',
        destination: parsed.data.destination,
        externalBatchId: `mock_payout_batch_${Date.now()}`,
        isSimulated: true, // Clearly labeled simulated
      },
    });

    // Mark corresponding earnings as PAID_OUT
    let remainingToMark = requestedMicroUsd;
    for (const item of payableItems) {
      if (remainingToMark <= 0n) break;
      await prisma.creatorEarning.update({
        where: { id: item.id },
        data: { status: 'PAID_OUT' },
      });
      remainingToMark -= item.netMicroUsd;
    }

    return sendSuccess(res, {
      payoutId: payout.id,
      amountMicroUsd: payout.amountMicroUsd.toString(),
      status: payout.status,
      destination: payout.destination,
      isSimulated: true,
      message: 'Payout processed successfully (simulated mock adapter)',
    });
  } catch (error) {
    next(error);
  }
});
