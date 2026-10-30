import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateJwtToken } from '../src/lib/auth';
import { LedgerService } from '../src/modules/ledger/ledgerService';

describe('Functional Refund System & Quality Judge Settlement', () => {
  let consumerUser: any;
  let consumerToken: string;
  let creatorUser: any;
  let creatorToken: string;
  let demoTool: any;
  let consumerAgent: any;

  it('Setup: Load seeded accounts, agent, and generate auth tokens', async () => {
    consumerUser = await prisma.user.findUnique({
      where: { email: 'consumer@tooltoll.com' },
      include: { wallet: true },
    });
    assert.ok(consumerUser);
    assert.ok(consumerUser.wallet);
    consumerToken = generateJwtToken({
      userId: consumerUser.id,
      email: consumerUser.email,
      isAdmin: consumerUser.isAdmin,
      isCreator: consumerUser.isCreator,
      isConsumer: consumerUser.isConsumer,
    });

    creatorUser = await prisma.user.findUnique({
      where: { email: 'creator@tooltoll.com' },
      include: { wallet: true },
    });
    assert.ok(creatorUser);
    creatorToken = generateJwtToken({
      userId: creatorUser.id,
      email: creatorUser.email,
      isAdmin: creatorUser.isAdmin,
      isCreator: creatorUser.isCreator,
      isConsumer: creatorUser.isConsumer,
    });

    demoTool = await prisma.tool.findUnique({
      where: { slug: 'demo-text-translator' },
    });
    assert.ok(demoTool);

    consumerAgent = await prisma.agent.findFirst({
      where: { userId: consumerUser.id },
    });
    assert.ok(consumerAgent);
  });

  it('Case 1: A successful API execution meeting quality requirements is NOT eligible for refund', async () => {
    // Create a successful tool call
    const callId = `success_call_${Date.now()}`;
    const call = await prisma.toolCall.create({
      data: {
        id: callId,
        agentId: consumerAgent.id,
        toolId: demoTool.id,
        idempotencyKey: `success_key_${Date.now()}`,
        priceMicroUsd: 5000n,
        platformFeeBps: 2000,
        platformFeeMicroUsd: 1000n,
        creatorEarningsMicroUsd: 4000n,
        status: 'SUCCESS',
        httpStatus: 200,
        latencyMs: 140,
        sanitizedInput: { text: 'hello', targetLanguage: 'es' },
        sanitizedOutput: { translated_text: 'hola' },
        completedAt: new Date(),
      },
    });

    // Check eligibility
    const res = await request(app)
      .get(`/api/wallet/calls/${callId}/refund-eligibility`)
      .set('Authorization', `Bearer ${consumerToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.isEligible, false);
    assert.equal(res.body.data.status, 'NOT_ELIGIBLE');
    assert.ok(res.body.data.reason.includes('successfully'));

    // Attempting refund should be rejected
    const refundRes = await request(app)
      .post(`/api/wallet/calls/${callId}/refund`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({});

    assert.equal(refundRes.status, 400);
    assert.equal(refundRes.body.success, false);
    assert.equal(refundRes.body.error.code, 'INELIGIBLE_FOR_REFUND');
  });

  it('Case 2: An eligible charged execution (HTTP 502 server error) can be verified and refunded', async () => {
    const callId = `failed_502_call_${Date.now()}`;
    const charge = 8000n; // $0.008

    // 1. Simulate captured paid call
    await prisma.toolCall.create({
      data: {
        id: callId,
        agentId: consumerAgent.id,
        toolId: demoTool.id,
        idempotencyKey: `failed_502_key_${Date.now()}`,
        priceMicroUsd: charge,
        platformFeeBps: 2000,
        platformFeeMicroUsd: 1600n,
        creatorEarningsMicroUsd: 6400n,
        status: 'FAILED',
        httpStatus: 502,
        latencyMs: 380,
        failureReason: 'Upstream microservice returned HTTP 502 Bad Gateway',
        sanitizedInput: { text: 'test 502' },
        sanitizedOutput: { error: 'Bad Gateway' },
        completedAt: new Date(),
      },
    });

    // Create matching creator earning
    await prisma.creatorEarning.create({
      data: {
        creatorId: demoTool.creatorId,
        toolCallId: callId,
        toolId: demoTool.id,
        grossMicroUsd: charge,
        platformFeeMicroUsd: 1600n,
        netMicroUsd: 6400n,
        status: 'PAYABLE',
      },
    });

    // 2. Check refund eligibility
    const eligRes = await request(app)
      .get(`/api/wallet/calls/${callId}/refund-eligibility`)
      .set('Authorization', `Bearer ${consumerToken}`);

    assert.equal(eligRes.status, 200);
    assert.equal(eligRes.body.data.isEligible, true);
    assert.equal(eligRes.body.data.status, 'ELIGIBLE');
    assert.equal(eligRes.body.data.refundableAmountMicroUsd, charge.toString());

    // 3. Process refund
    const initialWallet = await prisma.wallet.findUnique({ where: { id: consumerUser.wallet.id } });
    const initialBalance = initialWallet!.balance;

    const refundRes = await request(app)
      .post(`/api/wallet/calls/${callId}/refund`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ reason: 'Upstream server crashed with HTTP 502' });

    assert.equal(refundRes.status, 200);
    assert.equal(refundRes.body.success, true);
    assert.equal(refundRes.body.data.status, 'REFUNDED');
    assert.equal(refundRes.body.data.refundedAmountMicroUsd, charge.toString());

    // 4. Verify wallet balance credited
    const updatedWallet = await prisma.wallet.findUnique({ where: { id: consumerUser.wallet.id } });
    assert.equal(updatedWallet!.balance, initialBalance + charge);

    // 5. Verify ToolCall status updated
    const updatedCall = await prisma.toolCall.findUnique({ where: { id: callId } });
    assert.equal(updatedCall!.status, 'REVERSED');
    assert.equal(updatedCall!.isReversed, true);

    // 6. Verify CreatorEarning reversed
    const updatedEarning = await prisma.creatorEarning.findUnique({ where: { toolCallId: callId } });
    assert.equal(updatedEarning!.status, 'REVERSED');

    // 7. Verify Double-Entry Ledger entries
    const entries = await prisma.ledgerEntry.findMany({
      where: { callId, referenceType: 'REFUND' },
    });
    assert.equal(entries.length, 3);
    const userWalletCredit = entries.find((e) => e.account === 'USER_WALLET');
    const creatorDebit = entries.find((e) => e.account === 'CREATOR_PAYABLE');
    const platformDebit = entries.find((e) => e.account === 'PLATFORM_REVENUE');

    assert.ok(userWalletCredit && userWalletCredit.entryType === 'CREDIT' && userWalletCredit.amount === charge);
    assert.ok(creatorDebit && creatorDebit.entryType === 'DEBIT' && creatorDebit.amount === 6400n);
    assert.ok(platformDebit && platformDebit.entryType === 'DEBIT' && platformDebit.amount === 1600n);
    assert.equal(creatorDebit.amount + platformDebit.amount, userWalletCredit.amount);
  });

  it('Case 3: An execution with zero charge cannot receive a financial refund', async () => {
    const zeroCallId = `zero_charge_call_${Date.now()}`;
    await prisma.toolCall.create({
      data: {
        id: zeroCallId,
        agentId: consumerAgent.id,
        toolId: demoTool.id,
        idempotencyKey: `zero_key_${Date.now()}`,
        priceMicroUsd: 0n,
        platformFeeBps: 2000,
        platformFeeMicroUsd: 0n,
        creatorEarningsMicroUsd: 0n,
        status: 'FAILED',
        httpStatus: 500,
        failureReason: 'Free call failed',
        sanitizedInput: {},
      },
    });

    const eligRes = await request(app)
      .get(`/api/wallet/calls/${zeroCallId}/refund-eligibility`)
      .set('Authorization', `Bearer ${consumerToken}`);

    assert.equal(eligRes.status, 200);
    assert.equal(eligRes.body.data.isEligible, false);
    assert.equal(eligRes.body.data.status, 'NOT_ELIGIBLE');

    const refundRes = await request(app)
      .post(`/api/wallet/calls/${zeroCallId}/refund`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({});

    assert.equal(refundRes.status, 400);
  });

  it('Case 4: A user cannot refund another user execution', async () => {
    const foreignCallId = `foreign_call_${Date.now()}`;
    await prisma.toolCall.create({
      data: {
        id: foreignCallId,
        agentId: consumerAgent.id, // belongs to consumerUser
        toolId: demoTool.id,
        idempotencyKey: `foreign_key_${Date.now()}`,
        priceMicroUsd: 10000n,
        platformFeeBps: 2000,
        platformFeeMicroUsd: 2000n,
        creatorEarningsMicroUsd: 8000n,
        status: 'FAILED',
        httpStatus: 500,
        sanitizedInput: {},
      },
    });

    // Creator user attempts to refund consumer user's call
    const res = await request(app)
      .post(`/api/wallet/calls/${foreignCallId}/refund`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({});

    assert.equal(res.status, 404); // Scoped not found for unauthorized user
  });

  it('Case 5: Repeated requests cannot create duplicate refunds (Idempotency)', async () => {
    const callId = `idempotent_refund_call_${Date.now()}`;
    const charge = 5000n;

    await prisma.toolCall.create({
      data: {
        id: callId,
        agentId: consumerAgent.id,
        toolId: demoTool.id,
        idempotencyKey: `idem_refund_key_${Date.now()}`,
        priceMicroUsd: charge,
        platformFeeBps: 2000,
        platformFeeMicroUsd: 1000n,
        creatorEarningsMicroUsd: 4000n,
        status: 'FAILED',
        httpStatus: 503,
        sanitizedInput: {},
      },
    });

    // First refund call
    const res1 = await request(app)
      .post(`/api/wallet/calls/${callId}/refund`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ reason: 'HTTP 503 Service Unavailable' });

    assert.equal(res1.status, 200);
    assert.equal(res1.body.data.status, 'REFUNDED');
    assert.equal(res1.body.data.alreadyRefunded, false);

    const balanceAfterFirst = (await prisma.wallet.findUnique({ where: { id: consumerUser.wallet.id } }))!.balance;

    // Second refund call (repeat)
    const res2 = await request(app)
      .post(`/api/wallet/calls/${callId}/refund`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ reason: 'HTTP 503 Service Unavailable' });

    assert.equal(res2.status, 200);
    assert.equal(res2.body.data.status, 'REFUNDED');
    assert.equal(res2.body.data.alreadyRefunded, true);

    // Verify balance was NOT credited twice
    const balanceAfterSecond = (await prisma.wallet.findUnique({ where: { id: consumerUser.wallet.id } }))!.balance;
    assert.equal(balanceAfterFirst, balanceAfterSecond);
  });

  it('Case 6: Concurrent refund requests cannot over-refund a transaction', async () => {
    const callId = `concurrent_refund_call_${Date.now()}`;
    const charge = 12000n;

    await prisma.toolCall.create({
      data: {
        id: callId,
        agentId: consumerAgent.id,
        toolId: demoTool.id,
        idempotencyKey: `concurrent_key_${Date.now()}`,
        priceMicroUsd: charge,
        platformFeeBps: 2000,
        platformFeeMicroUsd: 2400n,
        creatorEarningsMicroUsd: 9600n,
        status: 'FAILED',
        httpStatus: 504,
        sanitizedInput: {},
      },
    });

    const balanceBefore = (await prisma.wallet.findUnique({ where: { id: consumerUser.wallet.id } }))!.balance;

    // Trigger 3 concurrent refund requests simultaneously
    const [resA, resB, resC] = await Promise.all([
      request(app).post(`/api/wallet/calls/${callId}/refund`).set('Authorization', `Bearer ${consumerToken}`).send({}),
      request(app).post(`/api/wallet/calls/${callId}/refund`).set('Authorization', `Bearer ${consumerToken}`).send({}),
      request(app).post(`/api/wallet/calls/${callId}/refund`).set('Authorization', `Bearer ${consumerToken}`).send({}),
    ]);

    // All should succeed with 200, but only ONE should credit the balance
    assert.equal(resA.status, 200);
    assert.equal(resB.status, 200);
    assert.equal(resC.status, 200);

    const balanceAfter = (await prisma.wallet.findUnique({ where: { id: consumerUser.wallet.id } }))!.balance;
    assert.equal(balanceAfter, balanceBefore + charge); // Exactly one charge credited
  });

  it('Case 7: Latency SLA breach qualifies for refund', async () => {
    const callId = `sla_breach_call_${Date.now()}`;
    await prisma.toolCall.create({
      data: {
        id: callId,
        agentId: consumerAgent.id,
        toolId: demoTool.id,
        idempotencyKey: `sla_key_${Date.now()}`,
        priceMicroUsd: 7000n,
        platformFeeBps: 2000,
        platformFeeMicroUsd: 1400n,
        creatorEarningsMicroUsd: 5600n,
        status: 'SUCCESS',
        httpStatus: 200,
        latencyMs: 18000, // tool.timeoutMs is 15000ms -> breached!
        sanitizedInput: {},
      },
    });

    const eligRes = await request(app)
      .get(`/api/wallet/calls/${callId}/refund-eligibility`)
      .set('Authorization', `Bearer ${consumerToken}`);

    assert.equal(eligRes.status, 200);
    assert.equal(eligRes.body.data.isEligible, true);
    assert.ok(eligRes.body.data.reason.includes('breached contract SLA threshold'));
  });

  it('Case 8: GET /api/wallet/refunds returns recorded refunds with audit details', async () => {
    const res = await request(app)
      .get('/api/wallet/refunds')
      .set('Authorization', `Bearer ${consumerToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);
    assert.ok(res.body.data[0].amountMicroUsd);
    assert.ok(res.body.data[0].callId);
  });
});
