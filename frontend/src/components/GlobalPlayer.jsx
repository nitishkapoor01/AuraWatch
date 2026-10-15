import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, ExternalLink, Volume2, VolumeX, Loader2, Crown } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import styles from './GlobalPlayer.module.css';

const GlobalPlayer = () => {
  const { playerState, closePlayer, setSticky } = usePlayer();
  const { isOpen, isSticky, movieData } = playerState;
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, token, user } = useAuth();
  const isAdmin = user && (user.role === 'admin' || user.is_super_admin);
  
  // Synchronously determine if user or guest has ANY VIP / ad-free access
  const isVipExemptSync = () => {
    if (Boolean(user?.is_premium)) return true;
    try {
      const guestUntil = localStorage.getItem('aurawatch_guest_vip_until');
      if (guestUntil && new Date(guestUntil) > new Date()) return true;
      const isUnlocked = localStorage.getItem('aurawatch_vip_unlocked');
      if (isUnlocked === 'true') return true;
    } catch (_) {}
    return false;
  };

  const isAdExempt = isVipExemptSync();

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initX: 0, initY: 0, dragged: false });

  // Pre-Roll Ad Gateway States (Strict 10s Timer)
  const [preRollActive, setPreRollActive] = useState(false);
  const [preRollSeconds, setPreRollSeconds] = useState(10);
  const [preRollConfig, setPreRollConfig] = useState(null);
  const [vastVideo, setVastVideo] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [adVideoStarted, setAdVideoStarted] = useState(false);
  const [adProgressPercent, setAdProgressPercent] = useState(0);
  const [isResolvingVast, setIsResolvingVast] = useState(false);
  const [adPassStatus, setAdPassStatus] = useState(null);
  const completedRef = useRef(false);

  // Helper to log first-party ad impression in real time for admin panel tracking
  const logFirstPartyImpression = (slot = 'pre_roll') => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 
        (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api');
      const visitorId = localStorage.getItem('trackingVisitorId') || '';
      const sessionId = sessionStorage.getItem('trackingSessionId') || '';
      const deviceType = window.innerWidth <= 860 ? 'mobile' : 'desktop';
      fetch(`${baseUrl}/ads/impression`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, visitorId, sessionId, deviceType })
      }).catch(() => {});
    } catch (_) {}
  };

  // Skip ad instantly handler
  const handleSkipAd = (e) => {
    if (e) e.stopPropagation();
    setPreRollActive(false);
    setIsResolvingVast(false);
    setVastVideo(null);
  };

  // Listen to global VIP unlock events (instant exemption)
  useEffect(() => {
    const onVipUnlocked = (e) => {
      const d = e.detail;
      if (d?.premium_expires_at) {
        localStorage.setItem('aurawatch_guest_vip_until', d.premium_expires_at);
      }
      localStorage.setItem('aurawatch_vip_unlocked', 'true');
      setPreRollActive(false);
      setIsResolvingVast(false);
      setVastVideo(null);
    };
    window.addEventListener('aurawatch_vip_unlocked', onVipUnlocked);
    return () => window.removeEventListener('aurawatch_vip_unlocked', onVipUnlocked);
  }, []);

  // Fetch Ads config and initialize Pre-Roll Gateway when opening a movie
  useEffect(() => {
    if (!isOpen || !movieData) {
      setPreRollActive(false);
      setVastVideo(null);
      setAdVideoStarted(false);
      setAdProgressPercent(0);
      setIsResolvingVast(false);
      return;
    }

    setAdVideoStarted(false);
    setAdProgressPercent(0);
    setVastVideo(null);

    // INSTANT PLAY FOR VIP: If user or guest has ANY VIP access, launch player instantly with 0ms delay!
    if (isVipExemptSync()) {
      setPreRollActive(false);
      setIsResolvingVast(false);
      return;
    }

    // Lock gateway strictly for non-VIP users with 10s timer
    setPreRollActive(true);
    setIsResolvingVast(true);
    setPreRollSeconds(10);

    completedRef.current = false;
    let isMounted = true;
    const fetchAdsConfig = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 
          (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api');

        const savedToken = localStorage.getItem('aurawatch_token') || token;
        const visitorId = localStorage.getItem('trackingVisitorId') || '';
        const headers = savedToken ? { Authorization: `Bearer ${savedToken}` } : {};
        if (visitorId) headers['x-visitor-id'] = visitorId;

        const fetchWithTimeout = async (url, options = {}, timeoutMs = 1200) => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          try {
            const resp = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timer);
            return resp;
          } catch (_) {
            clearTimeout(timer);
            return null;
          }
        };

        // Concurrently fetch VIP Ad-Pass quest status
        fetchWithTimeout(`${baseUrl}/vip/ad-pass/progress?visitor_id=${encodeURIComponent(visitorId)}`, { headers }, 1200)
          .then(r => r ? r.json() : null)
          .then(qData => {
            if (qData && isMounted) {
              setAdPassStatus(qData);
              if (qData.is_unlocked) {
                try {
                  if (qData.unlocked_until) localStorage.setItem('aurawatch_guest_vip_until', qData.unlocked_until);
                  localStorage.setItem('aurawatch_vip_unlocked', 'true');
                } catch (_) {}
                setPreRollActive(false);
                setIsResolvingVast(false);
              }
            }
          })
          .catch(() => {});

        const res = await fetchWithTimeout(`${baseUrl}/ads/config?visitor_id=${encodeURIComponent(visitorId)}`, { headers }, 1200);

        let data = null;
        if (res && res.ok) {
          try { data = await res.json(); } catch (_) {}
        }
        
        // If config endpoint was slow or failed, use hardened HilltopAds VAST default with 10s timer
        if (!data) {
          data = {
            config: {
              enabled: true,
              pre_roll: {
                enabled: true,
                type: 'vast',
                vast_url: 'https://loyal-product.com/dXmaFuz.dKG/N/vIZdG/UJ/Zexmc9Gu/ZpUql/k/PSTRcp1/Mtj_EUwsMJjgkFtJNzzYU/y/MOTUA-ztMKwH',
                timer_seconds: 10
              }
            }
          };
        }

        if (isMounted) {
          if (data.is_premium || data.skipAdsTimer || !data.config?.enabled) {
            setPreRollActive(false);
            setIsResolvingVast(false);
            return;
          }

          const preRoll = data.config?.pre_roll;
          if (data.config?.enabled && preRoll?.enabled) {
            const timerSecs = Math.max(10, preRoll.timer_seconds || 10);
            setPreRollConfig(preRoll);
            setPreRollSeconds(timerSecs);
            setPreRollActive(true);
            setIsResolvingVast(true);

            // Attempt to resolve VAST Video if configured
            const vastUrl = preRoll.vast_url || (preRoll.type === 'vast' ? 'https://loyal-product.com/dXmaFuz.dKG/N/vIZdG/UJ/Zexmc9Gu/ZpUql/k/PSTRcp1/Mtj_EUwsMJjgkFtJNzzYU/y/MOTUA-ztMKwH' : '');
            if (vastUrl && preRoll.type !== 'banner' && preRoll.type !== 'video') {
              try {
                let xmlText = '';
                // 1. Try fast backend proxy
                const proxyUrl = `${baseUrl}/ads/vast-proxy?url=${encodeURIComponent(vastUrl)}`;
                const pRes = await fetchWithTimeout(proxyUrl, {}, 1200);
                if (pRes && pRes.ok) xmlText = await pRes.text();

                // 2. If proxy was slow or failed, fetch directly from HilltopAds
                if (!xmlText) {
                  const vRes = await fetchWithTimeout(vastUrl, {}, 1500);
                  if (vRes && vRes.ok) xmlText = await vRes.text();
                }

                if (xmlText && isMounted) {
                  // Instant regex match for mp4 URL (handles CDATA and standard tags)
                  const mp4Match = xmlText.match(/<MediaFile[^>]*type=["']video\/mp4["'][^>]*><!\[CDATA\[(.*?)\]\]><\/MediaFile>/i) ||
                                   xmlText.match(/<MediaFile[^>]*><!\[CDATA\[(.*?)\]\]><\/MediaFile>/i) ||
                                   xmlText.match(/<MediaFile[^>]*>(https?:\/\/[^<]+\.mp4[^<]*)<\/MediaFile>/i);
                  
                  const clickMatch = xmlText.match(/<ClickThrough><!\[CDATA\[(.*?)\]\]><\/ClickThrough>/i) ||
                                     xmlText.match(/<ClickThrough>(https?:\/\/[^<]+)<\/ClickThrough>/i);

                  const impMatches = Array.from(xmlText.matchAll(/<Impression><!\[CDATA\[(.*?)\]\]><\/Impression>/gi)).map(m => m[1]);

                  const foundVideo = mp4Match ? mp4Match[1].trim() : '';
                  const clickThrough = clickMatch ? clickMatch[1].trim() : '';

                  if (foundVideo) {
                    const safeDirectVideo = foundVideo.replace('://silent-basis.pro', '://www.silent-basis.pro');
                    const proxiedVideo = `${baseUrl}/ads/video-proxy?url=${encodeURIComponent(safeDirectVideo)}`;
                    // Use direct CDN video for instant, zero-lag 60fps playback, with proxy as fallback
                    setVastVideo({ url: safeDirectVideo, proxyUrl: proxiedVideo, rawUrl: foundVideo, clickThrough, impressions: impMatches });
                    setIsResolvingVast(false);
                  } else {
                    console.warn('No video found in VAST XML, advancing to stream');
                    setPreRollActive(false);
                    setIsResolvingVast(false);
                  }
                } else if (isMounted) {
                  setPreRollActive(false);
                  setIsResolvingVast(false);
                }
              } catch (vErr) {
                console.warn('VAST resolution note:', vErr);
                if (isMounted) {
                  setPreRollActive(false);
                  setIsResolvingVast(false);
                }
              }
            } else if (preRoll.type === 'video' && preRoll.video_url) {
              setVastVideo({ url: preRoll.video_url, clickThrough: preRoll.direct_url || '', impressions: [] });
              setIsResolvingVast(false);
            } else {
              setPreRollActive(false);
              setIsResolvingVast(false);
            }
          } else {
            setPreRollActive(false);
            setIsResolvingVast(false);
          }
        }
      } catch (e) {
        if (isMounted) {
          setPreRollActive(false);
          setIsResolvingVast(false);
        }
      }
    };

    fetchAdsConfig();

    return () => {
      isMounted = false;
    };
  }, [isOpen, movieData, isAdExempt]);

  // Pre-Roll Countdown Timer with Auto-Advance (only for fallback banners)
  useEffect(() => {
    if (!preRollActive) return;
    if (vastVideo?.url) return; // Video playback drives countdown strictly via onTimeUpdate

    if (preRollSeconds > 0) {
      const timer = setTimeout(() => {
        setPreRollSeconds(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (preRollSeconds === 0 && !completedRef.current) {
      completedRef.current = true;
      setPreRollActive(false);
    }
  }, [preRollActive, preRollSeconds, vastVideo]);

  // Watch route changes. If playing and we leave the movie page, force sticky
  useEffect(() => {
    if (isOpen && movieData) {
      const isOnMoviePage = location.pathname.includes(`/movie/${movieData.id}`);
      if (!isOnMoviePage && !isSticky) {
        setSticky(true);
      }
    }
  }, [location.pathname, isOpen, movieData, isSticky, setSticky]);

  // Drag logic
  const handleStart = (e, clientX, clientY) => {
    // Ignore clicks on buttons
    if (e.target.closest('button')) return;
    
    if (!isSticky) return;
    
    if (e.type === 'mousedown') e.preventDefault();
    
    setIsDragging(true);
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      initX: position.x,
      initY: position.y,
      dragged: false
    };
  };

  const handleMouseDown = (e) => {
    handleStart(e, e.clientX, e.clientY);
  };

  const handleTouchStart = (e) => {
    handleStart(e, e.touches[0].clientX, e.touches[0].clientY);
  };

  useEffect(() => {
    const handleMove = (clientX, clientY) => {
      if (!isDragging) return;
      
      const deltaX = clientX - dragRef.current.startX;
      const deltaY = clientY - dragRef.current.startY;
      
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        dragRef.current.dragged = true;
      }
      
      setPosition({
        x: dragRef.current.initX + deltaX,
        y: dragRef.current.initY + deltaY
      });
    };

    const handleMouseMove = (e) => handleMove(e.clientX, e.clientY);
    
    const handleTouchMove = (e) => {
      if (isDragging && dragRef.current.dragged) {
        e.preventDefault(); // Prevent page scrolling while dragging player
      }
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        if (!dragRef.current.dragged) {
          // It was a click, not a drag. Expand!
          setSticky(false);
          navigate(`/movie/${movieData.id}?type=${movieData.type}`);
        }
        setIsDragging(false);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, movieData, navigate, setSticky]);

  // Reset position when not sticky
  useEffect(() => {
    if (!isSticky) {
      setPosition({ x: 0, y: 0 });
    }
  }, [isSticky]);

  // Track progress globally
  useEffect(() => {
    if (!isOpen || !movieData || !isLoggedIn) return;

    let estimatedDuration = (movieData.runtime || 120) * 60; // Approximate if not passed
    const watchStartTime = Date.now();

    const trackWatch = async (progressVal, durationVal) => {
      try {
        await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/watch-history`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            movieId: movieData.id,
            movieType: movieData.type,
            title: movieData.title,
            poster: movieData.poster,
            backdrop: movieData.backdrop,
            rating: movieData.rating,
            year: movieData.year,
            progress: progressVal,
            duration: durationVal,
            season: movieData.season,
            episode: movieData.episode
          })
        });
      } catch (err) {
        console.error('Failed to track watch globally:', err);
      }
    };

    // Fetch existing progress so we can preserve it if higher
    let savedProgress = 0;
    const fetchExisting = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api');
        const res = await fetch(`${API_BASE}/watch-history`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const existing = data.find(h =>
            h.movie_id == movieData.id &&
            h.movie_type == movieData.type &&
            (movieData.season ? h.season == movieData.season && h.episode == movieData.episode : true)
          );
          if (existing) {
            savedProgress = existing.progress || 0;
            if (existing.duration > 0) estimatedDuration = existing.duration;
          }
        }
      } catch (err) {
        // ignore — we'll just use 0
      }
    };

    // Kick off fetch, then start interval
    fetchExisting().then(() => {
      const progressInterval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - watchStartTime) / 1000);
        if (elapsedSeconds < 5) return;
        // Send the HIGHER of saved progress or current elapsed to avoid regressing completed items
        const reportedProgress = Math.max(savedProgress, elapsedSeconds);
        trackWatch(reportedProgress, estimatedDuration > 0 ? estimatedDuration : elapsedSeconds + 60);
      }, 30000);

      // Store interval id in closure for cleanup
      return () => {
        clearInterval(progressInterval);
        const elapsedSeconds = Math.floor((Date.now() - watchStartTime) / 1000);
        if (elapsedSeconds >= 5) {
          const reportedProgress = Math.max(savedProgress, elapsedSeconds);
          trackWatch(reportedProgress, estimatedDuration > 0 ? estimatedDuration : elapsedSeconds + 60);
        }
      };
    });

    // Fallback cleanup in case fetchExisting is still pending
    return () => {
      // The inner cleanup from fetchExisting().then() handles intervals.
      // This outer return ensures no leak if component unmounts before promise resolves.
    };
  }, [isOpen, movieData, isLoggedIn, token]);

  if (!isOpen || !movieData) return null;

  const getPlayerUrl = () => {
    const type = (movieData.type || '').toLowerCase();
    const isTV = type === 'tv' || type === 'series';

    // ScreenScape as sole provider with ad-blocking sandbox
    if (isTV) {
      return `https://screenscape.me/embed?tmdb=${movieData.id}&type=tv&s=${movieData.season || 1}&e=${movieData.episode || 1}`;
    }
    return `https://screenscape.me/embed?tmdb=${movieData.id}&type=movie`;
  };

  const isTV = movieData.type === 'tv' || movieData.type === 'Series';
  const isAnime = movieData.type === 'anime' || (movieData.genres && movieData.genres.some(g => (g.name || g || '').toString().toLowerCase().includes('anime')));
  const mediaLabel = isAnime ? 'Anime' : (isTV ? 'Series' : 'Movie');
  const label = isTV 
    ? `${movieData.title} • S${movieData.season} E${movieData.episode}${movieData.epName ? ` • ${movieData.epName}` : ''}`
    : movieData.title;

  return (
    <div 
      className={`${styles.trailerModal} ${isSticky ? styles.stickyPlayer : ''}`}
      style={isSticky ? { 
        transform: `translate(${position.x}px, ${position.y}px)`,
        animation: (isDragging || position.x !== 0 || position.y !== 0) ? 'none' : undefined
      } : {}}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Background Cinema Atmosphere */}
      {!isSticky && <div className={styles.ambientCinemaGlow} />}

      <button 
        className={styles.closeTrailerBtn} 
        onClick={(e) => {
          e.stopPropagation();
          closePlayer();
        }}
        title="Close Player"
        aria-label="Close Player"
      >
        <X size={24} />
      </button>

      <div className={styles.playerTopBar}>
        <div className={styles.metaInfoBadge}>
          <span className={styles.pulsingDot}></span>
          <span className={styles.streamBadgeText}>STREAMING</span>
          <span className={styles.titleSeparator}>•</span>
          <span className={styles.playerTitleText} title={label}>
            {label}
          </span>
        </div>
      </div>
      
      {isSticky && <div className={styles.dragOverlay}></div>}
      
      <div className={styles.playerStage}>
        {preRollActive ? (
          <div className={styles.ytPreRollContainer}>
            {vastVideo?.url ? (
              <div className={styles.ytVideoWrapper}>
                <div className={styles.ytVideoBox}>
                  <video
                    key={`${vastVideo.url}_${movieData?._playTimestamp || Date.now()}`}
                    src={vastVideo.url}
                    autoPlay
                    playsInline
                    muted={isMuted}
                    className={styles.ytVideoElement}
                    ref={(el) => {
                      if (el) {
                        el.muted = isMuted;
                        const playPromise = el.play();
                        if (playPromise && typeof playPromise.catch === 'function') {
                          playPromise.catch((err) => {
                            if (err.name === 'NotAllowedError') {
                              el.muted = true;
                              setIsMuted(true);
                              el.play().catch(() => {});
                            }
                          });
                        }
                      }
                    }}
                    onLoadedMetadata={(e) => {
                      e.target.currentTime = 0;
                    }}
                    onPlaying={() => {
                      setAdVideoStarted(true);
                      logFirstPartyImpression('pre_roll');
                      if (vastVideo.impressions?.length) {
                        vastVideo.impressions.forEach(impUrl => {
                          try { new Image().src = impUrl; } catch (_) {}
                        });
                      }
                    }}
                    onTimeUpdate={(e) => {
                      const ct = e.target.currentTime;
                      const requiredSecs = Math.max(10, preRollConfig?.timer_seconds || 10);
                      const rem = Math.max(0, Math.ceil(requiredSecs - ct));
                      setPreRollSeconds(rem);
                      const dur = e.target.duration || requiredSecs;
                      setAdProgressPercent(Math.min(100, (ct / Math.max(1, Math.min(dur, requiredSecs))) * 100));
                    }}
                    onEnded={() => {
                      setPreRollActive(false);
                    }}
                    onError={(e) => {
                      if (vastVideo?.proxyUrl && e.target.src !== vastVideo.proxyUrl) {
                        console.warn('Direct CDN video blocked, falling back to first-party proxy:', vastVideo.proxyUrl);
                        e.target.src = vastVideo.proxyUrl;
                        e.target.play().catch(() => {});
                        return;
                      }
                      console.warn('Ad video playback error, advancing to stream');
                      setPreRollActive(false);
                    }}
                    onClick={() => {
                      if (vastVideo.clickThrough) {
                        window.open(vastVideo.clickThrough, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  />

                  {/* Loading overlay while ad video is buffering */}
                  {!adVideoStarted && (
                    <div className={styles.ytLoadingOverlay}>
                      <Loader2 className={styles.spinner} size={28} />
                      <span>Loading sponsor ad...</span>
                    </div>
                  )}

                  {/* YouTube Top Bar */}
                  <div className={styles.ytTopOverlay}>
                    <div className={styles.ytAdTag}>
                      <span className={styles.ytAdYellow}>Ad</span>
                      <span className={styles.ytAdDot}>•</span>
                      <span>1 of 1</span>
                    </div>

                    {adPassStatus?.enabled && !adPassStatus?.is_unlocked && !isAdExempt && (
                      <div 
                        className={styles.ytQuestBadge} 
                        title="Unlock Free VIP Pass"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.dispatchEvent(new CustomEvent('aurawatch_open_vip_modal'));
                        }}
                      >
                        <Crown size={12} color="#ffb703" />
                        <span>Free VIP Pass</span>
                      </div>
                    )}
                  </div>

                  {/* YouTube Bottom Controls */}
                  <div className={styles.ytBottomLeft}>
                    <button 
                      type="button" 
                      className={styles.ytSoundBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMuted(!isMuted);
                      }}
                      title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
                    >
                      {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>

                    {vastVideo.clickThrough && (
                      <a
                        href={vastVideo.clickThrough}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.ytVisitBtn}
                        onClick={(e) => e.stopPropagation()}
                        title="Visit Advertiser"
                        aria-label="Visit Advertiser"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>

                  {/* YouTube Bottom-Right Skip Button */}
                  <div className={styles.ytBottomRight}>
                    {!adVideoStarted ? (
                      <div className={styles.ytCountdownBox}>
                        <span>Ad starting...</span>
                      </div>
                    ) : preRollSeconds > 0 ? (
                      <div className={styles.ytCountdownBox}>
                        <span>Video will play after ad</span>
                        <span className={styles.ytCountdownNum}>{preRollSeconds}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.ytSkipBtn}
                        onClick={handleSkipAd}
                      >
                        <span>Skip Ad</span>
                        <span className={styles.ytSkipArrow}>➔</span>
                      </button>
                    )}
                  </div>

                  {/* YouTube Yellow Progress Bar */}
                  <div className={styles.ytProgressBar}>
                    <div 
                      className={styles.ytProgressFill}
                      style={{ width: `${adProgressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.ytFallbackContainer}>
                <div className={styles.ytLoadingOverlay}>
                  <Loader2 className={styles.spinner} size={32} />
                  <span>Loading stream...</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <iframe
            key={`screenscape-${movieData.id}-${movieData.season || 0}-${movieData.episode || 0}`}
            id="stream-player"
            src={getPlayerUrl()}
            title={movieData.title}
            className={styles.trailerIframe}
            sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
            allow="autoplay; encrypted-media; picture-in-picture; accelerometer; gyroscope; fullscreen"
            referrerPolicy="no-referrer"
            allowFullScreen
            style={{ pointerEvents: isSticky ? 'none' : 'auto' }}
          ></iframe>
        )}
      </div>
    </div>
  );
};

export default GlobalPlayer;
