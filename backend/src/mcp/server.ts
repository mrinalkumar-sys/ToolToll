import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ExecutionGateway } from '../modules/execution/executionGateway';
import { formatMicroUsd } from '../utils/money';

/**
 * PRD 7.9: Create MCP Server configured for a specific authenticated agent
 */
export function createMcpServer(agentId: string): McpServer {
  const server = new McpServer({
    name: 'ToolToll-MCP-Server',
    version: '1.0.0',
  });

  // Tool 1: search_tools
  server.tool(
    'search_tools',
    {
      query: z.string().optional().describe('Search term for matching tool names, descriptions, or tags'),
      category: z.string().optional().describe('Filter by tool category (e.g. Translation, Security, NLP)'),
      max_price: z.string().optional().describe('Maximum allowed price in micro-USD'),
      limit: z.number().optional().default(10).describe('Max number of tools to return'),
    },
    async ({ query, category, max_price, limit }) => {
      const q = (query || '').toLowerCase();
      const tools = await prisma.tool.findMany({
        where: {
          OR: [{ status: 'APPROVED' }, { isDemo: true }],
          ...(category ? { category } : {}),
          ...(max_price ? { priceMicroUsd: { lte: BigInt(max_price) } } : {}),
        },
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          shortDescription: true,
          category: true,
          tags: true,
          priceMicroUsd: true,
        },
      });

      const matched = tools.filter(
        (t) =>
          !q ||
          t.name.toLowerCase().includes(q) ||
          t.shortDescription.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      );

      const formatted = matched.map((t) => ({
        tool_id: t.id,
        name: t.name,
        slug: t.slug,
        category: t.category,
        description: t.shortDescription,
        price_micro_usd: t.priceMicroUsd.toString(),
        formatted_price: formatMicroUsd(t.priceMicroUsd),
      }));

      return {
        content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }],
      };
    }
  );

  // Tool 2: get_tool_details
  server.tool(
    'get_tool_details',
    {
      tool_id: z.string().describe('Unique ID of the tool'),
    },
    async ({ tool_id }) => {
      const tool = await prisma.tool.findUnique({
        where: { id: tool_id },
        select: {
          id: true,
          name: true,
          slug: true,
          shortDescription: true,
          detailedDescription: true,
          category: true,
          tags: true,
          inputSchema: true,
          priceMicroUsd: true,
          timeoutMs: true,
          status: true,
        },
      });

      if (!tool) {
        return {
          content: [{ type: 'text', text: `Tool with ID ${tool_id} not found.` }],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                ...tool,
                price_micro_usd: tool.priceMicroUsd.toString(),
                formatted_price: formatMicroUsd(tool.priceMicroUsd),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Tool 3: get_tool_price
  server.tool(
    'get_tool_price',
    {
      tool_id: z.string().describe('Unique ID of the tool'),
    },
    async ({ tool_id }) => {
      const tool = await prisma.tool.findUnique({
        where: { id: tool_id },
        select: { id: true, name: true, priceMicroUsd: true, currency: true },
      });

      if (!tool) {
        return { content: [{ type: 'text', text: `Tool ${tool_id} not found` }] };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              tool_id: tool.id,
              name: tool.name,
              price_micro_usd: tool.priceMicroUsd.toString(),
              formatted_price: formatMicroUsd(tool.priceMicroUsd),
              currency: tool.currency,
            }),
          },
        ],
      };
    }
  );

  // Tool 4: get_wallet_balance
  server.tool('get_wallet_balance', {}, async () => {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: { user: { include: { wallet: true } } },
    });

    const wallet = agent?.user.wallet;
    if (!wallet) {
      return { content: [{ type: 'text', text: 'Wallet not found' }] };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            available_micro_usd: wallet.balance.toString(),
            reserved_micro_usd: wallet.reservedBalance.toString(),
            formatted_balance: formatMicroUsd(wallet.balance),
            currency: wallet.currency,
          }),
        },
      ],
    };
  });

  // Tool 5: call_paid_tool (PRD 7.9)
  server.tool(
    'call_paid_tool',
    {
      tool_id: z.string().describe('Tool ID to execute'),
      input: z.string().describe('JSON-stringified input payload conforming to the tool schema'),
      idempotency_key: z.string().describe('Unique idempotency key to prevent duplicate charges'),
    },
    async ({ tool_id, input, idempotency_key }) => {
      let parsedInput: unknown;
      try {
        parsedInput = JSON.parse(input);
      } catch {
        parsedInput = { rawText: input };
      }

      try {
        const execution = await ExecutionGateway.execute({
          agentId,
          toolId: tool_id,
          idempotencyKey: idempotency_key,
          input: parsedInput,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(execution, null, 2) }],
        };
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Execution error';
        return {
          content: [{ type: 'text', text: `Tool execution failed: ${msg}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 6: get_call_status
  server.tool(
    'get_call_status',
    {
      call_id: z.string().describe('ID of the tool execution call'),
    },
    async ({ call_id }) => {
      const call = await prisma.toolCall.findUnique({
        where: { id: call_id },
        select: {
          id: true,
          status: true,
          sanitizedOutput: true,
          priceMicroUsd: true,
          latencyMs: true,
          failureReason: true,
          completedAt: true,
        },
      });

      if (!call) {
        return { content: [{ type: 'text', text: `Call ${call_id} not found` }] };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ...call,
              price_micro_usd: call.priceMicroUsd.toString(),
            }),
          },
        ],
      };
    }
  );

  // Tool 7: get_usage_history
  server.tool(
    'get_usage_history',
    {
      limit: z.number().optional().default(10).describe('Max number of recent calls to retrieve'),
    },
    async ({ limit }) => {
      const calls = await prisma.toolCall.findMany({
        where: { agentId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { tool: { select: { name: true, category: true } } },
      });

      const formatted = calls.map((c) => ({
        call_id: c.id,
        tool_name: c.tool.name,
        category: c.tool.category,
        status: c.status,
        price_micro_usd: c.priceMicroUsd.toString(),
        formatted_price: formatMicroUsd(c.priceMicroUsd),
        latency_ms: c.latencyMs,
        created_at: c.createdAt,
      }));

      return {
        content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }],
      };
    }
  );

  return server;
}
