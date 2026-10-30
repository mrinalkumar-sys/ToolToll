const API_BASE = '/api';

function getAuthHeader() {
  const token = localStorage.getItem('tooltoll_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse(res) {
  if (!res.ok) {
    let errMsg = `Request failed (${res.status})`;
    try {
      const errData = await res.json();
      if (errData.detail) {
        errMsg = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }
  return res.json();
}

export const api = {
  // Auth
  async register(data) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async login(data) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  // Tools
  async getTools(params) {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.mine) query.append('mine', 'true');
    const res = await fetch(`${API_BASE}/tools?${query.toString()}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async searchTools(params = {}) {
    const query = new URLSearchParams();
    if (params.q) query.append('q', params.q);
    if (params.category) query.append('category', params.category);
    if (params.max_price !== undefined) query.append('max_price', params.max_price.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    const res = await fetch(`${API_BASE}/tools/search?${query.toString()}`);
    return handleResponse(res);
  },

  async getTool(id) {
    const res = await fetch(`${API_BASE}/tools/${id}`);
    return handleResponse(res);
  },

  async createTool(data) {
    const res = await fetch(`${API_BASE}/tools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateTool(id, data) {
    const res = await fetch(`${API_BASE}/tools/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async testTool(id, sampleInput) {
    const res = await fetch(`${API_BASE}/tools/${id}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ sample_input: sampleInput }),
    });
    return handleResponse(res);
  },

  async submitTool(id) {
    const res = await fetch(`${API_BASE}/tools/${id}/submit`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async executeToolDirect(toolId, inputData, idempotencyKey) {
    const res = await fetch(`${API_BASE}/tools/${toolId}/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ tool_id: toolId, input_data: inputData, idempotency_key: idempotencyKey }),
    });
    return handleResponse(res);
  },

  // Agents
  async getAgents() {
    const res = await fetch(`${API_BASE}/agents`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async getAgent(id) {
    const res = await fetch(`${API_BASE}/agents/${id}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async createAgent(data) {
    const res = await fetch(`${API_BASE}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateAgent(id, data) {
    const res = await fetch(`${API_BASE}/agents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async getAgentCredentials(agentId) {
    const res = await fetch(`${API_BASE}/agents/${agentId}/credentials`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async issueAgentCredential(agentId, data) {
    const res = await fetch(`${API_BASE}/agents/${agentId}/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async revokeAgentCredential(agentId, credentialId) {
    const res = await fetch(`${API_BASE}/agents/${agentId}/credentials/${credentialId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async getAgentPermissions(agentId) {
    const res = await fetch(`${API_BASE}/agents/${agentId}/permissions`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async updateAgentPermissions(agentId, permissions) {
    const res = await fetch(`${API_BASE}/agents/${agentId}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ permissions }),
    });
    return handleResponse(res);
  },

  // Agent AI Discovery & Execution
  async planAgentTask(data) {
    const res = await fetch(`${API_BASE}/agent/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async executeAgentTask(data) {
    const res = await fetch(`${API_BASE}/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // Wallet & Payments
  async getWallet() {
    const res = await fetch(`${API_BASE}/wallet`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async getTransactions(limit = 50) {
    const res = await fetch(`${API_BASE}/wallet/transactions?limit=${limit}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async createPayPalOrder(amount, paymentProvider = 'mock') {
    const res = await fetch(`${API_BASE}/paypal/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ amount, payment_provider: paymentProvider }),
    });
    return handleResponse(res);
  },

  async capturePayPalOrder(orderId) {
    const res = await fetch(`${API_BASE}/paypal/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async getCallHistory(limit = 50) {
    const res = await fetch(`${API_BASE}/calls?limit=${limit}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async getCreatorEarnings() {
    const res = await fetch(`${API_BASE}/creator/earnings`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async requestCreatorPayout(data) {
    const res = await fetch(`${API_BASE}/creator/payouts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // Admin
  async getPendingTools() {
    const res = await fetch(`${API_BASE}/admin/tools/pending`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async reviewTool(toolId, action, reason) {
    const res = await fetch(`${API_BASE}/admin/tools/${toolId}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ action, reason }),
    });
    return handleResponse(res);
  },

  async getAdminStats() {
    const res = await fetch(`${API_BASE}/admin/stats`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async getAdminAuditLogs(limit = 50) {
    const res = await fetch(`${API_BASE}/admin/audit-logs?limit=${limit}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },
};
