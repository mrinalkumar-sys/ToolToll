import React from 'react';
import { Sparkles, ShieldCheck, Zap, Layers, ExternalLink, Cpu } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-dark)',
        background: '#07080B',
        padding: '64px 0 36px',
        marginTop: 'auto',
        color: 'var(--text-dark-primary)',
      }}
    >
      <div className="container-editorial">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '40px',
            marginBottom: '48px',
          }}
        >
          {/* Brand & Mission Statement */}
          <div style={{ maxWidth: '380px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--brand-orange)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={17} color="#FFFFFF" strokeWidth={2.5} />
              </div>
              <span
                style={{
                  fontWeight: 900,
                  fontSize: '1.25rem',
                  letterSpacing: '-0.04em',
                  fontFamily: 'var(--font-display)',
                  textTransform: 'uppercase',
                }}
              >
                ToolToll
              </span>
            </div>
            <p
              style={{
                fontSize: '0.88rem',
                color: 'var(--text-dark-secondary)',
                lineHeight: 1.65,
                marginBottom: '18px',
              }}
            >
              The pay-per-use API marketplace and high-speed monetization gateway engineered for autonomous AI agents, featuring atomic reservations, DNS-pinned SSRF protection, and native Model Context Protocol (MCP) support.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="badge badge-orange">Machine Economy</span>
              <span className="badge badge-dark-neutral">Micro-USD BigInt</span>
            </div>
          </div>

          {/* Core Architecture */}
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontWeight: 800,
                color: 'var(--brand-orange)',
                marginBottom: '16px',
              }}
            >
              Gateway Architecture
            </div>
            <ul
              style={{
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                fontSize: '0.84rem',
                color: 'var(--text-dark-secondary)',
              }}
            >
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={14} color="var(--brand-orange)" />
                Integer Micro-USD (1 USD = 1M µUSD)
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={14} color="var(--status-emerald)" />
                DNS-Pinned SSRF Isolation
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={14} color="var(--status-sky)" />
                Double-Entry Append-Only Ledger
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={14} color="var(--status-amber)" />
                Compensating Reversals on Fail
              </li>
            </ul>
          </div>

          {/* Transports & MCP */}
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontWeight: 800,
                color: 'var(--brand-orange)',
                marginBottom: '16px',
              }}
            >
              Transports & SDKs
            </div>
            <ul
              style={{
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                fontSize: '0.84rem',
                color: 'var(--text-dark-secondary)',
              }}
            >
              <li>Model Context Protocol (MCP)</li>
              <li>STDIO Local Daemon Transport</li>
              <li>Streamable HTTP (SSE Remote)</li>
              <li>Claude Desktop Plugin Conf</li>
              <li>Cursor & Windsurf Native Support</li>
            </ul>
          </div>

          {/* Live Node Status */}
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontWeight: 800,
                color: 'var(--brand-orange)',
                marginBottom: '16px',
              }}
            >
              Network Telemetry
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                fontSize: '0.82rem',
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-dark)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dark-secondary)' }}>Execution Gateway:</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34D399', fontWeight: 700 }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
                  Online (18ms)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dark-secondary)' }}>AI Intelligence Service:</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34D399', fontWeight: 700 }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
                  Operational
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dark-secondary)' }}>Ledger Solvency:</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34D399', fontWeight: 700 }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
                  100% Balanced
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Sub-Bar */}
        <div
          style={{
            paddingTop: '24px',
            borderTop: '1px solid var(--border-dark)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            fontSize: '0.78rem',
            color: 'var(--text-dark-muted)',
          }}
        >
          <div>© 2026 ToolToll Marketplace. Architectural Infrastructure for Autonomous Agents.</div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <a
              href="http://localhost:4000/api/docs"
              target="_blank"
              rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-dark-secondary)' }}
            >
              Gateway OpenAPI Docs <ExternalLink size={12} />
            </a>
            <a
              href="http://127.0.0.1:8001/docs"
              target="_blank"
              rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-dark-secondary)' }}
            >
              AI Orchestrator Specs <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
