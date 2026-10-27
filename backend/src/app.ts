import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { openApiSpec } from './config/swagger';

import { authRouter } from './modules/auth/authController';
import { agentRouter } from './modules/agents/agentController';
import { toolRouter } from './modules/tools/toolController';
import { walletRouter } from './modules/wallet/walletController';
import { paypalRouter } from './modules/payments/paypalController';
import { creatorRouter } from './modules/creator/creatorController';
import { adminRouter } from './modules/admin/adminController';
import { agentWorkflowRouter } from './modules/ai-integration/plannerController';
import { demoRouter } from './modules/demo/demoTools';

export const app = express();

// Security Headers
app.use(helmet({
  contentSecurityPolicy: false, // Allow Swagger UI in dev
}));

// CORS Configuration
const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin || allowedOrigins.includes(origin) || env.APP_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy'));
      }
    },
    credentials: true,
  })
);

// Body Parsing & Cookie Parsing with bounded request size
app.use(express.json({ limit: env.MAX_REQUEST_SIZE }));
app.use(express.urlencoded({ extended: true, limit: env.MAX_REQUEST_SIZE }));
app.use(cookieParser());

// Request logging
app.use(requestLogger);

// Rate Limiting (PRD 7.1: Server-side rate limiting on auth, execution, and MCP endpoints)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later.',
    },
  },
});

const executionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 calls per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Execution rate limit exceeded.',
    },
  },
});

// Health check endpoint (PRD 15: Phase 1 exit criteria)
app.get(['/health', '/api/health'], (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: env.APP_ENV,
    version: '1.0.0',
  });
});

// OpenAPI Swagger UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

// Mount Application Routes
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/agents', agentRouter);
app.use('/api/tools', toolRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/calls', walletRouter); // Direct route alias for PRD 10
app.use('/api/paypal', paypalRouter);
app.use('/api/webhooks/paypal', paypalRouter); // Direct route alias for PRD 7.6
app.use('/api/creator', creatorRouter);
app.use('/api/admin', adminRouter);
app.use('/api/agent', agentWorkflowRouter);
app.use('/api/demo', executionLimiter, demoRouter);

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Requested API endpoint not found',
    },
  });
});

// Centralized Error Handler
app.use(errorHandler);
