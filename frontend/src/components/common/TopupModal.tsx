import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { formatMicroUsd } from '../../utils/formatters';
import { PayPalCaptureResponse, PayPalConfig } from '../../types';
import {
  X,
  CreditCard,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Zap,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';

interface TopupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CheckoutState = 'idle' | 'loading_sdk' | 'processing' | 'success' | 'cancelled' | 'error';
type ProcessingStage = 'authorizing' | 'capturing' | 'crediting';

interface PreCreatedOrder {
  orderId: string;
  approvalUrl: string;
  amount: number;
}

export const TopupModal: React.FC<TopupModalProps> = ({ isOpen, onClose }) => {
  const { wallet, refreshWallet, isAuthenticated, loginDemo } = useAuth();

  const [selectedAmount, setSelectedAmount] = useState<number>(10); // USD
  const [customAmount, setCustomAmount] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'paypal' | 'mock'>('paypal');

  const [checkoutState, setCheckoutState] = useState<CheckoutState>('idle');
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('capturing');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paypalConfig, setPaypalConfig] = useState<PayPalConfig | null>(null);
  const [captureResult, setCaptureResult] = useState<PayPalCaptureResponse | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const buttonsInstanceRef = useRef<any>(null);
  const preCreatedOrderRef = useRef<PreCreatedOrder | null>(null);
  const preCreatePromiseRef = useRef<Promise<PreCreatedOrder | null> | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const currentAmount = customAmount ? parseFloat(customAmount) : selectedAmount;
  const currentMicroUsd = Math.round((currentAmount || 0) * 1_000_000);
  const currentAmountRef = useRef(currentAmount);

  useEffect(() => {
    currentAmountRef.current = currentAmount;
  }, [currentAmount]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCheckoutState('idle');
      setProcessingStage('capturing');
      setErrorMessage(null);
      setCaptureResult(null);
      setActiveOrderId(null);

      // Fetch PayPal client configuration from backend
      api.getPayPalConfig().then((cfg) => {
        setPaypalConfig(cfg);
      }).catch((err) => {
        console.warn('Failed to load PayPal config:', err);
      });
    }
  }, [isOpen]);

  // Proactively pre-create PayPal Sandbox order in background so clicking the yellow PayPal button opens the approval window INSTANTLY (0ms)
  useEffect(() => {
    if (!isOpen || activeTab !== 'paypal' || !currentAmount || currentAmount < 1 || isNaN(currentAmount)) {
      return;
    }

    let isCurrent = true;

    const preCreate = async (): Promise<PreCreatedOrder | null> => {
      try {
        if (!isAuthenticated) {
          await loginDemo('consumer');
        }

        const amt = currentAmountRef.current;
        const res = await api.createPaypalOrder(amt);
        if (!isCurrent) return null;

        const data: PreCreatedOrder = {
          orderId: res.orderId,
          approvalUrl: res.approvalUrl || `https://www.sandbox.paypal.com/checkoutnow?token=${res.orderId}`,
          amount: amt,
        };
        preCreatedOrderRef.current = data;
        setActiveOrderId(res.orderId);
        return data;
      } catch (err: any) {
        console.warn('Background PayPal order pre-creation notice:', err?.message || err);
        return null;
      }
    };

    const timer = setTimeout(() => {
      preCreatePromiseRef.current = preCreate();
    }, 120);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [isOpen, activeTab, currentAmount, isAuthenticated]);

  // Cross-window message listener when payment is approved in popup window
  useEffect(() => {
    const handleWindowMessage = async (e: MessageEvent) => {
      if (e.data?.type === 'PAYPAL_ORDER_APPROVED' && e.data?.orderId) {
        const orderId = e.data.orderId;
        setActiveOrderId(orderId);
        setCheckoutState('processing');
        setProcessingStage('capturing');

        try {
          setProcessingStage('crediting');
          const cap = await api.capturePaypalOrder(orderId);
          // Refresh in background without delaying user success notification
          refreshWallet().catch(() => {});
          if (isMountedRef.current) {
            setCaptureResult(cap);
            setCheckoutState('success');
          }
        } catch (err: any) {
          if (isMountedRef.current) {
            setCheckoutState('error');
            setErrorMessage(err?.message || 'Payment capture failed');
          }
        }
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, []);

  // Load PayPal JavaScript SDK & Render Buttons
  useEffect(() => {
    if (!isOpen || activeTab !== 'paypal' || checkoutState === 'success') {
      return;
    }

    let isMounted = true;

    const loadAndRenderPayPal = async () => {
      try {
        const cfg = paypalConfig || await api.getPayPalConfig();
        if (!isMounted) return;

        const clientId = cfg.clientId;
        const scriptId = 'paypal-sdk-script';

        // Check if script already exists with correct client-id
        let script = document.getElementById(scriptId) as HTMLScriptElement | null;

        if (!script || !window.hasOwnProperty('paypal')) {
          setCheckoutState('loading_sdk');
          if (script) {
            script.remove();
          }

          script = document.createElement('script');
          script.id = scriptId;
          script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture&components=buttons`;
          script.async = true;

          await new Promise<void>((resolve, reject) => {
            script!.onload = () => resolve();
            script!.onerror = () => reject(new Error('Failed to load PayPal Sandbox JS SDK'));
            document.body.appendChild(script!);
          });
        }

        if (!isMounted) return;

        const paypal = (window as any).paypal;
        if (!paypal || !paypal.Buttons) {
          throw new Error('PayPal SDK loaded but Buttons component unavailable');
        }

        // Clean up previous button instance if any
        if (paypalContainerRef.current) {
          paypalContainerRef.current.innerHTML = '';
        }

        // Render PayPal Smart Payment Buttons
        const buttons = paypal.Buttons({
          style: {
            layout: 'vertical',
            color: 'gold',
            shape: 'rect',
            label: 'paypal',
            height: 44,
          },

          createOrder: async () => {
            setErrorMessage(null);
            // CRITICAL: Do NOT setCheckoutState('processing') here to avoid unmounting the button container
            try {
              if (!isAuthenticated) {
                await loginDemo('consumer');
              }

              const targetAmount = currentAmountRef.current || 10;

              // 1. If pre-created order exists with matching amount, return immediately (0ms delay!)
              if (
                preCreatedOrderRef.current &&
                Math.abs(preCreatedOrderRef.current.amount - targetAmount) < 0.001
              ) {
                setActiveOrderId(preCreatedOrderRef.current.orderId);
                return preCreatedOrderRef.current.orderId;
              }

              // 2. If background pre-creation is currently running, await it
              if (preCreatePromiseRef.current) {
                const awaited = await preCreatePromiseRef.current;
                if (awaited && Math.abs(awaited.amount - targetAmount) < 0.001) {
                  setActiveOrderId(awaited.orderId);
                  return awaited.orderId;
                }
              }

              // 3. Fallback: Create fresh order
              const res = await api.createPaypalOrder(targetAmount);
              setActiveOrderId(res.orderId);
              preCreatedOrderRef.current = {
                orderId: res.orderId,
                approvalUrl: res.approvalUrl || `https://www.sandbox.paypal.com/checkoutnow?token=${res.orderId}`,
                amount: targetAmount,
              };
              return res.orderId;
            } catch (err: any) {
              setErrorMessage(err?.message || 'Failed to create PayPal Sandbox order');
              throw err;
            }
          },

          onApprove: async (data: any) => {
            const orderIdToCapture = data?.orderID || data?.orderId || activeOrderId || preCreatedOrderRef.current?.orderId;
            if (!orderIdToCapture) return;

            setCheckoutState('processing');
            setProcessingStage('capturing');
            setStatusMessage('Capturing approved funds via PayPal Sandbox REST API...');

            try {
              setProcessingStage('crediting');
              const res = await api.capturePaypalOrder(orderIdToCapture);

              // Concurrently refresh wallet in background so success screen displays instantly with zero network delay
              refreshWallet().catch(() => {});

              if (isMounted) {
                setCaptureResult(res);
                setCheckoutState('success');
              }
            } catch (err: any) {
              console.error('PayPal capture error in onApprove:', err);
              if (isMounted) {
                setCheckoutState('error');
                setErrorMessage(err?.message || 'Payment capture failed. Funds were not charged.');
              }
            }
          },

          onCancel: async (data: any) => {
            const orderIdToCancel = data?.orderID || data?.orderId || activeOrderId;
            if (orderIdToCancel) {
              await api.cancelPaypalOrder(orderIdToCancel).catch(() => {});
            }
            if (isMounted) {
              setCheckoutState('cancelled');
            }
          },

          onError: (err: any) => {
            console.error('PayPal Buttons Error:', err);
            if (isMounted) {
              setCheckoutState('error');
              setErrorMessage(err?.message || 'An error occurred during PayPal checkout');
            }
          },
        });

        if (paypalContainerRef.current && isMounted) {
          buttons.render(paypalContainerRef.current);
          buttonsInstanceRef.current = buttons;
          setCheckoutState('idle');
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('PayPal Initialization Error:', err);
          setCheckoutState('error');
          setErrorMessage(err?.message || 'Failed to initialize PayPal Checkout');
        }
      }
    };

    const timer = setTimeout(loadAndRenderPayPal, 50);
    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (buttonsInstanceRef.current && typeof buttonsInstanceRef.current.close === 'function') {
        buttonsInstanceRef.current.close().catch(() => {});
      }
    };
  }, [isOpen, activeTab, paypalConfig, isAuthenticated]);

  if (!isOpen) return null;

  // Direct 1-Click Launch to PayPal Sandbox Approval Window (0ms latency)
  const handleOpenApprovalWindow = async () => {
    if (!currentAmount || currentAmount < 1) return;
    setErrorMessage(null);

    try {
      if (!isAuthenticated) {
        await loginDemo('consumer');
      }

      let order = preCreatedOrderRef.current;
      if (!order || Math.abs(order.amount - currentAmount) > 0.001) {
        if (preCreatePromiseRef.current) {
          order = await preCreatePromiseRef.current;
        }
        if (!order || Math.abs(order.amount - currentAmount) > 0.001) {
          const res = await api.createPaypalOrder(currentAmount);
          order = {
            orderId: res.orderId,
            approvalUrl: res.approvalUrl || `https://www.sandbox.paypal.com/checkoutnow?token=${res.orderId}`,
            amount: currentAmount,
          };
        }
      }

      if (!order) return;
      const orderId = order.orderId;
      setActiveOrderId(orderId);

      // Directly open in PayPal Sandbox approval window
      const popup = window.open(
        order.approvalUrl,
        'PayPalSandboxApproval',
        'width=520,height=750,menubar=no,toolbar=no,status=no,resizable=yes'
      );

      // Fast poll every 1.5 seconds for approval
      const pollTimer = setInterval(async () => {
        try {
          const details = await api.getPaypalOrder(orderId);
          if (details.status === 'APPROVED' || details.paypalStatus === 'APPROVED') {
            clearInterval(pollTimer);
            setCheckoutState('processing');
            setProcessingStage('crediting');
            const cap = await api.capturePaypalOrder(orderId);
            refreshWallet().catch(() => {});
            if (isMountedRef.current) {
              setCaptureResult(cap);
              setCheckoutState('success');
              if (popup && !popup.closed) popup.close();
            }
          } else if (details.status === 'COMPLETED') {
            clearInterval(pollTimer);
            refreshWallet().catch(() => {});
            if (isMountedRef.current) {
              setCheckoutState('success');
              if (popup && !popup.closed) popup.close();
            }
          }
        } catch {
          // ignore polling check errors
        }
      }, 1500);

      setTimeout(() => clearInterval(pollTimer), 180000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to open PayPal Sandbox approval window');
    }
  };

  const handleDevMockTopup = async () => {
    if (!currentAmount || currentAmount <= 0) return;
    setCheckoutState('processing');
    setStatusMessage('Executing instant mock top-up...');
    setErrorMessage(null);

    try {
      if (!isAuthenticated) {
        await loginDemo('consumer');
      }
      await api.mockTopup(currentMicroUsd.toString());
      await refreshWallet();
      setCaptureResult({
        id: `mock_${Date.now()}`,
        orderId: `MOCK_ORDER_${Date.now()}`,
        captureId: `MOCK_CAP_${Date.now()}`,
        status: 'COMPLETED',
        amount: currentAmount.toFixed(2),
        amountMicroUsd: currentMicroUsd.toString(),
        currency: 'USD',
        message: 'Mock payment captured and credited successfully',
      });
      setCheckoutState('success');
    } catch (err: any) {
      setCheckoutState('error');
      setErrorMessage(err?.message || 'Mock top-up failed');
    }
  };

  const handleUserCancel = async () => {
    if (activeOrderId) {
      await api.cancelPaypalOrder(activeOrderId).catch(() => {});
    }
    setCheckoutState('cancelled');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '520px',
          width: '95%',
          background: '#0D1117',
          border: '1px solid var(--border-dark)',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-dark)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-xs)',
                background: 'var(--brand-orange)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-orange)',
                flexShrink: 0,
              }}
            >
              <CreditCard size={18} color="#FFFFFF" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', margin: 0, lineHeight: 1.2 }}>
                  PayPal Sandbox Checkout
                </h3>
                <span className="badge badge-orange" style={{ fontSize: '0.62rem', padding: '2px 6px', fontWeight: 800 }}>
                  SANDBOX
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '0.74rem', color: 'var(--text-dark-muted)' }}>
                Deposit Micro-USD platform credits for autonomous agent tool execution
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close checkout modal"
            style={{ background: 'none', border: 'none', color: 'var(--text-dark-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px 24px' }}>
          {/* ========================================================= */}
          {/* VIEW: SUCCESS NOTIFICATION                                */}
          {/* ========================================================= */}
          {checkoutState === 'success' && (
            <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.14)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 18px',
                  boxShadow: '0 0 20px rgba(16, 185, 129, 0.25)',
                }}
              >
                <CheckCircle size={34} color="#10B981" />
              </div>

              <h4 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '6px' }}>
                Payment Completed Successfully!
              </h4>
              <p style={{ color: 'var(--text-dark-secondary)', fontSize: '0.86rem', marginBottom: '22px' }}>
                Your PayPal Sandbox payment has been captured and verified. Funds have been atomically credited to your micro-USD ledger.
              </p>

              {/* Receipt / Transaction Details Card */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-dark)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '16px 20px',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  marginBottom: '24px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-dark-muted)' }}>Product:</span>
                  <span style={{ color: '#FFFFFF', fontWeight: 600 }}>ToolToll Machine Credits</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-dark-muted)' }}>Amount Paid:</span>
                  <span style={{ color: '#10B981', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                    ${Number(captureResult?.amount || currentAmount).toFixed(2)} USD
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-dark-muted)' }}>Micro-USD Credited to Ledger:</span>
                  <span style={{ color: 'var(--brand-orange)', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                    +{Number(captureResult?.amountMicroUsd || currentMicroUsd).toLocaleString()} µUSD
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-dark-muted)' }}>PayPal Order ID:</span>
                  <span style={{ color: '#FFFFFF', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.80rem' }}>
                    {captureResult?.orderId || activeOrderId || 'N/A'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-dark-muted)' }}>Transaction / Capture ID:</span>
                  <span style={{ color: '#38BDF8', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.80rem' }}>
                    {captureResult?.captureId || 'Verified & Captured'}
                  </span>
                </div>
                <div
                  style={{
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    paddingTop: '10px',
                    marginTop: '2px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.86rem',
                  }}
                >
                  <span style={{ color: '#FFFFFF', fontWeight: 700 }}>Updated Wallet Balance:</span>
                  <span style={{ color: '#34D399', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
                    {formatMicroUsd(wallet?.balance)}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '11px' }}
                  onClick={() => {
                    setCheckoutState('idle');
                    setCaptureResult(null);
                  }}
                >
                  <RotateCcw size={15} />
                  Deposit Again
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '11px' }}
                  onClick={async () => {
                    await refreshWallet();
                    onClose();
                  }}
                >
                  Done
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW: CANCELLED PAYMENT NOTIFICATION                      */}
          {/* ========================================================= */}
          {checkoutState === 'cancelled' && (
            <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <AlertCircle size={32} color="#F59E0B" />
              </div>

              <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '6px' }}>
                Payment Cancelled
              </h4>
              <p style={{ color: 'var(--text-dark-secondary)', fontSize: '0.86rem', marginBottom: '22px' }}>
                The PayPal Sandbox transaction was cancelled. No charges were made to your account.
              </p>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '11px' }}
                  onClick={onClose}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '11px' }}
                  onClick={() => {
                    setCheckoutState('idle');
                    setErrorMessage(null);
                  }}
                >
                  <RotateCcw size={15} />
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW: FAST REAL-TIME PROCESSING INDICATOR                 */}
          {/* ========================================================= */}
          {checkoutState === 'processing' && (
            <div style={{ textAlign: 'center', padding: '24px 0 12px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  border: '3px solid rgba(255, 85, 0, 0.2)',
                  borderTopColor: 'var(--brand-orange)',
                  animation: 'spin 0.7s linear infinite',
                  margin: '0 auto 18px',
                }}
              />
              <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '6px' }}>
                Processing Sandbox Payment
              </h4>
              <p style={{ color: 'var(--text-dark-muted)', fontSize: '0.82rem', marginBottom: '20px' }}>
                {statusMessage || 'Capturing transaction with PayPal REST API & crediting ledger...'}
              </p>

              {/* Snappy 3-Step Live Progress Checklist */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-dark)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '16px 18px',
                  maxWidth: '390px',
                  margin: '0 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem' }}>
                  <CheckCircle size={16} color="#10B981" />
                  <span style={{ color: '#FFFFFF', fontWeight: 600 }}>1. Sandbox Buyer Authorization Received</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem' }}>
                  {processingStage === 'capturing' ? (
                    <RefreshCw size={15} color="var(--brand-orange)" className="animate-spin" />
                  ) : (
                    <CheckCircle size={16} color="#10B981" />
                  )}
                  <span
                    style={{
                      color: processingStage === 'capturing' ? 'var(--brand-orange)' : '#FFFFFF',
                      fontWeight: 600,
                    }}
                  >
                    2. Capturing Payment via PayPal REST API...
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem' }}>
                  {processingStage === 'crediting' ? (
                    <RefreshCw size={15} color="var(--brand-orange)" className="animate-spin" />
                  ) : (
                    <ShieldCheck size={16} color="var(--text-dark-muted)" />
                  )}
                  <span
                    style={{
                      color: processingStage === 'crediting' ? 'var(--brand-orange)' : 'var(--text-dark-muted)',
                      fontWeight: 600,
                    }}
                  >
                    3. Crediting Double-Entry Ledger...
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW: MAIN CHECKOUT INTERFACE                             */}
          {/* ========================================================= */}
          {(checkoutState === 'idle' || checkoutState === 'loading_sdk' || checkoutState === 'error') && (
            <>
              {/* Payment Method Switcher Tabs */}
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '4px',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border-dark)',
                  marginBottom: '18px',
                }}
              >
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    flex: 1,
                    background: activeTab === 'paypal' ? 'var(--brand-orange)' : 'transparent',
                    color: activeTab === 'paypal' ? '#FFFFFF' : 'var(--text-dark-secondary)',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-xs)',
                    border: 'none',
                    padding: '8px',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                  onClick={() => setActiveTab('paypal')}
                >
                  <CreditCard size={14} />
                  PayPal Sandbox Checkout
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    flex: 1,
                    background: activeTab === 'mock' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                    color: activeTab === 'mock' ? '#FFFFFF' : 'var(--text-dark-secondary)',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-xs)',
                    border: 'none',
                    padding: '8px',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                  onClick={() => setActiveTab('mock')}
                >
                  <Zap size={14} />
                  Instant Dev Topup
                </button>
              </div>

              {/* Order Summary Box */}
              <div
                style={{
                  padding: '16px 18px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-dark)',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-dark-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.06em' }}>
                    Order Summary
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 700 }}>
                    Active Balance: {formatMicroUsd(wallet?.balance)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.90rem', color: '#FFFFFF', fontWeight: 700 }}>
                    ToolToll API Machine Credits
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                    ${currentAmount.toFixed(2)} <span style={{ fontSize: '0.80rem', color: 'var(--text-dark-muted)' }}>USD</span>
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-dark-secondary)' }}>
                  <span>Credits credited to ledger:</span>
                  <strong style={{ color: 'var(--brand-orange)', fontFamily: 'var(--font-mono)' }}>
                    +{currentMicroUsd.toLocaleString()} µUSD
                  </strong>
                </div>
              </div>

              {/* Amount Selection */}
              <div style={{ marginBottom: '18px' }}>
                <label className="form-label" style={{ marginBottom: '8px', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Select Package Amount
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
                  {[5, 10, 25, 50].map((amt) => {
                    const isSelected = selectedAmount === amt && !customAmount;
                    return (
                      <button
                        key={amt}
                        type="button"
                        className="btn"
                        style={{
                          background: isSelected ? 'var(--brand-orange)' : 'rgba(255, 255, 255, 0.03)',
                          borderColor: isSelected ? 'var(--brand-orange)' : 'var(--border-dark)',
                          color: isSelected ? '#FFFFFF' : 'var(--text-dark-primary)',
                          fontWeight: 800,
                          borderRadius: 'var(--radius-xs)',
                          padding: '10px 4px',
                          fontSize: '0.95rem',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                        onClick={() => {
                          setSelectedAmount(amt);
                          setCustomAmount('');
                        }}
                      >
                        <span>${amt}</span>
                        <span style={{ fontSize: '0.62rem', fontWeight: 600, opacity: 0.8 }}>
                          {amt}M µUSD
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.72rem', color: 'var(--text-dark-muted)' }}>
                    Or Custom Amount ($1.00 – $10,000.00 USD)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    step="1"
                    className="form-input"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="e.g. 100"
                    style={{ fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              {/* Error Notification */}
              {errorMessage && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-xs)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#F87171',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    marginBottom: '16px',
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>Payment Error</div>
                    <div style={{ marginTop: '2px', wordBreak: 'break-word' }}>{errorMessage}</div>
                  </div>
                </div>
              )}

              {/* PayPal Payment Tab Content */}
              {activeTab === 'paypal' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Dedicated 1-Click Yellow PayPal Sandbox Button */}
                  <button
                    type="button"
                    onClick={handleOpenApprovalWindow}
                    title="Click to directly open PayPal Sandbox Approval Window"
                    style={{
                      width: '100%',
                      height: '44px',
                      background: '#FFC439',
                      color: '#001C6B',
                      border: 'none',
                      borderRadius: '4px',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                      transition: 'transform 0.08s ease, filter 0.08s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.filter = 'brightness(1)')}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M20.067 8.478c-.492 4.15-3.29 5.56-6.623 5.56h-2.11l-1.04 6.6H5.4l2.91-18.42h6.58c3.21 0 5.667 1.26 5.177 6.26z"
                        fill="#003087"
                      />
                      <path
                        d="M17.157 9.878c-.37 3.12-2.47 4.18-4.97 4.18h-1.58l-.78 4.96H6.1l2.18-13.84h4.94c2.41 0 4.25.95 3.937 4.7z"
                        fill="#0079C1"
                      />
                    </svg>
                    <span>Direct Open in PayPal Sandbox Window ↗</span>
                  </button>

                  {/* Official PayPal SDK Smart Payment Buttons Container */}
                  <div
                    style={{
                      minHeight: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    {checkoutState === 'loading_sdk' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dark-muted)', fontSize: '0.82rem', padding: '10px 0' }}>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Initializing PayPal Sandbox...</span>
                      </div>
                    )}
                    <div
                      id="paypal-button-container"
                      ref={paypalContainerRef}
                      style={{ width: '100%', minHeight: '44px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.70rem', color: 'var(--text-dark-muted)', marginTop: '2px' }}>
                    <ShieldCheck size={13} color="#10B981" />
                    <span>Instant Pre-Warmed PayPal Sandbox Orders v2 API</span>
                  </div>

                  {/* Cancel Button */}
                  <div style={{ borderTop: '1px solid var(--border-dark)', paddingTop: '10px', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm w-full"
                      style={{ padding: '8px', fontSize: '0.78rem', color: 'var(--text-dark-muted)' }}
                      onClick={handleUserCancel}
                    >
                      Cancel Payment & Return
                    </button>
                  </div>
                </div>
              )}

              {/* Instant Dev Topup Tab Content */}
              {activeTab === 'mock' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-dark-secondary)', margin: '0 0 4px' }}>
                    For automated local testing without PayPal login credentials, use the 1-click mock deposit adapter:
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!currentAmount || currentAmount <= 0}
                    onClick={handleDevMockTopup}
                    style={{ width: '100%', padding: '12px', fontWeight: 800 }}
                  >
                    <Zap size={16} />
                    1-Click Instant Deposit (${currentAmount.toFixed(2)})
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={onClose}
                    style={{ padding: '8px', fontSize: '0.78rem' }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};