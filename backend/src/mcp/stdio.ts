import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './server';
import { prisma } from '../lib/prisma';
import { hashAgentToken } from '../lib/crypto';
import { logger } from '../config/logger';

async function runStdioServer() {
  // PRD 7.9: Credential read from environment, never from CLI args or source
  const rawKey = process.env.TOOLTOLL_AGENT_KEY;

  if (!rawKey) {
    console.error('Error: TOOLTOLL_AGENT_KEY environment variable is required to run ToolToll MCP server.');
    process.exit(1);
  }

  const tokenHash = hashAgentToken(rawKey);
  const credential = await prisma.agentCredential.findUnique({
    where: { tokenHash },
    include: { agent: true },
  });

  if (!credential) {
    console.error('Error: Invalid TOOLTOLL_AGENT_KEY provided.');
    process.exit(1);
  }

  if (credential.revokedAt) {
    console.error('Error: TOOLTOLL_AGENT_KEY has been revoked.');
    process.exit(1);
  }

  if (credential.expiresAt && credential.expiresAt < new Date()) {
    console.error('Error: TOOLTOLL_AGENT_KEY has expired.');
    process.exit(1);
  }

  if (!credential.agent.isActive) {
    console.error('Error: Agent is deactivated.');
    process.exit(1);
  }

  const server = createMcpServer(credential.agentId);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  logger.info({ agentId: credential.agentId }, 'ToolToll MCP STDIO server running');
}

runStdioServer().catch((err) => {
  console.error('Fatal MCP STDIO server error:', err);
  process.exit(1);
});
