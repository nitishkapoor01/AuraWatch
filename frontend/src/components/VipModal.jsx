import React, { useState, useEffect, useRef } from 'react';
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
  ArrowRight,
  Volume2,
  VolumeX,
  ExternalLink
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

  // Dedicated In-Modal Ad Player State
  const [isPlayingAd, setIsPlayingAd] = useState(false);
  const [adCountdown, setAdCountdown] = useState(10);
  const [adCanClaim, setAdCanClaim] = useState(false);
  const [adIsMuted, setAdIsMuted] = useState(true);
  const [adClaiming, setAdClaiming] = useState(false);
  const [adSuccessMsg, setAdSuccessMsg] = useState('');
  const [loadingAdVideo, setLoadingAdVideo] = useState(false);
  const [adVideoObj, setAdVideoObj] = useState({
    url: '',
    proxyUrl: '',
    clickThrough: ''
  });

  const countdownTimerRef = useRef(null);

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
    if (!isOpen) {
      // Reset ad watching state when closed
      setIsPlayingAd(false);
      setAdCanClaim(false);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      return;
    }

    setStatusMessage({ text: '', type: '' });
    setAdSuccessMsg('');
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

  // Clean body scroll lock
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  // Cleanup countdown timer on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  // Handle Starting a Voluntary Sponsor Ad Watch in the Quest Section
  const handleStartSponsorAd = async () => {
    setIsPlayingAd(true);
    setAdCountdown(10);
    setAdCanClaim(false);
    setAdSuccessMsg('');
    setLoadingAdVideo(true);

    // Resolve active sponsor ad
    try {
      const res = await fetch(`${API_BASE}/ads/config`);
      const data = await res.json();
      const preRoll = data?.config?.pre_roll;
      const vastUrl = preRoll?.vast_url || 'https://loyal-product.com/dXmaFuz.dKG/N/vIZdG/UJ/Zexmc9Gu/ZpUql/k/PSTRcp1/Mtj_EUwsMJjgkFtJNzzYU/y/MOTUA-ztMKwH';

      let videoUrl = '';
      let clickThrough = '';

      const pRes = await fetch(`${API_BASE}/ads/vast-proxy?url=${encodeURIComponent(vastUrl)}`).catch(() => null);
      let xmlText = pRes && pRes.ok ? await pRes.text() : '';
      if (!xmlText) {
        const dRes = await fetch(vastUrl).catch(() => null);
        if (dRes && dRes.ok) xmlText = await dRes.text();
      }

      if (xmlText) {
        const mp4Match = xmlText.match(/<MediaFile[^>]*type=["']video\/mp4["'][^>]*><!\[CDATA\[(.*?)\]\]><\/MediaFile>/i) ||
                         xmlText.match(/<MediaFile[^>]*><!\[CDATA\[(.*?)\]\]><\/MediaFile>/i) ||
                         xmlText.match(/<MediaFile[^>]*>(https?:\/\/[^<]+\.mp4[^<]*)<\/MediaFile>/i);
        const clickMatch = xmlText.match(/<ClickThrough><!\[CDATA\[(.*?)\]\]><\/ClickThrough>/i) ||
                           xmlText.match(/<ClickThrough>(https?:\/\/[^<]+)<\/ClickThrough>/i);

        if (mp4Match) {
          const rawUrl = mp4Match[1].trim();
          const safeUrl = rawUrl.replace('://silent-basis.pro', '://www.silent-basis.pro');
          const proxiedVideo = `${API_BASE}/ads/video-proxy?url=${encodeURIComponent(safeUrl)}`;
          videoUrl = safeUrl;
          clickThrough = clickMatch ? clickMatch[1].trim() : '';
          setAdVideoObj({ url: safeUrl, proxyUrl: proxiedVideo, clickThrough });
        }
      }
    } catch (_) {}

    setLoadingAdVideo(false);

    // Start 10-second countdown
    let remaining = 10;
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      setAdCountdown(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current);
        setAdCanClaim(true);
      }
    }, 1000);
  };

  // Claim Completed Sponsor Ad
  const handleClaimAdProgress = async () => {
    if (adClaiming) return;
    setAdClaiming(true);

    try {
      const token = localStorage.getItem('aurawatch_token');
      const visitorId = localStorage.getItem('trackingVisitorId') || '';
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (visitorId) headers['x-visitor-id'] = visitorId;

      const res = await fetch(`${API_BASE}/vip/ad-pass/complete-ad`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ visitor_id: visitorId, source: 'vip_section' })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setAdSuccessMsg(data.message || 'Progress recorded! +1 ad added to your VIP Pass quest.');
        fetchQuest();
        if (token) await refreshUser();
        if (data.is_unlocked) {
          window.dispatchEvent(new CustomEvent('aurawatch_vip_unlocked', { detail: data }));
        }
        setIsPlayingAd(false);
      } else {
        setStatusMessage({ text: data.message || 'Please wait a moment before claiming.', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: 'Network error. Please try again.', type: 'error' });
    } finally {
      setAdClaiming(false);
    }
  };

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
                <div className={styles.freePassPill}>
                  <Sparkles size={14} />
                  <span>100% Free • No Login or Payment Required</span>
                </div>

                <h2 className={styles.heroTitle}>
                  Watch Sponsor Ads Here. <span className={styles.gradientText}>Unlock Free VIP.</span>
                </h2>
                <p className={styles.heroSubtitle}>
                  Watch 10-second sponsor ads voluntarily in this section to advance your quest. In return, all ads, banners, and popup redirects are turned off platform-wide for up to 5 days.
                </p>

                {/* 3-Step Simple Explainer */}
                <div className={styles.howItWorksSteps}>
                  <div className={styles.stepItem}>
                    <span className={styles.stepNum}>1</span>
                    <div className={styles.stepText}>
                      <strong>Click Watch Ad</strong>
                      <span>Watch here (no movie ads count)</span>
                    </div>
                  </div>
                  <div className={styles.stepArrow}>➔</div>
                  <div className={styles.stepItem}>
                    <span className={styles.stepNum}>2</span>
                    <div className={styles.stepText}>
                      <strong>Count Adds Up</strong>
                      <span>10s ad gives +1 quest point</span>
                    </div>
                  </div>
                  <div className={styles.stepArrow}>➔</div>
                  <div className={styles.stepItem}>
                    <span className={styles.stepNum}>3</span>
                    <div className={styles.stepText}>
                      <strong>Zero Ads Unlocked</strong>
                      <span>Enjoy 1 to 5 days 100% ad-free</span>
                    </div>
                  </div>
                </div>

                {!isLoggedIn && (
                  <div className={styles.guestSyncRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldCheck size={16} color="#10b981" />
                      <span><strong>Guest Mode:</strong> Progress saves on this device. No account or card needed.</span>
                    </div>
                    <button
                      type="button"
                      className={styles.guestSyncBtn}
                      onClick={() => {
                        onClose();
                        if (onRequireLogin) onRequireLogin();
                      }}
                    >
                      Sign In to Sync
                    </button>
                  </div>
                )}

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
                            Watch sponsor ads in this section to advance your quest. Regular movie playback ads do not count.
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

                    {/* Interactive In-Modal Sponsor Ad Action Section */}
                    <div className={styles.questAdSection}>
                      {isPlayingAd ? (
                        <div className={styles.adPlayerBox}>
                          <div className={styles.adPlayerOverlayTop}>
                            <div className={styles.adTagBadge}>
                              <span>Sponsor Ad</span>
                            </div>
                            <div className={styles.adCountdownPill}>
                              {adCountdown > 0 ? `Reward in ${adCountdown}s` : 'Reward Ready'}
                            </div>
                          </div>

                          {adVideoObj.url ? (
                            <video
                              src={adVideoObj.url}
                              autoPlay
                              playsInline
                              muted={adIsMuted}
                              className={styles.adPlayerVideo}
                              onError={(e) => {
                                if (adVideoObj.proxyUrl && e.target.src !== adVideoObj.proxyUrl) {
                                  e.target.src = adVideoObj.proxyUrl;
                                  e.target.play().catch(() => {});
                                }
                              }}
                            />
                          ) : (
                            <div style={{
                              padding: '40px 20px',
                              background: 'radial-gradient(circle, rgba(255, 183, 3, 0.15) 0%, rgba(0,0,0,0.8) 100%)',
                              textAlign: 'center'
                            }}>
                              <Loader2 size={32} className={styles.spinner} style={{ color: '#ffb703', margin: '0 auto 12px' }} />
                              <div style={{ color: '#fff', fontSize: '14px', fontWeight: '700' }}>
                                Sponsor Ad Playing...
                              </div>
                              <div style={{ color: '#aaa', fontSize: '12px', marginTop: '4px' }}>
                                Reward credits when countdown finishes.
                              </div>
                            </div>
                          )}

                          <div className={styles.adPlayerOverlayBottom}>
                            <button
                              type="button"
                              className={styles.adMuteBtn}
                              onClick={() => setAdIsMuted(!adIsMuted)}
                              title={adIsMuted ? 'Unmute' : 'Mute'}
                            >
                              {adIsMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                            </button>

                            {adVideoObj.clickThrough && (
                              <a
                                href={adVideoObj.clickThrough}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.adVisitLink}
                              >
                                <span>Visit Sponsor</span>
                                <ExternalLink size={12} />
                              </a>
                            )}

                            {adCanClaim ? (
                              <button
                                type="button"
                                className={styles.adClaimBtn}
                                onClick={handleClaimAdProgress}
                                disabled={adClaiming}
                              >
                                {adClaiming ? (
                                  <>
                                    <Loader2 size={14} className={styles.spinner} />
                                    <span>Claiming...</span>
                                  </>
                                ) : (
                                  <>
                                    <Check size={14} />
                                    <span>Claim +1 Progress</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#888' }}>
                                Please watch full 10s to claim credit
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          {adSuccessMsg && (
                            <div className={styles.questCompleteCard}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: '700', fontSize: '14px' }}>
                                <Check size={18} />
                                <span>{adSuccessMsg}</span>
                              </div>
                              <span style={{ fontSize: '12px', color: '#ccc' }}>
                                Current count: {currentAds} ads. You need {Math.max(0, nextTarget - currentAds)} more ads to reach the next VIP milestone!
                              </span>
                            </div>
                          )}

                          <button
                            type="button"
                            className={styles.watchAdBtn}
                            onClick={handleStartSponsorAd}
                            disabled={loadingAdVideo}
                          >
                            <Play size={18} fill="#000" />
                            <span>Watch Sponsor Ad (+1 Progress)</span>
                          </button>

                          <p className={styles.watchAdHint}>
                            Watch quick 10-second sponsor ads right here to fill your quest. Once unlocked, all ads across all movies turn off automatically!
                          </p>
                        </>
                      )}
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
