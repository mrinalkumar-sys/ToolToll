import React, { useState, useId } from 'react';
import {
  X,
  UploadCloud,
  Globe,
  FileText,
  Sparkles,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Layers,
  Shield,
  Code,
  Check,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api';
import {
  ApimaticValidationReport,
  ToolTollDraftConfig,
  ApimaticEndpointSummary,
  Tool,
} from '../../types';

interface ApimaticOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (tool: Tool) => void;
}

type OnboardingStep = 1 | 2 | 3 | 4 | 5;

const SAMPLE_OPENAPI_SPEC = JSON.stringify(
  {
    openapi: '3.0.0',
    info: {
      title: 'Global Geocoding & Weather Intelligence',
      version: '1.4.0',
      description: 'High-availability coordinates lookup and atmospheric telemetry metrics for autonomous agents.',
    },
    servers: [
      {
        url: 'https://api.geoweather-intel.com',
        description: 'Production gateway cluster',
      },
    ],
    components: {
      securitySchemes: {
        ProviderApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Provider-Key',
          description: 'Upstream provider authentication token',
        },
      },
    },
    paths: {
      '/v1/geocode': {
        post: {
          summary: 'Forward Geocode Address',
          description: 'Translates a textual street address into latitude, longitude, and accuracy radius.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['address'],
                  properties: {
                    address: {
                      type: 'string',
                      description: 'Full street address or landmark query',
                    },
                    countryCode: {
                      type: 'string',
                      description: 'ISO-3166 2-letter country code',
                    },
                  },
                },
                example: {
                  address: '1600 Amphitheatre Parkway, Mountain View, CA',
                  countryCode: 'US',
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Coordinates returned successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      lat: { type: 'number' },
                      lon: { type: 'number' },
                      confidence: { type: 'number' },
                    },
                  },
                  example: {
                    lat: 37.422,
                    lon: -122.084,
                    confidence: 0.99,
                  },
                },
              },
            },
          },
        },
      },
      '/v1/telemetry': {
        post: {
          summary: 'Fetch Atmospheric Telemetry',
          description: 'Retrieves current temperature, barometric pressure, and precipitation risk.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['lat', 'lon'],
                  properties: {
                    lat: { type: 'number' },
                    lon: { type: 'number' },
                    units: { type: 'string', default: 'metric' },
                  },
                },
                example: {
                  lat: 37.422,
                  lon: -122.084,
                  units: 'metric',
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Real-time readings',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      tempCelsius: { type: 'number' },
                      humidity: { type: 'number' },
                      pressureHpa: { type: 'number' },
                    },
                  },
                  example: {
                    tempCelsius: 21.5,
                    humidity: 55,
                    pressureHpa: 1013,
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  null,
  2
);

export const ApimaticOnboardingModal: React.FC<ApimaticOnboardingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const fileInputId = useId();
  // Step state (1: Upload, 2: Validating, 3: Report, 4: Preview/Edit, 5: Confirm)
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);

  // Step 1: Input state
  const [inputTab, setInputTab] = useState<'upload' | 'url' | 'paste'>('paste');
  const [specContent, setSpecContent] = useState<string>(SAMPLE_OPENAPI_SPEC);
  const [specUrl, setSpecUrl] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');

  // Step 2 & 3: Validation state
  const [validating, setValidating] = useState<boolean>(false);
  const [validationReport, setValidationReport] = useState<ApimaticValidationReport | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Step 4: Editable ToolToll configuration draft
  const [draftConfig, setDraftConfig] = useState<ToolTollDraftConfig | null>(null);
  const [editApiName, setEditApiName] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('Data & Analytics');
  const [editBaseUrl, setEditBaseUrl] = useState<string>('');
  const [editShortDesc, setEditShortDesc] = useState<string>('');
  const [editDetailedDesc, setEditDetailedDesc] = useState<string>('');
  const [editPriceMicroUsd, setEditPriceMicroUsd] = useState<string>('5000');
  const [editAuthMethod, setEditAuthMethod] = useState<'NONE' | 'API_KEY_HEADER' | 'BEARER_TOKEN' | 'BASIC_AUTH'>('API_KEY_HEADER');
  const [editAuthHeaderName, setEditAuthHeaderName] = useState<string>('X-API-Key');
  const [editUpstreamSecret, setEditUpstreamSecret] = useState<string>('');
  const [selectedEndpoints, setSelectedEndpoints] = useState<Array<ApimaticEndpointSummary & { enabled: boolean }>>([]);

  // Step 5: Submission state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<Tool | null>(null);

  if (!isOpen) return null;

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setSpecContent(content || '');
      setInputTab('paste'); // Switch to editor so creator sees what was loaded
    };
    reader.readAsText(file);
  };

  // Step 2 Trigger: Validate with APIMatic
  const handleValidateSpec = async () => {
    setValidating(true);
    setValidationError(null);
    setCurrentStep(2);

    try {
      const payload = inputTab === 'url' ? { specUrl } : { specContent };
      const res = await api.validateApiSpec(payload);

      setValidationReport(res.report);

      if (res.draft) {
        setDraftConfig(res.draft);
        setEditApiName(res.draft.name);
        setEditCategory(res.draft.category || 'Data & Analytics');
        setEditBaseUrl(res.draft.baseUrl);
        setEditShortDesc(res.draft.shortDescription);
        setEditDetailedDesc(res.draft.detailedDescription);
        setEditPriceMicroUsd(res.draft.priceMicroUsd || '5000');
        setEditAuthMethod(res.draft.authMethod);
        setEditAuthHeaderName(res.draft.authHeaderName || 'X-API-Key');
        setSelectedEndpoints(
          res.draft.endpoints.map((ep) => ({
            ...ep,
            enabled: true,
          }))
        );
      }

      setCurrentStep(3); // Show Validation Report
    } catch (err: any) {
      setValidationError(err.message || 'Validation request failed.');
      setCurrentStep(1); // Return to input
    } finally {
      setValidating(false);
    }
  };

  // Step 5 Trigger: Confirm & Register in ToolToll
  const handleConfirmRegistration = async () => {
    if (!draftConfig) return;

    setSubmitting(true);
    try {
      const activeEndpoints = selectedEndpoints
        .filter((ep) => ep.enabled)
        .map((ep, idx) => ({
          name: ep.name,
          endpointPath: ep.path,
          httpMethod: ep.method,
          description: ep.description,
          inputSchema: ep.inputSchema,
          outputSchema: ep.outputSchema,
          exampleRequest: ep.exampleRequest,
          exampleResponse: ep.exampleResponse,
          authMethod: editAuthMethod,
          authHeaderName: editAuthHeaderName,
          priceMicroUsd: ep.priceMicroUsd || editPriceMicroUsd,
          timeoutMs: ep.timeoutMs || 15000,
          isPrimary: idx === 0,
        }));

      if (activeEndpoints.length === 0) {
        alert('Please enable at least one endpoint to register this API service.');
        setSubmitting(false);
        return;
      }

      const payload = {
        name: editApiName.trim(),
        shortDescription: editShortDesc.trim(),
        detailedDescription: editDetailedDesc.trim(),
        category: editCategory,
        tags: draftConfig.tags || [editCategory.toLowerCase(), 'apimatic'],
        baseUrl: editBaseUrl.trim(),
        authMethod: editAuthMethod,
        authHeaderName: editAuthMethod === 'API_KEY_HEADER' ? editAuthHeaderName : undefined,
        upstreamSecret: editUpstreamSecret.trim() ? editUpstreamSecret.trim() : undefined,
        priceMicroUsd: editPriceMicroUsd,
        timeoutMs: 15000,
        endpoints: activeEndpoints,
      };

      const createdTool = await api.confirmOnboardedApi(payload);
      setSubmitSuccess(createdTool);
      onSuccess(createdTool);
    } catch (err: any) {
      alert(`Registration failed: ${err.message || 'Server error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getMethodBadgeColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return '#0EA5E9';
      case 'POST': return '#10B981';
      case 'PUT': return '#F59E0B';
      case 'PATCH': return '#8B5CF6';
      case 'DELETE': return '#EF4444';
      default: return '#64748B';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '920px',
          width: '94vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0F121A',
          border: '1px solid rgba(255, 85, 0, 0.35)',
          borderRadius: '16px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(255, 85, 0, 0.15)',
        }}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(255, 85, 0, 0.12)',
                border: '1px solid rgba(255, 85, 0, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FF5500',
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  API Onboarding Studio
                </h3>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'rgba(255, 85, 0, 0.15)',
                    color: '#FF5500',
                    border: '1px solid rgba(255, 85, 0, 0.3)',
                    letterSpacing: '0.5px',
                  }}
                >
                  POWERED BY APIMATIC
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#9FA4B5', margin: '2px 0 0 0' }}>
                Validate OpenAPI/Swagger specifications, extract endpoints, and register services into ToolToll.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#9FA4B5',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 5-Step Visual Stepper Bar */}
        <div
          style={{
            padding: '0.85rem 1.75rem',
            background: '#090A0E',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          {[
            { num: 1, label: 'Upload Spec' },
            { num: 2, label: 'Validate' },
            { num: 3, label: 'Review Report' },
            { num: 4, label: 'Preview & Edit' },
            { num: 5, label: 'Confirm & Save' },
          ].map((step, idx) => {
            const isCompleted = currentStep > step.num;
            const isCurrent = currentStep === step.num;
            return (
              <React.Fragment key={step.num}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      background: isCompleted
                        ? '#10B981'
                        : isCurrent
                        ? '#FF5500'
                        : 'rgba(255, 255, 255, 0.08)',
                      color: isCompleted || isCurrent ? '#FFFFFF' : '#646A7E',
                    }}
                  >
                    {isCompleted ? <Check size={14} /> : step.num}
                  </div>
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: isCurrent ? 700 : 500,
                      color: isCurrent ? '#FFFFFF' : isCompleted ? '#9FA4B5' : '#646A7E',
                    }}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < 4 && (
                  <div
                    style={{
                      flex: 1,
                      height: '2px',
                      background: currentStep > idx + 1 ? '#10B981' : 'rgba(255, 255, 255, 0.08)',
                      maxWidth: '40px',
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1.75rem' }}>
          {/* ================= STEP 1: UPLOAD API SPECIFICATION ================= */}
          {currentStep === 1 && (
            <div>
              {validationError && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#EF4444',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <AlertCircle size={18} />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Source Mode Tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setInputTab('paste')}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    border: inputTab === 'paste' ? '1px solid #FF5500' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: inputTab === 'paste' ? 'rgba(255, 85, 0, 0.12)' : 'transparent',
                    color: inputTab === 'paste' ? '#FF5500' : '#9FA4B5',
                  }}
                >
                  <Code size={15} />
                  Paste JSON / YAML
                </button>
                <button
                  type="button"
                  onClick={() => setInputTab('upload')}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    border: inputTab === 'upload' ? '1px solid #FF5500' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: inputTab === 'upload' ? 'rgba(255, 85, 0, 0.12)' : 'transparent',
                    color: inputTab === 'upload' ? '#FF5500' : '#9FA4B5',
                  }}
                >
                  <UploadCloud size={15} />
                  Upload File (.json, .yaml)
                </button>
                <button
                  type="button"
                  onClick={() => setInputTab('url')}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    border: inputTab === 'url' ? '1px solid #FF5500' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: inputTab === 'url' ? 'rgba(255, 85, 0, 0.12)' : 'transparent',
                    color: inputTab === 'url' ? '#FF5500' : '#9FA4B5',
                  }}
                >
                  <Globe size={15} />
                  Specification URL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSpecContent(SAMPLE_OPENAPI_SPEC);
                    setInputTab('paste');
                  }}
                  style={{
                    marginLeft: 'auto',
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: '#161824',
                    color: '#9FA4B5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <FileText size={14} color="#FF5500" />
                  Load Sample OAS 3.0
                </button>
              </div>

              {/* Input Area: URL */}
              {inputTab === 'url' && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.4rem' }}>
                    Public Specification URL (OpenAPI 3.x or Swagger 2.0)
                  </label>
                  <input
                    type="url"
                    value={specUrl}
                    onChange={(e) => setSpecUrl(e.target.value)}
                    placeholder="https://petstore.swagger.io/v2/swagger.json"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: '#090A0E',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  />
                  <p style={{ fontSize: '0.75rem', color: '#646A7E', marginTop: '0.35rem' }}>
                    ToolToll will validate and fetch the spec with strict SSRF DNS pinning guards.
                  </p>
                </div>
              )}

              {/* Input Area: Upload File */}
              {inputTab === 'upload' && (
                <div
                  style={{
                    border: '2px dashed rgba(255, 85, 0, 0.35)',
                    borderRadius: '12px',
                    padding: '2.5rem 1.5rem',
                    textAlign: 'center',
                    background: 'rgba(255, 85, 0, 0.03)',
                    marginBottom: '1.25rem',
                    cursor: 'pointer',
                  }}
                  onClick={() => document.getElementById(fileInputId)?.click()}
                >
                  <UploadCloud size={40} color="#FF5500" style={{ margin: '0 auto 0.75rem auto' }} />
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 0.3rem 0' }}>
                    Click or Drag to Upload OpenAPI File
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: '#9FA4B5', margin: 0 }}>
                    Supports .json, .yaml, and .yml OpenAPI 3.0/3.1 or Swagger 2.0 documents.
                  </p>
                  {uploadedFileName && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10B981',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}
                    >
                      <Check size={14} />
                      Loaded: {uploadedFileName}
                    </div>
                  )}
                  <input
                    id={fileInputId}
                    type="file"
                    accept=".json,.yaml,.yml,application/json,text/yaml"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </div>
              )}

              {/* Input Area: Paste Text Editor */}
              {inputTab === 'paste' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#FFFFFF' }}>
                      Raw Specification Content (JSON / YAML)
                    </label>
                    <span style={{ fontSize: '0.75rem', color: '#646A7E' }}>
                      {specContent.split('\n').length} lines
                    </span>
                  </div>
                  <textarea
                    value={specContent}
                    onChange={(e) => setSpecContent(e.target.value)}
                    rows={14}
                    placeholder="Paste OpenAPI 3.0 / Swagger 2.0 specification here..."
                    style={{
                      width: '100%',
                      padding: '0.85rem 1rem',
                      background: '#090A0E',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#E2E8F0',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: '0.82rem',
                      lineHeight: '1.45',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* ================= STEP 2: VALIDATING SPINNER ================= */}
          {currentStep === 2 && (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
              <RefreshCw size={42} color="#FF5500" className="animate-spin" style={{ margin: '0 auto 1.25rem auto' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 0.5rem 0' }}>
                Validating with APIMatic Engine...
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#9FA4B5', maxWidth: '460px', margin: '0 auto' }}>
                Analyzing specification syntax, inspecting endpoints, verifying JSON schemas, checking authentication schemes, and linting contract compliance.
              </p>
            </div>
          )}

          {/* ================= STEP 3: REVIEW VALIDATION REPORT ================= */}
          {currentStep === 3 && validationReport && (
            <div>
              {/* Report Header Card */}
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  background: validationReport.isValid
                    ? validationReport.warnings.length > 0
                      ? 'rgba(245, 158, 11, 0.08)'
                      : 'rgba(16, 185, 129, 0.08)'
                    : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${
                    validationReport.isValid
                      ? validationReport.warnings.length > 0
                        ? 'rgba(245, 158, 11, 0.35)'
                        : 'rgba(16, 185, 129, 0.35)'
                      : 'rgba(239, 68, 68, 0.35)'
                  }`,
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  {validationReport.isValid ? (
                    validationReport.warnings.length > 0 ? (
                      <AlertTriangle size={32} color="#F59E0B" />
                    ) : (
                      <CheckCircle size={32} color="#10B981" />
                    )
                  ) : (
                    <AlertCircle size={32} color="#EF4444" />
                  )}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: validationReport.isValid
                            ? validationReport.warnings.length > 0
                              ? '#F59E0B'
                              : '#10B981'
                            : '#EF4444',
                          color: '#000000',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {validationReport.status}
                      </span>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                        {validationReport.specTitle} ({validationReport.specVersion})
                      </h4>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#9FA4B5', margin: '4px 0 0 0' }}>
                      {validationReport.engineDetails}
                      {validationReport.apimaticNotice && ` • ${validationReport.apimaticNotice}`}
                    </p>
                  </div>
                </div>

                {/* Counters */}
                <div style={{ display: 'flex', gap: '0.85rem', textAlign: 'center' }}>
                  <div style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF' }}>
                      {validationReport.summary.endpointsCount}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#646A7E', textTransform: 'uppercase' }}>Endpoints</div>
                  </div>
                  <div style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: validationReport.summary.errorsCount > 0 ? '#EF4444' : '#10B981' }}>
                      {validationReport.summary.errorsCount}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#646A7E', textTransform: 'uppercase' }}>Errors</div>
                  </div>
                  <div style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: validationReport.summary.warningsCount > 0 ? '#F59E0B' : '#9FA4B5' }}>
                      {validationReport.summary.warningsCount}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#646A7E', textTransform: 'uppercase' }}>Warnings</div>
                  </div>
                </div>
              </div>

              {/* Errors Block (if any) */}
              {validationReport.errors.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <h5 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
                    Blocking Validation Errors ({validationReport.errors.length})
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {validationReport.errors.map((err, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          fontSize: '0.82rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 700, color: '#EF4444' }}>{err.code}</span>
                          {err.path && <code style={{ fontSize: '0.75rem', color: '#9FA4B5' }}>{err.path}</code>}
                        </div>
                        <div style={{ color: '#E2E8F0', marginBottom: '0.25rem' }}>{err.message}</div>
                        {err.suggestion && (
                          <div style={{ color: '#F97316', fontSize: '0.78rem', marginTop: '4px' }}>
                            💡 <strong>Suggested fix:</strong> {err.suggestion}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings Block (if any) */}
              {validationReport.warnings.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <h5 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
                    Non-Blocking Quality Warnings ({validationReport.warnings.length})
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {validationReport.warnings.map((warn, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          background: 'rgba(245, 158, 11, 0.08)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          fontSize: '0.82rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 700, color: '#F59E0B' }}>{warn.code}</span>
                          {warn.path && <code style={{ fontSize: '0.75rem', color: '#9FA4B5' }}>{warn.path}</code>}
                        </div>
                        <div style={{ color: '#E2E8F0' }}>{warn.message}</div>
                        {warn.suggestion && (
                          <div style={{ color: '#FBBF24', fontSize: '0.78rem', marginTop: '4px' }}>
                            💡 <strong>Recommendation:</strong> {warn.suggestion}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Successful Checks */}
              <div style={{ marginBottom: '1.25rem' }}>
                <h5 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
                  Passed Structural Verifications ({validationReport.successfulChecks.length})
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.5rem' }}>
                  {validationReport.successfulChecks.map((check, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        background: 'rgba(16, 185, 129, 0.06)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <Check size={16} color="#10B981" />
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF' }}>{check.check}</div>
                        <div style={{ fontSize: '0.75rem', color: '#9FA4B5' }}>{check.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Endpoint Inspection Preview */}
              <div>
                <h5 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
                  Discovered Endpoints ({validationReport.endpointDetails.length})
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {validationReport.endpointDetails.map((ep, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        background: '#12141D',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '5px',
                            background: getMethodBadgeColor(ep.method),
                            color: '#FFFFFF',
                          }}
                        >
                          {ep.method}
                        </span>
                        <div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF' }}>
                            {ep.path}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: '#646A7E', marginLeft: '0.5rem' }}>
                            {ep.name}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {ep.hasInputSchema && (
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255, 85, 0, 0.15)', color: '#FF5500' }}>
                            Input Schema
                          </span>
                        )}
                        {ep.hasOutputSchema && (
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}>
                            Output Schema
                          </span>
                        )}
                        {ep.authRequired && (
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(139, 92, 246, 0.15)', color: '#A78BFA' }}>
                            {ep.authType}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 4: PREVIEW & EDIT TOOLTOLL CONFIGURATION ================= */}
          {currentStep === 4 && draftConfig && (
            <div>
              <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(255, 85, 0, 0.08)', border: '1px solid rgba(255, 85, 0, 0.25)', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.82rem', color: '#FFFFFF', fontWeight: 600 }}>
                  Review and customize the extracted API parameters before saving into ToolToll Creator Studio.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.35rem' }}>
                    API Service Name *
                  </label>
                  <input
                    type="text"
                    value={editApiName}
                    onChange={(e) => setEditApiName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: '#090A0E',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.35rem' }}>
                    Category *
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: '#090A0E',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '0.85rem',
                    }}
                  >
                    <option value="Data & Analytics">Data & Analytics</option>
                    <option value="NLP">NLP & Language</option>
                    <option value="AI / Machine Learning">AI / Machine Learning</option>
                    <option value="Finance">Finance & Payments</option>
                    <option value="Security">Security & Threat Defense</option>
                    <option value="Utility">Utility & Developer Tools</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.35rem' }}>
                  Target Base URL *
                </label>
                <input
                  type="url"
                  value={editBaseUrl}
                  onChange={(e) => setEditBaseUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    background: '#090A0E',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.35rem' }}>
                    Default Price per Call (micro-USD) *
                  </label>
                  <input
                    type="number"
                    value={editPriceMicroUsd}
                    onChange={(e) => setEditPriceMicroUsd(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: '#090A0E',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '0.85rem',
                    }}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#646A7E', marginTop: '2px', display: 'block' }}>
                    5000 µUSD = $0.005 USD per successful execution
                  </span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.35rem' }}>
                    Authentication Method
                  </label>
                  <select
                    value={editAuthMethod}
                    onChange={(e) => setEditAuthMethod(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: '#090A0E',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '0.85rem',
                    }}
                  >
                    <option value="NONE">None (Public API)</option>
                    <option value="API_KEY_HEADER">API Key Header</option>
                    <option value="BEARER_TOKEN">Bearer Token</option>
                    <option value="BASIC_AUTH">HTTP Basic Auth</option>
                  </select>
                </div>
              </div>

              {editAuthMethod === 'API_KEY_HEADER' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.35rem' }}>
                    Auth Header Name
                  </label>
                  <input
                    type="text"
                    value={editAuthHeaderName}
                    onChange={(e) => setEditAuthHeaderName(e.target.value)}
                    placeholder="X-API-Key"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: '#090A0E',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              )}

              {editAuthMethod !== 'NONE' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.35rem' }}>
                    Upstream Secret / API Key (Optional now, can be configured later)
                  </label>
                  <input
                    type="password"
                    value={editUpstreamSecret}
                    onChange={(e) => setEditUpstreamSecret(e.target.value)}
                    placeholder="Enter upstream API secret..."
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: '#090A0E',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '0.85rem',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '4px' }}>
                    <Shield size={12} color="#10B981" />
                    <span style={{ fontSize: '0.72rem', color: '#10B981' }}>
                      Encrypted at rest with AES-256-GCM. Invariant 8: Secrets are never exposed to agents or frontend.
                    </span>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.35rem' }}>
                  Short Description
                </label>
                <input
                  type="text"
                  value={editShortDesc}
                  onChange={(e) => setEditShortDesc(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    background: '#090A0E',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              {/* Endpoints Inclusion Checklist */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>
                  Endpoints to Register ({selectedEndpoints.filter((e) => e.enabled).length} of {selectedEndpoints.length} selected)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedEndpoints.map((ep, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '8px',
                        background: ep.enabled ? '#12141D' : '#090A0E',
                        border: `1px solid ${ep.enabled ? 'rgba(255, 85, 0, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <input
                          type="checkbox"
                          checked={ep.enabled}
                          onChange={(e) => {
                            const updated = [...selectedEndpoints];
                            updated[idx].enabled = e.target.checked;
                            setSelectedEndpoints(updated);
                          }}
                          style={{ cursor: 'pointer', accentColor: '#FF5500' }}
                        />
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: getMethodBadgeColor(ep.method),
                            color: '#FFFFFF',
                          }}
                        >
                          {ep.method}
                        </span>
                        <div>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF' }}>
                            {ep.path}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#9FA4B5', marginLeft: '0.5rem' }}>
                            {ep.name}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {idx === 0 && (
                          <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255, 85, 0, 0.15)', color: '#FF5500', fontWeight: 700 }}>
                            PRIMARY
                          </span>
                        )}
                        <input
                          type="number"
                          value={ep.priceMicroUsd || editPriceMicroUsd}
                          onChange={(e) => {
                            const updated = [...selectedEndpoints];
                            updated[idx].priceMicroUsd = e.target.value;
                            setSelectedEndpoints(updated);
                          }}
                          title="Price in micro-USD"
                          style={{
                            width: '90px',
                            padding: '4px 8px',
                            background: '#090A0E',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '4px',
                            color: '#FFFFFF',
                            fontSize: '0.75rem',
                            textAlign: 'right',
                          }}
                        />
                        <span style={{ fontSize: '0.7rem', color: '#646A7E' }}>µUSD</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 5: CONFIRM AND REGISTER ================= */}
          {currentStep === 5 && (
            <div>
              {submitSuccess ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '2px solid #10B981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#10B981',
                      margin: '0 auto 1.25rem auto',
                    }}
                  >
                    <CheckCircle size={36} />
                  </div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 0.5rem 0' }}>
                    API Service Registered Successfully!
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: '#9FA4B5', maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
                    "{submitSuccess.name}" has been created in your Creator Studio under <strong>DRAFT</strong> status. You can now run verification test calls before submitting it for marketplace approval.
                  </p>
                  <button
                    onClick={onClose}
                    className="btn btn-primary"
                    style={{
                      padding: '0.75rem 1.75rem',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                    }}
                  >
                    Return to Creator Studio
                  </button>
                </div>
              ) : (
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1rem' }}>
                    Final Registration Confirmation
                  </h4>

                  <div
                    style={{
                      padding: '1.25rem',
                      borderRadius: '12px',
                      background: '#12141D',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      marginBottom: '1.25rem',
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#646A7E', textTransform: 'uppercase' }}>API Service</span>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#FFFFFF' }}>{editApiName}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#646A7E', textTransform: 'uppercase' }}>Category</span>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#FF5500' }}>{editCategory}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#646A7E', textTransform: 'uppercase' }}>Base Host</span>
                        <div style={{ fontSize: '0.82rem', color: '#9FA4B5' }}>{editBaseUrl}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#646A7E', textTransform: 'uppercase' }}>Registered Endpoints</span>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#10B981' }}>
                          {selectedEndpoints.filter((e) => e.enabled).length} Active Endpoint(s)
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '1rem',
                      borderRadius: '8px',
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      marginBottom: '1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }}
                  >
                    <Shield size={22} color="#10B981" />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF' }}>
                        Compliance with Publication Rules (Invariant 10)
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#9FA4B5' }}>
                        Your API will be registered in <strong>DRAFT</strong> status. Marketplace consumers cannot view or execute it until you run a successful test call and receive administrator review.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div
          style={{
            padding: '1rem 1.75rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#090A0E',
            borderBottomLeftRadius: '16px',
            borderBottomRightRadius: '16px',
          }}
        >
          {/* Back button */}
          {currentStep > 1 && !submitSuccess ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => (prev === 3 ? 1 : ((prev - 1) as OnboardingStep)))}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#9FA4B5',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <ArrowLeft size={16} />
              {currentStep === 3 ? 'Back to Spec' : 'Back'}
            </button>
          ) : (
            <div />
          )}

          {/* Forward / Action button */}
          {!submitSuccess && (
            <div>
              {currentStep === 1 && (
                <button
                  type="button"
                  onClick={handleValidateSpec}
                  disabled={validating || (!specContent.trim() && !specUrl.trim())}
                  className="btn btn-primary"
                  style={{
                    padding: '0.65rem 1.4rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: validating || (!specContent.trim() && !specUrl.trim()) ? 'not-allowed' : 'pointer',
                    opacity: validating || (!specContent.trim() && !specUrl.trim()) ? 0.6 : 1,
                  }}
                >
                  <Sparkles size={16} />
                  Validate with APIMatic
                </button>
              )}

              {currentStep === 3 && validationReport && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  disabled={!validationReport.isValid}
                  className="btn btn-primary"
                  style={{
                    padding: '0.65rem 1.4rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: !validationReport.isValid ? 'not-allowed' : 'pointer',
                    opacity: !validationReport.isValid ? 0.5 : 1,
                  }}
                >
                  Configure ToolToll API
                  <ArrowRight size={16} />
                </button>
              )}

              {currentStep === 4 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  disabled={!editApiName.trim() || !editBaseUrl.trim()}
                  className="btn btn-primary"
                  style={{
                    padding: '0.65rem 1.4rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  Review & Confirm
                  <ArrowRight size={16} />
                </button>
              )}

              {currentStep === 5 && (
                <button
                  type="button"
                  onClick={handleConfirmRegistration}
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{
                    padding: '0.7rem 1.6rem',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Registering API...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      Confirm & Register API
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
