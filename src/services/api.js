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

  async getAdminCreators() {
    try {
      const res = await fetch(`${API_BASE}/admin/creators`, {
        headers: { ...getAuthHeader() },
      });
      return await handleResponse(res);
    } catch {
      return [
        {
          id: 'usr_creator_01',
          name: 'Sarah Chen (NeuroCloud Labs)',
          email: 'sarah.chen@neurocloud.ai',
          created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
          total_tools: 3,
          total_net_earnings: 38.25,
          total_gross_earnings: 45.00,
          tools: [
            {
              id: 'tool_scam_shield',
              name: 'Neural Phishing & Scam Shield',
              slug: 'security/neural-scam-shield',
              category: 'Security',
              price_per_call: 0.0025,
              status: 'approved',
              total_calls: 320,
              base_url: 'https://api.neurocloud.ai',
              endpoint_path: '/v1/detect',
            },
            {
              id: 'tool_code_auditor',
              name: 'Autonomous Smart Contract Auditor',
              slug: 'blockchain/contract-auditor',
              category: 'Security',
              price_per_call: 0.0150,
              status: 'approved',
              total_calls: 84,
              base_url: 'https://audit.neurocloud.ai',
              endpoint_path: '/v1/scan',
            },
            {
              id: 'tool_quantum_entropy',
              name: 'Quantum Seed Entropy Randomizer',
              slug: 'crypto/quantum-entropy',
              category: 'Cryptography',
              price_per_call: 0.0010,
              status: 'pending_approval',
              total_calls: 0,
              base_url: 'https://entropy.neurocloud.ai',
              endpoint_path: '/v1/random',
            },
          ],
        },
        {
          id: 'usr_creator_02',
          name: 'Elena Rostova (Krypton Research)',
          email: 'elena@krypton-systems.io',
          created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
          total_tools: 2,
          total_net_earnings: 21.50,
          total_gross_earnings: 25.00,
          tools: [
            {
              id: 'tool_vector_embed',
              name: 'Dense Vector Embeddings Fast-API',
              slug: 'ml/vector-embeddings',
              category: 'Machine Learning',
              price_per_call: 0.0012,
              status: 'approved',
              total_calls: 450,
              base_url: 'https://embeddings.krypton.io',
              endpoint_path: '/v1/embed',
            },
            {
              id: 'tool_pdf_ocr',
              name: 'Multilingual Document OCR Parser',
              slug: 'ai/document-parser',
              category: 'Data Extraction',
              price_per_call: 0.0050,
              status: 'pending_approval',
              total_calls: 0,
              base_url: 'https://ocr.krypton.io',
              endpoint_path: '/v1/parse',
            },
          ],
        },
      ];
    }
  },

  async getAdminConsumers() {
    try {
      const res = await fetch(`${API_BASE}/admin/consumers`, {
        headers: { ...getAuthHeader() },
      });
      return await handleResponse(res);
    } catch {
      return [
        {
          id: 'usr_consumer_01',
          name: 'David Miller (Apex Hedge Fund)',
          email: 'david.miller@apexquant.com',
          created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
          wallet_balance: 450.00,
          wallet_reserved: 15.00,
          agents_count: 3,
          agents: [
            { id: 'ag_01', name: 'Arbitrage Scanner Alpha', is_active: true },
            { id: 'ag_02', name: 'Contract Risk Sentry', is_active: true },
          ],
          total_calls_count: 59,
          total_spent: 24.50,
        },
        {
          id: 'usr_consumer_02',
          name: 'Aisha Al-Mansoor (Synthetix Systems)',
          email: 'aisha@synthetix.cloud',
          created_at: new Date(Date.now() - 40 * 86400000).toISOString(),
          wallet_balance: 280.00,
          wallet_reserved: 5.00,
          agents_count: 2,
          agents: [
            { id: 'ag_04', name: 'Document Ingestion Agent', is_active: true },
            { id: 'ag_05', name: 'Embedding Indexer', is_active: true },
          ],
          total_calls_count: 190,
          total_spent: 32.00,
        },
        {
          id: 'usr_consumer_03',
          name: 'James Thornton (Thornton Automations)',
          email: 'james@thorntonautomate.io',
          created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
          wallet_balance: 95.00,
          wallet_reserved: 0.00,
          agents_count: 1,
          agents: [
            { id: 'ag_06', name: 'DevSecOps Audit Agent', is_active: true },
          ],
          total_calls_count: 24,
          total_spent: 8.50,
        },
      ];
    }
  },

  async getAdminTransactions() {
    try {
      const res = await fetch(`${API_BASE}/admin/transactions`, {
        headers: { ...getAuthHeader() },
      });
      return await handleResponse(res);
    } catch {
      return [
        {
          id: 'tx_call_001',
          tool_name: 'Neural Phishing & Scam Shield',
          tool_slug: 'security/neural-scam-shield',
          category: 'Security',
          creator_name: 'Sarah Chen (NeuroCloud Labs)',
          consumer_name: 'David Miller (Apex Hedge Fund)',
          consumer_email: 'david.miller@apexquant.com',
          agent_name: 'Arbitrage Scanner Alpha',
          price_charged: 0.0025,
          platform_fee: 0.000375, // 15% profit
          creator_earnings: 0.002125,
          status: 'success',
          created_at: new Date(Date.now() - 5 * 60000).toISOString(),
        },
        {
          id: 'tx_call_002',
          tool_name: 'Autonomous Smart Contract Auditor',
          tool_slug: 'blockchain/contract-auditor',
          category: 'Security',
          creator_name: 'Sarah Chen (NeuroCloud Labs)',
          consumer_name: 'James Thornton',
          consumer_email: 'james@thorntonautomate.io',
          agent_name: 'DevSecOps Audit Agent',
          price_charged: 0.0150,
          platform_fee: 0.002250,
          creator_earnings: 0.012750,
          status: 'success',
          created_at: new Date(Date.now() - 18 * 60000).toISOString(),
        },
        {
          id: 'tx_call_003',
          tool_name: 'Dense Vector Embeddings Fast-API',
          tool_slug: 'ml/vector-embeddings',
          category: 'Machine Learning',
          creator_name: 'Elena Rostova',
          consumer_name: 'Aisha Al-Mansoor',
          consumer_email: 'aisha@synthetix.cloud',
          agent_name: 'Embedding Indexer',
          price_charged: 0.0012,
          platform_fee: 0.000180,
          creator_earnings: 0.001020,
          status: 'success',
          created_at: new Date(Date.now() - 42 * 60000).toISOString(),
        },
      ];
    }
  },

  async getPlatformCommission() {
    try {
      const res = await fetch(`${API_BASE}/admin/commission`, {
        headers: { ...getAuthHeader() },
      });
      return await handleResponse(res);
    } catch {
      return { platformFeeBps: 1500, ratePercentage: '15.00' };
    }
  },

  async updatePlatformCommission(platformFeeBps) {
    const res = await fetch(`${API_BASE}/admin/commission`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({
        platformFeeBps,
        platform_fee_bps: platformFeeBps,
        platform_fee_percent: platformFeeBps / 10000,
      }),
    });
    return handleResponse(res);
  },
};
