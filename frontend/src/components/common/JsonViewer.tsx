import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface JsonViewerProps {
  data: unknown;
  maxHeight?: string;
  title?: string;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ data, maxHeight = '280px', title }) => {
  const [copied, setCopied] = useState(false);
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        borderRadius: 'var(--radius-sm)',
        background: '#040508',
        border: '1px solid var(--border-dark)',
        overflow: 'hidden',
        fontSize: '0.82rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid var(--border-dark)',
        }}
      >
        <span style={{ color: 'var(--text-dark-muted)', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title || 'JSON Payload'}
        </span>
        <button
          onClick={handleCopy}
          className="btn btn-sm"
          style={{
            background: 'none',
            border: 'none',
            color: copied ? 'var(--brand-orange)' : 'var(--text-dark-muted)',
            padding: '2px 8px',
            fontSize: '0.74rem',
            cursor: 'pointer',
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        style={{
          padding: '14px',
          margin: 0,
          maxHeight,
          overflowY: 'auto',
          color: '#38BDF8',
          fontFamily: 'var(--font-mono)',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          fontSize: '0.8rem',
        }}
      >
        {jsonString}
      </pre>
    </div>
  );
};
