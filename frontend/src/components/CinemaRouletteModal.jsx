import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, Play, RotateCw, Star, Film, Tv, Sparkles, 
  Flame, Award, Clapperboard, Dices, FolderPlus, Compass
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useToast } from '../context/ToastContext';
import PlaylistModal from './PlaylistModal';
import styles from './CinemaRouletteModal.module.css';

const CATEGORIES = [
  { id: 'all', label: 'All Catalog', icon: Sparkles },
  { id: 'trending', label: 'Trending', icon: Flame },
  { id: 'movie', label: 'Movies', icon: Film },
  { id: 'tv', label: 'TV Series', icon: Tv },
  { id: 'action', label: 'Action', icon: Compass },
  { id: 'scifi', label: 'Sci-Fi', icon: Sparkles },
  { id: 'horror', label: 'Horror', icon: Flame },
  { id: 'anime', label: 'Anime', icon: Sparkles },
  { id: 'top_rated', label: 'Top Rated', icon: Award }
];

const CinemaRouletteModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { openPlayer } = usePlayer();
  const { showToast } = useToast();

  const [activeCategory, setActiveCategory] = useState('all');
  const [moviePool, setMoviePool] = useState([]);
  const [currentMovie, setCurrentMovie] = useState(null);
  const [state, setState] = useState('idle'); // 'idle' | 'spinning' | 'revealed'
  const [isPoolLoading, setIsPoolLoading] = useState(false);

  // Trailer Peek
  const [showTrailer, setShowTrailer] = useState(false);
  const [trailerKey, setTrailerKey] = useState(null);
  const [loadingTrailer, setLoadingTrailer] = useState(false);

  // Playlist Modal
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  const spinTimerRef = useRef(null);
  const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' 
    ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` 
    : 'https://aurawatch-1.onrender.com/api');

  // Load pool whenever category changes or modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsPoolLoading(true);

    const loadPool = async () => {
      try {
        const randomPage = Math.floor(Math.random() * 4) + 1;
        let endpoint;

        if (activeCategory === 'trending') {
          endpoint = `${baseUrl}/movies/trending`;
        } else if (activeCategory === 'movie') {
          endpoint = `${baseUrl}/movies/discover?type=movie&page=${randomPage}`;
        } else if (activeCategory === 'tv') {
          endpoint = `${baseUrl}/movies/discover?type=tv&page=${randomPage}`;
        } else if (activeCategory === 'action') {
          endpoint = `${baseUrl}/movies/discover?type=movie&genre=28&page=${randomPage}`;
        } else if (activeCategory === 'scifi') {
          endpoint = `${baseUrl}/movies/discover?type=movie&genre=878&page=${randomPage}`;
        } else if (activeCategory === 'horror') {
          endpoint = `${baseUrl}/movies/discover?type=movie&genre=27&page=${randomPage}`;
        } else if (activeCategory === 'anime') {
          endpoint = `${baseUrl}/movies/discover?type=tv&lang=anime&page=${randomPage}`;
        } else if (activeCategory === 'top_rated') {
          endpoint = `${baseUrl}/movies/top-rated?page=${randomPage}`;
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
          }
          setIsPoolLoading(false);
        }
      } catch (err) {
        console.error('Failed to load roulette pool:', err);
        if (isMounted) setIsPoolLoading(false);
      }
    };

    loadPool();

    return () => {
      isMounted = false;
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    };
  }, [isOpen, activeCategory]);

  // Reset states on modal close/open
  useEffect(() => {
    if (isOpen) {
      setState('idle');
      setShowTrailer(false);
      setTrailerKey(null);
    }
  }, [isOpen]);

  // Keyboard shortcut: Space / Enter to spin, Esc to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showTrailer) setShowTrailer(false);
        else onClose();
      } else if ((e.key === ' ' || e.key === 'Enter') && !showPlaylistModal) {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          if (state !== 'spinning') triggerSpin();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, state, moviePool, showTrailer, showPlaylistModal]);

  // The Suspenseful Spin Animation
  const triggerSpin = (overridePool = null) => {
    const pool = overridePool || moviePool;
    if (pool.length === 0) {
      showToast('Loading catalog titles, please wait...', 'info');
      return;
    }

    setState('spinning');
    setShowTrailer(false);
    setTrailerKey(null);

    let tick = 0;
    const totalTicks = 12;
    let delay = 50; // starts fast

    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);

    const step = () => {
      tick++;
      const candidate = pool[Math.floor(Math.random() * pool.length)];
      setCurrentMovie(candidate);

      if (tick > 7) {
        delay += 35; // smooth deceleration
      }

      if (tick >= totalTicks) {
        // Final pick
        const finalPick = pool[Math.floor(Math.random() * pool.length)];
        setCurrentMovie(finalPick);
        setState('revealed');
      } else {
        spinTimerRef.current = setTimeout(step, delay);
      }
    };

    step();
  };

  // Instant Stream
  const handleWatchNow = () => {
    if (!currentMovie) return;
    const movieType = currentMovie.type === 'Series' || currentMovie.type === 'tv' ? 'tv' : 'movie';
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

  // Peek Trailer
  const handleToggleTrailer = async () => {
    if (showTrailer) {
      setShowTrailer(false);
      return;
    }

    if (trailerKey) {
      setShowTrailer(true);
      return;
    }

    if (!currentMovie) return;

    setLoadingTrailer(true);
    try {
      const type = currentMovie.type === 'Series' || currentMovie.type === 'tv' ? 'tv' : 'movie';
      const res = await fetch(`${baseUrl}/movies/${currentMovie.id}/videos?type=${type}`);
      if (res.ok) {
        const data = await res.json();
        if (data.key) {
          setTrailerKey(data.key);
          setShowTrailer(true);
        } else {
          showToast('No trailer preview available for this title.', 'info');
        }
      } else {
        showToast('Trailer unavailable.', 'info');
      }
    } catch (_) {
      showToast('Could not load trailer.', 'error');
    } finally {
      setLoadingTrailer(false);
    }
  };

  if (!isOpen) return null;

  const movieType = currentMovie?.type === 'Series' || currentMovie?.type === 'tv' ? 'tv' : 'movie';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleBadge}>
            <Dices size={15} />
            <span>Cinema Roulette</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close Roulette">
            <X size={16} />
          </button>
        </div>

        {/* Minimal Category Selector */}
        <div className={styles.categoryBar}>
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                className={`${styles.categoryPill} ${isActive ? styles.categoryPillActive : ''}`}
                onClick={() => {
                  if (activeCategory !== cat.id) {
                    setActiveCategory(cat.id);
                  } else if (state !== 'spinning') {
                    triggerSpin();
                  }
                }}
                disabled={state === 'spinning'}
              >
                <Icon size={12} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Area */}
        <div className={styles.bodyArea}>
          {/* STATE 1: IDLE / READY */}
          {state === 'idle' && (
            <>
              <div className={styles.mysteryCard}>
                <div className={styles.mysteryGlowRing} />
                <div className={styles.mysteryIconWrap}>
                  <Dices size={28} />
                </div>
                <h3 className={styles.mysteryTitle}>Don't know what to watch?</h3>
                <p className={styles.mysterySub}>
                  Spin the roulette to let the vault pick tonight's movie.
                </p>
              </div>

              <div className={styles.actionsArea}>
                <button
                  className={styles.primaryBtn}
                  onClick={() => triggerSpin()}
                  disabled={isPoolLoading}
                >
                  <Dices size={17} />
                  <span>{isPoolLoading ? 'Loading Vault...' : 'Spin Roulette'}</span>
                </button>
              </div>
            </>
          )}

          {/* STATE 2: ACTIVE SPINNING REEL */}
          {state === 'spinning' && (
            <>
              <div className={styles.spinningContainer}>
                {currentMovie?.backdrop && (
                  <img
                    src={currentMovie.backdrop || currentMovie.poster}
                    alt="Spin Reel"
                    className={styles.spinningBackdrop}
                  />
                )}
                <div className={styles.spinningScanline} />
                <div className={styles.spinningOverlay}>
                  <RotateCw size={26} color="#ff3844" className="spin" />
                  <span className={styles.spinningText}>Rolling the Vault...</span>
                </div>
              </div>

              <div className={styles.actionsArea}>
                <button className={styles.primaryBtn} disabled>
                  <RotateCw size={17} className="spin" />
                  <span>Scanning Titles...</span>
                </button>
              </div>
            </>
          )}

          {/* STATE 3: REVEALED JACKPOT CARD */}
          {state === 'revealed' && currentMovie && (
            <div className={styles.revealedCard}>
              {/* Media Frame (Backdrop OR Trailer Embed) */}
              <div className={styles.mediaFrame}>
                {showTrailer && trailerKey ? (
                  <iframe
                    className={styles.trailerIframe}
                    src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0&modestbranding=1`}
                    title={`${currentMovie.title} Trailer`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <>
                    <img
                      src={currentMovie.backdrop || currentMovie.poster}
                      alt={currentMovie.title}
                      className={styles.backdropImg}
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.target.src = 'https://picsum.photos/id/20/1200/500'; }}
                    />
                    <div className={styles.mediaMetaBadge}>
                      <span>{movieType === 'tv' ? 'Series' : 'Movie'}</span>
                      {currentMovie.year && <span>• {currentMovie.year}</span>}
                    </div>
                    <div className={styles.matchBadge}>
                      98% MATCH
                    </div>
                  </>
                )}
              </div>

              {/* Title & Info */}
              <div className={styles.infoSection}>
                <div className={styles.titleRow}>
                  <h3 className={styles.movieTitle}>{currentMovie.title}</h3>
                  <div className={styles.metaChips}>
                    {currentMovie.rating && currentMovie.rating !== 'N/A' && (
                      <span className={`${styles.chip} ${styles.ratingChip}`}>
                        <Star size={11} fill="#f5c518" />
                        <span>{currentMovie.rating}</span>
                      </span>
                    )}
                    <span className={styles.chip}>HD</span>
                  </div>
                </div>

                <p className={styles.overviewText}>
                  {currentMovie.overview || 'Tonight’s mystery feature selected by Cinema Roulette.'}
                </p>
              </div>

              {/* Actions Area */}
              <div className={styles.actionsArea}>
                <button className={styles.primaryBtn} onClick={handleWatchNow}>
                  <Play size={16} fill="#fff" />
                  <span>Watch Now</span>
                </button>

                <div className={styles.secondaryRow}>
                  <button
                    className={`${styles.secondaryBtn} ${showTrailer ? styles.secondaryBtnActive : ''}`}
                    onClick={handleToggleTrailer}
                    disabled={loadingTrailer}
                  >
                    <Clapperboard size={14} />
                    <span>{loadingTrailer ? 'Loading...' : showTrailer ? 'Close Trailer' : 'Trailer'}</span>
                  </button>

                  <button
                    className={styles.secondaryBtn}
                    onClick={() => setShowPlaylistModal(true)}
                  >
                    <FolderPlus size={14} />
                    <span>Playlist</span>
                  </button>

                  <button
                    className={styles.secondaryBtn}
                    onClick={() => triggerSpin()}
                  >
                    <RotateCw size={14} />
                    <span>Re-roll</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Custom Playlist / Watchlist Modal */}
        {currentMovie && (
          <PlaylistModal
            isOpen={showPlaylistModal}
            onClose={() => setShowPlaylistModal(false)}
            movie={{
              id: currentMovie.id,
              type: movieType,
              title: currentMovie.title,
              poster: currentMovie.poster,
              backdrop: currentMovie.backdrop,
              overview: currentMovie.overview,
              rating: currentMovie.rating,
              year: currentMovie.year
            }}
          />
        )}
      </div>
    </div>
  );
};

export default CinemaRouletteModal;
