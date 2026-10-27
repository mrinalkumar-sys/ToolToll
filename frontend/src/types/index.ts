export type UserRole = 'consumer' | 'creator' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  isCreator: boolean;
  isConsumer: boolean;
  isAdmin: boolean;
  createdAt?: string;
}

export interface Wallet {
  id: string;
  balance: string; // Micro-USD as string
  currency: string;
  reservedBalance?: string;
}

export type ToolStatus =
  | 'DRAFT'
  | 'TESTING'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'PAUSED'
  | 'RETIRED';

export interface ToolVersion {
  version: number;
  priceMicroUsd: string;
  createdAt: string;
}

export interface Tool {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  tags: string[];
  baseUrl: string;
  endpointPath: string;
  httpMethod: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  priceMicroUsd: string;
  timeoutMs: number;
  rateLimitRpm: number;
  status: ToolStatus;
  version: number;
  isDemo?: boolean;
  creatorId: string;
  creator?: {
    id: string;
    name: string;
    email: string;
  };
  versions?: ToolVersion[];
  testRuns?: ToolTestRun[];
  metrics?: {
    avgLatencyMs: number;
    successRate: number;
    totalCalls: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ToolTestRun {
  id: string;
  toolId: string;
  status: string;
  durationMs: number;
  responseStatus: number;
  errorMessage?: string;
  createdAt: string;
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  description?: string;
  maxBudgetMicroUsd: string;
  dailyBudgetMicroUsd: string;
  monthlyBudgetMicroUsd: string;
  allowedTools: string[];
  status: string;
  credentials?: AgentCredential[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentCredential {
  id: string;
  prefix: string;
  name: string;
  scopes: string[];
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  walletId: string;
  entryType: 'CREDIT' | 'DEBIT';
  referenceType: string;
  referenceId: string;
  amount: string;
  runningBalance: string;
  description?: string;
  createdAt: string;
}

export interface ToolCall {
  id: string;
  agentId: string;
  toolId: string;
  status: 'PENDING' | 'RESERVED' | 'SUCCESS' | 'FAILED' | 'REVERSED';
  priceMicroUsd: string;
  platformFeeMicroUsd: string;
  creatorEarningsMicroUsd: string;
  idempotencyKey: string;
  inputPayload?: Record<string, unknown>;
  outputPayload?: Record<string, unknown>;
  latencyMs?: number;
  httpStatus?: number;
  reversalReason?: string;
  createdAt: string;
  completedAt?: string;
  tool?: {
    name: string;
    slug: string;
    category: string;
  };
  agent?: {
    name: string;
  };
}

export interface PlanStep {
  step: number;
  toolId: string;
  toolName: string;
  toolSlug: string;
  priceMicroUsd: string;
  inputMapping: Record<string, unknown>;
  reason: string;
}

export interface PlanResult {
  task: string;
  planId?: string;
  steps: PlanStep[];
  estimatedCostMicroUsd: string;
  estimatedCostUsd: string;
  approvalRequired: boolean;
  warnings?: string[];
}

export interface StepExecutionResult {
  step: number;
  toolName: string;
  callId: string;
  status: string;
  costMicroUsd: string;
  durationMs: number;
  output: Record<string, unknown>;
  qualityCheckPassed: boolean;
}

export interface ReconciliationReport {
  totalDeposited: string;
  totalWalletsBalance: string;
  totalReservedBalance: string;
  totalPlatformRevenue: string;
  totalCreatorPayable: string;
  totalSystemLiabilities: string;
  isBalanced: boolean;
  discrepancyMicroUsd: string;
  generatedAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}
