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
  ShieldCheck,
  CheckCircle,
  RotateCw,
  Cpu,
  Layers,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { Tool } from '../../types';

interface PlaygroundViewProps {
  initialTool?: Tool | null;
}

export const PlaygroundView: React.FC<PlaygroundViewProps> = ({ initialTool }) => {
  const { wallet, refreshWallet, isAuthenticated, loginDemo } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [taskPrompt, setTaskPrompt] = useState<string>(
    initialTool
      ? `Execute workflow with ${initialTool.name} (${initialTool.slug}): Process sample input and verify gateway output.`
      : 'Translate this customer message to French, check if it contains scam risk, and analyze its sentiment: "URGENT: Your account requires immediate verification to avoid suspension. Click here now."'
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
      title: 'Multilingual Scam & Sentiment',
      prompt: 'Translate this customer message to French, check if it contains scam risk, and analyze its sentiment: "URGENT: Your account requires immediate verification to avoid suspension. Click here now."',
    },
    {
      title: 'Security Risk Triage',
      prompt: 'Analyze this incoming SMS message for phishing and scam likelihood: "Congratulations! You won a $1,000 Walmart gift card. Text YES to claim."',
    },
    {
      title: 'Customer Feedback Sentiment',
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
      if (!isAuthenticated) {
        await loginDemo('consumer');
      }
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
    <div className="section-dark" style={{ minHeight: '85vh', paddingTop: '40px' }}>
      <div className="container-editorial">
        {/* Header */}
        <div style={{ maxWidth: '840px', marginBottom: '36px' }}>
          <span className="section-kicker">Agent Orchestration Console</span>
          <h1
            style={{
              fontSize: 'clamp(1.5rem, 3.8vw, 3.2rem)',
              maxWidth: '100%',
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
              fontWeight: 900,
              letterSpacing: '-0.035em',
              color: '#FFFFFF',
              marginBottom: '14px',
            }}
          >
            Autonomous Agent Playground.
          </h1>
          <p style={{ color: 'var(--text-dark-secondary)', fontSize: '1.05rem', lineHeight: 1.6 }}>
            Submit natural language requests. The ToolToll orchestrator discovers verified marketplace tools, computes upfront micro-USD budgets, and executes calls under atomic financial constraints.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
          {/* Main Console Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: '1 1 65%' }}>
            {/* Task Prompt Card */}
            <div className="card-dark" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bot size={18} color="var(--brand-orange)" />
                  Task Instruction Prompt
                </h3>
                <span className="badge badge-orange">NLP Intent Parser</span>
              </div>

              {/* Presets */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {presetTasks.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.76rem', padding: '5px 12px', borderRadius: 'var(--radius-xs)' }}
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
                style={{ fontSize: '0.94rem', marginBottom: '18px' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dark-muted)' }}>
                  Evaluated against live input schemas with zero sandbox leakage
                </div>
                <button
                  className="btn btn-primary"
                  disabled={planning || !taskPrompt.trim()}
                  onClick={handleGeneratePlan}
                >
                  <Sparkles size={16} />
                  {planning ? 'Synthesizing Pipeline...' : 'Generate Execution Plan'}
                </button>
              </div>

              {planError && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--status-rose-bg)',
                    border: '1px solid var(--status-rose-border)',
                    color: '#F87171',
                    fontSize: '0.88rem',
                  }}
                >
                  {planError}
                </div>
              )}
            </div>

            {/* Generated Plan Card */}
            {plan && (
              <div
                className="card-dark highlight-orange"
                style={{
                  padding: '28px',
                  border: '1px solid var(--brand-orange-border)',
                  animation: 'fadeIn 0.22s ease-out',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <span className="badge badge-orange" style={{ marginBottom: '6px' }}>
                      Ready For Execution
                    </span>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                      Execution Pipeline ({plan.steps?.length || 0} Sequential Steps)
                    </h3>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      ESTIMATED PIPELINE COST
                    </div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                      {formatMicroUsd(plan.estimatedCostMicroUsd)}
                    </div>
                  </div>
                </div>

                {/* Steps List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                  {plan.steps?.map((step: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '14px 18px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-dark)',
                      }}
                    >
                      <div
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: 'var(--radius-xs)',
                          background: 'var(--brand-orange)',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.88rem',
                        }}
                      >
                        {step.step || idx + 1}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.94rem', color: '#FFFFFF' }}>
                          {step.toolName || step.toolSlug}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-dark-secondary)' }}>
                          {step.reason || 'Matched requirement capability'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#38BDF8', fontWeight: 700 }}>
                        {formatMicroUsd(step.priceMicroUsd)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Execute Trigger */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '18px',
                    borderTop: '1px solid var(--border-dark)',
                    flexWrap: 'wrap',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-dark-secondary)' }}>
                    <ShieldCheck size={16} color="var(--status-emerald)" />
                    <span>Funds will be atomically reserved and settled upon verified 200 OK</span>
                  </div>

                  <button
                    className="btn btn-primary btn-lg"
                    disabled={executing}
                    onClick={handleExecutePlan}
                  >
                    {executing ? <RotateCw size={16} style={{ animation: 'spin 1s infinite linear' }} /> : <Play size={16} />}
                    {executing ? 'Executing Pipeline Calls...' : 'Approve & Execute Pipeline'}
                  </button>
                </div>

                {executionError && (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '14px 18px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--status-rose-bg)',
                      border: '1px solid var(--status-rose-border)',
                      color: '#F87171',
                      fontSize: '0.88rem',
                    }}
                  >
                    {executionError}
                  </div>
                )}
              </div>
            )}

            {/* Execution Results Card */}
            {executionResults && (
              <div className="card-dark" style={{ padding: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <CheckCircle size={22} color="var(--status-emerald)" />
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                      Execution Complete & Quality Verified
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dark-muted)' }}>
                      Double-entry ledger deductions processed successfully
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {executionResults.map((res: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '18px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-dark)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="badge badge-emerald">STEP {res.step || idx + 1}</span>
                          <strong style={{ fontSize: '0.98rem', color: '#FFFFFF' }}>{res.toolName || `Step ${idx + 1}`}</strong>
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', color: '#34D399', fontWeight: 700 }}>
                          {formatMicroUsd(res.costMicroUsd || res.priceMicroUsd)} ({res.durationMs || 16}ms)
                        </div>
                      </div>

                      <JsonViewer data={res.output || res} maxHeight="160px" title="Step Output Payload" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Column: Calling Identity & Ledger Invariants */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: '1 1 30%' }}>
            {/* Identity Card */}
            <div className="card-dark" style={{ padding: '24px' }}>
              <div
                style={{
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 800,
                  color: 'var(--brand-orange)',
                  marginBottom: '10px',
                }}
              >
                Calling Agent Identity
              </div>

              {agents.length > 0 ? (
                <div className="form-group" style={{ marginBottom: '14px' }}>
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
                <div style={{ fontSize: '0.84rem', color: 'var(--text-dark-secondary)', marginBottom: '14px' }}>
                  Operating as default autonomous sandbox agent.
                </div>
              )}

              <div
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-dark)',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-dark-muted)' }}>Available Balance:</span>
                  <span style={{ fontWeight: 800, color: '#34D399', fontFamily: 'var(--font-mono)' }}>
                    {formatMicroUsd(wallet?.balance)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dark-muted)' }}>In-flight Reserved:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-dark-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {formatMicroUsd(wallet?.reservedBalance || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Invariant Guarantees */}
            <div className="card-dark" style={{ padding: '24px' }}>
              <div
                style={{
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 800,
                  color: 'var(--brand-orange)',
                  marginBottom: '14px',
                }}
              >
                Financial & Security Invariants
              </div>

              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.82rem', color: 'var(--text-dark-secondary)' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <Zap size={15} color="var(--brand-orange)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ color: '#FFFFFF' }}>Atomic Fund Reservation:</strong> Balances locked via DB mutex prior to outbound call dispatch.
                  </div>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <ShieldCheck size={15} color="var(--status-emerald)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ color: '#FFFFFF' }}>Idempotency Enforcement:</strong> Replays with identical key return cached results without double charge.
                  </div>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <Layers size={15} color="var(--status-amber)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ color: '#FFFFFF' }}>Compensating Reversals:</strong> Timeouts or upstream 5xx errors trigger instant micro-USD ledger credits.
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
