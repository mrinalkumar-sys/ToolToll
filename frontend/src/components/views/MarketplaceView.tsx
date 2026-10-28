import React, { useState, useEffect, useRef } from 'react';
import { Tool } from '../../types';
import { api } from '../../services/api';
import { formatMicroUsd, formatMicroUnits, formatDuration } from '../../utils/formatters';
import { JsonViewer } from '../common/JsonViewer';
import { Hero3DScene } from '../common/Hero3DScene';
import {
  Search,
  Zap,
  ShieldCheck,
  Clock,
  Sparkles,
  Play,
  Layers,
  ExternalLink,
  X,
  CheckCircle,
  ArrowRight,
  Shield,
  Bot,
  Terminal,
  Activity,
  Check,
  Cpu,
  ChevronDown,
  HelpCircle,
} from 'lucide-react';

interface MarketplaceViewProps {
  onSelectToolForPlayground?: (tool: Tool) => void;
  onOpenAuth: () => void;
}

const HERO_WORDS = [
  { id: 'discover', text: 'Discover.' },
  { id: 'execute', text: 'Execute.' },
  { id: 'monetize', text: 'Monetize.' },
] as const;

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  onSelectToolForPlayground,
  onOpenAuth,
}) => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [inspectTool, setInspectTool] = useState<Tool | null>(null);

  // Live Test Runner state
  const [testInput, setTestInput] = useState<string>('{}');
  const [testRunning, setTestRunning] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Continuous Hero Headline Animation (Discover -> Execute -> Monetize)
  const [activeWordIndex, setActiveWordIndex] = useState<number>(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches) return;
    }

    const interval = setInterval(() => {
      setActiveWordIndex((prev) => (prev + 1) % HERO_WORDS.length);
    }, 1900);

    return () => clearInterval(interval);
  }, []);

  const faqs = [
    {
      q: 'How does micro-USD pay-per-use billing work for autonomous agents?',
      a: 'ToolToll uses integer micro-USD (1 USD = 1,000,000 µUSD) with zero floating-point imprecision. When an agent invokes a tool, an atomic database mutex reserves the required micro-funds in escrow. Upon successful upstream execution, funds are captured into creator earnings and platform fee accounts. If an upstream call fails or times out, a compensating reversal instantly returns 100% of the funds.'
    },
    {
      q: 'How does ToolToll protect against SSRF and unauthorized network access?',
      a: 'The Execution Gateway enforces strict DNS pinning and IP resolution checks. Upstream hostnames are resolved before connection and verified against forbidden private CIDR ranges (including RFC 1918, link-local, loopback, and metadata endpoints). The outbound HTTP agent binds strictly to the validated IP to defeat DNS rebinding attacks.'
    },
    {
      q: 'Can I integrate ToolToll tools into Claude Desktop, Cursor, or LangChain?',
      a: 'Yes! ToolToll natively supports the Model Context Protocol (MCP) over SSE and stdio transports. Autonomous agents can query MCP tool discovery schemas, receive standardized prompt templates, and execute authenticated API calls via 256-bit high-entropy agent keys.'
    },
    {
      q: 'How do creators earn money and receive payouts?',
      a: 'Creators receive 90% of every invocation fee directly credited to their ledger account in real time. Once earnings reach the minimum threshold, creators can request automated payouts to PayPal or bank accounts, trackable with an immutable cryptographic audit trail.'
    },
    {
      q: 'What are Agent Spending Limits and Human Approval Thresholds?',
      a: 'Consumers configure granular budget limits on every agent: maximum per-call spend, daily quota, and monthly limit. Additionally, if an orchestrated workflow exceeds an agent’s approval threshold (e.g. $5.00), execution is automatically paused until an operator manually approves the step.'
    }
  ];

  const catalogRef = useRef<HTMLDivElement>(null);

  const categories = ['All', 'Security', 'Translation', 'NLP', 'Data', 'Utility'];

  const fetchTools = async () => {
    setLoading(true);
    try {
      const data = await api.getTools({
        category: selectedCategory,
        query: searchQuery,
      });
      setTools(data);
    } catch (err) {
      console.error('Failed to load marketplace tools:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTools();
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory]);

  const handleOpenInspect = (tool: Tool) => {
    setInspectTool(tool);
    setTestResult(null);
    setTestError(null);

    // Populate sensible default sample inputs for demo tools
    if (tool.slug.includes('translate')) {
      setTestInput(JSON.stringify({ text: 'Autonomous agents need micro-payments.', targetLang: 'fr' }, null, 2));
    } else if (tool.slug.includes('scam')) {
      setTestInput(JSON.stringify({ text: 'URGENT: Your account requires immediate verification to avoid suspension. Click here now: http://phish-link.xyz' }, null, 2));
    } else if (tool.slug.includes('sentiment')) {
      setTestInput(JSON.stringify({ text: 'The ToolToll execution gateway is lightning fast and ultra secure!' }, null, 2));
    } else if (tool.slug.includes('extract') || tool.slug.includes('dom')) {
      setTestInput(JSON.stringify({ url: 'https://news.ycombinator.com', include_images: false }, null, 2));
    } else if (tool.slug.includes('python') || tool.slug.includes('code')) {
      setTestInput(JSON.stringify({ code: "import math\nprint(f'Computed Euler value: {math.e ** 2:.4f}')" }, null, 2));
    } else {
      setTestInput(JSON.stringify(tool.inputSchema || {}, null, 2));
    }
  };

  const handleRunTest = async () => {
    if (!inspectTool) return;
    setTestRunning(true);
    setTestError(null);
    setTestResult(null);

    try {
      let parsedInput = {};
      try {
        parsedInput = JSON.parse(testInput);
      } catch {
        throw new Error('Input payload must be valid JSON syntax');
      }

      const res = await api.runToolTest(inspectTool.id, parsedInput);
      setTestResult(res);
    } catch (err: any) {
      setTestError(err?.message || 'Verification test call failed');
    } finally {
      setTestRunning(false);
    }
  };

  const scrollToCatalog = () => {
    catalogRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div>
      {/* =========================================================================
          SECTION 1: HERO (Dark Obsidian Editorial - Inspired by Reference Hero)
          ========================================================================= */}
      <section className="section-dark" style={{ paddingTop: '80px', paddingBottom: '90px' }}>
        <div className="container-editorial">
          <div className="hero-grid-container">
            {/* Left Column: Hero Text & Actions */}
            <div className="hero-left-col">
              <span className="section-kicker hero-spring-kicker">
                Professional API Infrastructure for Autonomous Agents
              </span>
              <h1
                className="hero-animated-headline"
                aria-label="Discover. Execute. Monetize."
              >
                {HERO_WORDS.map((item, index) => {
                  const isActive = activeWordIndex === index;
                  return (
                    <span
                      key={item.id}
                      className={`hero-headline-row hero-spring-line-${index} ${isActive ? 'is-active' : 'is-inactive'}`}
                    >
                      <span className="hero-headline-word">
                        {item.text}
                        <span className="hero-headline-underline" aria-hidden="true" />
                      </span>
                    </span>
                  );
                })}
              </h1>
              <p className="hero-description hero-spring-desc">
                The premier pay-per-use marketplace built for autonomous machine agents. Sub-cent micro-USD billing, atomic reservations, DNS-pinned SSRF protection, and native Model Context Protocol (MCP) tool discovery.
              </p>

              <div className="hero-cta-container hero-spring-cta" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-lg hero-btn-spring" onClick={scrollToCatalog}>
                  Explore Marketplace <ArrowRight size={18} />
                </button>
                {onSelectToolForPlayground && (
                  <button
                    className="btn btn-secondary btn-lg hero-btn-spring"
                    onClick={() => onSelectToolForPlayground(tools[0] || {} as Tool)}
                  >
                    <Bot size={18} />
                    Launch Playground
                  </button>
                )}
              </div>
            </div>

            {/* Right Column: Original 3D Autonomous Energy Core Scene */}
            <div className="hero-right-col" aria-label="3D Core Visualization">
              <div className="hero-3d-wrapper">
                <div className="hero-video-ambient-glow" />
                <Hero3DScene />
              </div>
            </div>
          </div>

          {/* Key Metric Telemetry Bar (Matching Reference Stats Strip) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '24px',
              paddingTop: '36px',
              borderTop: '1px solid var(--border-dark)',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2.4rem',
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  color: '#FFFFFF',
                  lineHeight: 1,
                  marginBottom: '6px',
                }}
              >
                1.4M+
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Agent Invocations
              </div>
            </div>

            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2.4rem',
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  color: '#FFFFFF',
                  lineHeight: 1,
                  marginBottom: '6px',
                }}
              >
                100%
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Double-Entry Solvency
              </div>
            </div>

            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2.4rem',
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  color: '#FFFFFF',
                  lineHeight: 1,
                  marginBottom: '6px',
                }}
              >
                &lt;15ms
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                P99 Execution Latency
              </div>
            </div>

            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2.4rem',
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  color: '#FFFFFF',
                  lineHeight: 1,
                  marginBottom: '6px',
                }}
              >
                100+
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Audited Agent Tools
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: ALTERNATING WARM IVORY CATALOG (Editorial Contrast)
          ========================================================================= */}
      <section ref={catalogRef} className="section-light" id="catalog">
        <div className="container-editorial">
          {/* Section Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              gap: '20px',
              marginBottom: '40px',
            }}
          >
            <div>
              <span className="section-kicker">Autonomous Machine Capabilities</span>
              <h2
                style={{
                  fontSize: 'clamp(1.5rem, 3.5vw, 2.8rem)',
                  maxWidth: '100%',
                  overflowWrap: 'break-word',
                  wordBreak: 'break-word',
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  color: 'var(--text-light-primary)',
                }}
              >
                Audited Tools & AI Services.
              </h2>
            </div>
            <p
              style={{
                maxWidth: '480px',
                fontSize: '0.94rem',
                color: 'var(--text-light-secondary)',
                lineHeight: 1.6,
              }}
            >
              Every API is pre-evaluated against strict input schemas, protected with DNS-pinned SSRF validation, and billed with integer micro-USD precision.
            </p>
          </div>

          {/* Search Bar & Category Filter Strip */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              marginBottom: '36px',
              background: '#FFFFFF',
              padding: '16px 20px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              {/* Search Box */}
              <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
                <Search
                  size={18}
                  color="var(--text-light-muted)"
                  style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  className="form-input"
                  style={{
                    paddingLeft: '44px',
                    height: '46px',
                    fontSize: '0.94rem',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search APIs by capability (e.g. translate, scam, sentiment, extract, python)..."
                />
              </div>

              {/* Refresh Button */}
              <button
                className="btn btn-light-secondary"
                style={{ height: '46px' }}
                onClick={fetchTools}
              >
                Refresh Tools
              </button>
            </div>

            {/* Category Pills */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {categories.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    className="btn btn-sm"
                    style={{
                      background: isActive ? 'var(--brand-orange)' : 'var(--bg-light-elevated)',
                      borderColor: isActive ? 'var(--brand-orange)' : 'transparent',
                      color: isActive ? '#FFFFFF' : 'var(--text-light-secondary)',
                      fontWeight: isActive ? 700 : 600,
                      borderRadius: 'var(--radius-xs)',
                      boxShadow: isActive ? 'var(--shadow-orange)' : 'none',
                    }}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tools Grid - Architectural Cards */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-light-muted)' }}>
              <Sparkles size={34} style={{ color: 'var(--brand-orange)', animation: 'pulseOrangeGlow 1.5s infinite' }} />
              <div style={{ marginTop: '14px', fontWeight: 600 }}>Loading verified marketplace tools...</div>
            </div>
          ) : tools.length === 0 ? (
            <div
              className="card-light"
              style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-light-muted)' }}
            >
              <Layers size={40} style={{ margin: '0 auto 14px', color: 'var(--text-light-muted)' }} />
              <h3 style={{ color: 'var(--text-light-primary)', marginBottom: '8px' }}>
                No tools found matching your criteria
              </h3>
              <p>Try searching for different keywords or reset the category filter.</p>
              <button
                className="btn btn-outline-orange btn-sm"
                style={{ marginTop: '16px' }}
                onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                gap: '24px',
              }}
            >
              {tools.map((tool) => (
                <div
                  key={tool.id}
                  className="card-light highlight-orange"
                  style={{
                    padding: '28px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    {/* Header: Category & Status */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '16px',
                      }}
                    >
                      <span className="badge badge-light-neutral">{tool.category}</span>
                      <span className="badge badge-emerald">
                        <Check size={12} strokeWidth={3} />
                        {tool.status}
                      </span>
                    </div>

                    {/* Tool Name & Slug */}
                    <h3
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        color: 'var(--text-light-primary)',
                        marginBottom: '6px',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {tool.name}
                    </h3>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--brand-orange)',
                        marginBottom: '14px',
                        fontWeight: 600,
                      }}
                    >
                      {tool.slug} (v{tool.version})
                    </div>

                    {/* Description */}
                    <p
                      style={{
                        fontSize: '0.88rem',
                        color: 'var(--text-light-secondary)',
                        marginBottom: '20px',
                        lineHeight: 1.6,
                        minHeight: '44px',
                      }}
                    >
                      {tool.description}
                    </p>

                    {/* Pricing Box - Clean Inset */}
                    <div
                      style={{
                        padding: '14px 16px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-light-base)',
                        border: '1px solid var(--border-light)',
                        marginBottom: '18px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: '0.68rem',
                            color: 'var(--text-light-muted)',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                          }}
                        >
                          Price Per Successful Call
                        </div>
                        <div
                          style={{
                            fontSize: '1.2rem',
                            fontWeight: 800,
                            color: 'var(--text-light-primary)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {formatMicroUsd(tool.priceMicroUsd)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-light-muted)' }}>Micro Units</div>
                        <div
                          style={{
                            fontSize: '0.82rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--brand-orange)',
                            fontWeight: 700,
                          }}
                        >
                          {formatMicroUnits(tool.priceMicroUsd)}
                        </div>
                      </div>
                    </div>

                    {/* Telemetry Metrics */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '10px',
                        fontSize: '0.78rem',
                        color: 'var(--text-light-muted)',
                        marginBottom: '20px',
                        paddingBottom: '16px',
                        borderBottom: '1px solid var(--border-light)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} color="var(--brand-orange)" />
                        <span>Latency: ~{tool.metrics?.avgLatencyMs || 18}ms</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle size={14} color="var(--status-emerald)" />
                        <span>Success: {tool.metrics?.successRate || 100}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      className="btn btn-light-secondary btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => handleOpenInspect(tool)}
                    >
                      <ExternalLink size={14} />
                      Inspect & Test
                    </button>

                    {onSelectToolForPlayground && (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => onSelectToolForPlayground(tool)}
                      >
                        <Play size={14} />
                        Run in Agent
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: HOW IT WORKS (Dark Editorial - Inspired by Reference Step Flow)
          ========================================================================= */}
      <section className="section-dark" style={{ borderTop: '1px solid var(--border-dark)' }}>
        <div className="container-editorial">
          <div style={{ maxWidth: '640px', marginBottom: '56px' }}>
            <span className="section-kicker">Execution Architecture</span>
            <h2
              style={{
                fontSize: 'clamp(1.5rem, 3.8vw, 3.2rem)',
                maxWidth: '100%',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                color: '#FFFFFF',
                marginBottom: '16px',
              }}
            >
              How Our Service Works.
            </h2>
            <p style={{ color: 'var(--text-dark-secondary)', fontSize: '1.05rem', lineHeight: 1.6 }}>
              A carefully structured, sub-cent execution gateway designed to protect consumer balances, guarantee upstream payouts, and prevent unauthorized network egress.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '32px',
              position: 'relative',
            }}
          >
            {/* Step 1 */}
            <div
              className="card-dark highlight-orange"
              style={{ padding: '32px 28px', position: 'relative' }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2rem',
                  fontWeight: 900,
                  color: 'var(--brand-orange)',
                  marginBottom: '14px',
                }}
              >
                01
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '10px' }}>
                Intent & Schema Match
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-dark-secondary)', lineHeight: 1.6 }}>
                Agent passes a natural language task or structured intent. ToolToll ranker pairs the request with verified input schemas and validates syntax before invocation.
              </p>
            </div>

            {/* Step 2 */}
            <div
              className="card-dark highlight-orange"
              style={{ padding: '32px 28px', position: 'relative' }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2rem',
                  fontWeight: 900,
                  color: 'var(--brand-orange)',
                  marginBottom: '14px',
                }}
              >
                02
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '10px' }}>
                Atomic Fund Reservation
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-dark-secondary)', lineHeight: 1.6 }}>
                The gateway reserves the micro-USD call cost atomically using row-level PostgreSQL locks. In-flight funds are held securely so concurrent tasks never overdraw.
              </p>
            </div>

            {/* Step 3 */}
            <div
              className="card-dark highlight-orange"
              style={{ padding: '32px 28px', position: 'relative' }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2rem',
                  fontWeight: 900,
                  color: 'var(--brand-orange)',
                  marginBottom: '14px',
                }}
              >
                03
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '10px' }}>
                DNS-Pinned SSRF Dispatch
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-dark-secondary)', lineHeight: 1.6 }}>
                Outbound HTTP dispatcher performs custom DNS resolution, pins the IP against private IP blacklists, and attaches AES-256 encrypted upstream credentials.
              </p>
            </div>

            {/* Step 4 */}
            <div
              className="card-dark highlight-orange"
              style={{ padding: '32px 28px', position: 'relative' }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2rem',
                  fontWeight: 900,
                  color: 'var(--brand-orange)',
                  marginBottom: '14px',
                }}
              >
                04
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '10px' }}>
                Double-Entry Settlement
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-dark-secondary)', lineHeight: 1.6 }}>
                Upon verified 200 OK, funds are captured into the append-only ledger and split with creator. On upstream error or timeout, compensating reversals execute instantly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: PRICING & SPECIFICATION MATRIX (Reference Horizontal Table)
          ========================================================================= */}
      <section className="section-dark-elevated">
        <div className="container-editorial">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              gap: '20px',
              marginBottom: '36px',
            }}
          >
            <div>
              <span className="section-kicker">Transparent Rates</span>
              <h2
                style={{
                  fontSize: 'clamp(1.35rem, 3vw, 2.4rem)',
                  maxWidth: '100%',
                  overflowWrap: 'break-word',
                  wordBreak: 'break-word',
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  color: '#FFFFFF',
                }}
              >
                Service Packages & Pricing.
              </h2>
            </div>
            <p style={{ color: 'var(--text-dark-secondary)', fontSize: '0.9rem', maxWidth: '440px' }}>
              Micro-USD units ensure that AI agents pay only for what they execute, without recurring subscription waste or opaque credit conversions.
            </p>
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>API Service Name</th>
                  <th>Category</th>
                  <th>HTTP Method & Path</th>
                  <th>SLA Latency</th>
                  <th>Unit Rate (Micro-USD)</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {tools.slice(0, 5).map((tool) => (
                  <tr key={tool.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{tool.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dark-muted)', fontFamily: 'var(--font-mono)' }}>
                        {tool.slug}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-dark-neutral">{tool.category}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                        <span style={{ color: 'var(--brand-orange)', fontWeight: 700 }}>{tool.httpMethod}</span>
                        <span style={{ color: 'var(--text-dark-secondary)' }}>{tool.endpointPath}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: '#34D399', fontWeight: 600 }}>~{tool.metrics?.avgLatencyMs || 18}ms</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 800, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                        {formatMicroUsd(tool.priceMicroUsd)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dark-muted)' }}>
                        {formatMicroUnits(tool.priceMicroUsd)}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-outline-orange btn-sm"
                        onClick={() => handleOpenInspect(tool)}
                      >
                        Inspect & Test
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: TESTIMONIALS (Warm Ivory Editorial - "Trusted by Car Enthusiasts")
          ========================================================================= */}
      <section className="section-light">
        <div className="container-editorial">
          <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 48px' }}>
            <span className="section-kicker">Developer Endorsements</span>
            <h2
              style={{
                fontSize: 'clamp(1.5rem, 3.2vw, 2.6rem)',
                maxWidth: '100%',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                fontWeight: 900,
                color: 'var(--text-light-primary)',
                letterSpacing: '-0.03em',
                marginBottom: '12px',
              }}
            >
              Trusted by Autonomous Agent Builders.
            </h2>
            <p style={{ color: 'var(--text-light-secondary)', fontSize: '0.95rem' }}>
              See why leading multi-agent research teams and enterprise autonomous pipelines rely on ToolToll for sub-cent API payments.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '24px',
            }}
          >
            <div className="card-light" style={{ padding: '28px' }}>
              <p style={{ fontSize: '0.94rem', color: 'var(--text-light-primary)', lineHeight: 1.6, marginBottom: '20px', fontStyle: 'italic' }}>
                "The double-entry append-only ledger and integer micro-USD pricing solved our biggest blocker: autonomous agents overspending on external API calls without human budget controls."
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-light-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                  AR
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-light-primary)' }}>Alex Rivera</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-light-muted)' }}>Lead AI Engineer, Autonomous Corp</div>
                </div>
              </div>
            </div>

            <div className="card-light" style={{ padding: '28px' }}>
              <p style={{ fontSize: '0.94rem', color: 'var(--text-light-primary)', lineHeight: 1.6, marginBottom: '20px', fontStyle: 'italic' }}>
                "Native Model Context Protocol (MCP) support made integrating ToolToll into Claude Desktop and Cursor seamless. Our agents discovered tools and executed tasks within minutes."
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-light-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                  SK
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-light-primary)' }}>Sarah Kowalski</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-light-muted)' }}>Staff Architect, Agentic Systems</div>
                </div>
              </div>
            </div>

            <div className="card-light" style={{ padding: '28px' }}>
              <p style={{ fontSize: '0.94rem', color: 'var(--text-light-primary)', lineHeight: 1.6, marginBottom: '20px', fontStyle: 'italic' }}>
                "As an API developer, monetizing my specialized NLP models directly to machine consumers without dealing with credit cards or per-seat billing has been a total game changer."
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-light-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                  DL
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-light-primary)' }}>David Lin</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-light-muted)' }}>Founder, Polyglot AI Models</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 6: FREQUENTLY ASKED QUESTIONS (Warm Ivory Editorial Accordion)
          ========================================================================= */}
      <section className="section-light" style={{ borderTop: '1px solid var(--border-light)', padding: '80px 0' }}>
        <div className="container-editorial">
          <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 48px' }}>
            <span className="section-kicker">Platform Architecture & Answers</span>
            <h2
              style={{
                fontSize: 'clamp(1.5rem, 3.2vw, 2.6rem)',
                maxWidth: '100%',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                fontWeight: 900,
                color: 'var(--text-light-primary)',
                letterSpacing: '-0.03em',
                marginBottom: '12px',
              }}
            >
              Frequently Asked Questions.
            </h2>
            <p style={{ color: 'var(--text-light-secondary)', fontSize: '0.95rem' }}>
              Everything you need to know about micro-USD billing, autonomous agent keys, double-entry accounting, and SSRF security.
            </p>
          </div>

          <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="card-light"
                  style={{
                    padding: '0',
                    overflow: 'hidden',
                    border: isOpen ? '1px solid var(--brand-orange)' : '1px solid var(--border-light)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    style={{
                      width: '100%',
                      padding: '20px 24px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: 'var(--text-light-primary)',
                    }}
                  >
                    <span style={{ fontSize: '1.02rem', fontWeight: 800, paddingRight: '16px' }}>
                      {faq.q}
                    </span>
                    <ChevronDown
                      size={18}
                      color={isOpen ? 'var(--brand-orange)' : 'var(--text-light-muted)'}
                      style={{
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.25s ease',
                        flexShrink: 0,
                      }}
                    />
                  </button>
                  {isOpen && (
                    <div
                      style={{
                        padding: '0 24px 22px',
                        fontSize: '0.92rem',
                        color: 'var(--text-light-secondary)',
                        lineHeight: 1.65,
                        borderTop: '1px solid var(--border-light)',
                        paddingTop: '16px',
                      }}
                    >
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 7: CTA BANNER (Dark Luxury)
          ========================================================================= */}
      <section className="section-dark" style={{ borderTop: '1px solid var(--border-dark)', padding: '96px 0' }}>
        <div className="container-editorial" style={{ textAlign: 'center' }}>
          <div style={{ maxWidth: '780px', margin: '0 auto' }}>
            <span className="section-kicker">Machine-to-Machine Settlement</span>
            <h2
              style={{
                fontSize: 'clamp(1.5rem, 4.5vw, 3.8rem)',
                maxWidth: '100%',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                fontWeight: 900,
                letterSpacing: '-0.035em',
                color: '#FFFFFF',
                lineHeight: 1.1,
                marginBottom: '20px',
              }}
            >
              Your Agents Deserve Native Financial Infrastructure.
            </h2>
            <p
              style={{
                fontSize: '1.1rem',
                color: 'var(--text-dark-secondary)',
                lineHeight: 1.6,
                marginBottom: '36px',
              }}
            >
              Fund your wallet in micro-USD, generate high-entropy agent keys, and let autonomous workflows discover and pay for verified tools in real time.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-lg" onClick={onOpenAuth}>
                Deploy Your First Agent <ArrowRight size={18} />
              </button>
              <button className="btn btn-secondary btn-lg" onClick={scrollToCatalog}>
                Browse 100+ Tools
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          INSPECT & LIVE TEST RUNNER MODAL
          ========================================================================= */}
      {inspectTool && (
        <div className="modal-overlay" onClick={() => setInspectTool(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '820px' }}
          >
            <div className="modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FFFFFF' }}>
                    {inspectTool.name}
                  </h3>
                  <span className="badge badge-orange">{inspectTool.category}</span>
                </div>
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--brand-orange)',
                    marginTop: '4px',
                  }}
                >
                  {inspectTool.httpMethod} {inspectTool.endpointPath}
                </div>
              </div>
              <button
                onClick={() => setInspectTool(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dark-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ marginBottom: '20px', color: 'var(--text-dark-secondary)', lineHeight: 1.6 }}>
                {inspectTool.description}
              </p>

              {/* Specs Row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  marginBottom: '24px',
                }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-dark)',
                  }}
                >
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    PRICE PER CALL
                  </div>
                  <div style={{ fontWeight: 800, color: '#FFFFFF', fontFamily: 'var(--font-mono)', fontSize: '1.1rem', marginTop: '2px' }}>
                    {formatMicroUsd(inspectTool.priceMicroUsd)}
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-dark)',
                  }}
                >
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    GATEWAY TIMEOUT
                  </div>
                  <div style={{ fontWeight: 800, color: '#FFFFFF', fontFamily: 'var(--font-mono)', fontSize: '1.1rem', marginTop: '2px' }}>
                    {formatDuration(inspectTool.timeoutMs)}
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-dark)',
                  }}
                >
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    RATE LIMIT
                  </div>
                  <div style={{ fontWeight: 800, color: '#FFFFFF', fontFamily: 'var(--font-mono)', fontSize: '1.1rem', marginTop: '2px' }}>
                    {inspectTool.rateLimitRpm} RPM
                  </div>
                </div>
              </div>

              {/* JSON Schema Section */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Input Parameter JSON Schema
                </div>
                <JsonViewer data={inspectTool.inputSchema} maxHeight="140px" title="JSON Schema Definition" />
              </div>

              {/* Live Sandbox Test Runner */}
              <div
                style={{
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 85, 0, 0.04)',
                  border: '1px solid var(--brand-orange-border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={16} color="var(--brand-orange)" />
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#FFFFFF' }}>
                      Interactive Sandbox Test Runner
                    </span>
                  </div>
                  <span className="badge badge-orange" style={{ fontSize: '0.66rem' }}>
                    SSRF Validated
                  </span>
                </div>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ color: 'var(--text-dark-secondary)' }}>
                    Sample Input JSON Payload:
                  </label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.85rem',
                      background: 'rgba(0,0,0,0.4)',
                    }}
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={testRunning}
                  onClick={handleRunTest}
                >
                  <Play size={14} />
                  {testRunning ? 'Executing Sandbox Call...' : 'Execute Test Call Now'}
                </button>

                {testError && (
                  <div
                    style={{
                      marginTop: '14px',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--status-rose-bg)',
                      border: '1px solid var(--status-rose-border)',
                      color: '#F87171',
                      fontSize: '0.84rem',
                    }}
                  >
                    Error: {testError}
                  </div>
                )}

                {testResult && (
                  <div style={{ marginTop: '16px' }}>
                    <div
                      style={{
                        display: 'flex',
                        gap: '14px',
                        fontSize: '0.8rem',
                        marginBottom: '8px',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ color: '#34D399', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={14} strokeWidth={3} />
                        Status: {testResult.responseStatus || 200} OK
                      </span>
                      <span style={{ color: 'var(--text-dark-muted)' }}>
                        Duration: {testResult.durationMs || 15}ms
                      </span>
                    </div>
                    <JsonViewer
                      data={testResult.responseBody || testResult}
                      maxHeight="160px"
                      title="Response Body"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setInspectTool(null)}>
                Close
              </button>
              {onSelectToolForPlayground && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const t = inspectTool;
                    setInspectTool(null);
                    onSelectToolForPlayground(t);
                  }}
                >
                  <Play size={15} />
                  Run in Playground
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
