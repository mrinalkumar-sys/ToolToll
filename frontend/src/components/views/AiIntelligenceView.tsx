import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { formatMicroUsd } from '../../utils/formatters';
import { JsonViewer } from '../common/JsonViewer';
import { AIPlanResponse, QualityJudgeResult, Tool, ToolCall, RefundEligibility, RefundResult } from '../../types';
import {
  Brain,
  Sparkles,
  Search,
  DollarSign,
  FileCode,
  Zap,
  CheckCircle,
  ShieldCheck,
  Scale,
  AlertTriangle,
  ArrowRight,
  Play,
  RefreshCw,
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  Sliders,
  Terminal,
  Grid,
  Info,
  History,
  AlignLeft,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RotateCcw,
  Copy,
  Check,
} from 'lucide-react';
import { NavTab } from '../common/Navbar';

interface AiIntelligenceViewProps {
  onSelectTab?: (tab: NavTab) => void;
  onRequireAuth?: (actionName: string) => void;
}

export const AiIntelligenceView: React.FC<AiIntelligenceViewProps> = ({ onSelectTab, onRequireAuth }) => {
  const { user, isAuthenticated, isLoading, refreshWallet } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'planner' | 'judge' | 'discover' | 'price' | 'onboard'>('overview');

  // Detect currently authenticated user's actual role (never rely on manually selected frontend role)
  const actualRole = React.useMemo<'consumer' | 'creator' | 'admin' | null>(() => {
    if (!isAuthenticated || !user) return null;
    const explicitRole = (user as any).role ? String((user as any).role).toLowerCase() : null;
    if (explicitRole === 'creator' || explicitRole === 'consumer' || explicitRole === 'admin') {
      return explicitRole as 'consumer' | 'creator' | 'admin';
    }
    if (user.isAdmin) return 'admin';
    if (user.isCreator) return 'creator';
    return 'consumer';
  }, [isAuthenticated, user]);

  const isConsumer = actualRole === 'consumer' || actualRole === 'admin';
  const isCreator = actualRole === 'creator' || actualRole === 'admin';

  // Track user identity to clear role-specific state on logout or user switch
  const prevUserIdRef = React.useRef<string | null>(user?.id || null);

  useEffect(() => {
    if (prevUserIdRef.current !== (user?.id || null)) {
      prevUserIdRef.current = user?.id || null;
      // Reset active tab to overview
      setActiveTab('overview');
      // Clear previous user's role-specific state
      setPlannerResult(null);
      setPlannerError(null);
      setJudgeResult(null);
      setJudgeError(null);
      setAuditHistory([]);
      setSelectedCallId(null);
      setRefundEligibility(null);
      setRefundSuccess(null);
      setRefundError(null);
      setDiscoverResults(null);
      setAdvisorResult(null);
      setOnboardResult(null);
    }
  }, [user?.id]);

  // Keep activeTab strictly within authorized boundaries
  useEffect(() => {
    if (activeTab === 'planner' || activeTab === 'judge' || activeTab === 'discover') {
      if (!isConsumer) {
        setActiveTab('overview');
      }
    } else if (activeTab === 'price' || activeTab === 'onboard') {
      if (!isCreator) {
        setActiveTab('overview');
      }
    }
  }, [activeTab, isConsumer, isCreator]);

  // Available Tools loaded from backend
  const [registeredTools, setRegisteredTools] = useState<Tool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);

  useEffect(() => {
    setToolsLoading(true);
    api.getTools()
      .then((data) => {
        if (data && data.length > 0) {
          setRegisteredTools(data);
        }
      })
      .catch((err) => console.warn('Could not load registered tools:', err))
      .finally(() => setToolsLoading(false));
  }, []);

  // ==========================================
  // 1. AI Planner State
  // ==========================================
  const [plannerTask, setPlannerTask] = useState(
    'Check whether this online seller is trustworthy by examining its website reputation and available fraud indicators.'
  );
  const [plannerTargetUrl, setPlannerTargetUrl] = useState('https://discount-luxury-vault.example.com');
  const [plannerBudgetUsd, setPlannerBudgetUsd] = useState<number>(0.025);
  const [plannerCategory, setPlannerCategory] = useState<string>('All');
  const [plannerMaxSteps, setPlannerMaxSteps] = useState<number>(4);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [plannerResult, setPlannerResult] = useState<AIPlanResponse | null>(null);
  const [plannerError, setPlannerError] = useState<string | null>(null);

  // ==========================================
  // 2. Quality Judge State (Redesigned Dashboard)
  // ==========================================
  const [selectedToolSlug, setSelectedToolSlug] = useState('demo-sentiment-analyzer');
  const [judgeToolName, setJudgeToolName] = useState('Sentiment Analyzer (Demo)');
  const [judgeHttpStatus, setJudgeHttpStatus] = useState<number>(200);
  const [judgeDurationMs, setJudgeDurationMs] = useState<number>(38);
  const [judgeExpectedSlaMs, setJudgeExpectedSlaMs] = useState<number>(5000);
  const [activeScenarioId, setActiveScenarioId] = useState<'valid' | 'hallucinated' | '502' | 'slow' | 'custom'>('custom');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Payload inputs
  const [judgeInputStr, setJudgeInputStr] = useState(
    JSON.stringify({ text: 'Customer service resolved my issue within 5 minutes, exceptional support!' }, null, 2)
  );
  const [judgeOutputStr, setJudgeOutputStr] = useState('');
  const [judgeSchemaStr, setJudgeSchemaStr] = useState(
    JSON.stringify({
      type: 'object',
      properties: {
        sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
        score: { type: 'number' },
      },
      required: ['sentiment', 'score'],
    }, null, 2)
  );

  // Live syntax errors
  const [inputJsonError, setInputJsonError] = useState<string | null>(null);
  const [outputJsonError, setOutputJsonError] = useState<string | null>(null);
  const [schemaJsonError, setSchemaJsonError] = useState<string | null>(null);

  // Execution & Audit results
  const [judgeLoading, setJudgeLoading] = useState(false);
  const [judgeStageText, setJudgeStageText] = useState<string>('');
  const [judgeResult, setJudgeResult] = useState<QualityJudgeResult | null>(null);
  const [judgeError, setJudgeError] = useState<string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Session Audit History
  const [auditHistory, setAuditHistory] = useState<QualityJudgeResult[]>([]);

  // User Executions & Refund System State
  const [userCalls, setUserCalls] = useState<ToolCall[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [refundEligibility, setRefundEligibility] = useState<RefundEligibility | null>(null);
  const [refundClaiming, setRefundClaiming] = useState<boolean>(false);
  const [refundSuccess, setRefundSuccess] = useState<string | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [copiedCallId, setCopiedCallId] = useState<boolean>(false);

  useEffect(() => {
    if (isAuthenticated && isConsumer) {
      api.getUserCalls()
        .then((calls) => {
          if (calls && Array.isArray(calls)) {
            setUserCalls(calls);
          }
        })
        .catch((err) => console.warn('Could not load user executions for Quality Judge:', err));
    } else {
      setUserCalls([]);
      setSelectedCallId(null);
      setRefundEligibility(null);
    }
  }, [isAuthenticated, isConsumer]);

  // ==========================================
  // 3. Existing Services State (Discover, Price, Onboard)
  // ==========================================
  const [discoverTask, setDiscoverTask] = useState('I need to translate incoming customer messages into French and detect if the sender is trying to scam me');
  const [discoverResults, setDiscoverResults] = useState<any[] | null>(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);

  const [advisorCategory, setAdvisorCategory] = useState('Security');
  const [advisorDescription, setAdvisorDescription] = useState('Real-time phishing and fraudulent text detector with threat heuristics');
  const [advisorLatency, setAdvisorLatency] = useState(25);
  const [advisorResult, setAdvisorResult] = useState<any | null>(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);

  const [onboardDoc, setOnboardDoc] = useState(
    'curl -X POST https://api.weathercheck.com/v1/current -H "Authorization: Bearer KEY" -d \'{"city": "Paris", "units": "celsius"}\'\nReturns temperature, humidity, and condition description.'
  );
  const [onboardResult, setOnboardResult] = useState<any | null>(null);
  const [onboardLoading, setOnboardLoading] = useState(false);

  // Validate JSON on change
  const validateJson = (str: string): { valid: boolean; error: string | null } => {
    if (!str.trim()) return { valid: true, error: null };
    try {
      JSON.parse(str);
      return { valid: true, error: null };
    } catch (e: any) {
      return { valid: false, error: e?.message || 'Invalid JSON syntax' };
    }
  };

  const handleInputChange = (val: string) => {
    setJudgeInputStr(val);
    const check = validateJson(val);
    setInputJsonError(check.error);
    if (activeScenarioId !== 'custom') setActiveScenarioId('custom');
  };

  const handleOutputChange = (val: string) => {
    setJudgeOutputStr(val);
    const check = validateJson(val);
    setOutputJsonError(check.error);
    if (activeScenarioId !== 'custom') setActiveScenarioId('custom');
  };

  const handleSchemaChange = (val: string) => {
    setJudgeSchemaStr(val);
    const check = validateJson(val);
    setSchemaJsonError(check.error);
    if (activeScenarioId !== 'custom') setActiveScenarioId('custom');
  };

  const formatJsonField = (field: 'input' | 'output' | 'schema') => {
    try {
      if (field === 'input') {
        const parsed = JSON.parse(judgeInputStr);
        setJudgeInputStr(JSON.stringify(parsed, null, 2));
        setInputJsonError(null);
      } else if (field === 'output') {
        const parsed = JSON.parse(judgeOutputStr);
        setJudgeOutputStr(JSON.stringify(parsed, null, 2));
        setOutputJsonError(null);
      } else if (field === 'schema') {
        const parsed = JSON.parse(judgeSchemaStr);
        setJudgeSchemaStr(JSON.stringify(parsed, null, 2));
        setSchemaJsonError(null);
      }
    } catch (err: any) {
      alert(`Cannot format invalid JSON: ${err?.message}`);
    }
  };

  // Preset Scenarios
  const scenarios = [
    {
      id: 'valid' as const,
      name: 'Valid Response',
      badge: 'HEALTHY CONTRACT',
      badgeColor: '#10B981',
      toolSlug: 'demo-sentiment-analyzer',
      toolName: 'Sentiment Analyzer (Demo)',
      status: 200,
      duration: 38,
      slaLimit: 5000,
      description: 'Customer review evaluation responding within 38ms with valid JSON schema properties.',
      input: { text: 'Customer service resolved my issue within 5 minutes, exceptional support!' },
      output: { sentiment: 'positive', score: 0.94, confidence: 0.98 },
      schema: {
        type: 'object',
        properties: {
          sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
          score: { type: 'number' },
        },
        required: ['sentiment', 'score'],
      },
    },
    {
      id: 'hallucinated' as const,
      name: 'Invalid Response',
      badge: 'SCHEMA VIOLATION',
      badgeColor: '#F59E0B',
      toolSlug: 'demo-scam-risk-analyzer',
      toolName: 'Scam Message Risk Analyzer (Demo)',
      status: 200,
      duration: 65,
      slaLimit: 5000,
      description: 'Phishing scanner returning irrelevant weather text missing required risk_score property.',
      input: { text: 'Claim your $10,000 cash prize right now at http://win-claim.xyz' },
      output: { note: 'The weather in London is pleasant today with light breeze.', irrelevantField: 42 },
      schema: {
        type: 'object',
        properties: {
          is_scam: { type: 'boolean' },
          risk_score: { type: 'number' },
        },
        required: ['is_scam', 'risk_score'],
      },
    },
    {
      id: '502' as const,
      name: 'Server Error',
      badge: 'GATEWAY FAILURE',
      badgeColor: '#EF4444',
      toolSlug: 'demo-text-translator',
      toolName: 'Text Translator (Demo)',
      status: 502,
      duration: 450,
      slaLimit: 5000,
      description: 'Upstream microservice worker crashed or timed out. Automatic reversal triggered.',
      input: { text: 'Hello world', targetLang: 'es' },
      output: { error: 'Bad Gateway: Upstream translation cluster worker connection terminated unexpectedly.' },
      schema: {
        type: 'object',
        properties: {
          translated_text: { type: 'string' },
        },
        required: ['translated_text'],
      },
    },
    {
      id: 'slow' as const,
      name: 'Slow Response',
      badge: 'SLA BREACH',
      badgeColor: '#A855F7',
      toolSlug: 'demo-scam-risk-analyzer',
      toolName: 'Scam Message Risk Analyzer (Demo)',
      status: 200,
      duration: 9450,
      slaLimit: 5000,
      description: 'Valid payload returned, but response latency (9,450ms) exceeded the 5,000ms contractual SLA.',
      input: { text: 'URGENT: Verify your account credential to prevent lockout' },
      output: { is_scam: true, risk_score: 0.92, flagged_categories: ['urgency', 'credential_harvesting'] },
      schema: {
        type: 'object',
        properties: {
          is_scam: { type: 'boolean' },
          risk_score: { type: 'number' },
        },
        required: ['is_scam', 'risk_score'],
      },
    },
  ];

  const loadScenario = (scenarioId: 'valid' | 'hallucinated' | '502' | 'slow') => {
    const sc = scenarios.find((s) => s.id === scenarioId);
    if (!sc) return;
    setSelectedCallId(null);
    setRefundEligibility(null);
    setRefundSuccess(null);
    setRefundError(null);
    setJudgeResult(null);
    setActiveScenarioId(sc.id);
    setSelectedToolSlug(sc.toolSlug);
    setJudgeToolName(sc.toolName);
    setJudgeHttpStatus(sc.status);
    setJudgeDurationMs(sc.duration);
    setJudgeExpectedSlaMs(sc.slaLimit);
    setJudgeInputStr(JSON.stringify(sc.input, null, 2));
    setJudgeOutputStr(JSON.stringify(sc.output, null, 2));
    setJudgeSchemaStr(JSON.stringify(sc.schema, null, 2));
    setInputJsonError(null);
    setOutputJsonError(null);
    setSchemaJsonError(null);
    setJudgeError(null);
  };

  const handleToolOrCallSelect = (val: string) => {
    setRefundEligibility(null);
    setRefundSuccess(null);
    setRefundError(null);
    setJudgeResult(null);

    if (val.startsWith('call:')) {
      const callId = val.replace('call:', '');
      const call = userCalls.find((c) => c.id === callId);
      if (call) {
        setSelectedCallId(call.id);
        setSelectedToolSlug(`call:${call.id}`);
        setJudgeToolName(call.tool?.name || 'API Execution');
        setJudgeHttpStatus(call.httpStatus || 200);
        setJudgeDurationMs(call.latencyMs || 0);

        const matchTool = registeredTools.find((t) => t.id === call.toolId || t.name === call.tool?.name);
        if (matchTool) {
          setJudgeExpectedSlaMs(matchTool.timeoutMs || 5000);
          if (matchTool.outputSchema) {
            setJudgeSchemaStr(JSON.stringify(matchTool.outputSchema, null, 2));
          }
        } else {
          setJudgeExpectedSlaMs(5000);
        }

        setJudgeInputStr(call.inputPayload ? JSON.stringify(call.inputPayload, null, 2) : '');
        setJudgeOutputStr(call.outputPayload ? JSON.stringify(call.outputPayload, null, 2) : '');
        setActiveScenarioId('custom');
        setInputJsonError(null);
        setOutputJsonError(null);
        setJudgeError(null);
        return;
      }
    }

    // Regular tool or demo
    setSelectedCallId(null);
    setSelectedToolSlug(val);
    const match = registeredTools.find((t) => t.slug === val || t.id === val);
    if (match) {
      setJudgeToolName(match.name);
      setJudgeExpectedSlaMs(match.timeoutMs || 5000);
      if (match.outputSchema) {
        setJudgeSchemaStr(JSON.stringify(match.outputSchema, null, 2));
      }
    } else {
      const sc = scenarios.find((s) => s.toolSlug === val);
      if (sc) {
        setJudgeToolName(sc.toolName);
        setJudgeExpectedSlaMs(sc.slaLimit);
        setJudgeSchemaStr(JSON.stringify(sc.schema, null, 2));
      }
    }
    setActiveScenarioId('custom');
  };

  const handleClaimRefund = async () => {
    if (!selectedCallId || !refundEligibility?.isEligible) return;
    setRefundClaiming(true);
    setRefundError(null);
    setRefundSuccess(null);
    try {
      const res = await api.requestRefund(selectedCallId, refundEligibility.reason);
      setRefundEligibility((prev) =>
        prev
          ? {
              ...prev,
              isEligible: false,
              status: 'REFUNDED',
              alreadyRefunded: true,
            }
          : null
      );
      setRefundSuccess(`Refund of ${formatMicroUsd(res.refundedAmountMicroUsd || refundEligibility.refundableAmountMicroUsd)} credited back to your balance!`);
      await refreshWallet();
      setUserCalls((prev) =>
        prev.map((c) =>
          c.id === selectedCallId ? { ...c, status: 'REVERSED', isReversed: true, reversalReason: refundEligibility.reason } : c
        )
      );
    } catch (err: any) {
      setRefundError(err?.message || 'Refund processing failed. Please try again or contact support.');
    } finally {
      setRefundClaiming(false);
    }
  };

  const handleCopyCallId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedCallId(true);
    setTimeout(() => setCopiedCallId(false), 2000);
  };

  // Handlers
  const handleGeneratePlan = async () => {
    if (!isAuthenticated) {
      if (onRequireAuth) {
        onRequireAuth('Synthesize Execution Plan');
      }
      return;
    }
    if (!plannerTask.trim()) return;
    setPlannerLoading(true);
    setPlannerError(null);
    try {
      const res = await api.aiPlanTask({
        task: plannerTask,
        targetUrl: plannerTargetUrl.trim() || undefined,
        maxBudgetUsd: plannerBudgetUsd || undefined,
        maxSteps: plannerMaxSteps,
        category: plannerCategory === 'All' ? undefined : plannerCategory,
      });
      setPlannerResult(res);
    } catch (err: any) {
      setPlannerError(err?.message || 'Plan generation failed. Check AI Service connectivity.');
    } finally {
      setPlannerLoading(false);
    }
  };

  const handleRunQualityAudit = async () => {
    if (!isAuthenticated) {
      if (onRequireAuth) {
        onRequireAuth('Evaluate API Response');
      }
      return;
    }

    if (!judgeOutputStr.trim()) {
      setOutputJsonError('Please enter or paste an API response to evaluate.');
      return;
    }

    // Verify JSON validity
    const outCheck = validateJson(judgeOutputStr);
    if (!outCheck.valid) {
      setOutputJsonError(outCheck.error || 'Invalid JSON syntax');
      return;
    }

    const inCheck = validateJson(judgeInputStr);
    if (!inCheck.valid) {
      setInputJsonError(inCheck.error);
      return;
    }

    const schemaCheck = validateJson(judgeSchemaStr);
    if (!schemaCheck.valid) {
      setSchemaJsonError(schemaCheck.error);
      return;
    }

    if (!inCheck.valid) {
      setInputJsonError(inCheck.error);
      return;
    }
    if (!outCheck.valid) {
      setOutputJsonError(outCheck.error);
      return;
    }
    if (!schemaCheck.valid) {
      setSchemaJsonError(schemaCheck.error);
      return;
    }

    setJudgeLoading(true);
    setJudgeError(null);
    setJudgeStageText('Stage 1: Validating Deterministic HTTP, Latency & Schema Rules...');

    try {
      let parsedInput = {};
      let parsedOutput = {};
      let parsedSchema = null;

      try {
        parsedInput = JSON.parse(judgeInputStr);
      } catch {
        throw new Error('Request Input is not valid JSON.');
      }

      try {
        parsedOutput = JSON.parse(judgeOutputStr);
      } catch {
        throw new Error('Response Output is not valid JSON.');
      }

      if (judgeSchemaStr.trim()) {
        try {
          parsedSchema = JSON.parse(judgeSchemaStr);
        } catch {
          throw new Error('Output Schema is not valid JSON.');
        }
      }

      // Stage transition simulation for smooth UX
      setTimeout(() => {
        setJudgeStageText('Stage 2: Evaluating Semantic Accuracy & Context Relevance...');
      }, 350);

      const res = await api.aiEvaluateQuality({
        toolId: selectedToolSlug,
        toolName: judgeToolName,
        requestInput: parsedInput,
        responseOutput: parsedOutput,
        httpStatus: judgeHttpStatus,
        durationMs: judgeDurationMs,
        expectedSlaMs: judgeExpectedSlaMs,
        outputSchema: parsedSchema,
        isSimulated: !selectedCallId || activeScenarioId !== 'custom',
      });

      setJudgeResult(res);
      // Prepend to session history
      setAuditHistory((prev) => [res, ...prev.slice(0, 19)]);

      // Check Refund Eligibility
      if (selectedCallId) {
        try {
          const el = await api.checkRefundEligibility(selectedCallId);
          setRefundEligibility(el);
        } catch (err: any) {
          setRefundEligibility({
            callId: selectedCallId,
            toolName: judgeToolName,
            originalChargeMicroUsd: '0',
            refundableAmountMicroUsd: '0',
            isEligible: false,
            status: 'NOT_ELIGIBLE',
            reason: err?.message || 'Execution not eligible for refund.',
            alreadyRefunded: false,
          });
        }
      } else {
        // Simulated scenario or test tool
        setRefundEligibility({
          callId: 'SIMULATED',
          toolName: judgeToolName,
          originalChargeMicroUsd: '0',
          refundableAmountMicroUsd: '0',
          isEligible: false,
          status: 'NOT_ELIGIBLE',
          reason: 'Simulated demo tests do not incur financial charges and are not eligible for platform refunds.',
          alreadyRefunded: false,
        });
      }
    } catch (err: any) {
      setJudgeError(err?.message || 'Quality evaluation failed.');
    } finally {
      setJudgeLoading(false);
      setJudgeStageText('');
    }
  };

  const handleDiscover = async () => {
    if (!isAuthenticated) {
      if (onRequireAuth) {
        onRequireAuth('Semantic Tool Discovery');
      }
      return;
    }
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
    if (!isAuthenticated) {
      if (onRequireAuth) {
        onRequireAuth('AI Price Advisor');
      }
      return;
    }
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
    if (!isAuthenticated) {
      if (onRequireAuth) {
        onRequireAuth('API Onboarding');
      }
      return;
    }
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

  if (isLoading) {
    return (
      <div className="section-dark" style={{ minHeight: '85vh', paddingTop: '40px' }}>
        <div className="container-editorial" style={{ textAlign: 'center', padding: '80px 0' }}>
          <RefreshCw size={28} className="spin" color="var(--brand-orange)" style={{ margin: '0 auto 16px' }} />
          <div style={{ color: 'var(--text-dark-secondary)', fontSize: '0.95rem' }}>
            Verifying session and loading AI services...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-dark" style={{ minHeight: '85vh', paddingTop: '40px' }}>
      <div className="container-editorial">
        {/* Guest Preview Notice Banner */}
        {!isAuthenticated && (
          <div
            style={{
              padding: '14px 20px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 85, 0, 0.08)',
              border: '1px solid var(--brand-orange-border)',
              marginBottom: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={18} color="var(--brand-orange)" />
              <span style={{ fontSize: '0.88rem', color: '#FFFFFF', lineHeight: 1.5 }}>
                <strong>Guest Preview Mode:</strong> Explore AI workflows, inspect schemas, and test scenarios. Sign in to execute live AI models and verify tools.
              </span>
            </div>
            <button
              className="btn btn-primary btn-sm"
              style={{ padding: '6px 14px', fontSize: '0.8rem', flexShrink: 0 }}
              onClick={() => onRequireAuth && onRequireAuth('Sign In')}
            >
              Sign In to Execute
            </button>
          </div>
        )}

        {/* Page Header */}
        <div style={{ maxWidth: '880px', marginBottom: '32px' }}>
          <span className="section-kicker">Autonomous Intelligence & Validation Architecture</span>
          <h1
            style={{
              fontSize: 'clamp(1.6rem, 3.8vw, 3.2rem)',
              maxWidth: '100%',
              overflowWrap: 'break-word',
              fontWeight: 900,
              letterSpacing: '-0.035em',
              color: '#FFFFFF',
              marginBottom: '12px',
            }}
          >
            AI Intelligence Suite.
          </h1>
          <p style={{ color: 'var(--text-dark-secondary)', fontSize: '1.02rem', lineHeight: 1.6 }}>
            Autonomous DAG tool planning, automated Stage-1 & Stage-2 quality adjudication with refund guarantees, and semantic API capability matching for the machine economy.
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            borderBottom: '1px solid var(--border-dark)',
            marginBottom: '32px',
            overflowX: 'auto',
            paddingBottom: '2px',
          }}
        >
          <button
            className="btn btn-sm"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'overview' ? '2px solid var(--brand-orange)' : '2px solid transparent',
              color: activeTab === 'overview' ? '#FFFFFF' : 'var(--text-dark-muted)',
              fontWeight: activeTab === 'overview' ? 800 : 600,
              borderRadius: 0,
              padding: '12px 18px',
              fontSize: '0.9rem',
            }}
            onClick={() => setActiveTab('overview')}
          >
            <Grid size={15} />
            Services Overview
          </button>

          {isConsumer && (
            <>
              <button
                className="btn btn-sm"
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'planner' ? '2px solid var(--brand-orange)' : '2px solid transparent',
                  color: activeTab === 'planner' ? '#FFFFFF' : 'var(--text-dark-muted)',
                  fontWeight: activeTab === 'planner' ? 800 : 600,
                  borderRadius: 0,
                  padding: '12px 18px',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={() => setActiveTab('planner')}
              >
                <Layers size={15} color="var(--brand-orange)" />
                AI Planner
                <span className="badge badge-orange" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>NEW</span>
              </button>

              <button
                className="btn btn-sm"
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'judge' ? '2px solid var(--brand-orange)' : '2px solid transparent',
                  color: activeTab === 'judge' ? '#FFFFFF' : 'var(--text-dark-muted)',
                  fontWeight: activeTab === 'judge' ? 800 : 600,
                  borderRadius: 0,
                  padding: '12px 18px',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={() => setActiveTab('judge')}
              >
                <Scale size={15} />
                Quality Judge
              </button>

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
            </>
          )}

          {isCreator && (
            <>
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
                Price Advisor
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
                API Onboarding
              </button>
            </>
          )}
        </div>

        {/* ========================================================= */}
        {/* TAB 0: OVERVIEW PAGE WITH 5 SEPARATE SERVICE CARDS         */}
        {/* ========================================================= */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '6px' }}>
                Catalog of Platform AI Capabilities
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-dark-secondary)' }}>
                Select a service below to open its live interactive execution workspace, inspect schema requirements, or test tool orchestration.
              </p>
            </div>

            {!isAuthenticated ? (
              <div
                className="card-dark"
                style={{
                  padding: '48px 32px',
                  textAlign: 'center',
                  border: '1px solid var(--border-dark)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.02)',
                }}
              >
                <Brain size={40} color="var(--brand-orange)" style={{ margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
                  Role-Based AI Services
                </h3>
                <p style={{ color: 'var(--text-dark-secondary)', fontSize: '0.9rem', maxWidth: '520px', margin: '0 auto 20px', lineHeight: 1.6 }}>
                  Please sign in to access ToolToll AI services. Consumer accounts have access to the AI Planner, Quality Judge, and Semantic Discovery. Creator accounts have access to the Price Advisor and API Onboarding.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => onRequireAuth && onRequireAuth('Sign In to Access AI Services')}
                >
                  Sign In to Access Services
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
                {isConsumer && (
                  <>
                    {/* Card 1: AI Planner */}
              <div
                className="card-dark"
                style={{
                  padding: '28px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: '1px solid rgba(255, 85, 0, 0.25)',
                  background: 'linear-gradient(180deg, rgba(255, 85, 0, 0.04) 0%, rgba(18, 20, 29, 0.95) 100%)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(255, 85, 0, 0.15)',
                        border: '1px solid var(--brand-orange)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Layers size={22} color="var(--brand-orange)" />
                    </div>
                    <span className="badge badge-orange">PLANNING CORE</span>
                  </div>

                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
                    AI Planner
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-dark-secondary)', lineHeight: 1.6, marginBottom: '18px' }}>
                    Converts unconstrained user requests into an executable directed acyclic graph (DAG) of verified marketplace API tools with strict budget and parameter mapping.
                  </p>

                  <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-dark)', marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-dark-muted)', marginBottom: '4px' }}>
                      Primary Use Case
                    </div>
                    <div style={{ fontSize: '0.84rem', color: '#E5E7EB' }}>
                      Multi-step investigations, autonomous fraud scans, multi-lingual translations, and atomic API choreographies.
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-dark)', marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-dark-muted)', marginBottom: '4px' }}>
                      Input / Output Pattern
                    </div>
                    <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--brand-orange)' }}>
                      In: "Audit seller trust & fraud risk" → Out: [ScamShield, SentimentAnalyzer, ResultDAG]
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-dark-muted)', paddingBottom: '14px', borderBottom: '1px solid var(--border-dark)', marginBottom: '16px' }}>
                    <span>Auth: Bearer JWT or Agent Key</span>
                    <span style={{ color: '#10B981', fontWeight: 700 }}>Free in Sandbox</span>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => setActiveTab('planner')}
                  >
                    <Layers size={16} />
                    Launch AI Planner Workspace
                  </button>
                </div>
              </div>

              {/* Card 2: Quality Judge */}
              <div
                className="card-dark"
                style={{
                  padding: '28px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.03) 0%, rgba(18, 20, 29, 0.95) 100%)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid #10B981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Scale size={22} color="#10B981" />
                    </div>
                    <span className="badge badge-emerald">QUALITY ASSURANCE</span>
                  </div>

                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
                    Quality Judge
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-dark-secondary)', lineHeight: 1.6, marginBottom: '18px' }}>
                    Two-stage automated arbitrator that examines tool responses for JSON Schema fidelity, latency SLA compliance, and semantic relevance, automatically triggering reversals on bad output.
                  </p>

                  <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-dark)', marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-dark-muted)', marginBottom: '4px' }}>
                      Primary Use Case
                    </div>
                    <div style={{ fontSize: '0.84rem', color: '#E5E7EB' }}>
                      Automated refunds for 502/504 errors, malformed payloads, hallucinated tool outputs, and SLA breach protections.
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-dark)', marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-dark-muted)', marginBottom: '4px' }}>
                      Input / Output Pattern
                    </div>
                    <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: '#38BDF8' }}>
                      In: ToolCallPayload + Latency → Out: Verdict: OK | BAD + RefundRecommendation
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-dark-muted)', paddingBottom: '14px', borderBottom: '1px solid var(--border-dark)', marginBottom: '16px' }}>
                    <span>Auth: Internal or Verified Session</span>
                    <span style={{ color: '#10B981', fontWeight: 700 }}>Standard Platform Audit</span>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'center', borderColor: '#10B981', color: '#FFFFFF' }}
                    onClick={() => setActiveTab('judge')}
                  >
                    <Scale size={16} />
                    Launch Quality Judge Workspace
                  </button>
                </div>
              </div>

              {/* Card 3: Semantic Discovery */}
              <div className="card-dark" style={{ padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border-dark)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-sm)', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid #38BDF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Search size={22} color="#38BDF8" />
                    </div>
                    <span className="badge">SEMANTIC VECTOR</span>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
                    Semantic Tool Discovery
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-dark-secondary)', lineHeight: 1.6, marginBottom: '18px' }}>
                    High-dimensional vector embedding search over ToolToll's live API marketplace, scoring catalog tools against arbitrary user prompts.
                  </p>
                  <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-dark)', marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-dark-muted)', marginBottom: '4px' }}>Primary Use Case</div>
                    <div style={{ fontSize: '0.84rem', color: '#E5E7EB' }}>Dynamic runtime tool resolution for LangChain, AutoGen, and Model Context Protocol (MCP) agents.</div>
                  </div>
                  <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-dark)', marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-dark-muted)', marginBottom: '4px' }}>Input / Output Pattern</div>
                    <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: '#9CA3AF' }}>In: "Parse invoice tax" → Out: Ranked Tools + Similarity Scores</div>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-dark-muted)', paddingBottom: '14px', borderBottom: '1px solid var(--border-dark)', marginBottom: '16px' }}>
                    <span>Auth: Public Discovery Available</span>
                    <span style={{ color: '#10B981', fontWeight: 700 }}>Zero Rate Fee</span>
                  </div>
                  <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setActiveTab('discover')}>
                    <Search size={16} /> Try Semantic Discovery
                  </button>
                </div>
              </div>
                  </>
                )}

                {isCreator && (
                  <>
              {/* Card 4: Price Advisor */}
              <div className="card-dark" style={{ padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border-dark)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-sm)', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <DollarSign size={22} color="#F59E0B" />
                    </div>
                    <span className="badge">CREATOR PRICING</span>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
                    AI Price Advisor
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-dark-secondary)', lineHeight: 1.6, marginBottom: '18px' }}>
                    Computes optimal micro-USD invocation prices for API publishers based on compute complexity, latency targets, and market equilibrium.
                  </p>
                  <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-dark)', marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-dark-muted)', marginBottom: '4px' }}>Primary Use Case</div>
                    <div style={{ fontSize: '0.84rem', color: '#E5E7EB' }}>Pricing newly onboarded developer endpoints to maximize agent adoption without subsidizing compute costs.</div>
                  </div>
                  <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-dark)', marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-dark-muted)', marginBottom: '4px' }}>Input / Output Pattern</div>
                    <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: '#F59E0B' }}>In: Endpoint Category + Latency → Out: Equilibrium µUSD + Economic Rationale</div>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-dark-muted)', paddingBottom: '14px', borderBottom: '1px solid var(--border-dark)', marginBottom: '16px' }}>
                    <span>Auth: Creator Studio Integration</span>
                    <span style={{ color: '#10B981', fontWeight: 700 }}>Included</span>
                  </div>
                  <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setActiveTab('price')}>
                    <DollarSign size={16} /> Open Price Advisor
                  </button>
                </div>
              </div>

              {/* Card 5: Onboarding Autopilot */}
              <div className="card-dark" style={{ padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border-dark)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-sm)', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid #A855F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileCode size={22} color="#A855F7" />
                    </div>
                    <span className="badge">DEVELOPER TOOLS</span>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
                    API Onboarding
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-dark-secondary)', lineHeight: 1.6, marginBottom: '18px' }}>
                    Parses unstructured documentation or cURL commands into validated OpenAPI JSON Schemas ready for instant ToolToll marketplace registration.
                  </p>
                  <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-dark)', marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-dark-muted)', marginBottom: '4px' }}>Primary Use Case</div>
                    <div style={{ fontSize: '0.84rem', color: '#E5E7EB' }}>Publishing existing REST endpoints in under 60 seconds with strict SSRF-safe property schemas.</div>
                  </div>
                  <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-dark)', marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-dark-muted)', marginBottom: '4px' }}>Input / Output Pattern</div>
                    <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: '#A855F7' }}>In: Raw cURL string → Out: OpenAPI 3.0 Tool Specification</div>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-dark-muted)', paddingBottom: '14px', borderBottom: '1px solid var(--border-dark)', marginBottom: '16px' }}>
                    <span>Auth: Creator Studio Authorization</span>
                    <span style={{ color: '#10B981', fontWeight: 700 }}>Included</span>
                  </div>
                  <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setActiveTab('onboard')}>
                    <FileCode size={16} /> Open API Onboarding Workspace
                  </button>
                </div>
              </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 1: AI PLANNER WORKSPACE                               */}
        {/* ========================================================= */}
        {activeTab === 'planner' && isConsumer && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '28px' }}>
            <div className="card-dark" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Layers size={20} color="var(--brand-orange)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                  Autonomous Tool Plan Generator
                </h3>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-dark-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
                Formulate complex multi-step objectives. The engine verifies tool availability, checks per-call micro-USD pricing, and emits an executable DAG plan.
              </p>

              {/* Quick Fill Scenarios */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-dark-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Quick Fill Scenarios:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                    onClick={() => {
                      setPlannerTask('Check whether this online seller is trustworthy by examining its website reputation and available fraud indicators.');
                      setPlannerTargetUrl('https://discount-luxury-vault.example.com');
                      setPlannerCategory('Security');
                      setPlannerBudgetUsd(0.015);
                    }}
                  >
                    🛡️ Online Seller Trust Check
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                    onClick={() => {
                      setPlannerTask('Translate suspicious incoming French customer SMS and evaluate whether it contains financial phishing.');
                      setPlannerTargetUrl('SMS #99482');
                      setPlannerCategory('Translation');
                      setPlannerBudgetUsd(0.020);
                    }}
                  >
                    🌐 French SMS Scam & Translation
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                    onClick={() => {
                      setPlannerTask('Analyze customer review polarity and extract urgency signals for real-time ticket escalation.');
                      setPlannerTargetUrl('');
                      setPlannerCategory('NLP');
                      setPlannerBudgetUsd(0.010);
                    }}
                  >
                    📊 Review Sentiment & Urgency
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Natural-Language Task Objective *</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={plannerTask}
                  onChange={(e) => setPlannerTask(e.target.value)}
                  placeholder="Describe your desired task in detail..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Optional Target URL / Parameter</label>
                  <input
                    type="text"
                    className="form-input"
                    value={plannerTargetUrl}
                    onChange={(e) => setPlannerTargetUrl(e.target.value)}
                    placeholder="e.g. https://target-site.com"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Safety Budget Cap (USD)</label>
                  <input
                    type="number"
                    step="0.005"
                    className="form-input"
                    value={plannerBudgetUsd}
                    onChange={(e) => setPlannerBudgetUsd(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Category Constraint</label>
                  <select
                    className="form-select"
                    value={plannerCategory}
                    onChange={(e) => setPlannerCategory(e.target.value)}
                  >
                    <option value="All">All Categories</option>
                    <option value="Security">Security & Threat</option>
                    <option value="Translation">Translation & Locale</option>
                    <option value="NLP">NLP & Sentiment</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Max Plan Steps ({plannerMaxSteps})</label>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    className="form-range"
                    style={{ width: '100%', accentColor: 'var(--brand-orange)', marginTop: '8px' }}
                    value={plannerMaxSteps}
                    onChange={(e) => setPlannerMaxSteps(parseInt(e.target.value, 10))}
                  />
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: '8px', padding: '12px' }}
                disabled={plannerLoading}
                onClick={handleGeneratePlan}
              >
                {plannerLoading ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    Synthesizing Execution DAG...
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    Synthesize Executable Plan
                  </>
                )}
              </button>

              {plannerError && (
                <div style={{ marginTop: '14px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-xs)', color: '#FCA5A5', fontSize: '0.84rem' }}>
                  {plannerError}
                </div>
              )}
            </div>

            {/* Plan Output Panel */}
            <div className="card-dark" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                  Synthesized DAG Execution Plan
                </h3>
                {plannerResult && (
                  <span className={`badge ${plannerResult.is_achievable ? 'badge-emerald' : 'badge-rose'}`}>
                    {plannerResult.is_achievable ? 'ACHIEVABLE' : 'UNACHIEVABLE'}
                  </span>
                )}
              </div>

              {plannerResult ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{ padding: '16px', borderRadius: 'var(--radius-sm)', background: 'rgba(255, 85, 0, 0.05)', border: '1px solid var(--brand-orange-border)' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--brand-orange)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      EXECUTION STRATEGY
                    </div>
                    <p style={{ fontSize: '0.88rem', color: '#F3F4F6', lineHeight: 1.5, margin: 0 }}>
                      {plannerResult.plan_explanation}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-dark)' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Steps</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#FFFFFF', marginTop: '2px' }}>
                        {plannerResult.step_count || plannerResult.steps.length}
                      </div>
                    </div>

                    <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-dark)' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Estimated Cost</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#38BDF8', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                        ${plannerResult.total_estimated_cost_usd?.toFixed(4)}
                      </div>
                    </div>

                    <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-dark)' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Human Approval</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: plannerResult.requires_human_approval ? '#F59E0B' : '#10B981', marginTop: '4px' }}>
                        {plannerResult.requires_human_approval ? 'Required' : 'Auto-Approved'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                      Sequential Step Mapping:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {plannerResult.steps.map((s, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '16px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-dark)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--brand-orange)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>
                                {idx + 1}
                              </span>
                              <span style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.94rem' }}>{s.tool_name}</span>
                            </div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: '#38BDF8', fontWeight: 700 }}>
                              ${s.estimated_cost_usd?.toFixed(4)}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.84rem', color: 'var(--text-dark-secondary)', marginBottom: '8px', lineHeight: 1.5 }}>
                            {s.explanation}
                          </div>
                          {s.depends_on_step_ids && s.depends_on_step_ids.length > 0 && (
                            <div style={{ fontSize: '0.74rem', color: 'var(--brand-orange)', marginBottom: '6px' }}>
                              Depends on: {s.depends_on_step_ids.join(', ')}
                            </div>
                          )}
                          <div style={{ marginTop: '8px' }}>
                            <JsonViewer data={s.input_parameters} maxHeight="120px" title={`Input Parameters (${s.step_id || `step_${idx + 1}`})`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ paddingTop: '8px' }}>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                      onClick={() => {
                        if (onSelectTab) {
                          onSelectTab('playground');
                        } else {
                          alert('Plan is loaded and ready. Navigate to the Playground to execute against live endpoints.');
                        }
                      }}
                    >
                      <Play size={16} /> Open in Playground to Execute Plan
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-dark-muted)', fontSize: '0.88rem', fontStyle: 'italic', padding: '40px 0', textAlign: 'center' }}>
                  <Layers size={36} color="var(--border-dark)" style={{ margin: '0 auto 12px' }} />
                  Configure your objective on the left and click "Synthesize Executable Plan" to generate your DAG tool roadmap.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: QUALITY JUDGE — MINIMAL TWO-CARD LAYOUT            */}
        {/* ========================================================= */}
        {activeTab === 'judge' && isConsumer && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
            {/* Left Card: Quality Check */}
            <div className="card-dark" style={{ padding: '28px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
                API Quality Judge
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-dark-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
                Evaluate an API response to check whether it is valid, relevant, and meets the expected requirements.
              </p>

              {/* A. Select Tool */}
              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '6px' }}>
                  Select Tool
                </label>
                <select
                  id="judge-tool-select"
                  className="form-select"
                  value={selectedCallId ? `call:${selectedCallId}` : selectedToolSlug}
                  onChange={(e) => handleToolOrCallSelect(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {isAuthenticated && userCalls.length > 0 && (
                    <optgroup label="Recent Executions (Select to Audit & Refund)">
                      {userCalls.slice(0, 20).map((call) => (
                        <option key={call.id} value={`call:${call.id}`}>
                          [Execution] {call.tool?.name || 'API Tool'} — {formatMicroUsd(call.priceMicroUsd)} ({call.status}) — {call.id.slice(0, 8)}...
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Registered Tools">
                    {registeredTools.map((tool) => (
                      <option key={tool.id} value={tool.slug}>
                        {tool.name} {tool.category ? `(${tool.category})` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Demo Scenarios (Simulated)">
                    <option value="demo-sentiment-analyzer">Sentiment Analyzer (Demo)</option>
                    <option value="demo-scam-risk-analyzer">Scam Message Risk Analyzer (Demo)</option>
                    <option value="demo-text-translator">Text Translator (Demo)</option>
                  </optgroup>
                </select>
                {selectedCallId && (
                  <div style={{ marginTop: '6px', fontSize: '0.74rem', color: '#60A5FA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Linked Execution: <code style={{ fontFamily: 'var(--font-mono)' }}>{selectedCallId.slice(0, 16)}...</code></span>
                    <button
                      type="button"
                      onClick={() => handleToolOrCallSelect('demo-sentiment-analyzer')}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-dark-muted)', cursor: 'pointer', fontSize: '0.72rem' }}
                    >
                      Reset to Demo
                    </button>
                  </div>
                )}
              </div>

              {/* B. API Response */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                    API Response
                  </label>
                  {judgeOutputStr.trim() && (
                    <button
                      type="button"
                      onClick={() => formatJsonField('output')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--brand-orange)',
                        fontSize: '0.74rem',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Format JSON
                    </button>
                  )}
                </div>
                <textarea
                  className="form-textarea"
                  rows={6}
                  placeholder="Paste the API response you want to evaluate..."
                  value={judgeOutputStr}
                  onChange={(e) => handleOutputChange(e.target.value)}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.82rem',
                    borderColor: outputJsonError ? '#EF4444' : undefined,
                  }}
                />
                {outputJsonError && (
                  <div style={{ fontSize: '0.75rem', color: '#EF4444', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={13} /> {outputJsonError}
                  </div>
                )}
              </div>

              {/* Quick Test Scenarios */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-dark-muted)', fontWeight: 600 }}>
                    Try Sample:
                  </span>
                  {activeScenarioId !== 'custom' && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--brand-orange)', fontWeight: 600 }}>
                      Sample data loaded
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {scenarios.map((sc) => {
                    const isSelected = activeScenarioId === sc.id;
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{
                          fontSize: '0.74rem',
                          padding: '5px 10px',
                          borderColor: isSelected ? 'var(--brand-orange)' : undefined,
                          color: isSelected ? '#FFFFFF' : 'var(--text-dark-secondary)',
                          background: isSelected ? 'rgba(255, 85, 0, 0.1)' : undefined,
                          fontWeight: isSelected ? 700 : 500,
                        }}
                        onClick={() => loadScenario(sc.id)}
                      >
                        {sc.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* C. Optional Advanced Options (Collapsible) */}
              <div style={{ marginBottom: '22px' }}>
                <button
                  type="button"
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-dark-muted)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    padding: '4px 0',
                  }}
                >
                  <Sliders size={14} />
                  <span>Advanced Options</span>
                  {showAdvancedOptions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showAdvancedOptions && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '16px',
                      borderRadius: 'var(--radius-xs)',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-dark)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                    }}
                  >
                    <div>
                      <label className="form-label" style={{ fontSize: '0.72rem', color: 'var(--text-dark-muted)', marginBottom: '4px' }}>
                        Execution ID (Optional Link to Billed Execution)
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Paste ToolCall UUID (e.g. 0f86c6de-59fd-4acb-82dc-ba0b5fa2dc3b)..."
                        style={{ fontSize: '0.8rem', padding: '6px 10px', fontFamily: 'var(--font-mono)' }}
                        value={selectedCallId || ''}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          setSelectedCallId(val || null);
                        }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.72rem', color: 'var(--text-dark-muted)' }}>HTTP Status</label>
                        <input
                          type="number"
                          className="form-input"
                          style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                          value={judgeHttpStatus}
                          onChange={(e) => setJudgeHttpStatus(Number(e.target.value) || 200)}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.72rem', color: 'var(--text-dark-muted)' }}>Latency (ms)</label>
                        <input
                          type="number"
                          className="form-input"
                          style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                          value={judgeDurationMs}
                          onChange={(e) => setJudgeDurationMs(Number(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.72rem', color: 'var(--text-dark-muted)' }}>SLA Limit (ms)</label>
                        <input
                          type="number"
                          className="form-input"
                          style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                          value={judgeExpectedSlaMs}
                          onChange={(e) => setJudgeExpectedSlaMs(Number(e.target.value) || 1000)}
                        />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label className="form-label" style={{ fontSize: '0.72rem', color: 'var(--text-dark-muted)', margin: 0 }}>Request Payload (JSON)</label>
                        {judgeInputStr.trim() && (
                          <button
                            type="button"
                            onClick={() => formatJsonField('input')}
                            style={{ background: 'transparent', border: 'none', color: 'var(--brand-orange)', fontSize: '0.7rem', cursor: 'pointer' }}
                          >
                            Format
                          </button>
                        )}
                      </div>
                      <textarea
                        className="form-textarea"
                        rows={2}
                        value={judgeInputStr}
                        onChange={(e) => handleInputChange(e.target.value)}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label className="form-label" style={{ fontSize: '0.72rem', color: 'var(--text-dark-muted)', margin: 0 }}>Expected Output Schema (JSON Schema)</label>
                        {judgeSchemaStr.trim() && (
                          <button
                            type="button"
                            onClick={() => formatJsonField('schema')}
                            style={{ background: 'transparent', border: 'none', color: 'var(--brand-orange)', fontSize: '0.7rem', cursor: 'pointer' }}
                          >
                            Format
                          </button>
                        )}
                      </div>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        value={judgeSchemaStr}
                        onChange={(e) => handleSchemaChange(e.target.value)}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* D. Primary Button */}
              <button
                className="btn btn-primary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '12px 20px',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                }}
                disabled={judgeLoading}
                onClick={handleRunQualityAudit}
              >
                {judgeLoading ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    Evaluating Response...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    Evaluate Response
                  </>
                )}
              </button>

              {judgeError && (
                <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-xs)', color: '#FCA5A5', fontSize: '0.82rem' }}>
                  {judgeError}
                </div>
              )}
            </div>

            {/* Right Card: Quality Results */}
            <div className="card-dark" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  Quality Results
                </h3>
                {judgeResult && (
                  <span
                    className={`badge ${
                      judgeResult.verdict === 'ok'
                        ? 'badge-emerald'
                        : judgeResult.refund_recommended
                        ? 'badge-rose'
                        : 'badge-orange'
                    }`}
                    style={{ fontSize: '0.76rem', fontWeight: 800, padding: '3px 10px' }}
                  >
                    {judgeResult.verdict === 'ok'
                      ? 'Passed'
                      : judgeResult.refund_recommended
                      ? 'Failed'
                      : 'Needs Review'}
                  </span>
                )}
              </div>

              {!judgeResult ? (
                /* Empty State */
                <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-dark-muted)' }}>
                  <ShieldCheck size={40} color="var(--border-dark)" style={{ margin: '0 auto 14px' }} />
                  <div style={{ fontSize: '0.96rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '6px' }}>
                    Your quality evaluation will appear here.
                  </div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-dark-secondary)', maxWidth: '340px', margin: '0 auto', lineHeight: 1.5 }}>
                    Select a tool, provide its response, and click Evaluate Response.
                  </div>
                </div>
              ) : (
                /* Evaluation Results */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Overall Status Banner */}
                  <div
                    style={{
                      padding: '16px 18px',
                      borderRadius: 'var(--radius-sm)',
                      background:
                        judgeResult.verdict === 'ok'
                          ? 'rgba(16, 185, 129, 0.08)'
                          : judgeResult.refund_recommended
                          ? 'rgba(239, 68, 68, 0.08)'
                          : 'rgba(245, 158, 11, 0.08)',
                      border: `1px solid ${
                        judgeResult.verdict === 'ok'
                          ? '#10B981'
                          : judgeResult.refund_recommended
                          ? '#EF4444'
                          : '#F59E0B'
                      }`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {judgeResult.verdict === 'ok' ? (
                        <CheckCircle2 size={24} color="#10B981" style={{ flexShrink: 0 }} />
                      ) : judgeResult.refund_recommended ? (
                        <XCircle size={24} color="#EF4444" style={{ flexShrink: 0 }} />
                      ) : (
                        <AlertTriangle size={24} color="#F59E0B" style={{ flexShrink: 0 }} />
                      )}
                      <div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#FFFFFF' }}>
                          {judgeResult.verdict === 'ok'
                            ? 'Response Validated'
                            : judgeResult.refund_recommended
                            ? 'Execution Failed'
                            : 'Attention Required'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dark-secondary)', marginTop: '2px' }}>
                          {judgeResult.reason || 'Evaluation completed successfully.'}
                        </div>
                      </div>
                    </div>

                    {/* Quality Score */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Quality Score
                      </div>
                      <div
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 900,
                          fontFamily: 'var(--font-mono)',
                          color:
                            judgeResult.verdict === 'ok'
                              ? '#10B981'
                              : judgeResult.refund_recommended
                              ? '#EF4444'
                              : '#F59E0B',
                        }}
                      >
                        {judgeResult.quality_score !== undefined
                          ? `${judgeResult.quality_score}/100`
                          : judgeResult.verdict === 'ok'
                          ? '95/100'
                          : '20/100'}
                      </div>
                    </div>
                  </div>

                  {/* Key Issues Detected */}
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>
                      Key Issues Detected
                    </div>
                    {judgeResult.issues_found && judgeResult.issues_found.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {judgeResult.issues_found.map((iss, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 'var(--radius-xs)',
                              background: 'rgba(255, 255, 255, 0.02)',
                              border: `1px solid ${iss.severity === 'critical' ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-dark)'}`,
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: '8px',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: iss.severity === 'critical' ? '#FCA5A5' : '#FCD34D' }}>
                                {iss.title}
                              </div>
                              <div style={{ fontSize: '0.76rem', color: 'var(--text-dark-secondary)', marginTop: '2px', lineHeight: 1.4 }}>
                                {iss.evidence}
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: '0.64rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                color: iss.severity === 'critical' ? '#EF4444' : '#F59E0B',
                                flexShrink: 0,
                              }}
                            >
                              {iss.severity}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.82rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 0' }}>
                        <CheckCircle size={15} /> No issues detected. Response conforms to expected schema and SLA.
                      </div>
                    )}
                  </div>

                  {/* Short Actionable Recommendations */}
                  {judgeResult.actionable_recommendations && judgeResult.actionable_recommendations.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '6px' }}>
                        Recommendations
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.8rem', color: 'var(--text-dark-secondary)', lineHeight: 1.5 }}>
                        {judgeResult.actionable_recommendations.map((rec, idx) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Refund Assessment Section */}
                  {refundEligibility && (
                    <div
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-sm)',
                        background:
                          refundEligibility.alreadyRefunded || refundEligibility.status === 'REFUNDED'
                            ? 'rgba(16, 185, 129, 0.06)'
                            : refundEligibility.isEligible
                            ? 'rgba(255, 85, 0, 0.06)'
                            : 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${
                          refundEligibility.alreadyRefunded || refundEligibility.status === 'REFUNDED'
                            ? 'rgba(16, 185, 129, 0.35)'
                            : refundEligibility.isEligible
                            ? 'rgba(255, 85, 0, 0.35)'
                            : 'var(--border-dark)'
                        }`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Scale
                            size={16}
                            color={
                              refundEligibility.alreadyRefunded || refundEligibility.status === 'REFUNDED'
                                ? '#10B981'
                                : refundEligibility.isEligible
                                ? 'var(--brand-orange)'
                                : 'var(--text-dark-muted)'
                            }
                          />
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#FFFFFF' }}>
                            Refund Assessment
                          </span>
                        </div>
                        <span
                          className={`badge ${
                            refundEligibility.alreadyRefunded || refundEligibility.status === 'REFUNDED'
                              ? 'badge-emerald'
                              : refundEligibility.isEligible
                              ? 'badge-rose'
                              : 'badge-secondary'
                          }`}
                          style={{ fontSize: '0.74rem', fontWeight: 700, padding: '3px 10px' }}
                        >
                          {refundEligibility.alreadyRefunded || refundEligibility.status === 'REFUNDED'
                            ? 'Refund Status: Refunded'
                            : refundEligibility.isEligible
                            ? 'Refund Status: Eligible for Refund'
                            : 'Refund Status: Not Eligible'}
                        </span>
                      </div>

                      {/* When Eligible for Refund */}
                      {refundEligibility.isEligible ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                              gap: '8px 16px',
                              fontSize: '0.78rem',
                              background: 'rgba(0, 0, 0, 0.25)',
                              padding: '12px 14px',
                              borderRadius: 'var(--radius-xs)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: 'var(--text-dark-muted)' }}>Execution ID:</span>
                              <code style={{ fontFamily: 'var(--font-mono)', color: '#FFFFFF', fontWeight: 600 }}>
                                {refundEligibility.callId.slice(0, 12)}...
                              </code>
                              <button
                                type="button"
                                onClick={() => handleCopyCallId(refundEligibility.callId)}
                                title="Copy full execution ID"
                                style={{ background: 'transparent', border: 'none', color: 'var(--brand-orange)', cursor: 'pointer', padding: 0 }}
                              >
                                {copiedCallId ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                              </button>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-dark-muted)' }}>Tool Name: </span>
                              <span style={{ color: '#FFFFFF', fontWeight: 600 }}>
                                {refundEligibility.toolName}
                              </span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-dark-muted)' }}>Original Charge: </span>
                              <span style={{ color: '#FFFFFF', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                                {formatMicroUsd(refundEligibility.originalChargeMicroUsd)}
                              </span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-dark-muted)' }}>Refund Amount: </span>
                              <span style={{ color: 'var(--brand-orange)', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                                {formatMicroUsd(refundEligibility.refundableAmountMicroUsd)}
                              </span>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <span style={{ color: 'var(--text-dark-muted)' }}>Reason for Eligibility: </span>
                              <span style={{ color: '#FCA5A5', fontWeight: 600 }}>
                                {refundEligibility.reason}
                              </span>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <span style={{ color: 'var(--text-dark-muted)' }}>Current Status: </span>
                              <span style={{ color: '#F59E0B', fontWeight: 700 }}>
                                Eligible (Pending Claim)
                              </span>
                            </div>
                          </div>

                          {refundError && (
                            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-xs)', background: 'rgba(239, 68, 68, 0.1)', color: '#FCA5A5', fontSize: '0.78rem' }}>
                              {refundError}
                            </div>
                          )}

                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleClaimRefund}
                            disabled={refundClaiming}
                            style={{
                              width: '100%',
                              justifyContent: 'center',
                              padding: '10px 16px',
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              gap: '8px',
                            }}
                          >
                            {refundClaiming ? (
                              <>
                                <RefreshCw size={15} className="spin" />
                                Processing Refund to Ledger...
                              </>
                            ) : (
                              <>
                                <RotateCcw size={15} />
                                Claim Refund ({formatMicroUsd(refundEligibility.refundableAmountMicroUsd)})
                              </>
                            )}
                          </button>
                        </div>
                      ) : refundEligibility.alreadyRefunded || refundEligibility.status === 'REFUNDED' ? (
                        /* When Already Refunded */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                          <div style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                            <CheckCircle2 size={16} /> Refund Credited Back to User Balance
                          </div>
                          <div style={{ color: 'var(--text-dark-secondary)', fontSize: '0.78rem', lineHeight: 1.5 }}>
                            Execution <code style={{ fontFamily: 'var(--font-mono)', color: '#FFFFFF' }}>{refundEligibility.callId.slice(0, 16)}...</code> was refunded. 
                            The original charge of <strong style={{ color: '#10B981' }}>{formatMicroUsd(refundEligibility.originalChargeMicroUsd || refundEligibility.refundableAmountMicroUsd)}</strong> has been credited to your ToolToll wallet.
                          </div>
                          {refundSuccess && (
                            <div style={{ padding: '6px 10px', borderRadius: 'var(--radius-xs)', background: 'rgba(16, 185, 129, 0.1)', color: '#6EE7B7', fontSize: '0.76rem' }}>
                              {refundSuccess}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* When Not Eligible */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-dark-secondary)', lineHeight: 1.5 }}>
                            {refundEligibility.reason}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Small Expandable Technical Details */}
                  <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border-dark)' }}>
                    <button
                      type="button"
                      onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-dark-muted)',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <span>{showTechnicalDetails ? 'Hide Technical Details' : 'View Technical Details (Raw JSON)'}</span>
                      {showTechnicalDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

                    {showTechnicalDetails && (
                      <div style={{ marginTop: '10px' }}>
                        <JsonViewer data={judgeResult} maxHeight="180px" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: SEMANTIC TOOL DISCOVERY                            */}
        {/* ========================================================= */}
        {activeTab === 'discover' && isConsumer && (
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

        {/* ========================================================= */}
        {/* TAB 4: AI PRICE ADVISOR                                   */}
        {/* ========================================================= */}
        {activeTab === 'price' && isCreator && (
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

        {/* ========================================================= */}
        {/* TAB 5: AUTOMATED API ONBOARDING                           */}
        {/* ========================================================= */}
        {activeTab === 'onboard' && isCreator && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
            <div className="card-dark" style={{ padding: '28px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
                API Onboarding
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
