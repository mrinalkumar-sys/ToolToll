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
        borderRadius: 'var(--radius-md)',
        background: '#040711',
        border: '1px solid var(--border-subtle)',
        overflow: 'hidden',
        fontSize: '0.8rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>
          {title || 'JSON Payload'}
        </span>
        <button
          onClick={handleCopy}
          className="btn btn-sm"
          style={{
            background: 'none',
            border: 'none',
            color: copied ? '#34d399' : 'var(--text-muted)',
            padding: '2px 6px',
            fontSize: '0.72rem',
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        style={{
          padding: '12px',
          margin: 0,
          maxHeight,
          overflowY: 'auto',
          color: '#38bdf8',
          fontFamily: 'var(--font-mono)',
          lineHeight: 1.45,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {jsonString}
      </pre>
    </div>
  );
};
