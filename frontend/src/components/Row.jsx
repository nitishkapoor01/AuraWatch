import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchWithCache } from '../utils/api';
import styles from '../pages/Home.module.css';

const Row = ({ title, endpoint, compact = false }) => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const rowRef = useRef(null);
  const sentinelRef = useRef(null);

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
      { rootMargin: '2000px' } // Start loading 2000px before visible to preload
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const fetchRowData = async () => {
      try {
        let latestPage1 = [];
        let latestPage2 = [];

        const updateMovies = (p1, p2) => {
          let merged = [];
          if (Array.isArray(p1)) merged = [...p1];
          if (Array.isArray(p2)) {
            const seen = new Set(merged.map(m => m.id));
            const newMovies = p2.filter(m => !seen.has(m.id));
            merged = [...merged, ...newMovies];
          }
          if (merged.length > 0) {
            setMovies(merged);
            setLoading(false);
          }
        };

        const onRevalidatePage1 = (data) => {
          latestPage1 = Array.isArray(data) ? data : [];
          updateMovies(latestPage1, latestPage2);
        };
        
        const onRevalidatePage2 = (data) => {
          latestPage2 = Array.isArray(data) ? data : [];
          updateMovies(latestPage1, latestPage2);
        };

        const sep = endpoint.includes('?') ? '&' : '?';
        const p1Promise = fetchWithCache(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/movies/${endpoint}`, onRevalidatePage1);
        const p2Promise = fetchWithCache(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/movies/${endpoint}${sep}page=2`, onRevalidatePage2);
        
        const [page1, page2] = await Promise.all([p1Promise, p2Promise]);
        
        latestPage1 = Array.isArray(page1) ? page1 : [];
        latestPage2 = Array.isArray(page2) ? page2 : [];
        updateMovies(latestPage1, latestPage2);

      } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
      } finally {
        setLoading(false);
      }
    };
    fetchRowData();
  }, [endpoint, isVisible]);

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



  if (loading) {
    return (
      <section className={styles.section} ref={sentinelRef}>
        <div className={styles.sectionHeader}><div className="skeleton" style={{ width: '150px', height: '18px' }}></div></div>
        <div className={styles.movieGrid}>
          {[...Array(8)].map((_, i) => <div key={i} className={`skeleton ${styles.cardContainer}`}></div>)}
        </div>
      </section>
    );
  }

  if (!movies || movies.length === 0) return null;

  return (
    <section className={styles.section} ref={sentinelRef}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{title}</h2>
      </div>

      <div className={styles.rowWrapper}>
        {canScrollLeft && (
          <button className={`${styles.scrollBtn} ${styles.scrollBtnLeft}`} onClick={() => scroll('left')}><ChevronLeft size={24} /></button>
        )}

        <div className={styles.movieGrid} ref={rowRef}>
          {movies.map((movie, idx) => (
            <Link 
              to={`/movie/${movie.id}?type=${movie.type ? movie.type.toLowerCase() : 'movie'}`}
              key={`${movie.id}-${idx}`} 
              className={styles.cardContainer}
              style={{
                flex: compact ? '0 0 calc(20% - 8px)' : undefined,
                aspectRatio: compact ? '16 / 9' : '2 / 3',
                height: compact ? 'auto' : undefined
              }}
            >
              <img src={movie.poster} alt={movie.title} className={styles.cardImage} loading="lazy" referrerPolicy="no-referrer" />
              <div className={styles.cardOverlay}>
                <span className={styles.cardTitle}>{movie.title}</span>
              </div>
            </Link>
          ))}
        </div>

        {canScrollRight && (
          <button className={`${styles.scrollBtn} ${styles.scrollBtnRight}`} onClick={() => scroll('right')}><ChevronRight size={24} /></button>
        )}
      </div>
    </section>
  );
};

export default Row;
