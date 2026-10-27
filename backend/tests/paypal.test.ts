import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateJwtToken } from '../src/lib/auth';

describe('PayPal & Wallet Payment Pipeline', () => {
  let userToken: string;
  let userWallet: any;
  let createdOrderId: string;

  before(async () => {
    // Isolated user and wallet for PayPal tests
    const user = await prisma.user.create({
      data: {
        email: `paypal_test_${Date.now()}@example.com`,
        name: 'PayPal Test User',
        passwordHash: 'mock_hash',
        isConsumer: true,
        wallet: {
          create: {
            balance: 10_000_000n, // $10.00
            reservedBalance: 0n,
            currency: 'USD',
          },
        },
      },
      include: { wallet: true },
    });

    userWallet = user.wallet;

    userToken = generateJwtToken({
      userId: user.id,
      email: user.email,
      isCreator: user.isCreator,
      isConsumer: user.isConsumer,
      isAdmin: user.isAdmin,
    });
  });

  it('POST /api/paypal/orders: Should create an order record', async () => {
    const res = await request(app)
      .post('/api/paypal/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ amountUsd: '15.00' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.orderId);
    assert.equal(res.body.data.status, 'CREATED');

    createdOrderId = res.body.data.orderId;
  });

  it('POST /api/paypal/orders/:orderId/capture: Should capture order and credit wallet atomically', async () => {
    const balanceBefore = (await prisma.wallet.findUnique({ where: { id: userWallet.id } }))!.balance;

    const res = await request(app)
      .post(`/api/paypal/orders/${createdOrderId}/capture`)
      .set('Authorization', `Bearer ${userToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'COMPLETED');
    assert.equal(res.body.data.amountMicroUsd, '15000000'); // $15.00 in micro-USD

    const balanceAfter = (await prisma.wallet.findUnique({ where: { id: userWallet.id } }))!.balance;
    assert.equal(balanceAfter - balanceBefore, 15_000_000n);
  });

  it('Invariant 11: PayPal webhook deduplication ignores duplicate event IDs', async () => {
    const eventId = `webhook_evt_${Date.now()}`;
    const payload = {
      id: eventId,
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: `capture_${Date.now()}`,
        custom_id: userWallet.id,
        amount: { value: '5.00' },
      },
    };

    // First delivery of webhook
    const res1 = await request(app)
      .post('/api/webhooks/paypal')
      .send(payload);

    assert.equal(res1.status, 200);
    assert.equal(res1.body.status, 'SUCCESS');

    // Duplicate delivery of the exact same webhook
    const res2 = await request(app)
      .post('/api/webhooks/paypal')
      .send(payload);

    assert.equal(res2.status, 200);
    assert.equal(res2.body.status, 'IGNORED_DUPLICATE');
  });
});
