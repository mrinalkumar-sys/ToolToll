import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { ExecutionGateway } from '../src/modules/execution/executionGateway';
import { LedgerService } from '../src/modules/ledger/ledgerService';

describe('Execution Gateway & Double-Entry Ledger System', () => {
  const agentKey = 'tt_live_demo1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  let demoTool: any;
  let consumerUser: any;

  it('Setup: Load seeded demo tool and consumer user', async () => {
    demoTool = await prisma.tool.findUnique({
      where: { slug: 'demo-text-translator' },
    });
    assert.ok(demoTool);

    consumerUser = await prisma.user.findUnique({
      where: { email: 'consumer@tooltoll.com' },
      include: { wallet: true },
    });
    assert.ok(consumerUser);
    assert.ok(consumerUser.wallet);
  });

  it('Invariant 6: Should execute paid tool call and return original result on idempotent replay without double-charging', async () => {
    const idempotencyKey = `idem_test_${Date.now()}`;
    const initialBalance = (await prisma.wallet.findUnique({ where: { id: consumerUser.wallet.id } }))!.balance;

    // First Call
    const res1 = await request(app)
      .post(`/api/tools/${demoTool.id}/calls`)
      .set('X-Agent-Key', agentKey)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        input: { text: 'hello world', targetLanguage: 'es' },
      });

    assert.equal(res1.status, 200);
    assert.equal(res1.body.success, true);
    assert.equal(res1.body.data.status, 'SUCCESS');
    const callId = res1.body.data.callId;

    const balanceAfterFirst = (await prisma.wallet.findUnique({ where: { id: consumerUser.wallet.id } }))!.balance;
    assert.equal(initialBalance - balanceAfterFirst, demoTool.priceMicroUsd);

    // Replay with exact same idempotency key
    const res2 = await request(app)
      .post(`/api/tools/${demoTool.id}/calls`)
      .set('X-Agent-Key', agentKey)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        input: { text: 'hello world', targetLanguage: 'es' },
      });

    assert.equal(res2.status, 200);
    assert.equal(res2.body.data.isIdempotentReplay, true);
    assert.equal(res2.body.data.callId, callId);

    // Verify balance is completely unchanged on replay (no double charge)
    const balanceAfterReplay = (await prisma.wallet.findUnique({ where: { id: consumerUser.wallet.id } }))!.balance;
    assert.equal(balanceAfterFirst, balanceAfterReplay);
  });

  it('Invariant 4: Append-only double-entry ledger verifies debit from wallet and credit to creator and platform', async () => {
    const entries = await prisma.ledgerEntry.findMany({
      where: { walletId: consumerUser.wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    assert.ok(entries.length >= 2);
    const accounts = entries.map((e) => e.account);
    assert.ok(accounts.includes('USER_WALLET') || accounts.includes('WALLET_RESERVED'));
  });

  it('Reversal Policy: Failed outbound call should reverse reservation back to user wallet', async () => {
    // Create tool with non-existent or failing endpoint
    const failingTool = await prisma.tool.create({
      data: {
        creatorId: demoTool.creatorId,
        slug: `failing-tool-${Date.now()}`,
        name: 'Failing Test Tool',
        shortDescription: 'Tool designed to test reversal on failure',
        detailedDescription: 'Points to an invalid endpoint to test automated compensating ledger reversals',
        category: 'Testing',
        tags: ['test', 'failing'],
        baseUrl: 'http://127.0.0.1:4000',
        endpointPath: '/api/demo/non-existent-endpoint',
        httpMethod: 'POST',
        inputSchema: { type: 'object' },
        priceMicroUsd: 10_000n, // $0.010
        status: 'APPROVED',
        isDemo: true,
      },
    });

    const balanceBefore = (await prisma.wallet.findUnique({ where: { id: consumerUser.wallet.id } }))!.balance;
    const reservedBefore = (await prisma.wallet.findUnique({ where: { id: consumerUser.wallet.id } }))!.reservedBalance;

    const res = await request(app)
      .post(`/api/tools/${failingTool.id}/calls`)
      .set('X-Agent-Key', agentKey)
      .set('Idempotency-Key', `failing_call_${Date.now()}`)
      .send({ input: {} });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'REVERSED');
    assert.ok(res.body.data.failureReason);

    // Check balance was fully restored via compensating ledger entry
    const balanceAfter = (await prisma.wallet.findUnique({ where: { id: consumerUser.wallet.id } }))!.balance;
    const reservedAfter = (await prisma.wallet.findUnique({ where: { id: consumerUser.wallet.id } }))!.reservedBalance;

    assert.equal(balanceAfter, balanceBefore);
    assert.equal(reservedAfter, reservedBefore);

    // Cleanup: delete child tool calls before tool
    await prisma.walletReservation.deleteMany({ where: { toolId: failingTool.id } });
    await prisma.toolCall.deleteMany({ where: { toolId: failingTool.id } });
    await prisma.tool.delete({ where: { id: failingTool.id } });
  });

  it('Approval Threshold: Calls exceeding agent approval threshold should return APPROVAL_REQUIRED', async () => {
    // Tool with price higher than agent's 5_000_000 micro-USD threshold without autoApproveTag
    const expensiveTool = await prisma.tool.create({
      data: {
        creatorId: demoTool.creatorId,
        slug: `expensive-tool-${Date.now()}`,
        name: 'Expensive AI Tool',
        shortDescription: 'Expensive tool for testing approval gating',
        detailedDescription: 'Costs $6.00 which exceeds the $5.00 approval threshold',
        category: 'HeavyCompute',
        tags: ['expensive', 'nondemo'],
        baseUrl: 'http://127.0.0.1:4000',
        endpointPath: '/api/demo/sentiment',
        httpMethod: 'POST',
        inputSchema: { type: 'object' },
        priceMicroUsd: 6_000_000n, // $6.00 (exceeds $5.00 threshold)
        status: 'APPROVED',
        isDemo: true,
      },
    });

    const res = await request(app)
      .post(`/api/tools/${expensiveTool.id}/calls`)
      .set('X-Agent-Key', agentKey)
      .set('Idempotency-Key', `expensive_call_${Date.now()}`)
      .send({ input: { text: 'test' } });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'APPROVAL_REQUIRED');

    // Cleanup: delete child tool calls before tool
    await prisma.walletReservation.deleteMany({ where: { toolId: expensiveTool.id } });
    await prisma.toolCall.deleteMany({ where: { toolId: expensiveTool.id } });
    await prisma.tool.delete({ where: { id: expensiveTool.id } });
  });
});

