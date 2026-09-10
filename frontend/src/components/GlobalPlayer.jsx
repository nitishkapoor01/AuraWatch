import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import styles from './GlobalPlayer.module.css';

const GlobalPlayer = () => {
  const { playerState, closePlayer, setSticky } = usePlayer();
  const { isOpen, isSticky, movieData } = playerState;
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, token } = useAuth();

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initX: 0, initY: 0, dragged: false });

  const [selectedServer, setSelectedServer] = useState(() => {
    return localStorage.getItem('aurawatch_player_server') || 'filmu';
  });
  const [isSwitching, setIsSwitching] = useState(false);

  const handleServerChange = (serverId) => {
    if (serverId === selectedServer) return;
    setIsSwitching(true);
    setSelectedServer(serverId);
    localStorage.setItem('aurawatch_player_server', serverId);
    setTimeout(() => {
      setIsSwitching(false);
    }, 400);
  };

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
    const isAnime = type === 'anime' || (movieData.genres && movieData.genres.some(g => g.name?.toLowerCase().includes('animation')));

    if (selectedServer === 'filmu') {
      if (isAnime && movieData.season && movieData.episode) {
        return `https://embed.filmu.in/anime/${movieData.id}/${movieData.season}/${movieData.episode}`;
      }
      if (isTV) {
        return `https://embed.filmu.in/tv/${movieData.id}/${movieData.season || 1}/${movieData.episode || 1}`;
      }
      return `https://embed.filmu.in/movie/${movieData.id}`;
    }

    // Default / Screenscape
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
        
        <div className={styles.playerSwitchDeck}>
          <button
            type="button"
            className={`${styles.streamOptionBtn} ${selectedServer === 'filmu' ? styles.activeOption : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              handleServerChange('filmu');
            }}
            title="Player 1"
          >
            <span className={styles.optionIconWrap}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </span>
            <span className={styles.optionMain}>Player 1</span>
          </button>

          <button
            type="button"
            className={`${styles.streamOptionBtn} ${selectedServer === 'screenscape' ? styles.activeOption : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              handleServerChange('screenscape');
            }}
            title="Player 2"
          >
            <span className={styles.optionIconWrap}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </span>
            <span className={styles.optionMain}>Player 2</span>
          </button>
        </div>
      </div>
      
      {isSticky && <div className={styles.dragOverlay}></div>}
      
      <div className={styles.playerStage}>
        {isSwitching && (
          <div className={styles.switchOverlay}>
            <div className={styles.switchSpinner}></div>
            <span>Connecting to {selectedServer === 'filmu' ? 'Player 1' : 'Player 2'}...</span>
          </div>
        )}
        <iframe
          key={`${selectedServer}-${movieData.id}-${movieData.season || 0}-${movieData.episode || 0}`}
          id="stream-player"
          src={getPlayerUrl()}
          title={movieData.title}
          className={`${styles.trailerIframe} ${isSwitching ? styles.frameFading : ''}`}
          allow="autoplay; encrypted-media; picture-in-picture; accelerometer; gyroscope; fullscreen"
          referrerPolicy="no-referrer"
          allowFullScreen
          style={{ pointerEvents: isSticky ? 'none' : 'auto' }}
        ></iframe>
      </div>
    </div>
  );
};

export default GlobalPlayer;
