import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import styles from '../pages/Home.module.css';

const ContinueWatchingRow = ({ compact = false }) => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const rowRef = useRef(null);
  const sentinelRef = useRef(null);
  const { isLoggedIn, token } = useAuth();

  // Only start loading when row scrolls into viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '2000px' } 
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || !isLoggedIn) return;
    
    const fetchHistory = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api');
        const res = await fetch(`${API_BASE}/watch-history`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          // Backend should handle duplicate elimination. Limit to recent 15
          setMovies(data.slice(0, 15));
        }
      } catch (err) {
        console.error('Failed to fetch watch history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [isVisible, isLoggedIn, token]);

  const checkScrollable = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    checkScrollable();
    el.addEventListener('scroll', checkScrollable, { passive: true });
    window.addEventListener('resize', checkScrollable);
    return () => {
      el.removeEventListener('scroll', checkScrollable);
      window.removeEventListener('resize', checkScrollable);
    };
  }, [movies, checkScrollable]);

  const scroll = (dir) => {
    const el = rowRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === 'right' ? scrollAmount : -scrollAmount, behavior: 'smooth' });
  };

  if (!isLoggedIn) return null;

  if (loading) {
    return (
      <section className={styles.section} ref={sentinelRef}>
        <div className={styles.sectionHeader}><div className="skeleton" style={{ width: '150px', height: '18px' }}></div></div>
        <div className={`${styles.movieGrid} movieGrid`}>
          {[...Array(6)].map((_, i) => <div key={i} className={`skeleton ${styles.cardContainer} cardContainer`}></div>)}
        </div>
      </section>
    );
  }

  if (!movies || movies.length === 0) return null;

  return (
    <section className={styles.section} ref={sentinelRef}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Continue Watching</h2>
      </div>

      <div className={styles.rowWrapper}>
        {canScrollLeft && (
          <button className={`${styles.scrollBtn} ${styles.scrollBtnLeft} scrollBtn`} onClick={() => scroll('left')}><ChevronLeft size={24} /></button>
        )}

        <div className={`${styles.movieGrid} movieGrid`} ref={rowRef}>
          {movies.map((movie, idx) => {
            const isTV = movie.movie_type !== 'movie';
            const playUrl = `/movie/${movie.movie_id}?type=${movie.movie_type}&play=true${isTV && movie.season ? `&s=${movie.season}&e=${movie.episode}` : ''}`;
            
            const progressPercent = movie.duration ? Math.min(100, Math.max(0, (movie.progress / movie.duration) * 100)) : 0;

            return (
              <Link 
                to={playUrl}
                key={`${movie.movie_id}-${idx}`} 
                className={`${styles.cardContainer} cardContainer`}
                style={{
                  flex: compact ? '0 0 calc(20% - 8px)' : undefined,
                  aspectRatio: compact ? '16 / 9' : '2 / 3',
                  height: compact ? 'auto' : undefined,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <img src={movie.poster || movie.backdrop} alt={movie.title} className={styles.cardImage} loading="lazy" referrerPolicy="no-referrer" />
                
                {/* Overlay for Continue Watching */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.4), transparent)',
                  padding: '12px 10px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  zIndex: 2
                }}>
                  <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {movie.title}
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#ccc', fontSize: '12px' }}>
                      {isTV && movie.season ? `S${movie.season} E${movie.episode}` : 'Movie'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#e50914', fontSize: '12px', fontWeight: 'bold' }}>
                      <Play size={12} fill="#e50914" /> Resume
                    </span>
                  </div>
                  {/* Progress bar line */}
                  {progressPercent > 0 && (
                    <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.3)', marginTop: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${progressPercent}%`, height: '100%', background: '#e50914' }}></div>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {canScrollRight && (
          <button className={`${styles.scrollBtn} ${styles.scrollBtnRight} scrollBtn`} onClick={() => scroll('right')}><ChevronRight size={24} /></button>
        )}
      </div>
    </section>
  );
};

export default ContinueWatchingRow;
