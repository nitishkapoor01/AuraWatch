import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, Dices, Play, Info, RotateCw, Star, Film, Tv, Sparkles, 
  Bookmark, Check, Flame, Award 
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import styles from './CinemaRouletteModal.module.css';

const CATEGORIES = [
  { id: 'all', label: 'All Catalog', icon: Flame },
  { id: 'movie', label: 'Movies', icon: Film },
  { id: 'tv', label: 'TV Series', icon: Tv },
  { id: 'anime', label: 'Anime', icon: Sparkles },
  { id: 'top_rated', label: 'Top Rated', icon: Award }
];

const CinemaRouletteModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { openPlayer } = usePlayer();
  const { isLoggedIn, token } = useAuth();
  const { showToast } = useToast();

  const [activeCategory, setActiveCategory] = useState('all');
  const [moviePool, setMoviePool] = useState([]);
  const [currentMovie, setCurrentMovie] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const spinIntervalRef = useRef(null);
  const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' 
    ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` 
    : 'https://aurawatch-1.onrender.com/api');

  // Load pool when category changes or modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    const fetchPool = async () => {
      try {
        const randomPage = Math.floor(Math.random() * 6) + 1;
        let endpoint;

        if (activeCategory === 'movie') {
          endpoint = `${baseUrl}/movies/discover?type=movie&page=${randomPage}`;
        } else if (activeCategory === 'tv') {
          endpoint = `${baseUrl}/movies/discover?type=tv&page=${randomPage}`;
        } else if (activeCategory === 'anime') {
          endpoint = `${baseUrl}/movies/discover?type=tv&lang=anime&page=${randomPage}`;
        } else if (activeCategory === 'top_rated') {
          endpoint = `${baseUrl}/movies/discover?type=movie&sort=top_rated&page=${randomPage}`;
        } else {
          // All Catalog
          const type = Math.random() > 0.5 ? 'movie' : 'tv';
          endpoint = `${baseUrl}/movies/discover?type=${type}&page=${randomPage}`;
        }

        const res = await fetch(endpoint);
        const data = await res.json();
        const list = Array.isArray(data) ? data.filter(m => m.poster || m.backdrop) : [];

        if (isMounted) {
          if (list.length > 0) {
            setMoviePool(list);
            // Auto-trigger a spin on fresh category or open
            triggerSpinReel(list);
          } else {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Failed to load roulette pool:', err);
        if (isMounted) setLoading(false);
      }
    };

    fetchPool();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if ((e.key === ' ' || e.key === 'r' || e.key === 'R') && !isSpinning) {
        e.preventDefault();
        triggerSpinReel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMounted = false;
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, activeCategory]);

  // Check if current picked movie is in favorites
  useEffect(() => {
    if (!isLoggedIn || !currentMovie?.id || !token) return;

    const checkFav = async () => {
      try {
        const type = currentMovie.type === 'Series' || currentMovie.type === 'tv' ? 'tv' : 'movie';
        const res = await fetch(`${baseUrl}/favorites/check/${currentMovie.id}?type=${type}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setIsSaved(Boolean(data.isFavorite));
        }
      } catch (_) {}
    };

    checkFav();
  }, [currentMovie?.id, isLoggedIn, token]);

  // The thrilling slot-reel spin animation
  const triggerSpinReel = (poolToUse = moviePool) => {
    const pool = poolToUse.length > 0 ? poolToUse : moviePool;
    if (pool.length === 0) return;

    setIsSpinning(true);
    setLoading(false);
    setIsSaved(false);

    let counter = 0;
    const totalFlips = 14; // Number of poster flips before stopping
    const duration = 1200; // 1.2s total duration
    const speed = duration / totalFlips;

    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);

    spinIntervalRef.current = setInterval(() => {
      counter++;
      const randomCandidate = pool[Math.floor(Math.random() * pool.length)];
      setCurrentMovie(randomCandidate);

      if (counter >= totalFlips) {
        clearInterval(spinIntervalRef.current);
        // Land on the final selected title
        const finalPick = pool[Math.floor(Math.random() * pool.length)];
        setCurrentMovie(finalPick);
        setIsSpinning(false);
      }
    }, speed);
  };

  if (!isOpen) return null;

  const movieType = currentMovie?.type === 'Series' || currentMovie?.type === 'tv' ? 'tv' : 'movie';

  // Watch Now directly in GlobalPlayer
  const handleWatchNow = () => {
    if (!currentMovie) return;
    openPlayer({
      id: currentMovie.id,
      type: movieType,
      title: currentMovie.title,
      poster: currentMovie.poster,
      backdrop: currentMovie.backdrop,
      rating: currentMovie.rating,
      year: currentMovie.year,
      runtime: currentMovie.runtime
    });
    onClose();
  };

  // View Details
  const handleViewDetails = () => {
    if (!currentMovie) return;
    navigate(`/movie/${currentMovie.id}?type=${movieType}`);
    onClose();
  };

  // Toggle Save to Watchlist
  const handleToggleSave = async () => {
    if (!isLoggedIn) {
      showToast('Please sign in to save titles to your watchlist.', 'info');
      navigate('/login');
      onClose();
      return;
    }

    const nextState = !isSaved;
    setIsSaved(nextState);

    try {
      if (nextState) {
        await fetch(`${baseUrl}/favorites`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            movieId: currentMovie.id,
            movieType,
            title: currentMovie.title,
            poster: currentMovie.poster,
            backdrop: currentMovie.backdrop,
            overview: currentMovie.overview,
            rating: currentMovie.rating,
            year: currentMovie.year
          })
        });
        showToast(`Saved "${currentMovie.title}" to Watchlist!`, 'success');
      } else {
        await fetch(`${baseUrl}/favorites/${currentMovie.id}?type=${movieType}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        showToast('Removed from Watchlist.', 'info');
      }
    } catch (_) {
      setIsSaved(!nextState);
      showToast('Failed to update Watchlist.', 'error');
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleBadge}>
            <Dices size={18} />
            <span>Cinema Roulette</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close Roulette">
            <X size={18} />
          </button>
        </div>

        {/* Category Pills */}
        <div className={styles.categoryBar}>
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                className={`${styles.categoryPill} ${activeCategory === cat.id ? styles.categoryPillActive : ''}`}
                onClick={() => {
                  if (activeCategory !== cat.id) {
                    setActiveCategory(cat.id);
                  } else {
                    triggerSpinReel();
                  }
                }}
                disabled={isSpinning}
              >
                <Icon size={14} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className={styles.contentArea}>
          {loading || !currentMovie ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '340px' }}>
              <div className={styles.skeletonCard} style={{ maxWidth: '300px', height: '300px' }} />
            </div>
          ) : (
            <>
              {/* Left Poster Reel */}
              <div className={`${styles.posterContainer} ${isSpinning ? styles.spinningGlow : ''}`}>
                <img
                  src={currentMovie.poster || currentMovie.backdrop}
                  alt={currentMovie.title}
                  className={styles.posterImage}
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.target.src = 'https://picsum.photos/id/10/300/450'; }}
                />

                {isSpinning && (
                  <div className={styles.posterOverlayDice}>
                    <div className={styles.diceIconPulse}>
                      <Dices size={48} color="#e50914" />
                    </div>
                  </div>
                )}
              </div>

              {/* Right Details */}
              <div className={styles.detailsContainer}>
                <div>
                  <div className={styles.topMetaRow}>
                    <span className={`${styles.metaBadge} ${styles.typeBadge}`}>
                      {movieType === 'tv' ? 'Series' : 'Movie'}
                    </span>
                    {currentMovie.year && (
                      <span className={styles.metaBadge}>{currentMovie.year}</span>
                    )}
                    {currentMovie.rating && currentMovie.rating !== 'N/A' && (
                      <span className={`${styles.metaBadge} ${styles.ratingBadge}`}>
                        <Star size={13} fill="#f5c518" />
                        <span>{currentMovie.rating}</span>
                      </span>
                    )}
                  </div>

                  <h2 className={styles.title}>{currentMovie.title}</h2>

                  {/* Genre tags if available */}
                  <div className={styles.genreTags}>
                    <span className={styles.genreTag}>
                      {activeCategory === 'anime' ? 'Anime' : activeCategory === 'tv' ? 'Television' : 'Cinema'}
                    </span>
                    {currentMovie.quality && (
                      <span className={styles.genreTag}>{currentMovie.quality}</span>
                    )}
                  </div>

                  <p className={styles.overview}>
                    {currentMovie.overview || 'An exciting title discovered through Cinema Roulette. Click Watch Now to start streaming immediately or spin again!'}
                  </p>
                </div>

                {/* Actions Bar */}
                <div className={styles.actionsBar}>
                  <button 
                    className={styles.watchNowBtn}
                    onClick={handleWatchNow}
                    disabled={isSpinning}
                  >
                    <Play size={18} fill="#fff" />
                    <span>Watch Now</span>
                  </button>

                  <button 
                    className={styles.secondaryBtn}
                    onClick={handleViewDetails}
                    disabled={isSpinning}
                  >
                    <Info size={16} />
                    <span>View Details</span>
                  </button>

                  <button 
                    className={styles.spinAgainBtn}
                    onClick={() => triggerSpinReel()}
                    disabled={isSpinning}
                    title="Press Space or R to re-spin"
                  >
                    <RotateCw size={16} className={isSpinning ? 'spin' : ''} />
                    <span>Spin Again</span>
                  </button>

                  <button
                    className={styles.secondaryBtn}
                    onClick={handleToggleSave}
                    disabled={isSpinning}
                    title={isSaved ? 'In Watchlist' : 'Save to Watchlist'}
                  >
                    {isSaved ? <Check size={16} color="#e50914" /> : <Bookmark size={16} />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CinemaRouletteModal;
