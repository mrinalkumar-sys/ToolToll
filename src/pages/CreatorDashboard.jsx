import React, { useState, useEffect } from 'react';
import {
  Plus,
  Play,
  AlertCircle,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Badge } from '../components/Badge.jsx';
import { Modal } from '../components/Modal.jsx';

export const CreatorDashboard = () => {
  const [tools, setTools] = useState([]);
  const [earnings, setEarnings] = useState(null);

  // New Tool Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    short_desc: '',
    detailed_desc: '',
    category: 'nlp',
    tags: 'ai, utility',
    base_url: 'https://api.internal-demo.tooltoll.io',
    endpoint_path: '/v1/my-tool',
    http_method: 'POST',
    input_schema: JSON.stringify(
      {
        type: 'object',
        properties: {
          input_text: { type: 'string', description: 'Input text to process' },
        },
        required: ['input_text'],
      },
      null,
      2
    ),
    output_schema: JSON.stringify(
      {
        type: 'object',
        properties: {
          result: { type: 'string' },
        },
      },
      null,
      2
    ),
    auth_type: 'none',
    upstream_secret: '',
    header_name: 'X-API-Key',
    price_per_call: '0.0150',
    currency: 'USD',
    timeout_seconds: 15,
    rate_limit_per_minute: 60,
    terms_of_use: 'Standard API fair use policy',
    creator_contact: 'dev@myapi.io',
  });
  const [formError, setFormError] = useState(null);
  const [creating, setCreating] = useState(false);

  // Test Runner state for a specific tool
  const [testingTool, setTestingTool] = useState(null);
  const [sampleInputStr, setSampleInputStr] = useState('{"input_text": "Hello world"}');
  const [testResult, setTestResult] = useState(null);
  const [testRunning, setTestRunning] = useState(false);

  useEffect(() => {
    loadCreatorData();
  }, []);

  const loadCreatorData = async () => {
    try {
      const [t, e] = await Promise.all([
        api.getTools({ mine: true }),
        api.getCreatorEarnings(),
      ]);
      setTools(t);
      setEarnings(e);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setCreating(true);
    try {
      let parsedInput, parsedOutput;
      try {
        parsedInput = JSON.parse(formData.input_schema);
      } catch {
        throw new Error('Input schema is not valid JSON');
      }
      try {
        parsedOutput = formData.output_schema ? JSON.parse(formData.output_schema) : undefined;
      } catch {
        throw new Error('Output schema is not valid JSON');
      }

      const payload = {
        name: formData.name,
        short_desc: formData.short_desc,
        detailed_desc: formData.detailed_desc,
        category: formData.category,
        tags: formData.tags.split(',').map((s) => s.trim()).filter(Boolean),
        base_url: formData.base_url,
        endpoint_path: formData.endpoint_path,
        http_method: formData.http_method,
        input_schema: parsedInput,
        output_schema: parsedOutput,
        auth_type: formData.auth_type,
        upstream_secret: formData.upstream_secret || undefined,
        header_name: formData.header_name,
        price_per_call: parseFloat(formData.price_per_call),
        currency: formData.currency,
        timeout_seconds: Number(formData.timeout_seconds),
        rate_limit_per_minute: Number(formData.rate_limit_per_minute),
        terms_of_use: formData.terms_of_use,
        creator_contact: formData.creator_contact,
      };

      await api.createTool(payload);
      setIsCreateOpen(false);
      await loadCreatorData();
    } catch (err) {
      setFormError(err.message || 'Failed to register API tool');
    } finally {
      setCreating(false);
    }
  };

  const handleRunControlledTest = async () => {
    if (!testingTool) return;
    setTestRunning(true);
    setTestResult(null);
    try {
      const parsed = JSON.parse(sampleInputStr);
      const res = await api.testTool(testingTool.id, parsed);
      setTestResult(res);
      await loadCreatorData();
    } catch (err) {
      setTestResult({ is_successful: false, error_message: err.message });
    } finally {
      setTestRunning(false);
    }
  };

  const handleSubmitForApproval = async (toolId) => {
    try {
      await api.submitTool(toolId);
      await loadCreatorData();
    } catch (err) {
      alert(err.message || 'Submission failed');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-900">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">API Creator Studio</h1>
          <p className="text-xs text-slate-400">
            Register, validate, test, and monetize your APIs for autonomous AI agents.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-md shadow-indigo-600/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Register New API Tool
        </button>
      </div>

      {/* Creator Earnings Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Net Creator Earnings</span>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            ${Number(earnings?.net_earnings || 0).toFixed(4)}
          </div>
          <span className="text-[11px] text-slate-500">85% net creator payout pool</span>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Gross Platform Volume</span>
          <div className="text-2xl font-bold text-slate-200 font-mono">
            ${Number(earnings?.gross_earnings || 0).toFixed(4)}
          </div>
          <span className="text-[11px] text-slate-500">Platform commission: 15%</span>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Total Paid Calls Handled</span>
          <div className="text-2xl font-bold text-cyan-400 font-mono">
            {earnings?.total_calls || 0}
          </div>
          <span className="text-[11px] text-slate-500">Empirically recorded on-ledger calls</span>
        </div>
      </div>

      {/* Tool Listings Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden space-y-4">
        <div className="p-6 pb-0 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-white">My Registered Tool Endpoints</h3>
          <span className="text-xs text-slate-500">{tools.length} total listings</span>
        </div>

        <div className="overflow-x-auto">
          {tools.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              You haven't registered any tools yet. Click "Register New API Tool" to get started!
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Tool Name</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Price / Call</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Telemetry</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {tools.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4 font-semibold text-white">
                      <div>{t.name}</div>
                      <div className="text-[10px] font-mono text-slate-500">{t.base_url}{t.endpoint_path}</div>
                    </td>
                    <td className="px-6 py-4 capitalize text-slate-400">{t.category}</td>
                    <td className="px-6 py-4 font-mono font-bold text-emerald-400">
                      ${Number(t.price_per_call).toFixed(4)}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          t.status === 'approved'
                            ? 'success'
                            : t.status === 'pending_approval'
                            ? 'warning'
                            : t.status === 'rejected'
                            ? 'danger'
                            : 'default'
                        }
                      >
                        {t.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-[11px] text-slate-400">
                      {t.total_calls} calls ({t.success_calls} successful)
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setTestingTool(t);
                          setTestResult(null);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition text-[11px] font-semibold cursor-pointer"
                      >
                        Run Test
                      </button>

                      {t.status === 'draft' && (
                        <button
                          onClick={() => handleSubmitForApproval(t.id)}
                          className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition text-[11px] font-semibold cursor-pointer"
                        >
                          Submit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Register Tool Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Register New API Tool"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Tool Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Geolocation IP Lookup"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 outline-none capitalize"
              >
                <option value="nlp">NLP</option>
                <option value="security">Security</option>
                <option value="translation">Translation</option>
                <option value="finance">Finance</option>
                <option value="analytics">Analytics</option>
                <option value="utility">Utility</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Short Description (for Agent Discovery)</label>
            <input
              type="text"
              required
              value={formData.short_desc}
              onChange={(e) => setFormData({ ...formData, short_desc: e.target.value })}
              placeholder="Resolves IP addresses into country, city, and ISP with 99.9% accuracy"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-slate-300 font-semibold mb-1">Base URL (Protected against SSRF)</label>
              <input
                type="url"
                required
                value={formData.base_url}
                onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                placeholder="https://api.mytool.com"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Endpoint Path</label>
              <input
                type="text"
                required
                value={formData.endpoint_path}
                onChange={(e) => setFormData({ ...formData, endpoint_path: e.target.value })}
                placeholder="/v1/lookup"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Authentication Method</label>
              <select
                value={formData.auth_type}
                onChange={(e) => setFormData({ ...formData, auth_type: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 outline-none"
              >
                <option value="none">No Auth</option>
                <option value="api_key_header">API Key Header</option>
                <option value="bearer_token">Bearer Token</option>
              </select>
            </div>

            {formData.auth_type !== 'none' && (
              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">
                  Upstream Credential (AES-256 Encrypted)
                </label>
                <input
                  type="password"
                  value={formData.upstream_secret}
                  onChange={(e) => setFormData({ ...formData, upstream_secret: e.target.value })}
                  placeholder="Secret key or token (encrypted before saving)"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 outline-none"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Price Per Call (USD)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                required
                value={formData.price_per_call}
                onChange={(e) => setFormData({ ...formData, price_per_call: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Timeout (Seconds)</label>
              <input
                type="number"
                min="1"
                max="60"
                required
                value={formData.timeout_seconds}
                onChange={(e) => setFormData({ ...formData, timeout_seconds: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="nlp, search, analytics"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Input JSON Schema</label>
            <textarea
              rows={4}
              required
              value={formData.input_schema}
              onChange={(e) => setFormData({ ...formData, input_schema: e.target.value })}
              className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full py-2.5 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 cursor-pointer"
          >
            {creating ? 'Saving and Validating...' : 'Register API Tool'}
          </button>
        </form>
      </Modal>

      {/* Controlled Test Runner Modal */}
      {testingTool && (
        <Modal
          isOpen={!!testingTool}
          onClose={() => setTestingTool(null)}
          title={`Controlled Test: ${testingTool.name}`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-400">
              Run a verified test call against this endpoint before submitting it for platform moderation.
            </p>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Sample Input Parameters (JSON):</label>
              <textarea
                rows={3}
                value={sampleInputStr}
                onChange={(e) => setSampleInputStr(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={handleRunControlledTest}
              disabled={testRunning}
              className="w-full py-2 rounded-lg font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              {testRunning ? 'Testing Endpoint...' : 'Execute Controlled Test'}
            </button>

            {testResult && (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Test Outcome:</span>
                  <Badge variant={testResult.is_successful ? 'success' : 'danger'}>
                    {testResult.is_successful ? 'Passed' : 'Failed'}
                  </Badge>
                </div>
                {testResult.response_status && (
                  <div className="text-[11px] text-slate-400">
                    HTTP Status: <span className="font-mono text-white">{testResult.response_status}</span> • Latency:{' '}
                    <span className="font-mono text-white">{testResult.latency_ms?.toFixed(0)}ms</span>
                  </div>
                )}
                {testResult.error_message && (
                  <div className="text-[11px] text-rose-400">{testResult.error_message}</div>
                )}
                {testResult.response_body && (
                  <pre className="p-2 rounded bg-slate-900 text-[10px] text-slate-300 font-mono overflow-x-auto max-h-32">
                    {testResult.response_body}
                  </pre>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
