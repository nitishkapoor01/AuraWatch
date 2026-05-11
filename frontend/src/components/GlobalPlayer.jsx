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
            poster: movieData.poster, // Pass these in openPlayer!
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

    const progressInterval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - watchStartTime) / 1000);
      if (elapsedSeconds < 5) return;
      trackWatch(elapsedSeconds, estimatedDuration > 0 ? estimatedDuration : elapsedSeconds + 60);
    }, 30000);

    return () => {
      clearInterval(progressInterval);
      const elapsedSeconds = Math.floor((Date.now() - watchStartTime) / 1000);
      if (elapsedSeconds >= 5) {
        trackWatch(elapsedSeconds, estimatedDuration > 0 ? estimatedDuration : elapsedSeconds + 60);
      }
    };
  }, [isOpen, movieData, isLoggedIn, token]);

  if (!isOpen || !movieData) return null;

  const getPlayerUrl = () => {
    const type = (movieData.type || '').toLowerCase();
    const isTV = type === 'tv' || type === 'series';
    
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
      <div className={styles.playerEpLabel}>
        {label}
      </div>
      
      {isSticky && <div className={styles.dragOverlay}></div>}
      
      <iframe
        id="screenscape-player"
        src={getPlayerUrl()}
        title={movieData.title}
        className={styles.trailerIframe}
        allow="autoplay; encrypted-media; fullscreen"
        referrerPolicy="no-referrer"
        allowFullScreen
        style={{ pointerEvents: isSticky ? 'none' : 'auto' }}
      ></iframe>

      <button 
        className={styles.closeTrailerBtn} 
        onClick={(e) => {
          e.stopPropagation();
          closePlayer();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        title="Close Player"
      >
        <X size={28} />
      </button>
    </div>
  );
};

export default GlobalPlayer;
