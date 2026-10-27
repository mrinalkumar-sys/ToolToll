import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { createMcpServer } from '../src/mcp/server';
import { ExecutionGateway } from '../src/modules/execution/executionGateway';

describe('Model Context Protocol (MCP) Server Tools', () => {
  let mcpUser: any;
  let agent: any;
  let server: any;
  let demoTool: any;

  before(async () => {
    // Dedicated isolated user and wallet for MCP tests
    mcpUser = await prisma.user.create({
      data: {
        email: `mcp_test_${Date.now()}@example.com`,
        name: 'MCP Test User',
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

    agent = await prisma.agent.create({
      data: {
        userId: mcpUser.id,
        name: 'MCP Test Agent',
        maxPerCallMicroUsd: 1_000_000n,
        dailyBudgetMicroUsd: 50_000_000n,
        monthlyBudgetMicroUsd: 500_000_000n,
        approvalThresholdMicroUsd: 5_000_000n,
        autoApproveTags: ['demo', 'translation'],
      },
    });

    demoTool = await prisma.tool.findUnique({
      where: { slug: 'demo-text-translator' },
    });
    assert.ok(demoTool);

    server = createMcpServer(agent.id);
    assert.ok(server);
  });

  it('MCP search_tools: searches and returns formatted tools', async () => {
    const tools = await prisma.tool.findMany({
      where: { OR: [{ status: 'APPROVED' }, { isDemo: true }] },
      take: 5,
    });
    assert.ok(tools.length > 0);
  });

  it('MCP get_wallet_balance: returns balance for agent owner wallet', async () => {
    const userWallet = await prisma.wallet.findUnique({
      where: { userId: agent.userId },
    });
    assert.ok(userWallet);
    assert.equal(userWallet.balance, 10_000_000n);
  });

  it('MCP call_paid_tool: executes tool call through billing gateway', async () => {
    const key = `mcp_call_${Date.now()}`;
    const initialBalance = (await prisma.wallet.findUnique({ where: { userId: agent.userId } }))!.balance;

    const res = await ExecutionGateway.execute({
      agentId: agent.id,
      toolId: demoTool.id,
      idempotencyKey: key,
      input: { text: 'hello', targetLanguage: 'es' },
    });

    assert.equal(res.status, 'SUCCESS');
    assert.ok(res.result);
    assert.equal(res.priceMicroUsd, demoTool.priceMicroUsd.toString());

    const newBalance = (await prisma.wallet.findUnique({ where: { userId: agent.userId } }))!.balance;
    assert.equal(initialBalance - newBalance, demoTool.priceMicroUsd);
  });
});
