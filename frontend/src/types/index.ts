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

export interface ToolEndpoint {
  id: string;
  toolId: string;
  name: string;
  description?: string;
  endpointPath: string;
  httpMethod: string;
  inputSchema: Record<string, unknown>;
  exampleRequest?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  exampleResponse?: Record<string, unknown>;
  authMethod: string;
  authHeaderName?: string;
  priceMicroUsd: string;
  currency?: string;
  timeoutMs?: number;
  status: ToolStatus;
  isPrimary?: boolean;
  createdAt: string;
  updatedAt: string;
  toolName?: string;
}

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
  shortDescription?: string;
  detailedDescription?: string;
  exampleRequest?: Record<string, unknown>;
  exampleResponse?: Record<string, unknown>;
  endpoints?: ToolEndpoint[];
  endpointCount?: number;
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

export interface QualityJudgeResult {
  call_id?: string | null;
  tool_id?: string;
  tool_name?: string;
  verdict: 'ok' | 'bad';
  reason: string;
  confidence: number;
  quality_score?: number;
  evaluation_stage: string;
  evaluation_status: string;
  refund_recommended: boolean;
  reliability_status?: 'passed' | 'failed' | 'warning';
  schema_compliant?: boolean;
  schema_details?: string;
  semantic_relevance?: 'high' | 'moderate' | 'low' | 'mismatch';
  semantic_explanation?: string;
  latency_acceptable?: boolean;
  measured_latency_ms?: number;
  sla_threshold_ms?: number;
  http_status?: number;
  issues_found?: Array<{ title: string; evidence: string; severity: 'critical' | 'warning' | 'info' }>;
  actionable_recommendations?: string[];
  evaluated_at?: string;
  is_simulated?: boolean;
}

export interface AIPlanResponse {
  task: string;
  is_achievable: boolean;
  impossibility_reason?: string | null;
  plan_explanation: string;
  steps: Array<{
    step_id: string;
    tool_id: string;
    tool_name: string;
    explanation: string;
    input_parameters: Record<string, any>;
    depends_on_step_ids: string[];
    estimated_cost_usd: number;
  }>;
  total_estimated_cost_usd: number;
  total_estimated_cost_micro_dollars: number;
  step_count: number;
  requires_human_approval: boolean;
  approval_reason?: string | null;
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

export interface RefundEligibility {
  callId: string;
  toolName: string;
  originalChargeMicroUsd: string;
  refundableAmountMicroUsd: string;
  isEligible: boolean;
  status: 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'REFUNDED' | 'PENDING_REVIEW';
  reason: string;
  alreadyRefunded: boolean;
}

export interface RefundResult {
  callId: string;
  status: 'REFUNDED';
  alreadyRefunded: boolean;
  refundedAmountMicroUsd: string;
  newBalanceMicroUsd: string;
  message: string;
}

export interface AdminCreatorListing {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  totalNetEarningsMicroUsd: string;
  totalGrossEarningsMicroUsd: string;
  totalTools: number;
  tools: Array<{
    id: string;
    name: string;
    slug: string;
    category: string;
    shortDescription?: string;
    baseUrl?: string;
    endpointPath?: string;
    httpMethod?: string;
    priceMicroUsd: string;
    status: string;
    callsCount: number;
    createdAt?: string;
  }>;
}

export interface AdminConsumerListing {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  walletBalanceMicroUsd: string;
  walletReservedMicroUsd: string;
  agentsCount: number;
  agents: Array<{
    id: string;
    name: string;
    isActive: boolean;
    totalCalls?: number;
  }>;
  totalCallsCount: number;
  successfulCallsCount: number;
  totalSpentMicroUsd: string;
}

export interface AdminTransaction {
  id: string;
  toolId?: string;
  toolName: string;
  toolSlug: string;
  category: string;
  creatorName: string;
  creatorEmail: string;
  consumerName: string;
  consumerEmail: string;
  agentName: string;
  priceMicroUsd: string;
  platformFeeMicroUsd: string;
  creatorEarningsMicroUsd: string;
  platformFeeBps?: number;
  status: string;
  latencyMs?: number;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalCreators?: number;
  totalConsumers?: number;
  totalTools: number;
  pendingTools?: number;
  totalCalls: number;
  totalGrossMicroUsd: string;
  totalPlatformRevenueMicroUsd: string;
  totalConsumerBalanceMicroUsd?: string;
  totalReservedMicroUsd?: string;
}


// ==========================================
// APIMatic API Onboarding & Validation Types
// ==========================================

export interface ApimaticValidationIssue {
  code: string;
  message: string;
  path?: string;
  severity: 'error' | 'warning';
  suggestion?: string;
}

export interface ApimaticEndpointSummary {
  path: string;
  method: string;
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  exampleRequest?: Record<string, unknown>;
  exampleResponse?: Record<string, unknown>;
  authRequired: boolean;
  authType: 'NONE' | 'API_KEY_HEADER' | 'BEARER_TOKEN' | 'BASIC_AUTH';
  authHeaderName?: string;
  parametersCount: number;
  hasInputSchema: boolean;
  hasOutputSchema: boolean;
  priceMicroUsd: string;
  timeoutMs: number;
  isPrimary: boolean;
}

export interface ApimaticValidationReport {
  engine: 'apimatic_cloud' | 'apimatic_local_engine';
  engineDetails: string;
  isValid: boolean;
  status: 'VALID' | 'WARNINGS' | 'INVALID';
  specTitle: string;
  specVersion: string;
  summary: {
    totalIssues: number;
    errorsCount: number;
    warningsCount: number;
    successfulChecksCount: number;
    endpointsCount: number;
  };
  errors: ApimaticValidationIssue[];
  warnings: ApimaticValidationIssue[];
  successfulChecks: Array<{ check: string; description: string }>;
  endpointDetails: ApimaticEndpointSummary[];
  schemaIssues: Array<{ schemaName: string; issue: string; severity: 'error' | 'warning' }>;
  apimaticNotice?: string;
}

export interface ToolTollDraftConfig {
  name: string;
  slug: string;
  shortDescription: string;
  detailedDescription: string;
  category: string;
  tags: string[];
  baseUrl: string;
  endpointPath: string;
  httpMethod: string;
  authMethod: 'NONE' | 'API_KEY_HEADER' | 'BEARER_TOKEN' | 'BASIC_AUTH';
  authHeaderName?: string;
  priceMicroUsd: string;
  timeoutMs: number;
  endpoints: ApimaticEndpointSummary[];
  rawSpecFormat: 'json' | 'yaml';
  specVersion: string;
}

export interface SdkGenerationResult {
  language: string;
  filename: string;
  code: string;
}
