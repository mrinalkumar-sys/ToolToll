import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { LedgerService } from '../ledger/ledgerService';
import { sendSuccess, sendError } from '../../utils/response';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../utils/errors';
import { dollarsToMicroUsd } from '../../utils/money';
import { env } from '../../config/env';

export const paypalRouter = Router();

// ==========================================
// PayPal Authentication & Helpers
// ==========================================

let tokenCache: { token: string; expiresAt: number } | null = null;
let tokenPromise: Promise<string> | null = null;

function getPayPalBaseUrl(): string {
  if (env.PAYPAL_BASE_URL && env.PAYPAL_BASE_URL.startsWith('http')) {
    return env.PAYPAL_BASE_URL.replace(/\/+$/, '');
  }
  return env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function getPayPalAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60000) {
    return tokenCache.token;
  }

  // Deduplicate concurrent token requests
  if (tokenPromise) {
    return await tokenPromise;
  }

  const clientId = env.PAYPAL_CLIENT_ID;
  const clientSecret = env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret || clientId === 'mock_client_id') {
    throw new BadRequestError('PayPal API credentials are not configured on server');
  }

  tokenPromise = (async () => {
    try {
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const baseUrl = getPayPalBaseUrl();

      const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error('PayPal OAuth Error:', res.status, errText);
        throw new BadRequestError('Failed to authenticate with PayPal Sandbox gateway');
      }

      const data = (await res.json()) as { access_token: string; expires_in: number };
      tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      };

      return data.access_token;
    } finally {
      tokenPromise = null;
    }
  })();

  return await tokenPromise;
}

// Pre-warm OAuth token at startup & auto-refresh before expiration
async function prewarmPayPalToken(): Promise<void> {
  try {
    const clientId = env.PAYPAL_CLIENT_ID;
    const clientSecret = env.PAYPAL_CLIENT_SECRET;
    if (clientId && clientSecret && clientId !== 'mock_client_id') {
      await getPayPalAccessToken();
      console.log('⚡ [PayPal Gateway] Sandbox OAuth token pre-warmed & cached in memory');
    }
  } catch (err: any) {
    console.warn('⚠️ [PayPal Gateway] Pre-warming token failed:', err?.message || err);
  }
}

// Fire startup pre-warm
setTimeout(() => {
  prewarmPayPalToken().catch(() => {});
}, 100);

// Keep token warm periodically (every 25 minutes)
setInterval(() => {
  prewarmPayPalToken().catch(() => {});
}, 25 * 60 * 1000);

// Validation schemas
const createOrderSchema = z.object({
  amount: z.union([z.string(), z.number()]).optional(),
  amountUsd: z.union([z.string(), z.number()]).optional(),
  packageId: z.string().optional(),
  currency: z.string().default('USD'),
}).refine((data) => data.amount !== undefined || data.amountUsd !== undefined || data.packageId !== undefined, {
  message: 'Amount or packageId is required',
});

const captureOrderSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
});

// Helper to validate and calculate server-side amount
function validateAndGetAmount(input: {
  amount?: string | number;
  amountUsd?: string | number;
  packageId?: string;
}): { amountUsdStr: string; amountMicroUsd: bigint } {
  // Predefined packages support
  const packageMap: Record<string, number> = {
    starter: 5.0,
    standard: 10.0,
    pro: 25.0,
    enterprise: 50.0,
  };

  let numVal: number;
  if (input.packageId && packageMap[input.packageId.toLowerCase()]) {
    numVal = packageMap[input.packageId.toLowerCase()];
  } else {
    const rawVal = input.amountUsd !== undefined ? input.amountUsd : input.amount;
    numVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal).trim());
  }

  if (isNaN(numVal) || !isFinite(numVal) || numVal < 1.0 || numVal > 10000.0) {
    throw new BadRequestError('Payment amount must be between $1.00 and $10,000.00 USD');
  }

  const amountUsdStr = numVal.toFixed(2);
  const amountMicroUsd = dollarsToMicroUsd(amountUsdStr);
  return { amountUsdStr, amountMicroUsd };
}

// ==========================================
// 1. GET /api/paypal/config
// Return public client configuration without secrets
// ==========================================
paypalRouter.get('/config', (_req: Request, res: Response) => {
  return sendSuccess(res, {
    clientId: env.PAYPAL_CLIENT_ID,
    mode: env.PAYPAL_MODE,
    currency: 'USD',
  });
});

// ==========================================
// 2. POST /api/paypal/create-order
// Create PayPal Sandbox Order with server-side validation
// ==========================================
async function handleCreateOrder(req: Request, res: Response, next: any) {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        parsed.error.errors[0]?.message || 'Invalid order parameters',
        400,
        'VALIDATION_ERROR',
        parsed.error.format()
      );
    }

    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user || !user.wallet) {
      throw new NotFoundError('Customer user or wallet record not found');
    }

    const { amountUsdStr, amountMicroUsd } = validateAndGetAmount(parsed.data);
    const baseUrl = getPayPalBaseUrl();
    const token = await getPayPalAccessToken();

    const frontendOrigin = env.FRONTEND_URL || 'http://localhost:5174';

    // Call PayPal Orders v2 API
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: `pu_${Date.now()}`,
          description: `ToolToll Micro-USD Credit Deposit: $${amountUsdStr} USD`,
          custom_id: user.wallet.id,
          amount: {
            currency_code: 'USD',
            value: amountUsdStr,
            breakdown: {
              item_total: {
                currency_code: 'USD',
                value: amountUsdStr,
              },
            },
          },
          items: [
            {
              name: 'ToolToll Machine Economy Credits',
              description: `${(parseFloat(amountUsdStr) * 1000000).toLocaleString()} Micro-USD Platform Balance`,
              unit_amount: {
                currency_code: 'USD',
                value: amountUsdStr,
              },
              quantity: '1',
              category: 'DIGITAL_GOODS',
            },
          ],
        },
      ],
      application_context: {
        brand_name: 'ToolToll Protocol',
        landing_page: 'LOGIN',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: `${frontendOrigin}/wallet?status=paypal_success`,
        cancel_url: `${frontendOrigin}/wallet?status=paypal_cancelled`,
      },
    };

    const ppRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    if (!ppRes.ok) {
      const errDetails = await ppRes.text().catch(() => '');
      console.error('PayPal Order Create Failed:', ppRes.status, errDetails);
      throw new BadRequestError('Failed to create order on PayPal Sandbox gateway');
    }

    const ppOrder = (await ppRes.json()) as {
      id: string;
      status: string;
      links?: Array<{ href: string; rel: string; method: string }>;
    };

    const orderId = ppOrder.id;
    const approvalLink = ppOrder.links?.find((l) => l.rel === 'approve');
    const approvalUrl = approvalLink?.href || `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`;

    // Save order in database
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
      id: orderRecord.id,
      orderId: orderRecord.orderId,
      approvalUrl,
      amount: orderRecord.amountUsd,
      currency: orderRecord.currency,
      status: orderRecord.status,
      customerId: orderRecord.userId,
      createdAt: orderRecord.createdAt,
    });
  } catch (error) {
    next(error);
  }
}

paypalRouter.post('/create-order', requireAuth, handleCreateOrder);
paypalRouter.post('/orders', requireAuth, handleCreateOrder); // Legacy alias

// ==========================================
// 3. POST /api/paypal/capture-order
// Capture authorized PayPal payment & credit customer wallet atomically
// ==========================================
async function handleCaptureOrder(req: Request, res: Response, next: any) {
  try {
    const rawOrderId = req.body?.orderId || req.params?.orderId;
    const parsed = captureOrderSchema.safeParse({ orderId: rawOrderId });

    if (!parsed.success) {
      return sendError(res, 'Valid orderId is required for payment capture', 400, 'VALIDATION_ERROR');
    }

    const { orderId } = parsed.data;
    const userId = req.user!.userId;

    const order = await prisma.paypalOrder.findUnique({
      where: { orderId },
    });

    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found in database`);
    }

    if (order.userId !== userId && !req.user!.isAdmin) {
      throw new ForbiddenError('You do not have permission to capture this order');
    }

    // Idempotency: Prevent duplicate payment captures
    if (order.status === 'COMPLETED') {
      return sendSuccess(res, {
        id: order.id,
        orderId: order.orderId,
        captureId: order.captureId || 'ALREADY_CAPTURED',
        status: 'COMPLETED',
        amount: order.amountUsd,
        currency: order.currency,
        message: 'Order was already captured and credited successfully',
      });
    }

    if (order.status === 'CANCELLED') {
      throw new BadRequestError('Cannot capture a cancelled payment order');
    }

    const baseUrl = getPayPalBaseUrl();
    const token = await getPayPalAccessToken();

    const capRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    let captureData: any = null;

    if (!capRes.ok) {
      const errJson: any = await capRes.json().catch(() => ({}));
      console.warn('PayPal Capture API returned non-200:', capRes.status, errJson);

      // Check if order was already captured on PayPal
      if (errJson?.name === 'ORDER_ALREADY_CAPTURED' || errJson?.details?.some((d: any) => d.issue === 'ORDER_ALREADY_CAPTURED')) {
        // Retrieve order details to extract existing capture ID
        const getRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (getRes.ok) {
          captureData = await getRes.json();
        }
      } else {
        throw new BadRequestError(errJson?.message || 'PayPal capture failed');
      }
    } else {
      captureData = await capRes.json();
    }

    // Extract transaction/capture ID
    const captureUnit = captureData?.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId: string = captureUnit?.id || captureData?.id || `cap_${Date.now()}`;
    const captureStatus: string = captureUnit?.status || captureData?.status || 'COMPLETED';

    if (captureStatus !== 'COMPLETED' && captureStatus !== 'PENDING') {
      await prisma.paypalOrder.update({
        where: { id: order.id },
        data: {
          status: 'FAILED',
          rawCapture: captureData as object,
        },
      });
      throw new BadRequestError(`PayPal capture status is ${captureStatus}`);
    }

    // Update PaypalOrder in database with capture ID and status
    const updatedOrder = await prisma.paypalOrder.update({
      where: { id: order.id },
      data: {
        status: 'COMPLETED',
        captureId,
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
      id: updatedOrder.id,
      orderId: updatedOrder.orderId,
      captureId,
      topupId: topup.id,
      status: 'COMPLETED',
      amount: updatedOrder.amountUsd,
      amountMicroUsd: updatedOrder.amountMicroUsd.toString(),
      currency: updatedOrder.currency,
      message: 'PayPal payment captured successfully and wallet credited',
    });
  } catch (error) {
    next(error);
  }
}

paypalRouter.post('/capture-order', requireAuth, handleCaptureOrder);
paypalRouter.post('/orders/:orderId/capture', requireAuth, handleCaptureOrder); // Legacy alias

// ==========================================
// 4. GET /api/paypal/order/:orderId
// Inspect order state, verify against PayPal, return full payment info
// ==========================================
async function handleGetOrder(req: Request, res: Response, next: any) {
  try {
    const { orderId } = req.params;
    const userId = req.user!.userId;

    const order = await prisma.paypalOrder.findUnique({
      where: { orderId },
    });

    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }

    if (order.userId !== userId && !req.user!.isAdmin) {
      throw new ForbiddenError('You do not have access to view this order');
    }

    let paypalRemoteStatus = order.status;

    try {
      const baseUrl = getPayPalBaseUrl();
      const token = await getPayPalAccessToken();
      const ppRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (ppRes.ok) {
        const ppData = (await ppRes.json()) as { status: string };
        paypalRemoteStatus = ppData.status;

        // Sync approved state if customer approved on PayPal
        if (ppData.status === 'APPROVED' && order.status === 'CREATED') {
          await prisma.paypalOrder.update({
            where: { id: order.id },
            data: { status: 'APPROVED' },
          });
        }
      }
    } catch (err) {
      console.warn('Could not query remote PayPal order status:', err);
    }

    return sendSuccess(res, {
      id: order.id,
      orderId: order.orderId,
      captureId: order.captureId,
      amount: order.amountUsd,
      amountMicroUsd: order.amountMicroUsd.toString(),
      currency: order.currency,
      status: order.status,
      paypalStatus: paypalRemoteStatus,
      customerId: order.userId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}

paypalRouter.get('/order/:orderId', requireAuth, handleGetOrder);
paypalRouter.get('/orders/:orderId', requireAuth, handleGetOrder); // Alias

// ==========================================
// 5. POST /api/paypal/cancel-order
// Handle cancelled payment states
// ==========================================
async function handleCancelOrder(req: Request, res: Response, next: any) {
  try {
    const orderId = req.body?.orderId || req.params?.orderId;
    if (!orderId) {
      throw new BadRequestError('orderId is required to cancel an order');
    }

    const userId = req.user!.userId;
    const order = await prisma.paypalOrder.findUnique({
      where: { orderId },
    });

    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }

    if (order.userId !== userId && !req.user!.isAdmin) {
      throw new ForbiddenError('You do not have permission to cancel this order');
    }

    if (order.status === 'COMPLETED') {
      throw new BadRequestError('Cannot cancel an order that has already been completed');
    }

    const updated = await prisma.paypalOrder.update({
      where: { id: order.id },
      data: { status: 'CANCELLED' },
    });

    return sendSuccess(res, {
      orderId: updated.orderId,
      status: 'CANCELLED',
      message: 'Payment cancelled successfully',
    });
  } catch (error) {
    next(error);
  }
}

paypalRouter.post('/cancel-order', requireAuth, handleCancelOrder);
paypalRouter.post('/orders/:orderId/cancel', requireAuth, handleCancelOrder); // Alias

// ==========================================
// 6. POST /api/paypal/webhooks
// Webhook handler with signature deduplication
// ==========================================
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

  // Idempotent webhook processing using unique eventId
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

  // Handle capture completed event asynchronously
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
