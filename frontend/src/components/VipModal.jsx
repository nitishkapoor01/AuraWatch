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
  Flame,
  Volume2,
  VolumeX,
  ExternalLink
} from 'lucide-react';
import { getApiBaseUrl } from '../utils/apiBase';
import styles from './VipModal.module.css';

const DEFAULT_TIERS = [
  { id: '1_day', name: 'Daily Pass', target_ads: 5, reward_hours: 24, label: '24h VIP' },
  { id: '2_days', name: '2-Day Pass', target_ads: 10, reward_hours: 48, label: '48h VIP' },
  { id: '5_days', name: '5-Day Pass', target_ads: 20, reward_hours: 120, label: '5-Day VIP' }
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
  const [adProgressPercent, setAdProgressPercent] = useState(0);
  const [adCanClaim, setAdCanClaim] = useState(false);
  const [adIsMuted, setAdIsMuted] = useState(false); // Default unmuted
  const [adClaiming, setAdClaiming] = useState(false);
  const [adSuccessMsg, setAdSuccessMsg] = useState('');
  const [adInlineMsg, setAdInlineMsg] = useState({ text: '', type: '' });
  const [loadingAdVideo, setLoadingAdVideo] = useState(false);
  const [adVideoObj, setAdVideoObj] = useState({
    url: '',
    proxyUrl: '',
    clickThrough: ''
  });

  const countdownTimerRef = useRef(null);
  const claimAdRef = useRef(null);

  const API_BASE = getApiBaseUrl();

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
      setIsPlayingAd(false);
      setAdCanClaim(false);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      return;
    }

    setStatusMessage({ text: '', type: '' });
    setAdSuccessMsg('');
    setIsExtending(false);

    fetchQuest();

    const token = localStorage.getItem('aurawatch_token');
    if (token) {
      fetch(`${API_BASE}/vip/status`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setVipStatus(data))
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  // Voluntary Ad Watch
  const handleStartSponsorAd = async () => {
    setIsPlayingAd(true);
    setAdCountdown(10);
    setAdCanClaim(false);
    setAdSuccessMsg('');
    setLoadingAdVideo(true);

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
    setAdInlineMsg({ text: '', type: '' });

    let remaining = 10;
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      setAdCountdown(Math.max(0, remaining));
      setAdProgressPercent(prev => Math.max(prev, Math.min(100, Math.round(((10 - remaining) / 10) * 100))));
      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current);
        setAdProgressPercent(100);
        setAdCanClaim(true);
        // Automatically claim reward once countdown reaches 0s
        if (claimAdRef.current) {
          claimAdRef.current();
        }
      }
    }, 1000);
  };

  // Claim Ad
  const handleClaimAdProgress = async () => {
    if (adClaiming) return;
    setAdClaiming(true);
    setAdInlineMsg({ text: '', type: '' });

    try {
      let visitorId = localStorage.getItem('trackingVisitorId');
      if (!visitorId) {
        visitorId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('trackingVisitorId', visitorId);
      }

      const token = localStorage.getItem('aurawatch_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      headers['x-visitor-id'] = visitorId;

      const res = await fetch(`${API_BASE}/vip/ad-pass/complete-ad`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ visitor_id: visitorId, source: 'vip_section' })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setAdSuccessMsg(data.message || '+1 Ad completed successfully.');
        setAdInlineMsg({ text: '', type: '' });
        fetchQuest();
        if (token) await refreshUser();
        if (data.is_unlocked) {
          window.dispatchEvent(new CustomEvent('aurawatch_vip_unlocked', { detail: data }));
        }
        setIsPlayingAd(false);
      } else {
        setAdInlineMsg({ text: data.message || 'Please wait a moment before claiming.', type: 'error' });
      }
    } catch (err) {
      setAdInlineMsg({ text: 'Network connection issue. Please retry.', type: 'error' });
    } finally {
      setAdClaiming(false);
    }
  };

  // Connect ref so countdown interval can cleanly trigger auto-claim
  useEffect(() => {
    claimAdRef.current = handleClaimAdProgress;
  });

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
            <Crown size={16} className={styles.crownIcon} />
            <span>AURA VIP PASS</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {/* Active VIP Member Banner */}
          {isUserVip && !isExtending ? (
            <div className={styles.activeVipHero}>
              <div className={styles.activeCrownGlow}>
                <Crown size={38} />
              </div>
              <h2 className={styles.activeVipTitle}>VIP Pass Active</h2>
              <p className={styles.activeVipSubtitle}>
                Enjoy 100% ad-free cinema, instant downloads, and unthrottled streaming.
              </p>

              <div className={styles.vipDetailsCard}>
                <div className={styles.vipDetailItem}>
                  <span className={styles.detailLabel}>Pass</span>
                  <span className={styles.detailValue}>
                    {vipStatus?.premium_plan || user?.premium_plan || 'Ad-Pass VIP'}
                  </span>
                </div>
                <div className={styles.vipDetailDivider} />
                <div className={styles.vipDetailItem}>
                  <span className={styles.detailLabel}>Remaining</span>
                  <span className={styles.detailValueHighlight}>
                    {questProgress.seconds_remaining > 0
                      ? `${Math.ceil(questProgress.seconds_remaining / 3600)} Hours`
                      : `${vipStatus?.days_remaining ?? 'Active'} Days`}
                  </span>
                </div>
                <div className={styles.vipDetailDivider} />
                <div className={styles.vipDetailItem}>
                  <span className={styles.detailLabel}>Expires</span>
                  <span className={styles.detailValue}>
                    {questProgress.unlocked_until || vipStatus?.premium_expires_at || user?.premium_expires_at
                      ? new Date(questProgress.unlocked_until || vipStatus?.premium_expires_at || user?.premium_expires_at).toLocaleDateString(undefined, {
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
                  <Sparkles size={14} />
                  <span>Extend Pass</span>
                </button>
                <button className={styles.doneBtn} onClick={onClose}>
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Clean Top Navigation Tabs */}
              <div className={styles.tabsContainer}>
                <button
                  className={`${styles.tabBtn} ${activeTab === 'quest' ? styles.tabActive : ''}`}
                  onClick={() => { setActiveTab('quest'); setStatusMessage({ text: '', type: '' }); }}
                >
                  <Sparkles size={14} />
                  <span>Watch & Unlock VIP</span>
                </button>
                <button
                  className={`${styles.tabBtn} ${activeTab === 'redeem' ? styles.tabActive : ''}`}
                  onClick={() => { setActiveTab('redeem'); setStatusMessage({ text: '', type: '' }); }}
                >
                  <Gift size={14} />
                  <span>Redeem Key</span>
                </button>
              </div>

              {/* Status Alert if any */}
              {statusMessage.text && (
                <div className={`${styles.statusBanner} ${statusMessage.type === 'success' ? styles.success : styles.error}`}>
                  {statusMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* TAB 1: WATCH & UNLOCK VIP */}
              {activeTab === 'quest' && (
                <>
                  {/* Compact Header Strip */}
                  <div className={styles.questHeaderStrip}>
                    <div className={styles.questTopMeta}>
                      <span className={styles.questFreeBadge}>
                        <Sparkles size={12} /> Free Pass
                      </span>
                      {questProgress.is_unlocked ? (
                        <span className={styles.questActiveBadge}>
                          <Check size={12} /> Active ({Math.ceil(questProgress.seconds_remaining / 3600)}h left)
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '700' }}>
                          No Login Required
                        </span>
                      )}
                    </div>
                    <h3 className={styles.questTitle}>
                      Watch 5 Ads for 24h Free VIP Pass
                    </h3>
                    <p className={styles.questSubtitle}>
                      Watch 10-second sponsor ads right here to turn off all video pre-rolls, banners, and popups.
                    </p>
                  </div>

                  {/* Sleek Milestone Chips (Compact horizontal row) */}
                  <div className={styles.milestoneChips}>
                    {tiers.map((tier, idx) => {
                      const isUnlockedTier = currentAds >= tier.target_ads;
                      const isCurrentTarget = !isUnlockedTier && (idx === 0 || currentAds >= tiers[idx - 1].target_ads);

                      return (
                        <div 
                          key={tier.id || idx}
                          className={`${styles.milestoneChip} ${isUnlockedTier ? styles.chipUnlocked : ''} ${isCurrentTarget ? styles.chipCurrent : ''}`}
                        >
                          <span className={styles.chipName}>{tier.name}</span>
                          <span className={styles.chipTarget}>{tier.target_ads} Ads</span>
                          <span className={styles.chipReward}>
                            {tier.label || `${tier.reward_hours}h Pass`}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Clean Progress Bar */}
                  <div className={styles.progressSection}>
                    <div className={styles.progressStats}>
                      <span className={styles.counterText}>
                        Progress: {currentAds} of {nextTarget} Ads
                      </span>
                      <span className={styles.percentText}>
                        {progressPercent}% Complete
                      </span>
                    </div>
                    <div className={styles.progressBarOuter}>
                      <div 
                        className={styles.progressBarInner}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Dedicated Sponsor Ad Viewer / Action Card */}
                  <div className={styles.adActionCard}>
                    {isPlayingAd ? (
                      <div className={styles.adPlayerBox}>
                        <div className={styles.adPlayerOverlayTop}>
                          <span className={styles.adTagBadge}>Sponsor Ad</span>
                          <span className={styles.adCountdownPill}>
                            {adCountdown > 0 ? `Reward in ${adCountdown}s` : 'Reward Ready'}
                          </span>
                        </div>

                        {adVideoObj.url ? (
                          <video
                            src={adVideoObj.url}
                            autoPlay
                            playsInline
                            muted={adIsMuted}
                            className={styles.adPlayerVideo}
                            ref={(el) => {
                              if (el) {
                                el.muted = adIsMuted;
                                const p = el.play();
                                if (p && typeof p.catch === 'function') {
                                  p.catch((err) => {
                                    if (err.name === 'NotAllowedError') {
                                      el.muted = true;
                                      setAdIsMuted(true);
                                      el.play().catch(() => {});
                                    }
                                  });
                                }
                              }
                            }}
                            onTimeUpdate={(e) => {
                              const ct = e.target.currentTime;
                              const dur = e.target.duration || 10;
                              const pct = Math.min(100, Math.round((ct / Math.min(dur, 10)) * 100));
                              setAdProgressPercent(prev => Math.max(prev, pct));
                            }}
                            onError={(e) => {
                              if (adVideoObj.proxyUrl && e.target.src !== adVideoObj.proxyUrl) {
                                e.target.src = adVideoObj.proxyUrl;
                                e.target.play().catch(() => {});
                              }
                            }}
                          />
                        ) : (
                          <div style={{ padding: '36px 16px', textAlign: 'center' }}>
                            <Loader2 size={26} className={styles.spinner} style={{ color: '#ffb703', margin: '0 auto 8px' }} />
                            <div style={{ color: '#fff', fontSize: '13px', fontWeight: '700' }}>
                              Sponsor Ad Playing...
                            </div>
                            <div style={{ color: '#888', fontSize: '11px', marginTop: '3px' }}>
                              Reward activates when 10-second timer completes.
                            </div>
                          </div>
                        )}

                        {/* Live Ad Progress Bar */}
                        <div className={styles.adVideoProgressBarOuter}>
                          <div 
                            className={styles.adVideoProgressBarInner}
                            style={{ width: `${adProgressPercent}%` }}
                          />
                        </div>

                        {/* Centered Prominent Claim Overlay when Reward is Ready */}
                        {adCanClaim && (
                          <div className={styles.centerClaimOverlay}>
                            <button
                              type="button"
                              className={styles.centerClaimBtn}
                              onClick={handleClaimAdProgress}
                              disabled={adClaiming}
                            >
                              {adClaiming ? (
                                <>
                                  <Loader2 size={16} className={styles.spinner} />
                                  <span>Recording Progress...</span>
                                </>
                              ) : (
                                <>
                                  <Check size={18} />
                                  <span>Claim +1 Ad Progress Now</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {/* In-Player Status Alert */}
                        {adInlineMsg.text && (
                          <div className={styles.inlinePlayerAlert}>
                            <span>{adInlineMsg.text}</span>
                            <button type="button" onClick={handleClaimAdProgress} className={styles.inlineRetryBtn}>
                              Retry
                            </button>
                          </div>
                        )}

                        <div className={styles.adPlayerOverlayBottom}>
                          <button
                            type="button"
                            className={styles.adMuteBtn}
                            onClick={() => setAdIsMuted(!adIsMuted)}
                            title={adIsMuted ? 'Unmute' : 'Mute'}
                          >
                            {adIsMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                          </button>

                          {adVideoObj.clickThrough && (
                            <a
                              href={adVideoObj.clickThrough}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#24a1de', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}
                            >
                              <span>Visit Sponsor</span>
                              <ExternalLink size={11} />
                            </a>
                          )}

                          {adCanClaim ? (
                            <button
                              type="button"
                              className={styles.adClaimBtn}
                              onClick={handleClaimAdProgress}
                              disabled={adClaiming}
                            >
                              {adClaiming ? <Loader2 size={13} className={styles.spinner} /> : <Check size={13} />}
                              <span>Claim +1</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#888' }}>
                              Reward in {adCountdown}s
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        {adSuccessMsg && (
                          <div className={styles.adSuccessCard}>
                            <Check size={16} />
                            <div style={{ textAlign: 'left', flex: 1 }}>
                              <div style={{ fontWeight: '700', color: '#10b981' }}>
                                {questProgress.is_unlocked ? 'VIP Pass Active' : '+1 Ad Recorded'}
                              </div>
                              <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                                {adSuccessMsg}
                              </div>
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          className={styles.watchAdBtn}
                          onClick={handleStartSponsorAd}
                          disabled={loadingAdVideo}
                        >
                          <Play size={16} fill="#000" />
                          <span>
                            {currentAds > 0 && currentAds < nextTarget 
                              ? `Watch Next Ad (${nextTarget - currentAds} more to unlock)` 
                              : 'Watch Sponsor Ad (+1 Progress)'}
                          </span>
                        </button>

                        <p className={styles.watchAdSub}>
                          Voluntary 10-second sponsor ad • Only ads watched here count towards quest
                        </p>
                      </>
                    )}
                  </div>

                  {/* 3 Minimal Micro Perks (One clean line at bottom) */}
                  <div className={styles.microPerksRow}>
                    <span className={styles.microPerkItem}>
                      <ShieldCheck size={13} /> Zero Video Ads
                    </span>
                    <span className={styles.microPerkItem}>
                      <Zap size={13} /> 0s Instant Downloads
                    </span>
                    <span className={styles.microPerkItem}>
                      <Crown size={13} /> VIP Crown Badge
                    </span>
                  </div>

                  {/* Subtle Guest Sync Footnote */}
                  {!isLoggedIn && (
                    <p className={styles.guestFootNote}>
                      Guest mode active. Progress is saved on this device.
                      <button
                        type="button"
                        className={styles.guestFootLink}
                        onClick={() => {
                          onClose();
                          if (onRequireLogin) onRequireLogin();
                        }}
                      >
                        Sign In to Sync
                      </button>
                    </p>
                  )}
                </>
              )}

              {/* TAB 2: REDEEM VIP KEY */}
              {activeTab === 'redeem' && (
                <div className={styles.redeemSection}>
                  <div className={styles.redeemIconWrapper}>
                    <Gift size={28} />
                  </div>
                  <h3 className={styles.redeemTitle}>Redeem VIP Key</h3>
                  <p className={styles.redeemSubtitle}>
                    Enter your giveaway activation key to instantly unlock VIP.
                  </p>

                  <form onSubmit={handleRedeemCode} className={styles.redeemForm}>
                    <input
                      type="text"
                      className={styles.codeInput}
                      placeholder="AURA-XXXX-XXXX"
                      value={redeemCode}
                      onChange={e => setRedeemCode(e.target.value.toUpperCase())}
                      maxLength={32}
                      required
                    />

                    <button
                      type="submit"
                      className={styles.activateBtn}
                      disabled={loading || !redeemCode.trim()}
                    >
                      {loading ? (
                        <>
                          <Loader2 size={16} className={styles.spinner} />
                          <span>Validating...</span>
                        </>
                      ) : (
                        <>
                          <Crown size={16} />
                          <span>Activate Key</span>
                        </>
                      )}
                    </button>
                  </form>
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
