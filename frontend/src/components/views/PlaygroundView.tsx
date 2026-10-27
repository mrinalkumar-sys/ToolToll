import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Agent, PlanResult } from '../../types';
import { formatMicroUsd } from '../../utils/formatters';
import { JsonViewer } from '../common/JsonViewer';
import {
  Bot,
  Play,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';

export const PlaygroundView: React.FC = () => {
  const { wallet, refreshWallet, isAuthenticated } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [taskPrompt, setTaskPrompt] = useState<string>(
    'Translate this customer message to French, check if it contains scam risk, and analyze its sentiment: "URGENT: Your account requires immediate verification to avoid suspension. Click here now."'
  );

  const [planning, setPlanning] = useState<boolean>(false);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  const [executing, setExecuting] = useState<boolean>(false);
  const [executionResults, setExecutionResults] = useState<any[] | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      api.getAgents().then((data) => {
        setAgents(data);
        if (data.length > 0) {
          setSelectedAgentId(data[0].id);
        }
      }).catch(console.error);
    }
  }, [isAuthenticated]);

  const presetTasks = [
    {
      title: 'Multilingual Scam & Sentiment Pipeline',
      prompt: 'Translate this customer message to French, check if it contains scam risk, and analyze its sentiment: "URGENT: Your account requires immediate verification to avoid suspension. Click here now."',
    },
    {
      title: 'Security Risk Triage',
      prompt: 'Analyze this incoming SMS message for phishing and scam likelihood: "Congratulations! You won a $1,000 Walmart gift card. Text YES to claim."',
    },
    {
      title: 'Customer Feedback Translation & Sentiment',
      prompt: 'Translate to Spanish and evaluate customer satisfaction sentiment: "The customer service representative resolved my invoice issue in minutes. Truly fantastic experience!"',
    },
  ];

  const handleGeneratePlan = async () => {
    if (!taskPrompt.trim()) return;
    setPlanning(true);
    setPlanError(null);
    setPlan(null);
    setExecutionResults(null);
    setExecutionError(null);

    try {
      const res = await api.generateAgentPlan(taskPrompt, selectedAgentId || undefined);
      setPlan(res);
    } catch (err: any) {
      setPlanError(err?.message || 'Failed to generate agent execution plan');
    } finally {
      setPlanning(false);
    }
  };

  const handleExecutePlan = async () => {
    if (!plan || !plan.steps) return;
    setExecuting(true);
    setExecutionError(null);

    try {
      const res = await api.executeAgentPlan(
        plan.task,
        plan.steps,
        selectedAgentId || (agents[0]?.id || '')
      );
      setExecutionResults(res.results);
      await refreshWallet();
    } catch (err: any) {
      setExecutionError(err?.message || 'Agent execution failed');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div className="badge badge-purple" style={{ marginBottom: '8px' }}>
          <Sparkles size={13} />
          Autonomous Orchestrator
        </div>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '8px' }}>Autonomous Agent Playground</h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '780px' }}>
          Submit high-level natural language tasks. The system selects and ranks verified marketplace APIs, models the data pipeline, calculates upfront micro-USD budgets, and executes calls through the secure gateway.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
        {/* Left Column: Task Input, Plan, and Execution Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Task Input Card */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={18} color="var(--accent-purple-light)" />
              Natural Language Task Prompt
            </h3>

            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {presetTasks.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                  onClick={() => setTaskPrompt(preset.prompt)}
                >
                  ⚡ {preset.title}
                </button>
              ))}
            </div>

            <textarea
              className="form-textarea"
              rows={4}
              value={taskPrompt}
              onChange={(e) => setTaskPrompt(e.target.value)}
              placeholder="Describe your multi-step task in plain English..."
              style={{ fontSize: '0.95rem', marginBottom: '16px' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Powered by AI Discovery & Verification Engine
              </div>
              <button
                className="btn btn-purple"
                disabled={planning || !taskPrompt.trim()}
                onClick={handleGeneratePlan}
              >
                <Sparkles size={16} />
                {planning ? 'Analyzing & Planning...' : 'Generate Execution Plan'}
              </button>
            </div>

            {planError && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(244, 63, 94, 0.1)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  color: '#fb7185',
                  fontSize: '0.88rem',
                }}
              >
                {planError}
              </div>
            )}
          </div>

          {/* Generated Plan Breakdown */}
          {plan && (
            <div
              className="glass-panel glow-cyan"
              style={{
                padding: '24px',
                border: '1px solid var(--border-accent)',
                animation: 'fadeIn 0.2s ease-out',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <div className="badge badge-cyan" style={{ marginBottom: '4px' }}>
                    Plan Ready for Approval
                  </div>
                  <h3 style={{ fontSize: '1.2rem' }}>Execution Pipeline ({plan.steps?.length || 0} Steps)</h3>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ESTIMATED COST</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-cyan-light)', fontFamily: 'var(--font-mono)' }}>
                    {formatMicroUsd(plan.estimatedCostMicroUsd)}
                  </div>
                </div>
              </div>

              {/* Steps timeline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                {plan.steps?.map((step: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'var(--accent-purple-glow)',
                        color: 'var(--accent-purple-light)',
                        border: '1px solid rgba(139, 92, 246, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                      }}
                    >
                      {step.step || idx + 1}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                        {step.toolName || step.toolSlug}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {step.reason || 'Matched requirement capability'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#38bdf8' }}>
                      {formatMicroUsd(step.priceMicroUsd)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Approval & Execute Trigger */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <ShieldCheck size={16} color="var(--accent-emerald)" />
                  <span>Funds will be atomically locked and released upon failure</span>
                </div>

                <button
                  className="btn btn-primary btn-lg"
                  disabled={executing}
                  onClick={handleExecutePlan}
                >
                  {executing ? <RotateCw size={16} style={{ animation: 'spin 1s infinite linear' }} /> : <Play size={16} />}
                  {executing ? 'Executing Pipeline...' : 'Approve & Execute Pipeline'}
                </button>
              </div>

              {executionError && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(244, 63, 94, 0.1)',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    color: '#fb7185',
                    fontSize: '0.88rem',
                  }}
                >
                  {executionError}
                </div>
              )}
            </div>
          )}

          {/* Live Execution Results Timeline */}
          {executionResults && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                <CheckCircle size={20} color="var(--accent-emerald)" />
                <h3 style={{ fontSize: '1.2rem' }}>Execution Output & Quality Verifications</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {executionResults.map((res: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge badge-emerald">STEP {res.step || idx + 1}</span>
                        <strong style={{ fontSize: '0.95rem' }}>{res.toolName || `Step ${idx + 1}`}</strong>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#34d399' }}>
                        {formatMicroUsd(res.costMicroUsd || res.priceMicroUsd)} ({res.durationMs || 16}ms)
                      </div>
                    </div>

                    <JsonViewer data={res.output || res} maxHeight="160px" title="Step Output Data" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Active Agent & Budget Guard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Agent Selector Card */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bot size={16} color="var(--accent-cyan)" />
              Calling Agent Identity
            </h4>

            {agents.length > 0 ? (
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <select
                  className="form-select"
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                >
                  {agents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name} (Budget: {formatMicroUsd(ag.maxBudgetMicroUsd)})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Using built-in system demo agent with unrestricted sandbox permissions.
              </div>
            )}

            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.8rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Wallet Balance:</span>
                <span style={{ fontWeight: 700, color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                  {formatMicroUsd(wallet?.balance)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>In-flight Reserved:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {formatMicroUsd(wallet?.reservedBalance || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Invariant Guarantees */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} color="var(--accent-emerald)" />
              Security & Financial Invariants
            </h4>

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ color: 'var(--accent-cyan)' }}>•</span>
                <span><strong>Atomic Fund Reservation:</strong> Balances locked before execution to prevent concurrent overspending.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ color: 'var(--accent-emerald)' }}>•</span>
                <span><strong>Idempotency Enforcement:</strong> Replays with identical keys return cached results with zero double-charge.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ color: 'var(--accent-amber)' }}>•</span>
                <span><strong>Automated Reversals:</strong> Upstream 5xx, timeouts, or schema mismatches trigger instant credit refunds.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
