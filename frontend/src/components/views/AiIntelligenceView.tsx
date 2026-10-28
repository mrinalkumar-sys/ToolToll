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
  Zap,
  CheckCircle,
} from 'lucide-react';

export const AiIntelligenceView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'discover' | 'price' | 'onboard'>('discover');

  // Semantic Discovery State
  const [discoverTask, setDiscoverTask] = useState('I need to translate incoming customer messages into French and detect if the sender is trying to scam me');
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
    <div className="section-dark" style={{ minHeight: '85vh', paddingTop: '40px' }}>
      <div className="container-editorial">
        {/* Header */}
        <div style={{ maxWidth: '840px', marginBottom: '36px' }}>
          <span className="section-kicker">Machine Learning & Reasoning Engine</span>
          <h1
            style={{
              fontSize: 'clamp(1.5rem, 3.8vw, 3.2rem)',
              maxWidth: '100%',
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
              fontWeight: 900,
              letterSpacing: '-0.035em',
              color: '#FFFFFF',
              marginBottom: '12px',
            }}
          >
            AI Intelligence Center.
          </h1>
          <p style={{ color: 'var(--text-dark-secondary)', fontSize: '1.02rem', lineHeight: 1.6 }}>
            Direct semantic capability matching, automated fair-market pricing appraisals, and AI-assisted schema generation from raw cURL and OpenAPI documentation.
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid var(--border-dark)',
            marginBottom: '32px',
            overflowX: 'auto',
          }}
        >
          <button
            className="btn btn-sm"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'discover' ? '2px solid var(--brand-orange)' : '2px solid transparent',
              color: activeTab === 'discover' ? '#FFFFFF' : 'var(--text-dark-muted)',
              fontWeight: activeTab === 'discover' ? 800 : 600,
              borderRadius: 0,
              padding: '12px 18px',
              fontSize: '0.9rem',
            }}
            onClick={() => setActiveTab('discover')}
          >
            <Search size={15} />
            Semantic Discovery
          </button>

          <button
            className="btn btn-sm"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'price' ? '2px solid var(--brand-orange)' : '2px solid transparent',
              color: activeTab === 'price' ? '#FFFFFF' : 'var(--text-dark-muted)',
              fontWeight: activeTab === 'price' ? 800 : 600,
              borderRadius: 0,
              padding: '12px 18px',
              fontSize: '0.9rem',
            }}
            onClick={() => setActiveTab('price')}
          >
            <DollarSign size={15} />
            AI Price Advisor
          </button>

          <button
            className="btn btn-sm"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'onboard' ? '2px solid var(--brand-orange)' : '2px solid transparent',
              color: activeTab === 'onboard' ? '#FFFFFF' : 'var(--text-dark-muted)',
              fontWeight: activeTab === 'onboard' ? 800 : 600,
              borderRadius: 0,
              padding: '12px 18px',
              fontSize: '0.9rem',
            }}
            onClick={() => setActiveTab('onboard')}
          >
            <FileCode size={15} />
            API Onboarding Drafter
          </button>
        </div>

        {/* Feature 1: Semantic Discovery */}
        {activeTab === 'discover' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
            <div className="card-dark" style={{ padding: '28px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
                Natural Language Tool Discovery
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-dark-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
                Describe what capabilities your autonomous agent needs in natural language. Our semantic vector engine identifies the most relevant audited tools.
              </p>

              <div className="form-group">
                <label className="form-label">Task Objective / Capabilities</label>
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

            <div className="card-dark" style={{ padding: '28px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '18px' }}>
                Semantic Vector Matches
              </h3>

              {discoverResults ? (
                discoverResults.length === 0 ? (
                  <div style={{ color: 'var(--text-dark-muted)', fontSize: '0.9rem' }}>No matches found.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {discoverResults.map((match: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          padding: '16px 20px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-dark)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.98rem' }}>{match.name}</span>
                          <span style={{ color: '#38BDF8', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem' }}>
                            {formatMicroUsd(match.price_micro_usd)}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.84rem', color: 'var(--text-dark-secondary)', marginBottom: '10px', lineHeight: 1.5 }}>
                          {match.explanation}
                        </div>
                        <span className="badge badge-orange" style={{ fontSize: '0.7rem' }}>
                          Confidence: {Math.round((match.score || 0.95) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div style={{ color: 'var(--text-dark-muted)', fontSize: '0.88rem', fontStyle: 'italic', padding: '20px 0' }}>
                  Enter your task instructions on the left to view semantic matches and fit scores.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Feature 2: AI Price Advisor */}
        {activeTab === 'price' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
            <div className="card-dark" style={{ padding: '28px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
                Algorithmic Fair Price Advisor
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-dark-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
                Recommends equilibrium per-invocation pricing based on compute intensity, expected latency, and competitive market data.
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
                {advisorLoading ? 'Analyzing Market Dynamics...' : 'Calculate Recommended Rate'}
              </button>
            </div>

            <div className="card-dark" style={{ padding: '28px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '18px' }}>
                Economic Valuation & Recommendation
              </h3>

              {advisorResult ? (
                <div>
                  <div
                    style={{
                      padding: '24px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255, 85, 0, 0.05)',
                      border: '1px solid var(--brand-orange-border)',
                      marginBottom: '20px',
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      RECOMMENDED MICRO-USD PRICE
                    </div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#FFFFFF', fontFamily: 'var(--font-mono)', margin: '4px 0' }}>
                      {formatMicroUsd(advisorResult.suggested_price_micro_usd)}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--brand-orange)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      ({advisorResult.suggested_price_micro_usd?.toLocaleString()} µUSD per call)
                    </div>
                  </div>

                  <div style={{ fontSize: '0.9rem', color: 'var(--text-dark-secondary)', lineHeight: 1.6 }}>
                    <strong style={{ color: '#FFFFFF', display: 'block', marginBottom: '6px' }}>Economic Rationale:</strong>
                    <p>{advisorResult.reasoning}</p>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-dark-muted)', fontSize: '0.88rem', fontStyle: 'italic', padding: '20px 0' }}>
                  Fill in your API details on the left to receive an algorithmic price estimate.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Feature 3: Automated API Onboarding */}
        {activeTab === 'onboard' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
            <div className="card-dark" style={{ padding: '28px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
                API Onboarding Auto-Drafter
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-dark-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
                Paste unstructured cURL snippets or API documentation. The AI orchestrator extracts endpoints, methods, and parameters into a schema-compliant draft.
              </p>

              <div className="form-group">
                <label className="form-label">cURL Snippet or Raw Documentation</label>
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
                {onboardLoading ? 'Extracting Schemas...' : 'Generate Tool Draft'}
              </button>
            </div>

            <div className="card-dark" style={{ padding: '28px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '18px' }}>
                Generated Tool Configuration Draft
              </h3>

              {onboardResult ? (
                <div>
                  <JsonViewer
                    data={onboardResult.draft || onboardResult}
                    maxHeight="320px"
                    title="Schema Draft Payload"
                  />
                </div>
              ) : (
                <div style={{ color: 'var(--text-dark-muted)', fontSize: '0.88rem', fontStyle: 'italic', padding: '20px 0' }}>
                  Click "Generate Tool Draft" to extract JSON Schema definitions from raw docs.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
