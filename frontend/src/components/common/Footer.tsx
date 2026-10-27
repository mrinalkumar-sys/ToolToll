import React from 'react';
import { Sparkles, ShieldCheck, Zap, Layers, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'rgba(4, 7, 17, 0.95)',
        padding: '40px 24px 32px',
        marginTop: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '2fr repeat(3, 1fr)',
          gap: '32px',
          marginBottom: '32px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-purple) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={16} color="#050a17" />
            </div>
            <span style={{ fontWeight: 800, fontSize: '1.15rem' }}>ToolToll</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: 1.6 }}>
            The pay-per-use API marketplace and monetization gateway engineered specifically for autonomous AI agents, featuring atomic reservations and Model Context Protocol (MCP) integration.
          </p>
        </div>

        <div>
          <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: '14px' }}>
            Architecture
          </h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <li>Integer Micro-USD (BigInt)</li>
            <li>DNS-Pinned SSRF Guard</li>
            <li>Double-Entry Append Ledger</li>
            <li>Compensating Reversals</li>
          </ul>
        </div>

        <div>
          <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: '14px' }}>
            Transports & MCP
          </h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <li>STDIO Local Transport</li>
            <li>Streamable HTTP (SSE)</li>
            <li>Claude Desktop Plugin</li>
            <li>Cursor / Windsurf Native</li>
          </ul>
        </div>

        <div>
          <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: '14px' }}>
            System Status
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }} />
              <span>Backend API (Port 4000): <strong>Online</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }} />
              <span>AI Service (Port 8001): <strong>Online</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }} />
              <span>PostgreSQL: <strong>Healthy</strong></span>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          paddingTop: '20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}
      >
        <div>© 2026 ToolToll Marketplace. Built for the autonomous machine-to-machine economy.</div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <a href="http://localhost:4000/api/docs" target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            Swagger OpenAPI <ExternalLink size={11} />
          </a>
          <a href="http://127.0.0.1:8001/docs" target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            AI Swagger <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </footer>
  );
};
