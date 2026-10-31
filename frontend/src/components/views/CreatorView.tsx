import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { formatMicroUsd } from '../../utils/formatters';
import { Tool, ToolEndpoint } from '../../types';
import { ApimaticOnboardingModal } from './ApimaticOnboardingModal';
import {
  Sparkles,
  Download,
  Code,
  Hammer,
  Plus,
  DollarSign,
  Send,
  CheckCircle,
  X,
  Zap,
  Layers,
  ArrowUpRight,
  Search,
  Filter,
  Play,
  Pause,
  Eye,
  Trash2,
  AlertCircle,
  Check,
  Shield,
  Key,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FileCode,
  ExternalLink,
} from 'lucide-react';

export const CreatorView: React.FC = () => {
  const { user, loginDemo } = useAuth();
  const [earnings, setEarnings] = useState<{
    grossEarningsMicroUsd: string;
    platformFeeMicroUsd: string;
    netEarningsMicroUsd: string;
    withdrawnMicroUsd: string;
    pendingPayoutMicroUsd: string;
    availablePayoutMicroUsd: string;
  } | null>(null);

  const [myTools, setMyTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'name' | 'priceAsc' | 'priceDesc'>('newest');

  // Modal 1: Register New API (PHASE 2)
  // APIMatic Onboarding & SDK Modals
  const [apimaticModalOpen, setApimaticModalOpen] = useState(false);
  const [sdkModalOpen, setSdkModalOpen] = useState(false);
  const [selectedToolForSdk, setSelectedToolForSdk] = useState<Tool | null>(null);
  const [sdkLanguage, setSdkLanguage] = useState<'typescript' | 'python'>('typescript');
  const [sdkCode, setSdkCode] = useState<string>('');
  const [sdkFilename, setSdkFilename] = useState<string>('');
  const [sdkLoading, setSdkLoading] = useState<boolean>(false);
  const [sdkCopied, setSdkCopied] = useState<boolean>(false);

  const handleOpenSdkModal = async (tool: Tool, lang: 'typescript' | 'python' = 'typescript') => {
    setSelectedToolForSdk(tool);
    setSdkLanguage(lang);
    setSdkModalOpen(true);
    setSdkLoading(true);
    setSdkCopied(false);
    try {
      const res = await api.getToolSdk(tool.id, lang);
      setSdkCode(res.code);
      setSdkFilename(res.filename);
    } catch (err: any) {
      setSdkCode('// Failed to generate SDK: ' + (err.message || 'Server error'));
    } finally {
      setSdkLoading(false);
    }
  };

  const handleChangeSdkLanguage = async (lang: 'typescript' | 'python') => {
    if (!selectedToolForSdk) return;
    setSdkLanguage(lang);
    setSdkLoading(true);
    setSdkCopied(false);
    try {
      const res = await api.getToolSdk(selectedToolForSdk.id, lang);
      setSdkCode(res.code);
      setSdkFilename(res.filename);
    } catch (err: any) {
      setSdkCode('// Failed to generate SDK: ' + (err.message || 'Server error'));
    } finally {
      setSdkLoading(false);
    }
  };

  const handleDownloadSdkFile = () => {
    if (!sdkCode || !sdkFilename) return;
    const blob = new Blob([sdkCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = sdkFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopySdkCode = () => {
    if (!sdkCode) return;
    navigator.clipboard.writeText(sdkCode);
    setSdkCopied(true);
    setTimeout(() => setSdkCopied(false), 2000);
  };

  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [regApiName, setRegApiName] = useState('');
  const [regCategory, setRegCategory] = useState('NLP');
  const [regDescription, setRegDescription] = useState('');
  const [regVersion, setRegVersion] = useState('1');
  const [regBaseUrl, setRegBaseUrl] = useState('https://api.yourdomain.com');
  const [regEndpointPath, setRegEndpointPath] = useState('/v1/analyze');
  const [regHttpMethod, setRegHttpMethod] = useState<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>('POST');
  const [regPriceMicroUsd, setRegPriceMicroUsd] = useState('5000');
  const [regInputSchema, setRegInputSchema] = useState('{\n  "type": "object",\n  "properties": {\n    "text": { "type": "string" }\n  },\n  "required": ["text"]\n}');
  const [regExampleRequest, setRegExampleRequest] = useState('{\n  "text": "Real-time verification request payload"\n}');
  const [regOutputSchema, setRegOutputSchema] = useState('{\n  "type": "object",\n  "properties": {\n    "success": { "type": "boolean" },\n    "result": { "type": "string" }\n  }\n}');
  const [regExampleResponse, setRegExampleResponse] = useState('{\n  "success": true,\n  "result": "Processed output data"\n}');
  const [regAuthType, setRegAuthType] = useState<'NONE' | 'API_KEY_HEADER' | 'BEARER_TOKEN' | 'BASIC_AUTH'>('NONE');
  const [regAuthHeaderName, setRegAuthHeaderName] = useState('X-API-Key');
  const [regSecretKey, setRegSecretKey] = useState('');
  const [regBasicUser, setRegBasicUser] = useState('');
  const [regBasicPass, setRegBasicPass] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});

  // Modal 2: Add Endpoint to Existing API (PHASE 3)
  const [addEndpointModalOpen, setAddEndpointModalOpen] = useState(false);
  const [selectedParentApiId, setSelectedParentApiId] = useState<string>('');
  const [epName, setEpName] = useState('');
  const [epPath, setEpPath] = useState('/v1/operation');
  const [epHttpMethod, setEpHttpMethod] = useState<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>('POST');
  const [epDescription, setEpDescription] = useState('');
  const [epPriceMicroUsd, setEpPriceMicroUsd] = useState('2500');
  const [epInputSchema, setEpInputSchema] = useState('{\n  "type": "object",\n  "properties": {\n    "query": { "type": "string" }\n  },\n  "required": ["query"]\n}');
  const [epExampleRequest, setEpExampleRequest] = useState('{\n  "query": "Sample endpoint query"\n}');
  const [epOutputSchema, setEpOutputSchema] = useState('{\n  "type": "object",\n  "properties": {\n    "status": { "type": "string" }\n  }\n}');
  const [epExampleResponse, setEpExampleResponse] = useState('{\n  "status": "completed"\n}');
  const [epAuthType, setEpAuthType] = useState<'NONE' | 'API_KEY_HEADER' | 'BEARER_TOKEN' | 'BASIC_AUTH'>('NONE');
  const [epAuthHeaderName, setEpAuthHeaderName] = useState('X-API-Key');
  const [epSecretKey, setEpSecretKey] = useState('');
  const [epLoading, setEpLoading] = useState(false);
  const [epErrors, setEpErrors] = useState<Record<string, string>>({});

  // Modal 3: Test Endpoint Runner
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testingTool, setTestingTool] = useState<Tool | null>(null);
  const [testingEndpoint, setTestingEndpoint] = useState<ToolEndpoint | null>(null);
  const [testInputStr, setTestInputStr] = useState('{\n  "text": "Verification test call"\n}');
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Modal 4: View Details Drawer
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [viewingTool, setViewingTool] = useState<Tool | null>(null);

  // Modal 5: Payout
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutEmail, setPayoutEmail] = useState('');
  const [payoutSuccess, setPayoutSuccess] = useState<string | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [earningsData, toolsData] = await Promise.all([
        api.getCreatorEarnings().catch(() => null),
        api.getTools(user?.id ? { creatorId: user.id } : {}).catch(() => []),
      ]);
      if (earningsData) setEarnings(earningsData);
      setMyTools(toolsData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  // Helper to calculate equivalent USD
  const formatMicroUsdDynamic = (valStr: string) => {
    try {
      const num = Number(valStr);
      if (isNaN(num)) return '$0.00';
      return formatMicroUsd(num);
    } catch {
      return '$0.00';
    }
  };

  // -------------------------------------------------------------
  // PHASE 2: Register New API
  // -------------------------------------------------------------
  const handleOpenRegisterModal = () => {
    setRegApiName('');
    setRegCategory('NLP');
    setRegDescription('');
    setRegVersion('1');
    setRegBaseUrl('https://api.yourdomain.com');
    setRegEndpointPath('/v1/analyze');
    setRegHttpMethod('POST');
    setRegPriceMicroUsd('5000');
    setRegInputSchema('{\n  "type": "object",\n  "properties": {\n    "text": { "type": "string" }\n  },\n  "required": ["text"]\n}');
    setRegExampleRequest('{\n  "text": "Sample text for analysis"\n}');
    setRegOutputSchema('{\n  "type": "object",\n  "properties": {\n    "result": { "type": "string" }\n  }\n}');
    setRegExampleResponse('{\n  "result": "Analysis output"\n}');
    setRegAuthType('NONE');
    setRegAuthHeaderName('X-API-Key');
    setRegSecretKey('');
    setRegBasicUser('');
    setRegBasicPass('');
    setRegErrors({});
    setRegisterModalOpen(true);
  };

  const validateRegisterForm = () => {
    const errors: Record<string, string> = {};
    if (!regApiName.trim() || regApiName.trim().length < 2) {
      errors.name = 'API Name must be at least 2 characters.';
    }
    if (!regDescription.trim() || regDescription.trim().length < 5) {
      errors.description = 'API Description must be at least 5 characters.';
    }
    if (!regBaseUrl.trim() || (!regBaseUrl.startsWith('http://') && !regBaseUrl.startsWith('https://'))) {
      errors.baseUrl = 'Base URL must start with http:// or https://';
    }
    if (!regEndpointPath.trim() || !regEndpointPath.startsWith('/')) {
      errors.endpointPath = 'Endpoint Path must start with / (e.g. /v1/execute)';
    }
    try {
      const price = BigInt(regPriceMicroUsd);
      if (price < 0n) errors.price = 'Price must be a positive integer.';
    } catch {
      errors.price = 'Price must be a valid integer in micro-USD.';
    }
    try {
      JSON.parse(regInputSchema);
    } catch {
      errors.inputSchema = 'Input Schema must be valid JSON syntax.';
    }
    if (regExampleRequest.trim()) {
      try {
        JSON.parse(regExampleRequest);
      } catch {
        errors.exampleRequest = 'Example Request must be valid JSON syntax.';
      }
    }
    if (regOutputSchema.trim()) {
      try {
        JSON.parse(regOutputSchema);
      } catch {
        errors.outputSchema = 'Output Schema must be valid JSON syntax.';
      }
    }
    if (regExampleResponse.trim()) {
      try {
        JSON.parse(regExampleResponse);
      } catch {
        errors.exampleResponse = 'Example Response must be valid JSON syntax.';
      }
    }
    if (regAuthType === 'API_KEY_HEADER' && !regSecretKey.trim()) {
      errors.secretKey = 'API Key Secret value is required when API Key Auth is selected.';
    }
    if (regAuthType === 'BEARER_TOKEN' && !regSecretKey.trim()) {
      errors.secretKey = 'Bearer Token string is required when Bearer Auth is selected.';
    }
    if (regAuthType === 'BASIC_AUTH' && (!regBasicUser.trim() || !regBasicPass.trim())) {
      errors.secretKey = 'Username and password are required for Basic Authentication.';
    }

    setRegErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegisterApiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRegisterForm()) return;

    setRegLoading(true);
    try {
      let upstreamSecret = undefined;
      if (regAuthType === 'API_KEY_HEADER' || regAuthType === 'BEARER_TOKEN') {
        upstreamSecret = regSecretKey;
      } else if (regAuthType === 'BASIC_AUTH') {
        upstreamSecret = `${regBasicUser}:${regBasicPass}`;
      }

      const inputSchema = JSON.parse(regInputSchema);
      const exampleRequest = regExampleRequest.trim() ? JSON.parse(regExampleRequest) : undefined;
      const outputSchema = regOutputSchema.trim() ? JSON.parse(regOutputSchema) : undefined;
      const exampleResponse = regExampleResponse.trim() ? JSON.parse(regExampleResponse) : undefined;

      const createdTool = await api.createTool({
        name: regApiName.trim(),
        category: regCategory,
        description: regDescription.trim(),
        version: regVersion.trim() || '1',
        baseUrl: regBaseUrl.trim(),
        endpointPath: regEndpointPath.trim(),
        httpMethod: regHttpMethod,
        priceMicroUsd: regPriceMicroUsd.trim(),
        inputSchema,
        exampleRequest,
        outputSchema,
        exampleResponse,
        authMethod: regAuthType,
        authHeaderName: regAuthType === 'API_KEY_HEADER' ? regAuthHeaderName : undefined,
        upstreamSecret,
      });

      setRegisterModalOpen(false);
      showNotification('success', `API Service "${createdTool.name}" and initial endpoint created successfully!`);
      // Update state immediately without page reload (Phase 2.9)
      setMyTools((prev) => [createdTool, ...prev.filter((t) => t.id !== createdTool.id)]);
      fetchData();
    } catch (err: any) {
      showNotification('error', err?.message || 'API Registration failed.');
    } finally {
      setRegLoading(false);
    }
  };

  // -------------------------------------------------------------
  // PHASE 3: Add Endpoint to Existing API
  // -------------------------------------------------------------
  const handleOpenAddEndpointModal = (preselectedToolId?: string) => {
    const targetToolId = preselectedToolId || (myTools.length > 0 ? myTools[0].id : '');
    setSelectedParentApiId(targetToolId);
    setEpName('');
    setEpPath('/v1/custom-route');
    setEpHttpMethod('POST');
    setEpDescription('');
    setEpPriceMicroUsd('2500');
    setEpInputSchema('{\n  "type": "object",\n  "properties": {\n    "query": { "type": "string" }\n  },\n  "required": ["query"]\n}');
    setEpExampleRequest('{\n  "query": "Sample test payload"\n}');
    setEpOutputSchema('{\n  "type": "object",\n  "properties": {\n    "status": { "type": "string" }\n  }\n}');
    setEpExampleResponse('{\n  "status": "ok"\n}');
    setEpAuthType('NONE');
    setEpAuthHeaderName('X-API-Key');
    setEpSecretKey('');
    setEpErrors({});
    setAddEndpointModalOpen(true);
  };

  const validateEndpointForm = () => {
    const errors: Record<string, string> = {};
    if (!selectedParentApiId) {
      errors.parentApi = 'Please select an existing API service.';
    }
    if (!epName.trim() || epName.trim().length < 2) {
      errors.name = 'Endpoint Name must be at least 2 characters.';
    }
    if (!epPath.trim() || !epPath.startsWith('/')) {
      errors.path = 'Endpoint Path must start with / (e.g. /v1/batch)';
    }

    // Check duplicate within selected API
    const parent = myTools.find((t) => t.id === selectedParentApiId);
    if (parent && parent.endpoints) {
      const isDup = parent.endpoints.some(
        (e) => e.endpointPath.toLowerCase() === epPath.trim().toLowerCase() && e.httpMethod === epHttpMethod
      );
      if (isDup) {
        errors.path = `Endpoint with path "${epPath}" and method "${epHttpMethod}" already exists in ${parent.name}.`;
      }
    }

    try {
      const price = BigInt(epPriceMicroUsd);
      if (price < 0n) errors.price = 'Price must be a positive integer.';
    } catch {
      errors.price = 'Price must be a valid integer in micro-USD.';
    }

    try {
      JSON.parse(epInputSchema);
    } catch {
      errors.inputSchema = 'Input Schema must be valid JSON syntax.';
    }

    if (epExampleRequest.trim()) {
      try {
        JSON.parse(epExampleRequest);
      } catch {
        errors.exampleRequest = 'Example Request must be valid JSON syntax.';
      }
    }

    if (epOutputSchema.trim()) {
      try {
        JSON.parse(epOutputSchema);
      } catch {
        errors.outputSchema = 'Output Schema must be valid JSON syntax.';
      }
    }

    if (epExampleResponse.trim()) {
      try {
        JSON.parse(epExampleResponse);
      } catch {
        errors.exampleResponse = 'Example Response must be valid JSON syntax.';
      }
    }

    setEpErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddEndpointSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEndpointForm()) return;

    setEpLoading(true);
    try {
      const inputSchema = JSON.parse(epInputSchema);
      const exampleRequest = epExampleRequest.trim() ? JSON.parse(epExampleRequest) : undefined;
      const outputSchema = epOutputSchema.trim() ? JSON.parse(epOutputSchema) : undefined;
      const exampleResponse = epExampleResponse.trim() ? JSON.parse(epExampleResponse) : undefined;

      const newEp = await api.addEndpoint(selectedParentApiId, {
        name: epName.trim(),
        endpointPath: epPath.trim(),
        httpMethod: epHttpMethod,
        description: epDescription.trim() || undefined,
        priceMicroUsd: epPriceMicroUsd.trim(),
        inputSchema,
        exampleRequest,
        outputSchema,
        exampleResponse,
        authMethod: epAuthType,
        authHeaderName: epAuthType === 'API_KEY_HEADER' ? epAuthHeaderName : undefined,
        upstreamSecret: epSecretKey || undefined,
      });

      setAddEndpointModalOpen(false);
      showNotification('success', `Endpoint "${newEp.name}" added to API service successfully!`);

      // Update state immediately without page reload (Phase 3.9)
      setMyTools((prev) =>
        prev.map((tool) => {
          if (tool.id === selectedParentApiId) {
            const currentEndpoints = tool.endpoints || [];
            return {
              ...tool,
              endpoints: [...currentEndpoints, newEp],
              endpointCount: currentEndpoints.length + 1,
            };
          }
          return tool;
        })
      );
      fetchData();
    } catch (err: any) {
      showNotification('error', err?.message || 'Failed to add endpoint.');
    } finally {
      setEpLoading(false);
    }
  };

  // -------------------------------------------------------------
  // PHASE 4: Testing & Submitting Operations
  // -------------------------------------------------------------
  const handleOpenTestModal = (tool: Tool, endpoint?: ToolEndpoint) => {
    setTestingTool(tool);
    const targetEndpoint = endpoint || (tool.endpoints && tool.endpoints[0]) || null;
    setTestingEndpoint(targetEndpoint);

    const initialInput =
      targetEndpoint?.exampleRequest
        ? JSON.stringify(targetEndpoint.exampleRequest, null, 2)
        : tool.exampleRequest
        ? JSON.stringify(tool.exampleRequest, null, 2)
        : '{\n  "text": "Verification test call"\n}';

    setTestInputStr(initialInput);
    setTestResult(null);
    setTestModalOpen(true);
  };

  const handleExecuteTest = async () => {
    if (!testingTool) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      let parsedInput = {};
      try {
        parsedInput = JSON.parse(testInputStr);
      } catch {
        alert('Test input must be valid JSON');
        setTestLoading(false);
        return;
      }

      let res;
      if (testingEndpoint) {
        res = await api.testEndpoint(testingTool.id, testingEndpoint.id, parsedInput);
      } else {
        res = await api.runToolTest(testingTool.id, parsedInput);
      }
      setTestResult(res);
      showNotification('success', 'Endpoint test executed successfully!');
    } catch (err: any) {
      setTestResult({
        isSuccess: false,
        statusCode: 500,
        errorMessage: err?.message || 'Execution failed',
      });
      showNotification('error', err?.message || 'Test failed.');
    } finally {
      setTestLoading(false);
    }
  };

  const handleTestAndSubmit = async (tool: Tool) => {
    try {
      await api.runToolTest(tool.id, { text: 'Verification test call' });
      await api.submitToolForReview(tool.id);
      showNotification('success', `Tool "${tool.name}" submitted for admin review!`);
      fetchData();
    } catch (err: any) {
      showNotification('error', `Submission failed: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleViewDetails = (tool: Tool) => {
    setViewingTool(tool);
    setDetailsModalOpen(true);
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!earnings?.availablePayoutMicroUsd) return;
    try {
      if (!user) {
        await loginDemo('creator');
      }
      await api.requestPayout(earnings.availablePayoutMicroUsd, payoutEmail);
      setPayoutSuccess('Simulated payout request processed and ledger updated!');
      setTimeout(() => {
        setPayoutModalOpen(false);
        setPayoutSuccess(null);
        fetchData();
      }, 1500);
    } catch (err: any) {
      showNotification('error', err?.message || 'Payout request failed');
    }
  };

  // Filtered & Sorted Tools
  const filteredTools = useMemo(() => {
    let list = [...myTools];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((t) => {
        const matchName = t.name.toLowerCase().includes(q);
        const matchSlug = t.slug.toLowerCase().includes(q);
        const matchCategory = t.category.toLowerCase().includes(q);
        const matchPath = t.endpointPath.toLowerCase().includes(q);
        const matchEp = t.endpoints?.some(
          (ep) => ep.name.toLowerCase().includes(q) || ep.endpointPath.toLowerCase().includes(q)
        );
        return matchName || matchSlug || matchCategory || matchPath || matchEp;
      });
    }

    // Category filter
    if (categoryFilter !== 'ALL') {
      list = list.filter((t) => t.category.toLowerCase() === categoryFilter.toLowerCase());
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      list = list.filter((t) => t.status === statusFilter);
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'priceAsc') return Number(a.priceMicroUsd) - Number(b.priceMicroUsd);
      if (sortBy === 'priceDesc') return Number(b.priceMicroUsd) - Number(a.priceMicroUsd);
      // Newest
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    return list;
  }, [myTools, searchQuery, categoryFilter, statusFilter, sortBy]);

  // Total endpoints count across all owned tools
  const totalEndpointsCount = useMemo(() => {
    return myTools.reduce((acc, t) => acc + (t.endpoints?.length || 1), 0);
  }, [myTools]);

  return (
    <div className="section-dark" style={{ minHeight: '85vh', paddingTop: '40px', paddingBottom: '80px' }}>
      <div className="container-editorial">
        {/* Floating Notification */}
        {notification && (
          <div
            style={{
              position: 'fixed',
              top: '84px',
              right: '24px',
              zIndex: 9999,
              padding: '14px 20px',
              borderRadius: 'var(--radius-sm)',
              background: notification.type === 'success' ? '#064E3B' : '#7F1D1D',
              border: `1px solid ${notification.type === 'success' ? '#10B981' : '#EF4444'}`,
              color: '#FFFFFF',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.88rem',
              fontWeight: 600,
              animation: 'fadeIn 0.2s ease',
            }}
          >
            {notification.type === 'success' ? <CheckCircle size={18} color="#10B981" /> : <AlertCircle size={18} color="#EF4444" />}
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', marginLeft: '6px' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* 1. DASHBOARD HEADER (PHASE 4.A)                            */}
        {/* ========================================================= */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: '24px',
            marginBottom: '36px',
          }}
        >
          <div>
            <span className="section-kicker">Developer Monetization Gateway</span>
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
              Creator Studio & Earnings.
            </h1>
            <p style={{ color: 'var(--text-dark-secondary)', maxWidth: '720px', fontSize: '1.02rem', lineHeight: 1.6 }}>
              Register your upstream endpoints, define custom input schemas, set per-call micro-USD pricing, and collect verified machine execution payouts.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => setApimaticModalOpen(true)}
              style={{
                background: 'linear-gradient(135deg, #FF5500 0%, #EA580C 100%)',
                border: '1px solid rgba(255, 85, 0, 0.6)',
                boxShadow: '0 4px 14px rgba(255, 85, 0, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 700,
              }}
            >
              <Sparkles size={16} />
              Onboard with APIMatic
            </button>
            <button className="btn btn-secondary btn-lg" onClick={handleOpenRegisterModal}>
              <Plus size={16} />
              Register Manually
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. API REVENUE METRIC CARDS (PHASE 4.B)                    */}
        {/* ========================================================= */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
            marginBottom: '36px',
          }}
        >
          <div className="card-dark" style={{ padding: '24px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Gross Volume Incurred
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#FFFFFF', fontFamily: 'var(--font-mono)', margin: '6px 0' }}>
              {formatMicroUsd(earnings?.grossEarningsMicroUsd || 0)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dark-muted)' }}>All-time execution billing</div>
          </div>

          <div className="card-dark" style={{ padding: '24px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Platform Commission (10%)
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--status-amber)', fontFamily: 'var(--font-mono)', margin: '6px 0' }}>
              {formatMicroUsd(earnings?.platformFeeMicroUsd || 0)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dark-muted)' }}>1,000 basis points platform fee</div>
          </div>

          <div className="card-dark" style={{ padding: '24px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Net Creator Revenue
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#34D399', fontFamily: 'var(--font-mono)', margin: '6px 0' }}>
              {formatMicroUsd(earnings?.netEarningsMicroUsd || 0)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dark-muted)' }}>Net credited to creator ledger</div>
          </div>

          <div className="card-dark highlight-orange" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Available For Withdrawal
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--brand-orange)', fontFamily: 'var(--font-mono)', margin: '6px 0' }}>
                {formatMicroUsd(earnings?.availablePayoutMicroUsd || 0)}
              </div>
            </div>
            <button
              className="btn btn-outline-orange btn-sm"
              style={{ width: '100%', marginTop: '10px' }}
              onClick={() => setPayoutModalOpen(true)}
            >
              <DollarSign size={14} />
              Request Payout
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. REGISTERED API ENDPOINTS SECTION (PHASE 4.C)            */}
        {/* ========================================================= */}
        <div className="card-dark" style={{ padding: '28px' }}>
          {/* Section Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Registered API Endpoints</span>
                <span className="badge badge-orange" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                  {totalEndpointsCount}
                </span>
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-dark-secondary)' }}>
                Manage live services, add dedicated endpoints, and monitor approval lifecycle
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleOpenAddEndpointModal()}
                title="Add a new endpoint route to an existing API"
              >
                <Plus size={14} />
                Add Endpoint
              </button>
            </div>
          </div>

          {/* Filtering, Search & Sorting Bar (Phase 4.C) */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              marginBottom: '20px',
              padding: '12px 16px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-dark)',
              borderRadius: 'var(--radius-sm)',
              alignItems: 'center',
            }}
          >
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
              <Search size={15} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                className="form-input"
                style={{
                  paddingLeft: '36px',
                  height: '38px',
                  fontSize: '0.84rem',
                  backgroundColor: '#111827',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#F3F4F6',
                }}
                placeholder="Search by API name, path, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Category Filter */}
            <select
              className="form-select filter-select"
              style={{
                width: 'auto',
                minWidth: '160px',
                height: '38px',
                fontSize: '0.84rem',
                flex: '0 0 auto',
              }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              <option value="NLP">NLP</option>
              <option value="Translation">Translation</option>
              <option value="Security">Security</option>
              <option value="Data">Data</option>
              <option value="Utility">Utility</option>
              <option value="Finance">Finance</option>
            </select>

            {/* Status Filter */}
            <select
              className="form-select filter-select"
              style={{
                width: 'auto',
                minWidth: '160px',
                height: '38px',
                fontSize: '0.84rem',
                flex: '0 0 auto',
              }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Approved / Live</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="DRAFT">Draft</option>
              <option value="PAUSED">Paused</option>
            </select>

            {/* Sort */}
            <select
              className="form-select filter-select"
              style={{
                width: 'auto',
                minWidth: '170px',
                height: '38px',
                fontSize: '0.84rem',
                flex: '0 0 auto',
              }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="newest">Sort: Newest</option>
              <option value="name">Sort: Name (A-Z)</option>
              <option value="priceAsc">Sort: Price (Low to High)</option>
              <option value="priceDesc">Sort: Price (High to Low)</option>
            </select>

            {(searchQuery || categoryFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('ALL');
                  setStatusFilter('ALL');
                }}
                style={{ height: '38px', fontSize: '0.80rem', padding: '0 14px', display: 'inline-flex', alignItems: 'center' }}
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Endpoints Table View */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dark-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              <div>Loading registered API services...</div>
            </div>
          ) : filteredTools.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', border: '1px dashed var(--border-dark)', borderRadius: 'var(--radius-sm)' }}>
              <Hammer size={36} color="var(--brand-orange)" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ color: '#FFFFFF', fontWeight: 700, marginBottom: '6px' }}>No APIs matching your criteria</h4>
              <p style={{ color: 'var(--text-dark-secondary)', fontSize: '0.88rem', maxWidth: '440px', margin: '0 auto 16px' }}>
                {searchQuery || categoryFilter !== 'ALL'
                  ? 'Try adjusting your search query or filters.'
                  : 'Get started by creating your first upstream API service.'}
              </p>
              <button className="btn btn-primary btn-sm" onClick={handleOpenRegisterModal}>
                <Plus size={14} /> Register New API
              </button>
            </div>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>API Service Name</th>
                    <th>Category</th>
                    <th>Endpoint Path & Method</th>
                    <th>Unit Rate</th>
                    <th>Version</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTools.map((tool) => {
                    const endpoints = tool.endpoints && tool.endpoints.length > 0
                      ? tool.endpoints
                      : [
                          {
                            id: `def_${tool.id}`,
                            toolId: tool.id,
                            name: `${tool.name} (Primary)`,
                            endpointPath: tool.endpointPath,
                            httpMethod: tool.httpMethod,
                            priceMicroUsd: tool.priceMicroUsd,
                            status: tool.status,
                            isPrimary: true,
                            inputSchema: tool.inputSchema,
                            createdAt: tool.createdAt,
                            updatedAt: tool.updatedAt,
                            authMethod: 'NONE',
                          } as ToolEndpoint,
                        ];

                    return (
                      <React.Fragment key={tool.id}>
                        {endpoints.map((ep, epIdx) => {
                          const methodColor =
                            ep.httpMethod === 'GET'
                              ? '#10B981'
                              : ep.httpMethod === 'POST'
                              ? '#38BDF8'
                              : ep.httpMethod === 'PUT'
                              ? '#F59E0B'
                              : ep.httpMethod === 'DELETE'
                              ? '#EF4444'
                              : '#8B5CF6';

                          return (
                            <tr
                              key={ep.id}
                              style={{
                                background: epIdx === 0 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                                borderTop: epIdx === 0 ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.03)',
                              }}
                            >
                              <td>
                                {epIdx === 0 ? (
                                  <div>
                                    <div style={{ fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span>{tool.name}</span>
                                      <span
                                        className="badge badge-dark-neutral"
                                        style={{ fontSize: '0.64rem', padding: '1px 6px', fontWeight: 600 }}
                                      >
                                        {endpoints.length} {endpoints.length === 1 ? 'endpoint' : 'endpoints'}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.74rem', color: 'var(--brand-orange)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                                      {tool.slug}
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ paddingLeft: '16px', fontSize: '0.80rem', color: 'var(--text-dark-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: 'var(--brand-orange)' }}>↳</span>
                                    <span>{ep.name}</span>
                                  </div>
                                )}
                              </td>

                              <td>
                                {epIdx === 0 && (
                                  <span className="badge badge-dark-neutral">{tool.category}</span>
                                )}
                              </td>

                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span
                                    style={{
                                      fontSize: '0.68rem',
                                      fontWeight: 800,
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: `${methodColor}22`,
                                      color: methodColor,
                                      border: `1px solid ${methodColor}44`,
                                      fontFamily: 'var(--font-mono)',
                                    }}
                                  >
                                    {ep.httpMethod}
                                  </span>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: '#FFFFFF' }}>
                                    {ep.endpointPath}
                                  </span>
                                </div>
                              </td>

                              <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FFFFFF', fontSize: '0.85rem' }}>
                                {formatMicroUsd(ep.priceMicroUsd || tool.priceMicroUsd)}
                              </td>

                              <td style={{ fontSize: '0.80rem', color: 'var(--text-dark-muted)' }}>
                                v{tool.version}
                              </td>

                              <td>
                                <span
                                  className={`badge ${
                                    (ep.status || tool.status) === 'APPROVED'
                                      ? 'badge-emerald'
                                      : (ep.status || tool.status) === 'PENDING_REVIEW'
                                      ? 'badge-amber'
                                      : 'badge-dark-neutral'
                                  }`}
                                >
                                  {ep.status || tool.status}
                                </span>
                              </td>

                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                  {/* Test Endpoint Button */}
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleOpenTestModal(tool, ep)}
                                    title="Execute test call against this endpoint"
                                    style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                                  >
                                    <Play size={12} />
                                    Test
                                  </button>

                                  {/* View Details */}
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleViewDetails(tool)}
                                    title="View full API service & endpoint specifications"
                                    style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                                  >
                                    <Eye size={12} />
                                  </button>

                                  {/* Add Endpoint Button on Parent */}
                                  {epIdx === 0 && (
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => handleOpenAddEndpointModal(tool.id)}
                                      title="Add new endpoint to this API service"
                                      style={{ padding: '4px 8px', fontSize: '0.74rem', color: 'var(--brand-orange)' }}
                                    >
                                      <Plus size={12} />
                                      Route
                                    </button>
                                  )}

                                  {/* Submit for Review if DRAFT */}
                                  {(tool.status === 'DRAFT' || tool.status === 'TESTING') && epIdx === 0 && (
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={() => handleTestAndSubmit(tool)}
                                      style={{ padding: '4px 9px', fontSize: '0.74rem' }}
                                    >
                                      <Send size={12} />
                                      Submit
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* MODAL 1: REGISTER NEW API (PHASE 2)                        */}
        {/* ========================================================= */}
        {registerModalOpen && (
          <div className="modal-overlay" onClick={() => setRegisterModalOpen(false)}>
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '780px', width: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
            >
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.28rem', fontWeight: 800, color: '#FFFFFF' }}>
                    Register New API Service
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-dark-muted)', marginTop: '2px' }}>
                    Create a new upstream API service and configure its initial endpoint route
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRegisterModalOpen(false);
                    setApimaticModalOpen(true);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255, 85, 0, 0.12)',
                    border: '1px solid rgba(255, 85, 0, 0.4)',
                    color: '#FF5500',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Sparkles size={14} />
                  Import via APIMatic
                </button>
                <button
                  onClick={() => setRegisterModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dark-muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleRegisterApiSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Fieldset 1: Basic Information */}
                  <div>
                    <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--brand-orange)', letterSpacing: '0.06em', marginBottom: '10px' }}>
                      1. Basic Information
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                      <div className="form-group">
                        <label className="form-label">API Name *</label>
                        <input
                          type="text"
                          required
                          className="form-input"
                          value={regApiName}
                          onChange={(e) => setRegApiName(e.target.value)}
                          placeholder="e.g. Translation & Localization Intelligence"
                        />
                        {regErrors.name && <span style={{ color: '#EF4444', fontSize: '0.72rem' }}>{regErrors.name}</span>}
                      </div>

                      <div className="form-group">
                        <label className="form-label">Category *</label>
                        <select className="form-select" value={regCategory} onChange={(e) => setRegCategory(e.target.value)}>
                          <option value="NLP">NLP</option>
                          <option value="Translation">Translation</option>
                          <option value="Security">Security</option>
                          <option value="Data">Data</option>
                          <option value="Utility">Utility</option>
                          <option value="Finance">Finance</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">API Version</label>
                        <input
                          type="text"
                          className="form-input"
                          value={regVersion}
                          onChange={(e) => setRegVersion(e.target.value)}
                          placeholder="e.g. 1.0.0"
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginTop: '12px' }}>
                      <label className="form-label">API Description *</label>
                      <textarea
                        className="form-textarea"
                        rows={2}
                        required
                        value={regDescription}
                        onChange={(e) => setRegDescription(e.target.value)}
                        placeholder="Comprehensive description of the service capabilities, latency expectations, and model accuracy..."
                      />
                      {regErrors.description && <span style={{ color: '#EF4444', fontSize: '0.72rem' }}>{regErrors.description}</span>}
                    </div>
                  </div>

                  {/* Fieldset 2: Connection Details */}
                  <div style={{ borderTop: '1px solid var(--border-dark)', paddingTop: '16px' }}>
                    <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--brand-orange)', letterSpacing: '0.06em', marginBottom: '10px' }}>
                      2. Connection Details
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr', gap: '14px' }}>
                      <div className="form-group">
                        <label className="form-label">Base URL *</label>
                        <input
                          type="text"
                          required
                          className="form-input"
                          value={regBaseUrl}
                          onChange={(e) => setRegBaseUrl(e.target.value)}
                          placeholder="https://api.yourdomain.com"
                        />
                        {regErrors.baseUrl && <span style={{ color: '#EF4444', fontSize: '0.72rem' }}>{regErrors.baseUrl}</span>}
                      </div>

                      <div className="form-group">
                        <label className="form-label">Initial Endpoint Path *</label>
                        <input
                          type="text"
                          required
                          className="form-input"
                          value={regEndpointPath}
                          onChange={(e) => setRegEndpointPath(e.target.value)}
                          placeholder="/v1/analyze"
                        />
                        {regErrors.endpointPath && <span style={{ color: '#EF4444', fontSize: '0.72rem' }}>{regErrors.endpointPath}</span>}
                      </div>

                      <div className="form-group">
                        <label className="form-label">HTTP Method *</label>
                        <select className="form-select" value={regHttpMethod} onChange={(e) => setRegHttpMethod(e.target.value as any)}>
                          <option value="POST">POST</option>
                          <option value="GET">GET</option>
                          <option value="PUT">PUT</option>
                          <option value="PATCH">PATCH</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Fieldset 3: Pricing */}
                  <div style={{ borderTop: '1px solid var(--border-dark)', paddingTop: '16px' }}>
                    <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--brand-orange)', letterSpacing: '0.06em', marginBottom: '10px' }}>
                      3. Pricing
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'center' }}>
                      <div className="form-group">
                        <label className="form-label">Price Per Call (micro-USD) *</label>
                        <input
                          type="number"
                          required
                          className="form-input"
                          value={regPriceMicroUsd}
                          onChange={(e) => setRegPriceMicroUsd(e.target.value)}
                          placeholder="5000"
                        />
                        {regErrors.price && <span style={{ color: '#EF4444', fontSize: '0.72rem' }}>{regErrors.price}</span>}
                      </div>

                      <div
                        style={{
                          padding: '12px 16px',
                          background: 'rgba(255, 85, 0, 0.08)',
                          border: '1px solid var(--brand-orange-border)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <div style={{ fontSize: '0.70rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                          Equivalent USD Amount
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-orange)', fontFamily: 'var(--font-mono)' }}>
                          {formatMicroUsdDynamic(regPriceMicroUsd)} USD
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fieldset 4: Input Configuration */}
                  <div style={{ borderTop: '1px solid var(--border-dark)', paddingTop: '16px' }}>
                    <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--brand-orange)', letterSpacing: '0.06em', marginBottom: '10px' }}>
                      4. Input Configuration
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                      <div className="form-group">
                        <label className="form-label">Input JSON Schema (Draft 7) *</label>
                        <textarea
                          className="form-textarea"
                          rows={4}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.80rem' }}
                          value={regInputSchema}
                          onChange={(e) => setRegInputSchema(e.target.value)}
                        />
                        {regErrors.inputSchema && <span style={{ color: '#EF4444', fontSize: '0.72rem' }}>{regErrors.inputSchema}</span>}
                      </div>

                      <div className="form-group">
                        <label className="form-label">Example Request JSON</label>
                        <textarea
                          className="form-textarea"
                          rows={4}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.80rem' }}
                          value={regExampleRequest}
                          onChange={(e) => setRegExampleRequest(e.target.value)}
                        />
                        {regErrors.exampleRequest && <span style={{ color: '#EF4444', fontSize: '0.72rem' }}>{regErrors.exampleRequest}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Fieldset 5: Output Configuration */}
                  <div style={{ borderTop: '1px solid var(--border-dark)', paddingTop: '16px' }}>
                    <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--brand-orange)', letterSpacing: '0.06em', marginBottom: '10px' }}>
                      5. Output Configuration
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                      <div className="form-group">
                        <label className="form-label">Output JSON Schema (Draft 7)</label>
                        <textarea
                          className="form-textarea"
                          rows={4}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.80rem' }}
                          value={regOutputSchema}
                          onChange={(e) => setRegOutputSchema(e.target.value)}
                        />
                        {regErrors.outputSchema && <span style={{ color: '#EF4444', fontSize: '0.72rem' }}>{regErrors.outputSchema}</span>}
                      </div>

                      <div className="form-group">
                        <label className="form-label">Example Response JSON</label>
                        <textarea
                          className="form-textarea"
                          rows={4}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.80rem' }}
                          value={regExampleResponse}
                          onChange={(e) => setRegExampleResponse(e.target.value)}
                        />
                        {regErrors.exampleResponse && <span style={{ color: '#EF4444', fontSize: '0.72rem' }}>{regErrors.exampleResponse}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Fieldset 6: Authentication */}
                  <div style={{ borderTop: '1px solid var(--border-dark)', paddingTop: '16px' }}>
                    <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--brand-orange)', letterSpacing: '0.06em', marginBottom: '10px' }}>
                      6. Upstream Authentication Configuration
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                      <div className="form-group">
                        <label className="form-label">Authentication Type</label>
                        <select className="form-select" value={regAuthType} onChange={(e) => setRegAuthType(e.target.value as any)}>
                          <option value="NONE">None (Public API)</option>
                          <option value="API_KEY_HEADER">API Key (Custom Header)</option>
                          <option value="BEARER_TOKEN">Bearer Token (Authorization Header)</option>
                          <option value="BASIC_AUTH">Basic Authentication (Username & Password)</option>
                        </select>
                      </div>

                      {regAuthType === 'API_KEY_HEADER' && (
                        <div className="form-group">
                          <label className="form-label">Header Name</label>
                          <input
                            type="text"
                            className="form-input"
                            value={regAuthHeaderName}
                            onChange={(e) => setRegAuthHeaderName(e.target.value)}
                            placeholder="X-API-Key"
                          />
                        </div>
                      )}

                      {(regAuthType === 'API_KEY_HEADER' || regAuthType === 'BEARER_TOKEN') && (
                        <div className="form-group">
                          <label className="form-label">Secret Token / Key</label>
                          <input
                            type="password"
                            className="form-input"
                            value={regSecretKey}
                            onChange={(e) => setRegSecretKey(e.target.value)}
                            placeholder="sk_live_..."
                          />
                          {regErrors.secretKey && <span style={{ color: '#EF4444', fontSize: '0.72rem' }}>{regErrors.secretKey}</span>}
                        </div>
                      )}

                      {regAuthType === 'BASIC_AUTH' && (
                        <>
                          <div className="form-group">
                            <label className="form-label">Basic Auth Username</label>
                            <input
                              type="text"
                              className="form-input"
                              value={regBasicUser}
                              onChange={(e) => setRegBasicUser(e.target.value)}
                              placeholder="api_user"
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Basic Auth Password</label>
                            <input
                              type="password"
                              className="form-input"
                              value={regBasicPass}
                              onChange={(e) => setRegBasicPass(e.target.value)}
                              placeholder="••••••••"
                            />
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dark-muted)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Shield size={13} color="#10B981" />
                      <span>Credentials are encrypted with AES-256-GCM and never returned in API responses or logs.</span>
                    </div>
                  </div>
                </div>

                <div className="modal-footer" style={{ borderTop: '1px solid var(--border-dark)', padding: '16px 24px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setRegisterModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={regLoading}>
                    {regLoading ? 'Registering API Service...' : 'Register API Service'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 2: ADD ENDPOINT TO EXISTING API (PHASE 3)           */}
        {/* ========================================================= */}
        {addEndpointModalOpen && (
          <div className="modal-overlay" onClick={() => setAddEndpointModalOpen(false)}>
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '720px', width: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
            >
              <div className="modal-header">
                <div>
                  <h3 style={{ fontSize: '1.28rem', fontWeight: 800, color: '#FFFFFF' }}>
                    Add Endpoint to Existing API
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-dark-muted)', marginTop: '2px' }}>
                    Configure a new route or operation under one of your registered API services
                  </p>
                </div>
                <button
                  onClick={() => setAddEndpointModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dark-muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddEndpointSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Step 1: Select Existing API (Phase 3.1) */}
                  <div>
                    <label className="form-label" style={{ fontWeight: 800, color: 'var(--brand-orange)' }}>
                      Step 1: Select Parent API Service *
                    </label>
                    <select
                      className="form-select"
                      required
                      value={selectedParentApiId}
                      onChange={(e) => setSelectedParentApiId(e.target.value)}
                      style={{ fontSize: '0.90rem', padding: '10px 14px' }}
                    >
                      {myTools.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.category}) — Base: {t.baseUrl}
                        </option>
                      ))}
                    </select>
                    {epErrors.parentApi && <span style={{ color: '#EF4444', fontSize: '0.72rem' }}>{epErrors.parentApi}</span>}
                  </div>

                  {/* Step 2: Endpoint Information (Phase 3.2) */}
                  <div style={{ borderTop: '1px solid var(--border-dark)', paddingTop: '16px' }}>
                    <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--brand-orange)', letterSpacing: '0.06em', marginBottom: '10px' }}>
                      Step 2: Endpoint Information
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                      <div className="form-group">
                        <label className="form-label">Endpoint Name *</label>
                        <input
                          type="text"
                          required
                          className="form-input"
                          value={epName}
                          onChange={(e) => setEpName(e.target.value)}
                          placeholder="e.g. Batch Document Translation"
                        />
                        {epErrors.name && <span style={{ color: '#EF4444', fontSize: '0.72rem' }}>{epErrors.name}</span>}
                      </div>

                      <div className="form-group">
                        <label className="form-label">HTTP Method *</label>
                        <select className="form-select" value={epHttpMethod} onChange={(e) => setEpHttpMethod(e.target.value as any)}>
                          <option value="POST">POST</option>
                          <option value="GET">GET</option>
                          <option value="PUT">PUT</option>
                          <option value="PATCH">PATCH</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Endpoint Path *</label>
                        <input
                          type="text"
                          required
                          className="form-input"
                          value={epPath}
                          onChange={(e) => setEpPath(e.target.value)}
                          placeholder="/v1/documents/batch"
                        />
                        {epErrors.path && <span style={{ color: '#EF4444', fontSize: '0.72rem' }}>{epErrors.path}</span>}
                      </div>
                    </div>

                    <div className="form-group" style={{ marginTop: '12px' }}>
                      <label className="form-label">Endpoint Description</label>
                      <input
                        type="text"
                        className="form-input"
                        value={epDescription}
                        onChange={(e) => setEpDescription(e.target.value)}
                        placeholder="Optional description of this specific endpoint route..."
                      />
                    </div>
                  </div>

                  {/* Pricing for this Endpoint */}
                  <div style={{ borderTop: '1px solid var(--border-dark)', paddingTop: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'center' }}>
                      <div className="form-group">
                        <label className="form-label">Price Per Call (micro-USD) *</label>
                        <input
                          type="number"
                          required
                          className="form-input"
                          value={epPriceMicroUsd}
                          onChange={(e) => setEpPriceMicroUsd(e.target.value)}
                          placeholder="2500"
                        />
                        {epErrors.price && <span style={{ color: '#EF4444', fontSize: '0.72rem' }}>{epErrors.price}</span>}
                      </div>

                      <div
                        style={{
                          padding: '10px 14px',
                          background: 'rgba(255, 85, 0, 0.08)',
                          border: '1px solid var(--brand-orange-border)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <div style={{ fontSize: '0.70rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                          Equivalent USD Amount
                        </div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--brand-orange)', fontFamily: 'var(--font-mono)' }}>
                          {formatMicroUsdDynamic(epPriceMicroUsd)} USD
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Schemas */}
                  <div style={{ borderTop: '1px solid var(--border-dark)', paddingTop: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                      <div className="form-group">
                        <label className="form-label">Input JSON Schema *</label>
                        <textarea
                          className="form-textarea"
                          rows={4}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.80rem' }}
                          value={epInputSchema}
                          onChange={(e) => setEpInputSchema(e.target.value)}
                        />
                        {epErrors.inputSchema && <span style={{ color: '#EF4444', fontSize: '0.72rem' }}>{epErrors.inputSchema}</span>}
                      </div>

                      <div className="form-group">
                        <label className="form-label">Example Request JSON</label>
                        <textarea
                          className="form-textarea"
                          rows={4}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.80rem' }}
                          value={epExampleRequest}
                          onChange={(e) => setEpExampleRequest(e.target.value)}
                        />
                        {epErrors.exampleRequest && <span style={{ color: '#EF4444', fontSize: '0.72rem' }}>{epErrors.exampleRequest}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Output Schemas */}
                  <div style={{ borderTop: '1px solid var(--border-dark)', paddingTop: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                      <div className="form-group">
                        <label className="form-label">Output JSON Schema</label>
                        <textarea
                          className="form-textarea"
                          rows={4}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.80rem' }}
                          value={epOutputSchema}
                          onChange={(e) => setEpOutputSchema(e.target.value)}
                        />
                        {epErrors.outputSchema && <span style={{ color: '#EF4444', fontSize: '0.72rem' }}>{epErrors.outputSchema}</span>}
                      </div>

                      <div className="form-group">
                        <label className="form-label">Example Response JSON</label>
                        <textarea
                          className="form-textarea"
                          rows={4}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.80rem' }}
                          value={epExampleResponse}
                          onChange={(e) => setEpExampleResponse(e.target.value)}
                        />
                        {epErrors.exampleResponse && <span style={{ color: '#EF4444', fontSize: '0.72rem' }}>{epErrors.exampleResponse}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer" style={{ borderTop: '1px solid var(--border-dark)', padding: '16px 24px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setAddEndpointModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={epLoading}>
                    {epLoading ? 'Adding Endpoint...' : 'Save Endpoint to API'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 3: TEST ENDPOINT RUNNER (PHASE 4.D)                  */}
        {/* ========================================================= */}
        {testModalOpen && testingTool && (
          <div className="modal-overlay" onClick={() => setTestModalOpen(false)}>
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '640px', width: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
            >
              <div className="modal-header">
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                    Test Endpoint Execution
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--brand-orange)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    {testingEndpoint?.httpMethod || testingTool.httpMethod} {testingTool.baseUrl}{testingEndpoint?.endpointPath || testingTool.endpointPath}
                  </div>
                </div>
                <button
                  onClick={() => setTestModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dark-muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Input Request Payload (JSON)</label>
                  <textarea
                    className="form-textarea"
                    rows={5}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
                    value={testInputStr}
                    onChange={(e) => setTestInputStr(e.target.value)}
                  />
                </div>

                <button
                  className="btn btn-primary w-full"
                  disabled={testLoading}
                  onClick={handleExecuteTest}
                  style={{ marginBottom: '18px' }}
                >
                  <Play size={14} />
                  {testLoading ? 'Executing Test Call...' : 'Run Test Call'}
                </button>

                {testResult && (
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid var(--border-dark)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '14px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-dark-muted)' }}>
                        Execution Result
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span
                          className={`badge ${testResult.isSuccess ? 'badge-emerald' : 'badge-amber'}`}
                        >
                          Status: {testResult.statusCode || (testResult.isSuccess ? 200 : 500)}
                        </span>
                        {testResult.latencyMs != null && (
                          <span className="badge badge-dark-neutral">
                            {testResult.latencyMs} ms
                          </span>
                        )}
                      </div>
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        padding: '10px',
                        background: '#090A0E',
                        borderRadius: '4px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.78rem',
                        color: testResult.isSuccess ? '#34D399' : '#F87171',
                        maxHeight: '180px',
                        overflowY: 'auto',
                      }}
                    >
                      {JSON.stringify(testResult.response || testResult.errorMessage || testResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-dark)', padding: '14px 24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setTestModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 4: VIEW DETAILS (PHASE 4.D)                          */}
        {/* ========================================================= */}
        {detailsModalOpen && viewingTool && (
          <div className="modal-overlay" onClick={() => setDetailsModalOpen(false)}>
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '680px', width: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
            >
              <div className="modal-header">
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                    {viewingTool.name}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--brand-orange)', fontFamily: 'var(--font-mono)' }}>
                    Category: {viewingTool.category} | Version: v{viewingTool.version}
                  </div>
                </div>
                <button
                  onClick={() => setDetailsModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dark-muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 700 }}>Description</label>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-dark-secondary)', lineHeight: 1.5 }}>
                    {viewingTool.detailedDescription || viewingTool.description || viewingTool.shortDescription}
                  </p>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 700 }}>Connection Specification</label>
                  <div style={{ background: '#090A0E', padding: '10px 14px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-dark)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                    <div style={{ color: 'var(--text-dark-muted)' }}>Base URL: <span style={{ color: '#FFFFFF' }}>{viewingTool.baseUrl}</span></div>
                    <div style={{ color: 'var(--text-dark-muted)', marginTop: '4px' }}>Rate Limit: <span style={{ color: '#FFFFFF' }}>{viewingTool.rateLimitRpm || 60} RPM</span></div>
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 700 }}>Configured Endpoints ({viewingTool.endpoints?.length || 1})</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(viewingTool.endpoints || [
                      {
                        id: 'def',
                        name: 'Primary Route',
                        endpointPath: viewingTool.endpointPath,
                        httpMethod: viewingTool.httpMethod,
                        priceMicroUsd: viewingTool.priceMicroUsd,
                        status: viewingTool.status,
                      } as ToolEndpoint,
                    ]).map((ep) => (
                      <div
                        key={ep.id}
                        style={{
                          padding: '10px 14px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-dark)',
                          borderRadius: 'var(--radius-xs)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#FFFFFF' }}>{ep.name}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--brand-orange)', marginTop: '2px' }}>
                            {ep.httpMethod} {ep.endpointPath}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: '#FFFFFF', fontWeight: 700 }}>
                            {formatMicroUsd(ep.priceMicroUsd)}
                          </div>
                          <span className="badge badge-emerald" style={{ fontSize: '0.64rem', marginTop: '3px' }}>
                            {ep.status || viewingTool.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-dark)', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setDetailsModalOpen(false);
                    handleOpenSdkModal(viewingTool);
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    background: 'rgba(255, 85, 0, 0.12)',
                    border: '1px solid rgba(255, 85, 0, 0.4)',
                    color: '#FF5500',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Code size={14} />
                  Download Client SDK (TS / Python)
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setDetailsModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 5: WITHDRAW PAYOUT                                   */}
        {/* ========================================================= */}
        {payoutModalOpen && (
          <div className="modal-overlay" onClick={() => setPayoutModalOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
              <div className="modal-header">
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>Withdraw Creator Earnings</h3>
                <button
                  onClick={() => setPayoutModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dark-muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleRequestPayout}>
                <div className="modal-body">
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dark-muted)' }}>Available to withdraw:</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#34D399', fontFamily: 'var(--font-mono)' }}>
                      {formatMicroUsd(earnings?.availablePayoutMicroUsd || 0)}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">PayPal Email for Transfer</label>
                    <input
                      type="email"
                      required
                      className="form-input"
                      value={payoutEmail}
                      onChange={(e) => setPayoutEmail(e.target.value)}
                      placeholder="creator-paypal@example.com"
                    />
                  </div>

                  {payoutSuccess && (
                    <div style={{ padding: '12px 16px', background: 'var(--status-emerald-bg)', border: '1px solid var(--status-emerald-border)', color: '#34D399', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                      {payoutSuccess}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setPayoutModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Confirm Simulated Payout
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* APIMATIC ONBOARDING MODAL */}
        <ApimaticOnboardingModal
          isOpen={apimaticModalOpen}
          onClose={() => setApimaticModalOpen(false)}
          onSuccess={(createdTool) => {
            setMyTools((prev) => [createdTool, ...prev]);
            setNotification({
              type: 'success',
              message: `API "${createdTool.name}" onboarded via APIMatic successfully in DRAFT status!`,
            });
            setTimeout(() => setNotification(null), 5000);
          }}
        />

        {/* CLIENT SDK VIEWER MODAL */}
        {sdkModalOpen && selectedToolForSdk && (
          <div className="modal-overlay" onClick={() => setSdkModalOpen(false)}>
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '820px', width: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
            >
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                    Client SDK — {selectedToolForSdk.name}
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-dark-muted)', margin: '2px 0 0 0' }}>
                    Auto-generated client wrapper with typed models and ToolToll pay-per-use authorization.
                  </p>
                </div>
                <button onClick={() => setSdkModalOpen(false)} style={{ background: 'none', border: 'none', color: '#9FA4B5', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              {/* Language Selector Tab */}
              <div style={{ padding: '0.75rem 1.5rem', background: '#090A0E', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleChangeSdkLanguage('typescript')}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: sdkLanguage === 'typescript' ? 'rgba(255, 85, 0, 0.15)' : 'transparent',
                      border: sdkLanguage === 'typescript' ? '1px solid #FF5500' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: sdkLanguage === 'typescript' ? '#FF5500' : '#9FA4B5',
                    }}
                  >
                    TypeScript (.ts)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeSdkLanguage('python')}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: sdkLanguage === 'python' ? 'rgba(255, 85, 0, 0.15)' : 'transparent',
                      border: sdkLanguage === 'python' ? '1px solid #FF5500' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: sdkLanguage === 'python' ? '#FF5500' : '#9FA4B5',
                    }}
                  >
                    Python (.py)
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleCopySdkCode}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: '#161824',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: sdkCopied ? '#10B981' : '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {sdkCopied ? <Check size={14} /> : <Code size={14} />}
                    {sdkCopied ? 'Copied!' : 'Copy Code'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadSdkFile}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: 'var(--brand-orange)',
                      border: 'none',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Download size={14} />
                    Download File
                  </button>
                </div>
              </div>

              {/* Code Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem', background: '#090A0E' }}>
                {sdkLoading ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#9FA4B5' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem auto' }} />
                    Generating SDK...
                  </div>
                ) : (
                  <pre
                    style={{
                      margin: 0,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: '0.8rem',
                      lineHeight: 1.5,
                      color: '#E2E8F0',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {sdkCode}
                  </pre>
                )}
              </div>

              <div style={{ padding: '0.75rem 1.5rem', background: '#12141D', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSdkModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
