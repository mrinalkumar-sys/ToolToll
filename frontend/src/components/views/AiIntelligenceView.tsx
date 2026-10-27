import React, { useState } from 'react';
import { api } from '../../services/api';
import { formatMicroUsd } from '../../utils/formatters';
import { JsonViewer } from '../common/JsonViewer';
import {
  Brain,
  Sparkles,
  Search,
  DollarSign,
  FileCode,
  ArrowRight,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export const AiIntelligenceView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'discover' | 'price' | 'onboard'>('discover');

  // Semantic Discovery State
  const [discoverTask, setDiscoverTask] = useState('I need to translate messages into French and detect if the sender is trying to scam me');
  const [discoverResults, setDiscoverResults] = useState<any[] | null>(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);

  // Price Advisor State
  const [advisorCategory, setAdvisorCategory] = useState('Security');
  const [advisorDescription, setAdvisorDescription] = useState('Real-time phishing and fraudulent text detector with threat heuristics');
  const [advisorLatency, setAdvisorLatency] = useState(25);
  const [advisorResult, setAdvisorResult] = useState<any | null>(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);

  // API Onboarding State
  const [onboardDoc, setOnboardDoc] = useState(
    'curl -X POST https://api.weathercheck.com/v1/current -H "Authorization: Bearer KEY" -d \'{"city": "Paris", "units": "celsius"}\'\nReturns temperature, humidity, and condition description.'
  );
  const [onboardResult, setOnboardResult] = useState<any | null>(null);
  const [onboardLoading, setOnboardLoading] = useState(false);

  const handleDiscover = async () => {
    if (!discoverTask.trim()) return;
    setDiscoverLoading(true);
    try {
      const res = await api.aiDiscoverTools(discoverTask);
      setDiscoverResults(res.results || []);
    } catch (err: any) {
      alert(`Discovery failed: ${err?.message || 'Check AI service status'}`);
    } finally {
      setDiscoverLoading(false);
    }
  };

  const handleSuggestPrice = async () => {
    setAdvisorLoading(true);
    try {
      const res = await api.aiSuggestPrice({
        category: advisorCategory,
        description: advisorDescription,
        latency_ms_estimate: advisorLatency,
      });
      setAdvisorResult(res);
    } catch (err: any) {
      alert(`Pricing advice failed: ${err?.message || 'Check AI service status'}`);
    } finally {
      setAdvisorLoading(false);
    }
  };

  const handleOnboardDraft = async () => {
    setOnboardLoading(true);
    try {
      const res = await api.aiOnboardDraft(onboardDoc);
      setOnboardResult(res);
    } catch (err: any) {
      alert(`Onboarding draft generation failed: ${err?.message || 'Check AI service status'}`);
    } finally {
      setOnboardLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div className="badge badge-purple" style={{ marginBottom: '8px' }}>
          <Brain size={13} />
          FastAPI AI Intelligence Service (Port 8001)
        </div>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '8px' }}>AI Intelligence Center</h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '750px' }}>
          Harness the dedicated Python AI service powering natural language tool discovery, dynamic market pricing recommendations, and automated API onboarding.
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '24px',
        }}
      >
        <button
          className="btn btn-sm"
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'discover' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
            color: activeTab === 'discover' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            borderRadius: 0,
            paddingBottom: '10px',
          }}
          onClick={() => setActiveTab('discover')}
        >
          <Search size={15} />
          Semantic Tool Discovery
        </button>

        <button
          className="btn btn-sm"
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'price' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
            color: activeTab === 'price' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            borderRadius: 0,
            paddingBottom: '10px',
          }}
          onClick={() => setActiveTab('price')}
        >
          <DollarSign size={15} />
          AI Price Advisor
        </button>

        <button
          className="btn btn-sm"
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'onboard' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
            color: activeTab === 'onboard' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            borderRadius: 0,
            paddingBottom: '10px',
          }}
          onClick={() => setActiveTab('onboard')}
        >
          <FileCode size={15} />
          Automated API Onboarding Draft
        </button>
      </div>

      {/* Feature 1: Semantic Discovery */}
      {activeTab === 'discover' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Natural Language Discovery</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Describe what capabilities your agent needs in free-form English. The AI service evaluates tool capability matches.
            </p>

            <div className="form-group">
              <label className="form-label">Task Objective</label>
              <textarea
                className="form-textarea"
                rows={4}
                value={discoverTask}
                onChange={(e) => setDiscoverTask(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary"
              disabled={discoverLoading}
              onClick={handleDiscover}
            >
              <Sparkles size={16} />
              {discoverLoading ? 'Searching Marketplace...' : 'Find Matching Tools'}
            </button>
          </div>

          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Discovery Matches</h3>

            {discoverResults ? (
              discoverResults.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No matches found.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {discoverResults.map((match: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 700 }}>{match.name}</span>
                        <span style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                          {formatMicroUsd(match.price_micro_usd)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        {match.explanation}
                      </div>
                      <div className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>
                        Fit Score: {Math.round((match.score || 0.95) * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                Run a search on the left to see semantic matching and ranking results.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feature 2: AI Price Advisor */}
      {activeTab === 'price' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Fair Market Price Advisor</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Determines optimal per-invocation pricing based on expected latency, resource intensity, and market comparables.
            </p>

            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={advisorCategory}
                onChange={(e) => setAdvisorCategory(e.target.value)}
              >
                <option value="Security">Security</option>
                <option value="Translation">Translation</option>
                <option value="NLP">NLP</option>
                <option value="Data">Data</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">API Capability Description</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={advisorDescription}
                onChange={(e) => setAdvisorDescription(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Estimated Latency (ms)</label>
              <input
                type="number"
                className="form-input"
                value={advisorLatency}
                onChange={(e) => setAdvisorLatency(parseInt(e.target.value, 10))}
              />
            </div>

            <button
              className="btn btn-primary"
              disabled={advisorLoading}
              onClick={handleSuggestPrice}
            >
              <DollarSign size={16} />
              {advisorLoading ? 'Calculating Fair Price...' : 'Get Price Recommendation'}
            </button>
          </div>

          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Pricing Recommendation</h3>

            {advisorResult ? (
              <div>
                <div
                  style={{
                    padding: '20px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(6, 182, 212, 0.08)',
                    border: '1px solid var(--border-accent)',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>RECOMMENDED PRICE PER CALL</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-cyan-light)', fontFamily: 'var(--font-mono)' }}>
                    {formatMicroUsd(advisorResult.suggested_price_micro_usd)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    ({advisorResult.suggested_price_micro_usd?.toLocaleString()} µUSD)
                  </div>
                </div>

                <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <strong>Economic Reasoning:</strong>
                  <p style={{ marginTop: '4px' }}>{advisorResult.reasoning}</p>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                Fill in tool details on the left to receive an algorithmic pricing appraisal.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feature 3: Automated API Onboarding */}
      {activeTab === 'onboard' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>API Onboarding Auto-Drafter</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Paste unstructured documentation, cURL snippets, or OpenAPI fragments. The AI service transforms it into a schema-compliant ToolToll tool draft.
            </p>

            <div className="form-group">
              <label className="form-label">cURL / Documentation Fragment</label>
              <textarea
                className="form-textarea"
                rows={8}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
                value={onboardDoc}
                onChange={(e) => setOnboardDoc(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary"
              disabled={onboardLoading}
              onClick={handleOnboardDraft}
            >
              <FileCode size={16} />
              {onboardLoading ? 'Generating Schema Draft...' : 'Generate Tool Draft'}
            </button>
          </div>

          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Generated Schema & Config Draft</h3>

            {onboardResult ? (
              <div>
                <JsonViewer
                  data={onboardResult.draft || onboardResult}
                  maxHeight="320px"
                  title="ToolToll Compliant Tool Draft"
                />
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                Click "Generate Tool Draft" to view the converted JSON configuration.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
