import React, { useState, useEffect } from 'react';
import {
  Search,
  ExternalLink,
  Code,
  Play,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Badge } from '../components/Badge.jsx';
import { Modal } from '../components/Modal.jsx';

export const MarketplacePage = () => {
  const [tools, setTools] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [maxPrice, setMaxPrice] = useState(0.1);
  const [loading, setLoading] = useState(true);

  // Selected Tool for Inspection Modal
  const [selectedTool, setSelectedTool] = useState(null);
  const [testInputJson, setTestInputJson] = useState('{}');
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    fetchMarketplaceTools();
  }, [selectedCategory, maxPrice]);

  const fetchMarketplaceTools = async () => {
    setLoading(true);
    try {
      const data = await api.searchTools({
        q: searchQuery || undefined,
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        max_price: maxPrice,
        limit: 50,
      });
      setTools(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchMarketplaceTools();
  };

  const handleOpenToolDetails = (t) => {
    setSelectedTool(t);
    // Generate sample input skeleton from schema properties
    if (t.input_schema?.properties) {
      const skeleton = {};
      Object.keys(t.input_schema.properties).forEach((k) => {
        skeleton[k] = t.input_schema.properties[k].default || 'sample';
      });
      setTestInputJson(JSON.stringify(skeleton, null, 2));
    } else {
      setTestInputJson('{}');
    }
    setTestResult(null);
  };

  const handleRunSampleExecution = async () => {
    if (!selectedTool) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const parsed = JSON.parse(testInputJson);
      const res = await api.executeToolDirect(selectedTool.id, parsed, `test_exec_${Date.now()}`);
      setTestResult(res);
    } catch (err) {
      setTestResult({ error: err.message || 'Execution failed' });
    } finally {
      setTestLoading(false);
    }
  };

  const categories = ['all', 'translation', 'security', 'nlp', 'finance', 'analytics'];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white tracking-tight">API Tool Marketplace</h1>
        <p className="text-xs text-slate-400">
          Discover verified APIs ready for autonomous AI agent invocation. Transparent pay-per-use rates.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by capability, keywords (e.g. translation, scam risk, sentiment)..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs text-slate-200 placeholder-slate-600 outline-none transition"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            Search
          </button>
        </form>

        {/* Category Chips & Price Slider */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/60 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-500 text-[11px] mr-1">Category:</span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs capitalize transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-[11px]">Max Price:</span>
            <input
              type="range"
              min="0.005"
              max="0.100"
              step="0.005"
              value={maxPrice}
              onChange={(e) => setMaxPrice(parseFloat(e.target.value))}
              className="w-24 accent-indigo-500 cursor-pointer"
            />
            <span className="font-mono text-emerald-400 font-semibold">${maxPrice.toFixed(3)}</span>
          </div>
        </div>
      </div>

      {/* Tool Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-500 animate-pulse">
          Searching marketplace tools...
        </div>
      ) : tools.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 space-y-2">
          <p className="text-sm font-semibold text-slate-300">No tools match your search criteria</p>
          <p className="text-xs text-slate-500">Try adjusting your filters or resetting the search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((t) => {
            const reliability = t.total_calls > 0 ? ((t.success_calls / t.total_calls) * 100).toFixed(0) : '100';
            return (
              <div
                key={t.id}
                className="rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition p-6 flex flex-col justify-between group shadow-lg hover:shadow-indigo-950/20"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h3 className="font-bold text-white text-base group-hover:text-indigo-300 transition">
                        {t.name}
                      </h3>
                      <Badge variant="purple" className="text-[10px] py-0 capitalize">
                        {t.category}
                      </Badge>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald-400 font-mono">
                        ${Number(t.price_per_call).toFixed(4)}
                      </div>
                      <span className="text-[10px] text-slate-500">per call</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                    {t.short_desc}
                  </p>

                  {/* Empirical Quality Badge */}
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Measured Reliability:</span>
                      </span>
                      <span className="font-semibold text-emerald-400 font-mono">{reliability}%</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 text-[10px]">
                      <span>Average Latency:</span>
                      <span className="font-mono text-slate-400">{Number(t.average_latency_ms || 0).toFixed(0)}ms</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500 truncate max-w-[140px]">
                    ID: {t.id.slice(0, 8)}...
                  </span>
                  <button
                    onClick={() => handleOpenToolDetails(t)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>View & Test</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tool Details & Interactive Test Modal */}
      {selectedTool && (
        <Modal
          isOpen={!!selectedTool}
          onClose={() => setSelectedTool(null)}
          title={selectedTool.name}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Badge variant="cyan" className="capitalize">
                  {selectedTool.category}
                </Badge>
                <p className="text-xs text-slate-400 mt-1">{selectedTool.short_desc}</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold font-mono text-emerald-400">
                  ${Number(selectedTool.price_per_call).toFixed(4)} USD
                </div>
                <span className="text-[10px] text-slate-500">Authoritative price per execution</span>
              </div>
            </div>

            {selectedTool.detailed_desc && (
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                {selectedTool.detailed_desc}
              </div>
            )}

            {/* Input Schema Viewer */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-indigo-400" />
                Input JSON Schema:
              </span>
              <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-mono overflow-x-auto max-h-40">
                {JSON.stringify(selectedTool.input_schema, null, 2)}
              </pre>
            </div>

            {/* Live Interactive Test Runner */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  Run Live Tool Call:
                </span>
                <span className="text-[10px] text-amber-400">Charges apply to connected wallet</span>
              </div>

              <textarea
                rows={3}
                value={testInputJson}
                onChange={(e) => setTestInputJson(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-200 outline-none focus:border-indigo-500"
              />

              <button
                onClick={handleRunSampleExecution}
                disabled={testLoading}
                className="w-full py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {testLoading ? 'Executing via ToolToll Protocol...' : 'Execute Tool Call'}
              </button>

              {testResult && (
                <div className="mt-3 p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">Execution Result:</span>
                    {testResult.status && (
                      <Badge variant={testResult.status === 'success' ? 'success' : 'danger'}>
                        {testResult.status}
                      </Badge>
                    )}
                  </div>
                  <pre className="p-2 rounded bg-slate-950 text-[11px] text-emerald-400 font-mono overflow-x-auto max-h-40">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Copyable MCP Snippet */}
            <div className="space-y-1 text-xs">
              <span className="text-slate-400 text-[11px]">Tool ID for Agent Configuration:</span>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-slate-300 text-xs select-all">
                {selectedTool.id}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
