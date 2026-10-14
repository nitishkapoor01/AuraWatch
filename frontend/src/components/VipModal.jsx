import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Crown, 
  X, 
  Check, 
  Copy, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  Clock, 
  QrCode, 
  Gift, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import styles from './VipModal.module.css';

const DEFAULT_PLANS = [
  { id: '1_month', name: '1 Month', duration_days: 30, price_inr: 29, badge: 'Popular' },
  { id: '3_months', name: '3 Months', duration_days: 90, price_inr: 69, badge: 'Best Value' },
  { id: '1_year', name: '1 Year', duration_days: 365, price_inr: 199, badge: 'VIP Master' }
];

const VipModal = ({ isOpen, onClose, onRequireLogin }) => {
  const { user, isLoggedIn, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState('upi'); // 'upi' | 'redeem'
  const [selectedPlan, setSelectedPlan] = useState(DEFAULT_PLANS[0]);
  const [redeemCode, setRedeemCode] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState({
    upi_id: 'aurawatch@upi',
    upi_name: 'AuraWatch VIP',
    qr_image_url: '',
    plans: DEFAULT_PLANS
  });
  const [vipStatus, setVipStatus] = useState(null);
  const [isExtending, setIsExtending] = useState(false);

  const API_BASE = `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:10000'}/api` : 'https://aurawatch-1.onrender.com/api')}`;

  // Fetch Payment Info (UPI ID, plans) & VIP status
  useEffect(() => {
    if (!isOpen) return;

    setStatusMessage({ text: '', type: '' });
    setIsExtending(false);

    // 1. Fetch public payment info
    fetch(`${API_BASE}/settings/vip_payment_info`)
      .then(res => res.json())
      .then(data => {
        if (data.value && typeof data.value === 'object') {
          setPaymentInfo(prev => ({
            ...prev,
            ...data.value,
            plans: data.value.plans?.length ? data.value.plans : DEFAULT_PLANS
          }));
          if (data.value.plans?.length) {
            setSelectedPlan(data.value.plans[0]);
          }
        }
      })
      .catch(() => {});

    // 2. Fetch authenticated VIP status if logged in
    const token = localStorage.getItem('aurawatch_token');
    if (token) {
      fetch(`${API_BASE}/vip/status`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          setVipStatus(data);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyUpi = () => {
    const upi = paymentInfo.upi_id || 'aurawatch@upi';
    navigator.clipboard.writeText(upi);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleRedeemCode = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
      onClose();
      if (onRequireLogin) onRequireLogin();
      return;
    }

    if (!redeemCode.trim()) {
      setStatusMessage({ text: 'Please enter a VIP gift code.', type: 'error' });
      return;
    }

    setLoading(true);
    setStatusMessage({ text: '', type: '' });

    try {
      const token = localStorage.getItem('aurawatch_token');
      const res = await fetch(`${API_BASE}/vip/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: redeemCode.trim() })
      });
      const data = await res.json();

      if (res.ok) {
        setStatusMessage({ text: data.message, type: 'success' });
        setRedeemCode('');
        await refreshUser();
        // Update local vipStatus
        setVipStatus(prev => ({
          ...prev,
          is_premium: true,
          premium_expires_at: data.premium_expires_at,
          premium_plan: data.premium_plan
        }));
      } else {
        setStatusMessage({ text: data.message || 'Failed to redeem code.', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: 'Network error. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
      onClose();
      if (onRequireLogin) onRequireLogin();
      return;
    }

    if (!utrNumber.trim() || utrNumber.trim().length < 6) {
      setStatusMessage({ text: 'Please enter a valid 12-digit UPI Reference / UTR Number.', type: 'error' });
      return;
    }

    setLoading(true);
    setStatusMessage({ text: '', type: '' });

    try {
      const token = localStorage.getItem('aurawatch_token');
      const res = await fetch(`${API_BASE}/vip/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          utr_number: utrNumber.trim(),
          amount: selectedPlan.price_inr,
          plan_duration_days: selectedPlan.duration_days,
          screenshot_url: screenshotUrl.trim() || null
        })
      });
      const data = await res.json();

      if (res.ok) {
        setStatusMessage({ text: data.message, type: 'success' });
        setUtrNumber('');
        setScreenshotUrl('');
        setVipStatus(prev => ({
          ...prev,
          latest_request: data.request
        }));
      } else {
        setStatusMessage({ text: data.message || 'Failed to submit request.', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: 'Network error. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const isUserVip = Boolean(user?.is_premium || vipStatus?.is_premium);
  const upiId = paymentInfo.upi_id || 'aurawatch@upi';
  const upiPayLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(paymentInfo.upi_name || 'AuraWatch')}&am=${selectedPlan.price_inr}&cu=INR&tn=${encodeURIComponent(`VIP ${selectedPlan.name}`)}`;
  const qrCodeUrl = paymentInfo.qr_image_url || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiPayLink)}`;

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
        {/* Glowing Header */}
        <div className={styles.modalHeader}>
          <div className={styles.crownBadge}>
            <Crown size={22} className={styles.crownIcon} />
            <span>AURA VIP PASS</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {/* Active VIP Member Banner */}
          {isUserVip && !isExtending ? (
            <div className={styles.activeVipHero}>
              <div className={styles.activeCrownGlow}>
                <Crown size={48} />
              </div>
              <h2 className={styles.activeVipTitle}>You are an Active VIP Member!</h2>
              <p className={styles.activeVipSubtitle}>
                Enjoy 100% ad-free cinema, instant 0s downloads, and premium streaming.
              </p>

              <div className={styles.vipDetailsCard}>
                <div className={styles.vipDetailItem}>
                  <span className={styles.detailLabel}>Current Plan</span>
                  <span className={styles.detailValue}>{vipStatus?.premium_plan || user?.premium_plan || 'VIP Ad-Free'}</span>
                </div>
                <div className={styles.vipDetailDivider} />
                <div className={styles.vipDetailItem}>
                  <span className={styles.detailLabel}>Days Remaining</span>
                  <span className={styles.detailValueHighlight}>
                    {vipStatus?.days_remaining ?? 'Active'} Days
                  </span>
                </div>
                <div className={styles.vipDetailDivider} />
                <div className={styles.vipDetailItem}>
                  <span className={styles.detailLabel}>Expires On</span>
                  <span className={styles.detailValue}>
                    {vipStatus?.premium_expires_at || user?.premium_expires_at
                      ? new Date(vipStatus?.premium_expires_at || user?.premium_expires_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })
                      : 'Lifetime'}
                  </span>
                </div>
              </div>

              <div className={styles.activeVipActions}>
                <button 
                  className={styles.extendBtn}
                  onClick={() => setIsExtending(true)}
                >
                  <Sparkles size={16} />
                  <span>Extend Subscription</span>
                </button>
                <button className={styles.doneBtn} onClick={onClose}>
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Value Proposition Highlights */}
              <div className={styles.heroSection}>
                <h2 className={styles.heroTitle}>
                  Stream Without Limits. <span className={styles.gradientText}>Zero Ads.</span>
                </h2>
                <p className={styles.heroSubtitle}>
                  Unlock uninterrupted entertainment with instant links and pure ad-free experience.
                </p>

                <div className={styles.perksGrid}>
                  <div className={styles.perkCard}>
                    <div className={styles.perkIconWrapper}>
                      <ShieldCheck size={20} className={styles.perkIcon} />
                    </div>
                    <div>
                      <h4 className={styles.perkName}>100% Zero Ads</h4>
                      <p className={styles.perkDesc}>No video pre-rolls, no banners, and zero popup redirects.</p>
                    </div>
                  </div>

                  <div className={styles.perkCard}>
                    <div className={styles.perkIconWrapper}>
                      <Zap size={20} className={styles.perkIcon} />
                    </div>
                    <div>
                      <h4 className={styles.perkName}>Instant 0-Second Downloads</h4>
                      <p className={styles.perkDesc}>Skip countdown timers entirely. Direct high-speed links.</p>
                    </div>
                  </div>

                  <div className={styles.perkCard}>
                    <div className={styles.perkIconWrapper}>
                      <Crown size={20} className={styles.perkIcon} />
                    </div>
                    <div>
                      <h4 className={styles.perkName}>VIP Crown Badge</h4>
                      <p className={styles.perkDesc}>Exclusive golden crown badge on your profile and header.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Alert */}
              {statusMessage.text && (
                <div className={`${styles.statusBanner} ${statusMessage.type === 'success' ? styles.success : styles.error}`}>
                  {statusMessage.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Pending Request Alert */}
              {vipStatus?.latest_request?.status === 'pending' && (
                <div className={styles.pendingBanner}>
                  <Clock size={18} className={styles.pendingIcon} />
                  <div>
                    <strong>Verification Underway:</strong> UTR <code>{vipStatus.latest_request.utr_number}</code> is currently being reviewed by admin. Your VIP will activate as soon as it is confirmed.
                  </div>
                </div>
              )}

              {/* Mode Tabs */}
              <div className={styles.tabsContainer}>
                <button
                  className={`${styles.tabBtn} ${activeTab === 'upi' ? styles.tabActive : ''}`}
                  onClick={() => { setActiveTab('upi'); setStatusMessage({ text: '', type: '' }); }}
                >
                  <QrCode size={16} />
                  <span>UPI / QR Pay</span>
                </button>
                <button
                  className={`${styles.tabBtn} ${activeTab === 'redeem' ? styles.tabActive : ''}`}
                  onClick={() => { setActiveTab('redeem'); setStatusMessage({ text: '', type: '' }); }}
                >
                  <Gift size={16} />
                  <span>Redeem Gift Code</span>
                </button>
              </div>

              {/* Tab 1: UPI / QR Pay */}
              {activeTab === 'upi' && (
                <div className={styles.tabContent}>
                  {/* Plan Picker */}
                  <div className={styles.planPicker}>
                    <label className={styles.sectionLabel}>Select Your VIP Pass</label>
                    <div className={styles.plansGrid}>
                      {(paymentInfo.plans || DEFAULT_PLANS).map(plan => {
                        const isSelected = selectedPlan.id === plan.id;
                        return (
                          <div
                            key={plan.id}
                            className={`${styles.planCard} ${isSelected ? styles.planSelected : ''}`}
                            onClick={() => setSelectedPlan(plan)}
                          >
                            {plan.badge && <span className={styles.planBadge}>{plan.badge}</span>}
                            <div className={styles.planDuration}>{plan.name}</div>
                            <div className={styles.planPrice}>
                              <span className={styles.currencySymbol}>₹</span>
                              {plan.price_inr}
                            </div>
                            <div className={styles.planDays}>{plan.duration_days} Days Ad-Free</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* QR & UPI Section */}
                  <div className={styles.paymentSection}>
                    <div className={styles.qrBlock}>
                      <div className={styles.qrFrame}>
                        <img 
                          src={qrCodeUrl} 
                          alt="UPI QR Code" 
                          className={styles.qrImage}
                        />
                      </div>
                      <span className={styles.scanHint}>Scan with any UPI App (GPay, PhonePe, Paytm)</span>
                    </div>

                    <div className={styles.upiDetailsBlock}>
                      <div className={styles.amountNotice}>
                        <span>Amount to Pay:</span>
                        <strong className={styles.amountHighlight}>₹{selectedPlan.price_inr}</strong>
                      </div>

                      <div className={styles.upiCopyBox}>
                        <div className={styles.upiTextGroup}>
                          <span className={styles.upiLabel}>UPI ID:</span>
                          <span className={styles.upiValue}>{upiId}</span>
                        </div>
                        <button
                          type="button"
                          className={styles.copyBtn}
                          onClick={handleCopyUpi}
                          title="Copy UPI ID"
                        >
                          {copiedUpi ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                          <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>

                      {/* Payment Verification Form */}
                      <form onSubmit={handleSubmitPayment} className={styles.utrForm}>
                        <label className={styles.formLabel}>
                          12-digit UPI Reference / UTR Number
                          <span className={styles.requiredMark}>*</span>
                        </label>
                        <input
                          type="text"
                          className={styles.inputField}
                          placeholder="e.g. 429810482910"
                          value={utrNumber}
                          onChange={e => setUtrNumber(e.target.value.toUpperCase())}
                          maxLength={30}
                          required
                        />

                        <label className={styles.formLabelOptional}>
                          Transaction Screenshot URL (Optional)
                        </label>
                        <input
                          type="url"
                          className={styles.inputField}
                          placeholder="https://imgur.com/... or image link"
                          value={screenshotUrl}
                          onChange={e => setScreenshotUrl(e.target.value)}
                        />

                        <button
                          type="submit"
                          className={styles.submitBtn}
                          disabled={loading}
                        >
                          {loading ? (
                            <>
                              <Loader2 size={18} className={styles.spinner} />
                              <span>Submitting Verification...</span>
                            </>
                          ) : (
                            <>
                              <span>Submit Payment Verification</span>
                              <ArrowRight size={18} />
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Redeem VIP Code */}
              {activeTab === 'redeem' && (
                <div className={styles.tabContent}>
                  <div className={styles.redeemSection}>
                    <div className={styles.redeemIconWrapper}>
                      <Gift size={36} className={styles.redeemIcon} />
                    </div>
                    <h3 className={styles.redeemTitle}>Have a VIP Gift Code?</h3>
                    <p className={styles.redeemSubtitle}>
                      Enter your activation code received from community events, giveaways, or admin to instantly unlock VIP.
                    </p>

                    <form onSubmit={handleRedeemCode} className={styles.redeemForm}>
                      <div className={styles.codeGroup}>
                        <input
                          type="text"
                          className={styles.codeInput}
                          placeholder="AURA-XXXX-XXXX"
                          value={redeemCode}
                          onChange={e => setRedeemCode(e.target.value.toUpperCase())}
                          maxLength={32}
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        className={styles.activateBtn}
                        disabled={loading || !redeemCode.trim()}
                      >
                        {loading ? (
                          <>
                            <Loader2 size={18} className={styles.spinner} />
                            <span>Validating Code...</span>
                          </>
                        ) : (
                          <>
                            <Crown size={18} />
                            <span>Activate VIP Now</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default VipModal;
