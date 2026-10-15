import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Crown, 
  X, 
  Check, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  Clock, 
  Gift, 
  Loader2, 
  AlertCircle,
  Play,
  Lock,
  Flame,
  ArrowRight
} from 'lucide-react';
import styles from './VipModal.module.css';

const DEFAULT_TIERS = [
  { id: '1_day', name: 'Daily Pass', target_ads: 5, reward_hours: 24, label: '24 Hours (1 Day)' },
  { id: '2_days', name: '2-Day Pass', target_ads: 10, reward_hours: 48, label: '48 Hours (2 Days)' },
  { id: '5_days', name: '5-Day Pass', target_ads: 20, reward_hours: 120, label: '120 Hours (5 Days)' }
];

const VipModal = ({ isOpen, onClose, onRequireLogin }) => {
  const { user, isLoggedIn, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState('quest'); // 'quest' | 'redeem'
  const [redeemCode, setRedeemCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
  const [vipStatus, setVipStatus] = useState(null);
  const [isExtending, setIsExtending] = useState(false);
  const [questProgress, setQuestProgress] = useState({
    enabled: true,
    current_count: 0,
    target_count: 5,
    reward_hours: 24,
    tiers: DEFAULT_TIERS,
    is_unlocked: false,
    unlocked_until: null,
    seconds_remaining: 0
  });

  const API_BASE = `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:10000'}/api` : 'https://aurawatch-1.onrender.com/api')}`;

  const fetchQuest = () => {
    const token = localStorage.getItem('aurawatch_token');
    const visitorId = localStorage.getItem('trackingVisitorId') || '';
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (visitorId) headers['x-visitor-id'] = visitorId;

    fetch(`${API_BASE}/vip/ad-pass/progress?visitor_id=${encodeURIComponent(visitorId)}`, { headers })
      .then(r => r.json())
      .then(data => {
        if (data && data.enabled !== undefined) {
          setQuestProgress({
            ...data,
            tiers: data.tiers?.length ? data.tiers : DEFAULT_TIERS
          });
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!isOpen) return;

    setStatusMessage({ text: '', type: '' });
    setIsExtending(false);

    // 1. Fetch quest status & tiers
    fetchQuest();

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

  // Lock body scroll cleanly when modal is open
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

  const handleRedeemCode = async (e) => {
    e.preventDefault();
    if (!redeemCode.trim()) {
      setStatusMessage({ text: 'Please enter a VIP giveaway code.', type: 'error' });
      return;
    }

    setLoading(true);
    setStatusMessage({ text: '', type: '' });

    try {
      const token = localStorage.getItem('aurawatch_token');
      const visitorId = localStorage.getItem('trackingVisitorId') || '';
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (visitorId) headers['x-visitor-id'] = visitorId;

      const res = await fetch(`${API_BASE}/vip/redeem`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ code: redeemCode.trim(), visitor_id: visitorId })
      });
      const data = await res.json();

      if (res.ok) {
        setStatusMessage({ text: data.message, type: 'success' });
        setRedeemCode('');
        if (token) await refreshUser();
        setVipStatus(prev => ({
          ...prev,
          is_premium: true,
          premium_expires_at: data.premium_expires_at,
          premium_plan: data.premium_plan
        }));
        setQuestProgress(prev => ({
          ...prev,
          is_unlocked: true,
          unlocked_until: data.premium_expires_at
        }));
        window.dispatchEvent(new CustomEvent('aurawatch_vip_unlocked', { detail: data }));
      } else {
        setStatusMessage({ text: data.message || 'Failed to redeem code.', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: 'Network connection issue. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const isUserVip = Boolean(user?.is_premium || vipStatus?.is_premium || questProgress?.is_unlocked);
  const tiers = questProgress.tiers && questProgress.tiers.length ? questProgress.tiers : DEFAULT_TIERS;
  const currentAds = questProgress.current_count || 0;
  const nextTarget = questProgress.target_count || tiers[0].target_ads;
  const progressPercent = Math.min(100, Math.round((currentAds / nextTarget) * 100));

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.crownBadge}>
            <Crown size={20} className={styles.crownIcon} />
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
                <Crown size={46} />
              </div>
              <h2 className={styles.activeVipTitle}>VIP Pass Active</h2>
              <p className={styles.activeVipSubtitle}>
                Enjoy 100% ad-free cinema, instant downloads, and unthrottled streaming.
              </p>

              <div className={styles.vipDetailsCard}>
                <div className={styles.vipDetailItem}>
                  <span className={styles.detailLabel}>Pass Tier</span>
                  <span className={styles.detailValue}>
                    {vipStatus?.premium_plan || user?.premium_plan || 'Ad-Pass VIP (Ad-Free)'}
                  </span>
                </div>
                <div className={styles.vipDetailDivider} />
                <div className={styles.vipDetailItem}>
                  <span className={styles.detailLabel}>Time Remaining</span>
                  <span className={styles.detailValueHighlight}>
                    {questProgress.seconds_remaining > 0
                      ? `${Math.ceil(questProgress.seconds_remaining / 3600)} Hours`
                      : `${vipStatus?.days_remaining ?? 'Active'} Days`}
                  </span>
                </div>
                <div className={styles.vipDetailDivider} />
                <div className={styles.vipDetailItem}>
                  <span className={styles.detailLabel}>Valid Until</span>
                  <span className={styles.detailValue}>
                    {questProgress.unlocked_until || vipStatus?.premium_expires_at || user?.premium_expires_at
                      ? new Date(questProgress.unlocked_until || vipStatus?.premium_expires_at || user?.premium_expires_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Active'}
                  </span>
                </div>
              </div>

              <div className={styles.activeVipActions}>
                <button 
                  className={styles.extendBtn}
                  onClick={() => setIsExtending(true)}
                >
                  <Sparkles size={16} />
                  <span>Extend / Progress Quests</span>
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
                  Watch sponsor ads to unlock 100% ad-free viewing or redeem an activation key.
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
                      <h4 className={styles.perkName}>Instant 0s Downloads</h4>
                      <p className={styles.perkDesc}>Skip countdown timers entirely. Direct high-speed access.</p>
                    </div>
                  </div>

                  <div className={styles.perkCard}>
                    <div className={styles.perkIconWrapper}>
                      <Crown size={20} className={styles.perkIcon} />
                    </div>
                    <div>
                      <h4 className={styles.perkName}>VIP Crown Badge</h4>
                      <p className={styles.perkDesc}>Golden VIP identity shown on your player and profile.</p>
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

              {/* Clean 2 Tabs (Quest & Redeem) */}
              <div className={styles.tabsContainer}>
                <button
                  className={`${styles.tabBtn} ${activeTab === 'quest' ? styles.tabActive : ''}`}
                  onClick={() => { setActiveTab('quest'); setStatusMessage({ text: '', type: '' }); }}
                >
                  <Sparkles size={16} />
                  <span>Watch & Unlock (Ad-Pass)</span>
                </button>
                <button
                  className={`${styles.tabBtn} ${activeTab === 'redeem' ? styles.tabActive : ''}`}
                  onClick={() => { setActiveTab('redeem'); setStatusMessage({ text: '', type: '' }); }}
                >
                  <Gift size={16} />
                  <span>Redeem VIP Key</span>
                </button>
              </div>

              {/* Tab 1: Watch & Unlock VIP (Milestone Quest) */}
              {activeTab === 'quest' && (
                <div className={styles.tabContent}>
                  <div className={styles.questCard}>
                    <div className={styles.questHeader}>
                      <div className={styles.questTitleGroup}>
                        <Crown size={26} className={styles.questIcon} />
                        <div>
                          <h3 className={styles.questTitle}>Ad-Pass Milestone Quests</h3>
                          <p className={styles.questSubtitle}>
                            Watch sponsor video ads while browsing to unlock extended ad-free passes.
                          </p>
                        </div>
                      </div>

                      {questProgress.is_unlocked && (
                        <div className={styles.questActiveBadge}>
                          <Check size={16} />
                          <span>Pass Active ({Math.ceil(questProgress.seconds_remaining / 3600)}h left)</span>
                        </div>
                      )}
                    </div>

                    {/* Milestone Tiers Grid */}
                    <div className={styles.tiersGrid}>
                      {tiers.map((tier, idx) => {
                        const isUnlockedTier = currentAds >= tier.target_ads;
                        const isCurrentTarget = !isUnlockedTier && (idx === 0 || currentAds >= tiers[idx - 1].target_ads);

                        return (
                          <div 
                            key={tier.id || idx}
                            className={`${styles.tierCard} ${isUnlockedTier ? styles.tierCardUnlocked : ''} ${isCurrentTarget ? styles.tierCardCurrent : ''}`}
                          >
                            <div className={styles.tierCardHeader}>
                              <span className={styles.tierBadge}>{tier.name}</span>
                              {isUnlockedTier ? (
                                <Check size={16} color="#10b981" />
                              ) : isCurrentTarget ? (
                                <Flame size={16} color="#ffb703" />
                              ) : (
                                <Lock size={14} color="rgba(255,255,255,0.4)" />
                              )}
                            </div>

                            <div className={styles.tierTargetAds}>
                              {tier.target_ads}
                              <span className={styles.tierTargetAdsSub}>Ads Required</span>
                            </div>

                            <div className={styles.tierReward}>
                              <Clock size={14} />
                              <span>{tier.label || `${tier.reward_hours} Hours Pass`}</span>
                            </div>

                            <div className={styles.tierStatusRow}>
                              {isUnlockedTier ? (
                                <span className={styles.tierUnlockedPill}>
                                  <Check size={13} /> Unlocked
                                </span>
                              ) : isCurrentTarget ? (
                                <span className={styles.tierProgressPill}>
                                  In Progress ({currentAds}/{tier.target_ads})
                                </span>
                              ) : (
                                <span className={styles.tierLockedPill}>
                                  Locked ({tier.target_ads - currentAds} more)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Overall Progress Bar */}
                    <div className={styles.questProgressBarOuter}>
                      <div 
                        className={styles.questProgressBarInner}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    <div className={styles.questStats}>
                      <span className={styles.questCounter}>
                        {currentAds} of {nextTarget} Ads to Next Milestone
                      </span>
                      <span className={styles.questPercent}>
                        {progressPercent}% Complete
                      </span>
                    </div>

                    <div className={styles.perkDesc} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <strong>How it works:</strong> Whenever you play a movie or episode, sponsor ads contribute to your quest. Once a milestone is reached, all pre-rolls, banners, and popups are deactivated across the entire platform.
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                      <button
                        type="button"
                        className={styles.activateBtn}
                        onClick={onClose}
                      >
                        <Play size={16} />
                        <span>Start Streaming to Progress Quest</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Redeem VIP Giveaway Key */}
              {activeTab === 'redeem' && (
                <div className={styles.tabContent}>
                  <div className={styles.redeemSection}>
                    <div className={styles.redeemIconWrapper}>
                      <Gift size={36} className={styles.redeemIcon} />
                    </div>
                    <h3 className={styles.redeemTitle}>Redeem VIP Activation Key</h3>
                    <p className={styles.redeemSubtitle}>
                      Enter an AuraWatch VIP key from our official community giveaways to instantly unlock ad-free access.
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
                            <span>Validating Key...</span>
                          </>
                        ) : (
                          <>
                            <Crown size={18} />
                            <span>Activate VIP Pass</span>
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
