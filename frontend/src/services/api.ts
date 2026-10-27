import {
  User,
  Wallet,
  Tool,
  Agent,
  AgentCredential,
  LedgerEntry,
  ToolCall,
  PlanResult,
  ReconciliationReport,
  AuditLog,
} from '../types';

const API_BASE = '/api';
const AI_BASE = '/ai-api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('tooltoll_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('tooltoll_token', token);
    } else {
      localStorage.removeItem('tooltoll_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    baseUrl: string = API_BASE
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok || (data && data.success === false)) {
      const errorMsg =
        data?.error?.message ||
        data?.detail ||
        `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    // Backend returns { success: true, data: T }, AI service returns raw JSON
    return data.data !== undefined ? data.data : data;
  }

  // --- Auth APIs ---
  async login(email: string, password: string): Promise<{ user: User; wallet: Wallet; token: string }> {
    const res = await this.request<{ user: User; wallet: Wallet; token: string }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
    this.setToken(res.token);
    return res;
  }

  async register(
    email: string,
    password: string,
    name: string,
    role: 'consumer' | 'creator' = 'consumer'
  ): Promise<{ user: User; wallet: Wallet; token: string }> {
    const res = await this.request<{ user: User; wallet: Wallet; token: string }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          name,
          isCreator: role === 'creator',
          isConsumer: true,
        }),
      }
    );
    this.setToken(res.token);
    return res;
  }

  async getCurrentUser(): Promise<{ user: User; wallet: Wallet }> {
    return this.request<{ user: User; wallet: Wallet }>('/auth/me');
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  // --- Marketplace & Tools APIs ---
  async getTools(params: { category?: string; query?: string } = {}): Promise<Tool[]> {
    const queryParams = new URLSearchParams();
    if (params.category && params.category !== 'All') queryParams.append('category', params.category);
    if (params.query) queryParams.append('query', params.query);
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/tools?${queryString}` : '/tools';
    return this.request<Tool[]>(endpoint);
  }

  async getToolDetails(id: string): Promise<Tool> {
    return this.request<Tool>(`/tools/${id}`);
  }

  async createTool(payload: Record<string, unknown>): Promise<Tool> {
    return this.request<Tool>('/tools', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateTool(id: string, payload: Record<string, unknown>): Promise<Tool> {
    return this.request<Tool>(`/tools/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async runToolTest(id: string, sampleInput: Record<string, unknown>): Promise<{
    status: string;
    durationMs: number;
    responseStatus: number;
    responseBody: unknown;
  }> {
    return this.request(`/tools/${id}/test`, {
      method: 'POST',
      body: JSON.stringify({ sampleInput }),
    });
  }

  async submitToolForReview(id: string): Promise<Tool> {
    return this.request<Tool>(`/tools/${id}/submit`, {
      method: 'POST',
    });
  }

  async executeToolCall(
    toolId: string,
    input: Record<string, unknown>,
    agentKey?: string
  ): Promise<{
    callId: string;
    status: string;
    result: unknown;
    priceMicroUsd: string;
  }> {
    const headers: Record<string, string> = {
      'Idempotency-Key': `web_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };
    if (agentKey) {
      headers['X-Agent-Key'] = agentKey;
    }
    return this.request(`/tools/${toolId}/calls`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ input }),
    });
  }

  // --- Agents APIs ---
  async getAgents(): Promise<Agent[]> {
    return this.request<Agent[]>('/agents');
  }

  async createAgent(payload: {
    name: string;
    description?: string;
    maxBudgetMicroUsd?: string;
    dailyBudgetMicroUsd?: string;
    monthlyBudgetMicroUsd?: string;
    allowedTools?: string[];
  }): Promise<Agent> {
    return this.request<Agent>('/agents', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async createAgentCredential(
    agentId: string,
    name = 'Primary Credential'
  ): Promise<{
    id: string;
    name: string;
    prefix: string;
    apiKey: string; // Plaintext shown ONCE
    scopes: string[];
    createdAt: string;
  }> {
    return this.request(`/agents/${agentId}/credentials`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async revokeAgentCredential(agentId: string, credentialId: string): Promise<void> {
    return this.request(`/agents/${agentId}/credentials/${credentialId}`, {
      method: 'DELETE',
    });
  }

  // --- AI Agent Planning & Orchestration ---
  async generateAgentPlan(task: string, agentId?: string): Promise<PlanResult> {
    return this.request<PlanResult>('/agent/plan', {
      method: 'POST',
      body: JSON.stringify({ task, agentId }),
    });
  }

  async executeAgentPlan(
    task: string,
    planSteps: unknown[],
    agentId: string
  ): Promise<{
    success: boolean;
    totalChargedMicroUsd: string;
    results: unknown[];
  }> {
    return this.request('/agent/execute', {
      method: 'POST',
      body: JSON.stringify({ task, steps: planSteps, agentId }),
    });
  }

  // --- Wallet & Billing ---
  async getWallet(): Promise<Wallet> {
    return this.request<Wallet>('/wallet');
  }

  async getTransactions(): Promise<LedgerEntry[]> {
    return this.request<LedgerEntry[]>('/wallet/transactions');
  }

  async mockTopup(amountMicroUsd: string): Promise<{ wallet: Wallet; message: string }> {
    return this.request('/wallet/topups', {
      method: 'POST',
      body: JSON.stringify({
        amountMicroUsd,
        provider: 'MOCK',
        referenceId: `mock_topup_${Date.now()}`,
      }),
    });
  }

  async createPaypalOrder(amountUsd: string): Promise<{ orderId: string; approvalUrl: string }> {
    return this.request('/paypal/orders', {
      method: 'POST',
      body: JSON.stringify({ amountUsd }),
    });
  }

  async capturePaypalOrder(orderId: string): Promise<{ wallet: Wallet; status: string }> {
    return this.request(`/paypal/orders/${orderId}/capture`, {
      method: 'POST',
    });
  }

  // --- Creator Studio ---
  async getCreatorEarnings(): Promise<{
    grossEarningsMicroUsd: string;
    platformFeeMicroUsd: string;
    netEarningsMicroUsd: string;
    withdrawnMicroUsd: string;
    pendingPayoutMicroUsd: string;
    availablePayoutMicroUsd: string;
  }> {
    return this.request('/creator/earnings');
  }

  async requestPayout(amountMicroUsd: string, paypalEmail: string): Promise<{
    payoutId: string;
    status: string;
    amountMicroUsd: string;
  }> {
    return this.request('/creator/payouts', {
      method: 'POST',
      body: JSON.stringify({ amountMicroUsd, paypalEmail }),
    });
  }

  // --- Admin Governance ---
  async getPendingTools(): Promise<Tool[]> {
    return this.request<Tool[]>('/admin/tools/pending');
  }

  async approveTool(toolId: string, reason = 'Meets platform standards'): Promise<Tool> {
    return this.request<Tool>(`/admin/tools/${toolId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async rejectTool(toolId: string, reason: string): Promise<Tool> {
    return this.request<Tool>(`/admin/tools/${toolId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async suspendTool(toolId: string, reason: string): Promise<Tool> {
    return this.request<Tool>(`/admin/tools/${toolId}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getReconciliationReport(): Promise<ReconciliationReport> {
    return this.request<ReconciliationReport>('/admin/reconciliation');
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    return this.request<AuditLog[]>('/admin/audit-logs');
  }

  async updatePlatformCommission(platformFeeBps: number): Promise<{ platformFeeBps: number }> {
    return this.request('/admin/commission', {
      method: 'PUT',
      body: JSON.stringify({ platformFeeBps }),
    });
  }

  // --- AI Service Direct Endpoints ---
  async aiDiscoverTools(task: string, maxPriceMicroUsd?: number): Promise<{
    results: Array<{
      tool_id: string;
      name: string;
      category: string;
      score: number;
      price_micro_usd: number;
      explanation: string;
    }>;
  }> {
    return this.request(
      '/tools/discover',
      {
        method: 'POST',
        body: JSON.stringify({ task, max_price_micro_usd: maxPriceMicroUsd, limit: 5 }),
      },
      AI_BASE
    );
  }

  async aiSuggestPrice(payload: {
    category: string;
    latency_ms_estimate?: number;
    description: string;
  }): Promise<{
    suggested_price_micro_usd: number;
    suggested_price_usd: number;
    reasoning: string;
  }> {
    return this.request(
      '/advisor/suggest-price',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      AI_BASE
    );
  }

  async aiOnboardDraft(documentationText: string): Promise<{
    draft: Record<string, unknown>;
    warnings: string[];
  }> {
    return this.request(
      '/onboarding/draft',
      {
        method: 'POST',
        body: JSON.stringify({ documentation_text: documentationText }),
      },
      AI_BASE
    );
  }
}

export const api = new ApiService();
