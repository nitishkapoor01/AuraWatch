import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, Play, ExternalLink, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import AdBanner from './ads/AdBanner';
import styles from './GlobalPlayer.module.css';

const GlobalPlayer = () => {
  const { playerState, closePlayer, setSticky } = usePlayer();
  const { isOpen, isSticky, movieData } = playerState;
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, token, user } = useAuth();
  const isAdmin = user && (user.role === 'admin' || user.is_super_admin);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initX: 0, initY: 0, dragged: false });

  // Pre-Roll Ad Gateway States
  const [preRollActive, setPreRollActive] = useState(false);
  const [preRollSeconds, setPreRollSeconds] = useState(5);
  const [preRollConfig, setPreRollConfig] = useState(null);
  const [vastVideo, setVastVideo] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const activeMovieKeyRef = useRef(null);

  // Fetch Ads config and initialize Pre-Roll Gateway when opening a movie
  useEffect(() => {
    if (!isOpen || !movieData) {
      setPreRollActive(false);
      return;
    }

    const currentKey = `${movieData.id}-${movieData.season || 0}-${movieData.episode || 0}`;
    if (activeMovieKeyRef.current === currentKey) {
      return;
    }
    activeMovieKeyRef.current = currentKey;

    // Skip ads entirely for admins
    if (isAdmin) {
      setPreRollActive(false);
      return;
    }

    let isMounted = true;
    const fetchAdsConfig = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 
          (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s safeguard timeout

        const res = await fetch(`${baseUrl}/ads/config`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.skipAdsTimer) {
            setPreRollActive(false);
            return;
          }

          const preRoll = data.config?.pre_roll;
          if (data.config?.enabled && preRoll?.enabled) {
            const timerSecs = Math.max(3, preRoll.timer_seconds || 5);
            setPreRollConfig(preRoll);
            setPreRollSeconds(timerSecs);
            setPreRollActive(true);

            // Attempt to resolve VAST Video if configured
            const vastUrl = preRoll.vast_url || (preRoll.type === 'vast' ? 'https://s.magsrv.com/v1/vast.php?idz=6033014' : '');
            if (vastUrl && preRoll.type !== 'banner' && preRoll.type !== 'video') {
              try {
                let xmlText = '';
                try {
                  const vRes = await fetch(vastUrl, { signal: controller.signal });
                  if (vRes.ok) xmlText = await vRes.text();
                } catch (_) {
                  // CORS fallback via internal backend proxy
                  const proxyUrl = `${baseUrl}/ads/vast-proxy?url=${encodeURIComponent(vastUrl)}`;
                  const pRes = await fetch(proxyUrl, { signal: controller.signal });
                  if (pRes.ok) xmlText = await pRes.text();
                }

                if (xmlText && isMounted) {
                  const parser = new DOMParser();
                  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                  const mediaFiles = Array.from(xmlDoc.querySelectorAll('MediaFile'));
                  let foundVideo = '';
                  for (const mf of mediaFiles) {
                    const src = mf.textContent.trim();
                    const type = (mf.getAttribute('type') || '').toLowerCase();
                    if (src && (type.includes('mp4') || src.includes('.mp4') || !foundVideo)) {
                      foundVideo = src;
                      if (type.includes('mp4')) break;
                    }
                  }

                  const clickThrough = xmlDoc.querySelector('ClickThrough')?.textContent.trim() || '';
                  const impressions = Array.from(xmlDoc.querySelectorAll('Impression')).map(i => i.textContent.trim()).filter(Boolean);

                  if (foundVideo) {
                    setVastVideo({ url: foundVideo, clickThrough, impressions });
                  } else {
                    setVastVideo(null);
                  }
                }
              } catch (vErr) {
                console.warn('VAST resolution note:', vErr);
                if (isMounted) setVastVideo(null);
              }
            } else if (preRoll.type === 'video' && preRoll.video_url) {
              setVastVideo({ url: preRoll.video_url, clickThrough: preRoll.direct_url || '', impressions: [] });
            } else {
              setVastVideo(null);
            }
          } else {
            setPreRollActive(false);
          }
        }
      } catch (e) {
        if (isMounted) setPreRollActive(false);
      }
    };

    fetchAdsConfig();

    return () => {
      isMounted = false;
    };
  }, [isOpen, movieData, isAdmin]);

  // Pre-Roll Countdown Timer with Auto-Advance
  useEffect(() => {
    if (!preRollActive) return;

    if (preRollSeconds > 0) {
      const timer = setTimeout(() => {
        setPreRollSeconds(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Auto-start stream after 2.5s if user has not clicked skip
      const autoStartTimer = setTimeout(() => {
        setPreRollActive(false);
      }, 2500);
      return () => clearTimeout(autoStartTimer);
    }
  }, [preRollActive, preRollSeconds]);

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
          <div className={styles.preRollGateway}>
            <div className={styles.preRollCard}>
              <div className={styles.preRollHeader}>
                <div className={styles.preRollBadge}>
                  <span className={styles.preRollDot} />
                  <span>SPONSORED PRESENTATION</span>
                </div>
                <span className={styles.preRollMovieTitle}>
                  {movieData.title}
                </span>
              </div>

              {vastVideo?.url ? (
                <div className={styles.preRollVideoWrapper}>
                  <video
                    key={vastVideo.url}
                    src={vastVideo.url}
                    autoPlay
                    playsInline
                    muted={isMuted}
                    className={styles.preRollVideoElement}
                    onPlay={() => {
                      if (vastVideo.impressions?.length) {
                        vastVideo.impressions.forEach(impUrl => {
                          try { new Image().src = impUrl; } catch (_) {}
                        });
                      }
                    }}
                    onClick={() => {
                      if (vastVideo.clickThrough) {
                        window.open(vastVideo.clickThrough, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  />
                  <button 
                    type="button" 
                    className={styles.preRollMuteBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMuted(!isMuted);
                    }}
                    title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
                  >
                    {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                    <span>{isMuted ? 'Unmute' : 'Sound On'}</span>
                  </button>
                  {vastVideo.clickThrough && (
                    <a
                      href={vastVideo.clickThrough}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.preRollVideoOverlayLink}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>Visit Sponsor</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              ) : (
                <div className={styles.preRollAdArea}>
                  <AdBanner slot="pre_roll" customConfig={preRollConfig} />
                </div>
              )}

              {!vastVideo?.url && preRollConfig?.direct_url && (
                <a 
                  href={preRollConfig.direct_url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={styles.preRollDirectLink}
                >
                  <span>Special Sponsor Offer</span>
                  <ExternalLink size={13} />
                </a>
              )}

              <div className={styles.preRollFooter}>
                <div className={styles.preRollProgressBar}>
                  <div 
                    className={styles.preRollProgressFill} 
                    style={{ 
                      width: `${Math.max(0, Math.min(100, (((preRollConfig?.timer_seconds || 5) - preRollSeconds) / (preRollConfig?.timer_seconds || 5)) * 100))}%` 
                    }}
                  />
                </div>

                <div className={styles.preRollActions}>
                  <span className={styles.preRollNote}>
                    {preRollSeconds > 0 
                      ? `Stream starting in ${preRollSeconds}s...`
                      : 'Ad finished • Ready to stream!'}
                  </span>
                  <button
                    className={`${styles.preRollSkipBtn} ${preRollSeconds === 0 ? styles.preRollSkipBtnReady : ''}`}
                    disabled={preRollSeconds > 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreRollActive(false);
                    }}
                  >
                    {preRollSeconds > 0 ? (
                      `Skip in ${preRollSeconds}s`
                    ) : (
                      <>
                        <Play size={14} fill="#fff" />
                        <span>Skip Ad & Play Stream</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
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
