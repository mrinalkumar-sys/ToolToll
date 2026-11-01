import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  RotateCcw,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  FileCode,
  Copy,
  Check,
  Cloud,
  ChevronRight,
  ChevronDown,
  Send,
  ShieldCheck,
  CheckCircle,
  Terminal,
} from 'lucide-react';
import { api } from '../../services/api';
import { Tool, ToolEndpoint, PostmanTestReport } from '../../types';

export interface PostmanTestingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tools: Tool[];
  initialToolId?: string;
  initialEndpointId?: string;
  onToolStatusUpdated?: () => void;
}

export const PostmanTestingModal: React.FC<PostmanTestingModalProps> = ({
  isOpen,
  onClose,
  tools,
  initialToolId,
  initialEndpointId,
  onToolStatusUpdated,
}) => {
  const [selectedToolId, setSelectedToolId] = useState<string>('');
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>('primary');
  const [activeTab, setActiveTab] = useState<'suite' | 'collection'>('suite');

  // Execution state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentExecutionStep, setCurrentExecutionStep] = useState<string>('');
  const [executionStats, setExecutionStats] = useState({ completed: 0, passed: 0, failed: 0 });

  // Results state
  const [currentReport, setCurrentReport] = useState<PostmanTestReport | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [collectionPreview, setCollectionPreview] = useState<string | null>(null);
  const [previewCopied, setPreviewCopied] = useState<boolean>(false);

  // Postman Cloud Sync state
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Review submission state
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [submittedSuccess, setSubmittedSuccess] = useState<boolean>(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Synchronize selected tool when modal opens or initialToolId changes
  useEffect(() => {
    if (!isOpen) return;

    if (initialToolId && tools.some((t) => t.id === initialToolId)) {
      setSelectedToolId(initialToolId);
    } else if (tools.length > 0 && (!selectedToolId || !tools.some((t) => t.id === selectedToolId))) {
      setSelectedToolId(tools[0].id);
    }
  }, [isOpen, initialToolId, tools]);

  const currentTool = tools.find((t) => t.id === selectedToolId) || (tools.length > 0 ? tools[0] : undefined);
  const endpoints = currentTool?.endpoints || [];

  // Synchronize selected endpoint when tool or initialEndpointId changes
  useEffect(() => {
    if (!currentTool) return;

    if (initialEndpointId && endpoints.some((e) => e.id === initialEndpointId)) {
      setSelectedEndpointId(initialEndpointId);
    } else if (endpoints.length > 0) {
      setSelectedEndpointId(endpoints[0].id);
    } else {
      setSelectedEndpointId('primary');
    }

    setCurrentReport(null);
    setSubmittedSuccess(false);
  }, [selectedToolId, initialEndpointId, currentTool?.id]);

  // Load collection preview when switching to collection tab
  useEffect(() => {
    if (activeTab === 'collection' && currentTool) {
      const targetEpId = selectedEndpointId === 'primary' ? undefined : selectedEndpointId;
      api.getPostmanCollection(currentTool.id, targetEpId)
        .then((col) => setCollectionPreview(JSON.stringify(col, null, 2)))
        .catch(() => setCollectionPreview(null));
    }
  }, [activeTab, currentTool?.id, selectedEndpointId]);

  const handleEndpointChange = (epId: string) => {
    setSelectedEndpointId(epId);
    setCurrentReport(null);
    setSubmittedSuccess(false);
  };

  const handleRunTests = async () => {
    if (!currentTool) return;

    const currentEndpoint = endpoints.find((e) => e.id === selectedEndpointId);
    const effectiveMethod = currentEndpoint?.httpMethod || currentTool.httpMethod || 'POST';
    const effectivePath = currentEndpoint?.endpointPath || currentTool.endpointPath || '/';

    const defaultPayload =
      currentEndpoint?.exampleRequest ||
      currentTool.exampleRequest ||
      (currentTool.inputSchema && typeof currentTool.inputSchema === 'object' && Object.keys(currentTool.inputSchema).length > 0
        ? currentTool.inputSchema
        : { query: 'verification' });

    setIsRunning(true);
    setCurrentExecutionStep(`Dispatching Newman test suite to ${effectiveMethod} ${effectivePath}...`);
    setExecutionStats({ completed: 0, passed: 0, failed: 0 });

    try {
      const targetEpId = selectedEndpointId === 'primary' ? undefined : selectedEndpointId;
      const report = await api.runPostmanTests({
        toolId: currentTool.id,
        endpointId: targetEpId,
        sampleInput: defaultPayload,
      });

      setCurrentReport(report);
      setExecutionStats({
        completed: report.totalTests,
        passed: report.passedTests,
        failed: report.failedTests,
      });
      if (onToolStatusUpdated) onToolStatusUpdated();
    } catch (err: any) {
      alert(`Test execution failed: ${err.message || 'Network or execution error'}`);
    } finally {
      setIsRunning(false);
      setCurrentExecutionStep('');
    }
  };

  const handleSubmitForReview = async () => {
    if (!currentTool) return;
    setSubmittingReview(true);
    try {
      await api.submitToolForReview(currentTool.id);
      setSubmittedSuccess(true);
      if (onToolStatusUpdated) onToolStatusUpdated();
    } catch (err: any) {
      alert(`Submission failed: ${err.message || 'Server error'}`);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleExportCollection = async () => {
    if (!currentTool) return;
    try {
      const targetEpId = selectedEndpointId === 'primary' ? undefined : selectedEndpointId;
      const collection = await api.getPostmanCollection(currentTool.id, targetEpId);
      const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentTool.slug}-postman-collection.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Failed to export collection: ${err.message}`);
    }
  };

  const handleExportEnvironment = async () => {
    if (!currentTool) return;
    try {
      const environment = await api.getPostmanEnvironment(currentTool.id);
      const blob = new Blob([JSON.stringify(environment, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentTool.slug}-postman-environment.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Failed to export environment: ${err.message}`);
    }
  };

  const handleSyncToPostmanCloud = async () => {
    if (!currentTool) return;
    setSyncing(true);
    setSyncNotice(null);
    try {
      const result = await api.syncCollectionToPostman(currentTool.id);
      if (result.synced) {
        setSyncNotice(`Collection successfully synced to Postman Cloud (Collection ID: ${result.collectionId})`);
      } else {
        setSyncNotice(result.message || 'Postman Cloud sync completed.');
      }
    } catch (err: any) {
      setSyncNotice(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyResponseBody = () => {
    if (!currentReport?.responseBody) return;
    navigator.clipboard.writeText(JSON.stringify(currentReport.responseBody, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPreview = () => {
    if (!collectionPreview) return;
    navigator.clipboard.writeText(collectionPreview);
    setPreviewCopied(true);
    setTimeout(() => setPreviewCopied(false), 2000);
  };

  if (!isOpen) return null;

  const currentEndpoint = endpoints.find((e) => e.id === selectedEndpointId);
  const effectiveMethod = (currentEndpoint?.httpMethod || currentTool?.httpMethod || 'POST').toUpperCase();
  const effectivePath = currentEndpoint?.endpointPath || currentTool?.endpointPath || '/';
  const effectiveTimeout = currentEndpoint?.timeoutMs || currentTool?.timeoutMs || 15000;
  const fullTargetUrl = currentTool?.baseUrl ? `${currentTool.baseUrl.replace(/\/$/, '')}${effectivePath}` : effectivePath;

  // Calculate SLA violations
  const slaViolations = currentReport && currentReport.latencyMs > effectiveTimeout ? 1 : 0;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(5, 6, 9, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.18s ease-out',
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '780px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0F111A',
          border: '1px solid rgba(255, 85, 0, 0.28)',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(255, 85, 0, 0.12)',
          overflow: 'hidden',
          animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* ================================================================= */}
        {/* 1. MODAL HEADER                                                   */}
        {/* ================================================================= */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: '#12141D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 85, 0, 0.12)',
                border: '1px solid rgba(255, 85, 0, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Terminal size={18} color="#FF5500" />
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '-0.01em' }}>
                  Postman API Testing & Quality Suite
                </h3>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(255, 85, 0, 0.15)',
                    color: '#FF6C37',
                    border: '1px solid rgba(255, 85, 0, 0.3)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Newman v6.2.1
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: '#9FA4B5',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Collection v2.1.0
                </span>
              </div>

              <div style={{ fontSize: '0.74rem', color: '#9FA4B5', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, color: '#FFFFFF' }}>{currentTool?.name || 'API Service'}</span>
                {currentTool?.id && (
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', color: '#646A7E', fontSize: '0.70rem' }}>
                    ID: {currentTool.id}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#9FA4B5',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#FFFFFF';
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#9FA4B5';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Close modal (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* ================================================================= */}
        {/* 2. TABS NAVIGATION                                                */}
        {/* ================================================================= */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: '#090A0E',
            padding: '0 16px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('suite')}
            style={{
              padding: '11px 16px',
              fontSize: '0.80rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'suite' ? '2px solid #FF5500' : '2px solid transparent',
              color: activeTab === 'suite' ? '#FF6C37' : '#9FA4B5',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Play size={13} className="fill-current" />
            <span>Run Newman Test Suite</span>
            {currentReport && (
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: currentReport.status === 'PASSED' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                  color: currentReport.status === 'PASSED' ? '#10B981' : '#EF4444',
                  border: currentReport.status === 'PASSED' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
                }}
              >
                {currentReport.status}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('collection')}
            style={{
              padding: '11px 16px',
              fontSize: '0.80rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'collection' ? '2px solid #FF5500' : '2px solid transparent',
              color: activeTab === 'collection' ? '#FF6C37' : '#9FA4B5',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Download size={13} />
            <span>Postman Collection v2.1.0</span>
          </button>
        </div>

        {/* ================================================================= */}
        {/* 3. MODAL BODY                                                     */}
        {/* ================================================================= */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* TAB 1: RUN NEWMAN TEST SUITE */}
          {activeTab === 'suite' && (
            <>
              {/* Card 1: Automated Contract & Quality Verification */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#12141D',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} color="#FF5500" />
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Automated Contract & Quality Verification
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.74rem' }}>
                    <CheckCircle size={14} color="#10B981" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ color: '#FFFFFF' }}>HTTP status codes:</strong>
                      <div style={{ color: '#9FA4B5', fontSize: '0.70rem' }}>Checks for valid 2xx response status</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.74rem' }}>
                    <CheckCircle size={14} color="#10B981" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ color: '#FFFFFF' }}>SLA latency thresholds:</strong>
                      <div style={{ color: '#9FA4B5', fontSize: '0.70rem' }}>Confirms response arrives within SLA limit</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.74rem' }}>
                    <CheckCircle size={14} color="#10B981" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ color: '#FFFFFF' }}>JSON response validity:</strong>
                      <div style={{ color: '#9FA4B5', fontSize: '0.70rem' }}>Ensures valid RFC 8259 syntax & application/json</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.74rem' }}>
                    <CheckCircle size={14} color="#10B981" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ color: '#FFFFFF' }}>OpenAPI schema compliance:</strong>
                      <div style={{ color: '#9FA4B5', fontSize: '0.70rem' }}>Validates response matches schema definitions</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.74rem' }}>
                    <CheckCircle size={14} color="#10B981" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ color: '#FFFFFF' }}>Response contract validation:</strong>
                      <div style={{ color: '#9FA4B5', fontSize: '0.70rem' }}>Verifies mandatory fields, types & error handling</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Target Endpoint Contract */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#12141D',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#9FA4B5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Target Endpoint Contract
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {tools.length > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.70rem', color: '#646A7E', fontWeight: 600 }}>API:</span>
                        <select
                          value={selectedToolId}
                          onChange={(e) => {
                            setSelectedToolId(e.target.value);
                            const t = tools.find((x) => x.id === e.target.value);
                            setSelectedEndpointId(t?.endpoints?.[0]?.id || 'primary');
                          }}
                          style={{
                            backgroundColor: '#090A0E',
                            color: '#FFFFFF',
                            fontSize: '0.74rem',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            outline: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          {tools.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {endpoints.length > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.70rem', color: '#646A7E', fontWeight: 600 }}>Route:</span>
                        <select
                          value={selectedEndpointId}
                          onChange={(e) => handleEndpointChange(e.target.value)}
                          style={{
                            backgroundColor: '#090A0E',
                            color: '#FFFFFF',
                            fontSize: '0.74rem',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            outline: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          {endpoints.map((ep) => (
                            <option key={ep.id} value={ep.id}>
                              {ep.httpMethod} {ep.name || ep.endpointPath}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Method, Name, URL, SLA Box */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#090A0E',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '5px',
                      backgroundColor:
                        effectiveMethod === 'POST'
                          ? 'rgba(16, 185, 129, 0.18)'
                          : effectiveMethod === 'GET'
                          ? 'rgba(14, 165, 233, 0.18)'
                          : effectiveMethod === 'PUT'
                          ? 'rgba(245, 158, 11, 0.18)'
                          : effectiveMethod === 'DELETE'
                          ? 'rgba(239, 68, 68, 0.18)'
                          : 'rgba(168, 85, 247, 0.18)',
                      color:
                        effectiveMethod === 'POST'
                          ? '#10B981'
                          : effectiveMethod === 'GET'
                          ? '#38BDF8'
                          : effectiveMethod === 'PUT'
                          ? '#F59E0B'
                          : effectiveMethod === 'DELETE'
                          ? '#EF4444'
                          : '#C084FC',
                      border:
                        effectiveMethod === 'POST'
                          ? '1px solid rgba(16, 185, 129, 0.4)'
                          : effectiveMethod === 'GET'
                          ? '1px solid rgba(14, 165, 233, 0.4)'
                          : effectiveMethod === 'PUT'
                          ? '1px solid rgba(245, 158, 11, 0.4)'
                          : effectiveMethod === 'DELETE'
                          ? '1px solid rgba(239, 68, 68, 0.4)'
                          : '1px solid rgba(168, 85, 247, 0.4)',
                    }}
                  >
                    {effectiveMethod}
                  </span>

                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <div style={{ fontSize: '0.80rem', fontWeight: 700, color: '#FFFFFF' }}>
                      {currentEndpoint?.name || currentTool?.name || 'Primary Endpoint'}
                    </div>
                    <div
                      style={{
                        fontSize: '0.74rem',
                        fontFamily: 'var(--font-mono, monospace)',
                        color: '#FF6C37',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={fullTargetUrl}
                    >
                      {fullTargetUrl}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '0.74rem',
                      fontFamily: 'var(--font-mono, monospace)',
                      color: '#9FA4B5',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <Clock size={13} color="#F59E0B" />
                    <span>SLA: &lt;{effectiveTimeout}ms</span>
                  </div>
                </div>

                {/* Prominent Orange Gradient Button */}
                <button
                  type="button"
                  onClick={handleRunTests}
                  disabled={isRunning}
                  style={{
                    width: '100%',
                    padding: '12px 20px',
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '0.86rem',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: isRunning ? 'wait' : 'pointer',
                    background: isRunning
                      ? 'rgba(255, 85, 0, 0.4)'
                      : 'linear-gradient(135deg, #FF5500 0%, #EA580C 100%)',
                    border: '1px solid rgba(255, 85, 0, 0.5)',
                    boxShadow: '0 4px 18px rgba(255, 85, 0, 0.35)',
                    transition: 'all 0.15s ease',
                    opacity: isRunning ? 0.75 : 1,
                  }}
                >
                  <Play size={14} className={`fill-current ${isRunning ? 'animate-spin' : ''}`} />
                  <span>
                    {isRunning ? 'Executing Postman Test Suite (Newman)...' : 'Execute Postman Test Suite (Newman)'}
                  </span>
                </button>

                {/* Live Running Progress */}
                {isRunning && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 85, 0, 0.08)',
                      border: '1px solid rgba(255, 85, 0, 0.25)',
                      fontSize: '0.76rem',
                      color: '#FF6C37',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>{currentExecutionStep}</span>
                      <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700 }}>Running...</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center', fontSize: '0.72rem', borderTop: '1px solid rgba(255, 85, 0, 0.15)', paddingTop: '6px' }}>
                      <div>Completed: <strong style={{ color: '#FFFFFF' }}>{executionStats.completed}</strong></div>
                      <div>Passed: <strong style={{ color: '#10B981' }}>{executionStats.passed}</strong></div>
                      <div>Failed: <strong style={{ color: '#EF4444' }}>{executionStats.failed}</strong></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 3: Test Results (Displayed after execution) */}
              {currentReport && (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: '#12141D',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  {/* Status Banner */}
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px',
                      backgroundColor:
                        currentReport.status === 'PASSED'
                          ? 'rgba(16, 185, 129, 0.12)'
                          : 'rgba(239, 68, 68, 0.12)',
                      border:
                        currentReport.status === 'PASSED'
                          ? '1px solid rgba(16, 185, 129, 0.35)'
                          : '1px solid rgba(239, 68, 68, 0.35)',
                      color: currentReport.status === 'PASSED' ? '#10B981' : '#EF4444',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {currentReport.status === 'PASSED' ? (
                        <CheckCircle2 size={20} color="#10B981" />
                      ) : (
                        <XCircle size={20} color="#EF4444" />
                      )}
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.86rem' }}>
                          {currentReport.status === 'PASSED'
                            ? 'All Postman Assertions Passed (Contract Verified)'
                            : 'Test Suite Assertions Failed'}
                        </div>
                        <div style={{ fontSize: '0.72rem', opacity: 0.9, marginTop: '2px', color: '#9FA4B5' }}>
                          {currentReport.errorMessage ||
                            `${currentReport.passedTests} of ${currentReport.totalTests} tests succeeded in ${currentReport.latencyMs}ms.`}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {currentReport.status === 'PASSED' &&
                        (currentTool?.status === 'DRAFT' || currentTool?.status === 'TESTING' || submittedSuccess) && (
                          submittedSuccess || currentTool?.status === 'PENDING_REVIEW' ? (
                            <span
                              style={{
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                padding: '5px 10px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                color: '#10B981',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                              }}
                            >
                              <CheckCircle2 size={13} />
                              <span>Submitted for Review</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={handleSubmitForReview}
                              disabled={submittingReview}
                              style={{
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                padding: '5px 12px',
                                borderRadius: '6px',
                                backgroundColor: '#10B981',
                                color: '#FFFFFF',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                              }}
                            >
                              <Send size={12} className={submittingReview ? 'animate-spin' : ''} />
                              <span>{submittingReview ? 'Submitting...' : 'Submit for Review'}</span>
                            </button>
                          )
                        )}

                      <button
                        type="button"
                        onClick={handleRunTests}
                        disabled={isRunning}
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          padding: '5px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          color: '#FFFFFF',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <RotateCcw size={12} className={isRunning ? 'animate-spin' : ''} />
                        <span>Run Again</span>
                      </button>
                    </div>
                  </div>

                  {/* 6 Summary Metric Cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                      gap: '8px',
                    }}
                  >
                    <div style={{ backgroundColor: '#090A0E', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <span style={{ fontSize: '0.66rem', color: '#646A7E', fontWeight: 700, textTransform: 'uppercase' }}>Status</span>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, marginTop: '2px', color: currentReport.status === 'PASSED' ? '#10B981' : '#EF4444' }}>
                        {currentReport.status}
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#090A0E', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <span style={{ fontSize: '0.66rem', color: '#646A7E', fontWeight: 700, textTransform: 'uppercase' }}>Total</span>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, marginTop: '2px', color: '#FFFFFF' }}>
                        {currentReport.totalTests}
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#090A0E', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <span style={{ fontSize: '0.66rem', color: '#646A7E', fontWeight: 700, textTransform: 'uppercase' }}>Passed</span>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, marginTop: '2px', color: '#10B981' }}>
                        {currentReport.passedTests}
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#090A0E', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <span style={{ fontSize: '0.66rem', color: '#646A7E', fontWeight: 700, textTransform: 'uppercase' }}>Failed</span>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, marginTop: '2px', color: currentReport.failedTests > 0 ? '#EF4444' : '#646A7E' }}>
                        {currentReport.failedTests}
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#090A0E', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <span style={{ fontSize: '0.66rem', color: '#646A7E', fontWeight: 700, textTransform: 'uppercase' }}>Latency</span>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, marginTop: '2px', color: '#FFFFFF', fontFamily: 'var(--font-mono, monospace)' }}>
                        {currentReport.latencyMs}ms
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#090A0E', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <span style={{ fontSize: '0.66rem', color: '#646A7E', fontWeight: 700, textTransform: 'uppercase' }}>SLA</span>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, marginTop: '2px', color: slaViolations > 0 ? '#EF4444' : '#10B981' }}>
                        {slaViolations > 0 ? `${slaViolations} Viol` : '0 Viol'}
                      </div>
                    </div>
                  </div>

                  {/* Assertion Checklist */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9FA4B5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Detailed Test Results ({currentReport.assertions.length} Assertions)
                    </span>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {currentReport.assertions.map((assertion, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.76rem',
                            backgroundColor: assertion.passed ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.1)',
                            border: assertion.passed ? '1px solid rgba(16, 185, 129, 0.18)' : '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#FFFFFF',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {assertion.passed ? (
                              <CheckCircle size={14} color="#10B981" />
                            ) : (
                              <XCircle size={14} color="#EF4444" />
                            )}
                            <span>{assertion.name}</span>
                          </div>

                          <span
                            style={{
                              fontSize: '0.64rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: assertion.passed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: assertion.passed ? '#10B981' : '#EF4444',
                            }}
                          >
                            {assertion.passed ? 'PASS' : 'FAIL'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Expandable Error Details */}
                  {currentReport.errorMessage && (
                    <div style={{ borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', overflow: 'hidden' }}>
                      <button
                        type="button"
                        onClick={() => setExpandedErrors(!expandedErrors)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: 'rgba(239, 68, 68, 0.12)',
                          border: 'none',
                          color: '#F87171',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertTriangle size={14} color="#EF4444" />
                          <span>Error Details & Stack Diagnostics</span>
                        </span>
                        {expandedErrors ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>

                      {expandedErrors && (
                        <div
                          style={{
                            padding: '10px 12px',
                            backgroundColor: '#090A0E',
                            color: '#F87171',
                            fontFamily: 'var(--font-mono, monospace)',
                            fontSize: '0.72rem',
                            whiteSpace: 'pre-wrap',
                            maxHeight: '140px',
                            overflowY: 'auto',
                            borderTop: '1px solid rgba(239, 68, 68, 0.2)',
                          }}
                        >
                          {currentReport.errorMessage}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Response Payload */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9FA4B5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Response Payload ({currentReport.statusCode} HTTP Status)
                      </span>

                      <button
                        type="button"
                        onClick={handleCopyResponseBody}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: copied ? '#10B981' : '#FF6C37',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copied ? 'Copied' : 'Copy Body'}</span>
                      </button>
                    </div>

                    <pre
                      style={{
                        margin: 0,
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#090A0E',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: '0.72rem',
                        color: '#E2E8F0',
                        maxHeight: '160px',
                        overflowY: 'auto',
                      }}
                    >
                      {currentReport.responseBody
                        ? JSON.stringify(currentReport.responseBody, null, 2)
                        : '(Empty Response)'}
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: POSTMAN COLLECTION V2.1.0 */}
          {activeTab === 'collection' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {syncNotice && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#38BDF8',
                    fontSize: '0.76rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{syncNotice}</span>
                  <button
                    onClick={() => setSyncNotice(null)}
                    style={{ background: 'none', border: 'none', color: '#38BDF8', cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* 2 Export Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '12px',
                }}
              >
                {/* Export Card 1: Collection v2.1.0 */}
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    backgroundColor: '#12141D',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255, 85, 0, 0.15)',
                        color: '#FF5500',
                        fontWeight: 800,
                        fontSize: '0.80rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      2.1
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                        Postman Collection v2.1.0
                      </h4>
                      <p style={{ fontSize: '0.70rem', color: '#9FA4B5', margin: '2px 0 0 0' }}>
                        Standardized collection schema with contract scripts
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportCollection}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#FFFFFF',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <Download size={13} color="#FF5500" />
                    <span>Download Collection JSON</span>
                  </button>
                </div>

                {/* Export Card 2: Environment JSON */}
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    backgroundColor: '#12141D',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(56, 189, 248, 0.15)',
                        color: '#38BDF8',
                        fontWeight: 800,
                        fontSize: '0.80rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FileCode size={16} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                        Postman Environment
                      </h4>
                      <p style={{ fontSize: '0.70rem', color: '#9FA4B5', margin: '2px 0 0 0' }}>
                        Pre-configured baseUrl and secret environment variables
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportEnvironment}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#FFFFFF',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <Download size={13} color="#38BDF8" />
                    <span>Download Environment JSON</span>
                  </button>
                </div>
              </div>

              {/* Cloud Sync Card */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  backgroundColor: '#12141D',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Cloud size={20} color="#FF5500" />
                  <div>
                    <h4 style={{ fontSize: '0.84rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                      Postman Cloud Workspace Sync
                    </h4>
                    <p style={{ fontSize: '0.70rem', color: '#9FA4B5', margin: '2px 0 0 0' }}>
                      Publish generated collection directly to your remote Postman workspace
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSyncToPostmanCloud}
                  disabled={syncing}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#FF5500',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: syncing ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    opacity: syncing ? 0.7 : 1,
                  }}
                >
                  <Cloud size={13} className={syncing ? 'animate-spin' : ''} />
                  <span>{syncing ? 'Syncing...' : 'Sync to Postman Cloud'}</span>
                </button>
              </div>

              {/* Collection Preview (if available) */}
              {collectionPreview && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9FA4B5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Generated Collection Schema Preview
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPreview}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: previewCopied ? '#10B981' : '#FF6C37',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {previewCopied ? <Check size={12} /> : <Copy size={12} />}
                      <span>{previewCopied ? 'Copied' : 'Copy Collection'}</span>
                    </button>
                  </div>

                  <pre
                    style={{
                      margin: 0,
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#090A0E',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: '0.70rem',
                      color: '#CBD5E1',
                      maxHeight: '180px',
                      overflowY: 'auto',
                    }}
                  >
                    {collectionPreview}
                  </pre>
                </div>
              )}

              {/* Import Instructions */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#090A0E',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  fontSize: '0.72rem',
                  color: '#9FA4B5',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 700, color: '#FFFFFF', marginBottom: '4px' }}>
                  How to Import into Postman Desktop:
                </div>
                <ol style={{ margin: 0, paddingLeft: '16px' }}>
                  <li>Download the Collection JSON and Environment JSON above.</li>
                  <li>In Postman Desktop, click <strong>Import</strong> in the top left header.</li>
                  <li>Drag and drop the downloaded files into Postman.</li>
                  <li>Select the active environment and run the test collection.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* 4. MODAL FOOTER                                                   */}
        {/* ================================================================= */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: '#12141D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#646A7E' }}>
            <Terminal size={14} color="#FF5500" />
            <span>ToolToll Postman Verification Runner</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
