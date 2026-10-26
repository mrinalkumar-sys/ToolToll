import express, { Request, Response } from 'express';
import cors from 'cors';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMcpServer } from './server';
import { prisma } from '../lib/prisma';
import { hashAgentToken } from '../lib/crypto';
import { logger } from '../config/logger';

const app = express();
app.use(cors());

const port = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 4001;

// Map transport by session ID
const transports: Record<string, SSEServerTransport> = {};

// Middleware to authenticate agent from Bearer token
async function authenticateMcpAgent(req: Request, res: Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Bearer token required for MCP HTTP transport' });
  }

  const rawToken = authHeader.slice(7);
  const tokenHash = hashAgentToken(rawToken);

  const credential = await prisma.agentCredential.findUnique({
    where: { tokenHash },
    include: { agent: true },
  });

  if (!credential || credential.revokedAt || (credential.expiresAt && credential.expiresAt < new Date()) || !credential.agent.isActive) {
    return res.status(401).json({ error: 'Invalid or inactive agent token' });
  }

  (req as Request & { agentId: string }).agentId = credential.agentId;
  next();
}

app.get('/sse', authenticateMcpAgent, async (req: Request, res: Response) => {
  const agentId = (req as Request & { agentId: string }).agentId;
  const transport = new SSEServerTransport('/message', res);
  const server = createMcpServer(agentId);

  transports[transport.sessionId] = transport;

  res.on('close', () => {
    delete transports[transport.sessionId];
  });

  await server.connect(transport);
  logger.info({ agentId, sessionId: transport.sessionId }, 'MCP SSE client connected');
});

app.post('/message', express.json(), async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];

  if (!transport) {
    return res.status(404).json({ error: 'Session not found' });
  }

  await transport.handlePostMessage(req, res);
});

app.listen(port, () => {
  logger.info(`ToolToll MCP Streamable HTTP server listening on port ${port}`);
});
