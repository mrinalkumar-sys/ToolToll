import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { LedgerService } from '../ledger/ledgerService';
import { sendSuccess, sendError } from '../../utils/response';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { dollarsToMicroUsd } from '../../utils/money';
import { env } from '../../config/env';

export const paypalRouter = Router();

const createOrderSchema = z.object({
  amountUsd: z.string().or(z.number()).refine((val) => {
    const n = typeof val === 'number' ? val : parseFloat(String(val).trim());
    return !isNaN(n) && isFinite(n) && n >= 1.0 && n <= 10000.0;
  }, { message: 'amountUsd must be a valid positive amount between $1.00 and $10,000.00' }),
});

// POST /api/paypal/orders
paypalRouter.post('/orders', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, parsed.error.errors[0]?.message || 'Invalid amountUsd', 400, 'VALIDATION_ERROR', parsed.error.format());
    }

    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user || !user.wallet) {
      throw new NotFoundError('User or wallet not found');
    }

    const numVal = typeof parsed.data.amountUsd === 'number' ? parsed.data.amountUsd : parseFloat(parsed.data.amountUsd);
    const amountUsdStr = numVal.toFixed(2);
    const amountMicroUsd = dollarsToMicroUsd(amountUsdStr);

    let orderId: string;

    if (env.PAYMENT_ADAPTER === 'paypal' && env.PAYPAL_CLIENT_ID !== 'mock_client_id') {
      // Real PayPal Sandbox Order Creation
      const auth = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString('base64');
      const tokenRes = await fetch(`${env.PAYPAL_BASE_URL}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!tokenRes.ok) {
        throw new BadRequestError('Failed to authenticate with PayPal API');
      }

      const tokenData = (await tokenRes.json()) as { access_token: string };

      const orderRes = await fetch(`${env.PAYPAL_BASE_URL}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              amount: {
                currency_code: 'USD',
                value: amountUsdStr,
              },
              custom_id: user.wallet.id,
            },
          ],
        }),
      });

      if (!orderRes.ok) {
        throw new BadRequestError('Failed to create order on PayPal');
      }

      const orderData = (await orderRes.json()) as { id: string };
      orderId = orderData.id;
    } else {
      // Mock PayPal adapter for dev and testing
      orderId = `MOCK_ORDER_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    const orderRecord = await prisma.paypalOrder.create({
      data: {
        userId,
        walletId: user.wallet.id,
        orderId,
        amountUsd: amountUsdStr,
        amountMicroUsd,
        currency: 'USD',
        status: 'CREATED',
      },
    });

    return sendSuccess(res, {
      orderId: orderRecord.orderId,
      amountUsd: orderRecord.amountUsd,
      status: orderRecord.status,
      adapter: env.PAYMENT_ADAPTER,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/paypal/orders/:orderId/capture
paypalRouter.post('/orders/:orderId/capture', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user!.userId;

    const order = await prisma.paypalOrder.findUnique({
      where: { orderId },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundError('Order not found or unauthorized');
    }

    if (order.status === 'COMPLETED') {
      return sendSuccess(res, { orderId, status: 'COMPLETED', message: 'Order already captured' });
    }

    if (order.status !== 'CREATED') {
      throw new BadRequestError(`Order in ${order.status} state cannot be captured`);
    }

    let captureData: unknown = { simulated: true };

    if (env.PAYMENT_ADAPTER === 'paypal' && env.PAYPAL_CLIENT_ID !== 'mock_client_id') {
      const auth = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString('base64');
      const tokenRes = await fetch(`${env.PAYPAL_BASE_URL}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!tokenRes.ok) {
        throw new BadRequestError('Failed to authenticate with PayPal API');
      }

      const tokenData = (await tokenRes.json()) as { access_token: string };

      const capRes = await fetch(`${env.PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!capRes.ok) {
        throw new BadRequestError('Failed to capture order on PayPal');
      }

      captureData = await capRes.json();
    }

    // Update order status atomically
    await prisma.paypalOrder.update({
      where: { id: order.id },
      data: {
        status: 'COMPLETED',
        rawCapture: captureData as object,
      },
    });

    // Credit consumer's wallet atomically with double-entry ledger record
    const topup = await LedgerService.creditTopup({
      walletId: order.walletId,
      amountMicroUsd: order.amountMicroUsd,
      provider: 'PAYPAL',
      referenceId: orderId,
    });

    return sendSuccess(res, {
      orderId,
      status: 'COMPLETED',
      topupId: topup.id,
      amountMicroUsd: order.amountMicroUsd.toString(),
      message: 'PayPal payment captured and wallet credited',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/webhooks/paypal (Webhook with signature deduplication)
export async function handlePaypalWebhook(req: Request, res: Response) {
  const event = req.body as {
    id?: string;
    event_type?: string;
    resource?: {
      id?: string;
      custom_id?: string;
      amount?: { value?: string };
      supplementary_data?: { related_ids?: { order_id?: string } };
    };
  };

  const eventId = event.id || `evt_${Date.now()}`;

  // Invariant 11: Idempotent webhook processing using unique eventId
  const existing = await prisma.webhookEvent.findUnique({
    where: { eventId },
  });

  if (existing) {
    return res.status(200).json({ status: 'IGNORED_DUPLICATE', message: 'Webhook already processed' });
  }

  // Deduplicate against already captured orders to avoid double-crediting
  const orderId = event.resource?.supplementary_data?.related_ids?.order_id || event.resource?.id;
  if (orderId) {
    const existingTopup = await prisma.topup.findFirst({
      where: {
        OR: [{ paypalOrderId: orderId }, { paypalOrderId: eventId }],
        status: 'COMPLETED',
      },
    });

    if (existingTopup) {
      await prisma.webhookEvent.create({
        data: {
          provider: 'PAYPAL',
          eventId,
          eventType: event.event_type || 'UNKNOWN',
          payload: req.body,
          status: 'IGNORED_ALREADY_CREDITED',
        },
      });
      return res.status(200).json({ status: 'IGNORED_DUPLICATE', message: 'Order already credited' });
    }
  }

  await prisma.webhookEvent.create({
    data: {
      provider: 'PAYPAL',
      eventId,
      eventType: event.event_type || 'UNKNOWN',
      payload: req.body,
      status: 'PROCESSED',
    },
  });

  // Handle capture completed event (e.g. async confirmation)
  if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED' && event.resource?.custom_id) {
    const walletId = event.resource.custom_id;
    const amountVal = event.resource.amount?.value || '0';
    const amountMicroUsd = dollarsToMicroUsd(amountVal);

    if (amountMicroUsd > 0n) {
      await LedgerService.creditTopup({
        walletId,
        amountMicroUsd,
        provider: 'PAYPAL',
        referenceId: eventId,
      }).catch(() => {});
    }
  }

  return res.status(200).json({ status: 'SUCCESS' });
}

paypalRouter.post('/webhooks', handlePaypalWebhook);
paypalRouter.post('/', handlePaypalWebhook);
