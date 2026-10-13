import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, Play, RotateCw, Star, Film, Tv, Sparkles, 
  Flame, Award, Clapperboard, Dices, FolderPlus, Compass
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useToast } from '../context/ToastContext';
import { fetchWithCache } from '../utils/api';
import PlaylistModal from './PlaylistModal';
import styles from './CinemaRouletteModal.module.css';

// 100% Verified Real TMDB Movie Pool (Instant Zero-Network Fallback)
const CURATED_SEED_POOL = [
  {
    id: 157336,
    title: "Interstellar",
    poster: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/rAiYTua5hvDQHQBMX67mHGeZqEg.jpg",
    type: "Movie",
    rating: "8.4",
    year: "2014",
    overview: "The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel."
  },
  {
    id: 27205,
    title: "Inception",
    poster: "https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg",
    type: "Movie",
    rating: "8.4",
    year: "2010",
    overview: "A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea."
  },
  {
    id: 155,
    title: "The Dark Knight",
    poster: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/dqK9Hag1054tghRQSqLSfrkvQnA.jpg",
    type: "Movie",
    rating: "8.5",
    year: "2008",
    overview: "Batman raises the stakes in his war on crime with the help of allies Jim Gordon and Harvey Dent to dismantle the mob."
  },
  {
    id: 693134,
    title: "Dune: Part Two",
    poster: "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s520b4q.jpg",
    type: "Movie",
    rating: "8.2",
    year: "2024",
    overview: "Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen on a warpath of revenge."
  },
  {
    id: 872585,
    title: "Oppenheimer",
    poster: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg",
    type: "Movie",
    rating: "8.1",
    year: "2023",
    overview: "The story of J. Robert Oppenheimer's role in the development of the atomic bomb during World War II."
  },
  {
    id: 129,
    title: "Spirited Away",
    poster: "https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/mSDsSDwaP3E7dEfUPWy4J0djt4O.jpg",
    type: "Movie",
    rating: "8.5",
    year: "2001",
    overview: "A young girl becomes trapped in a strange world of spirits and must find the courage to free her family."
  },
  {
    id: 94605,
    title: "Arcane",
    poster: "https://image.tmdb.org/t/p/w500/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/2meX1nMdScFOoV4370rqHWFDxZf.jpg",
    type: "Series",
    rating: "8.7",
    year: "2021",
    overview: "Amid the stark discord of twin cities Piltover and Zaun, two sisters fight on rival sides of a war between magic technologies."
  },
  {
    id: 66732,
    title: "Stranger Things",
    poster: "https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/56v2KjBlU4XaOv9rVYEQypROD7P.jpg",
    type: "Series",
    rating: "8.6",
    year: "2016",
    overview: "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl."
  },
  {
    id: 93405,
    title: "Squid Game",
    poster: "https://image.tmdb.org/t/p/w500/dDlG1v7iZvdv8i9s02rUuS8G2xW.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/oaGvjB0DvdurWhf9N9AuHGq21gw.jpg",
    type: "Series",
    rating: "7.8",
    year: "2021",
    overview: "Hundreds of cash-strapped players accept a strange invitation to compete in children's games with deadly high stakes."
  }
];

// Helper to scrape existing cached movies from localStorage
const getLocalCachedPool = () => {
  try {
    const collected = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('aurawatch_') && key.includes('/movies/')) {
        const itemStr = localStorage.getItem(key);
        if (itemStr) {
          const parsed = JSON.parse(itemStr);
          const list = parsed.data || parsed;
          if (Array.isArray(list)) {
            list.forEach(m => {
              if (m && m.id && (m.poster || m.backdrop)) collected.push(m);
            });
          }
        }
      }
    }
    if (collected.length >= 5) {
      // Deduplicate by ID
      const map = new Map();
      collected.forEach(m => map.set(m.id, m));
      return Array.from(map.values());
    }
  } catch (_) {}
  return CURATED_SEED_POOL;
};

// Safe Synthesized Web Audio Ticks
const playTick = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(750, ctx.currentTime);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.035);
  } catch (_) {}
};

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
  const [moviePool, setMoviePool] = useState(() => getLocalCachedPool());
  const [currentMovie, setCurrentMovie] = useState(null);
  const [state, setState] = useState('idle'); // 'idle' | 'spinning' | 'revealed'

  // Indices for the 3 visible carousel thumbnails
  const [reelIndices, setReelIndices] = useState({ left: 0, center: 1, right: 2 });

  // Trailer Peek state
  const [showTrailer, setShowTrailer] = useState(false);
  const [trailerKey, setTrailerKey] = useState(null);
  const [loadingTrailer, setLoadingTrailer] = useState(false);

  // Playlist Modal
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  const spinTimerRef = useRef(null);
  const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' 
    ? `${import.meta.env.VITE_API_URL || 'http://localhost:10000'}/api` 
    : 'https://aurawatch-1.onrender.com/api');

  // Sync initial reel thumbnails when moviePool updates
  useEffect(() => {
    if (moviePool.length >= 3) {
      setReelIndices({
        left: 0,
        center: 1,
        right: 2
      });
      setCurrentMovie(moviePool[1]);
    }
  }, [moviePool]);

  // Load pool whenever category changes or modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const loadPool = async () => {
      try {
        const randomPage = Math.floor(Math.random() * 3) + 1;
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
          endpoint = `${baseUrl}/movies/trending`;
        }

        const data = await fetchWithCache(endpoint);
        const list = Array.isArray(data) ? data.filter(m => m.poster || m.backdrop) : [];

        if (isMounted && list.length > 0) {
          setMoviePool(list);
        }
      } catch (err) {
        console.error('Failed to update roulette pool:', err);
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

  // The Suspenseful Spin Animation with Visible Flipping Real Thumbnails
  const triggerSpin = () => {
    const pool = moviePool.length > 0 ? moviePool : CURATED_SEED_POOL;

    setState('spinning');
    setShowTrailer(false);
    setTrailerKey(null);

    let tick = 0;
    const totalTicks = 15;
    let delay = 50; // Initial rapid velocity

    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);

    const step = () => {
      tick++;

      // Cycle center thumbnail across the pool
      const centerIdx = Math.floor(Math.random() * pool.length);
      const leftIdx = (centerIdx - 1 + pool.length) % pool.length;
      const rightIdx = (centerIdx + 1) % pool.length;

      setReelIndices({
        left: leftIdx,
        center: centerIdx,
        right: rightIdx
      });

      setCurrentMovie(pool[centerIdx]);
      playTick();

      // Smooth deceleration curve
      if (tick > 9) {
        delay += 40;
      }

      if (tick >= totalTicks) {
        // Final locked pick
        const finalPick = pool[centerIdx];
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
  const pool = moviePool.length > 0 ? moviePool : CURATED_SEED_POOL;
  const leftItem = pool[reelIndices.left] || pool[0];
  const centerItem = pool[reelIndices.center] || currentMovie || pool[1];
  const rightItem = pool[reelIndices.right] || pool[2] || pool[0];

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
          {/* STATE 1 & 2: REEL STAGE WITH VISIBLE REAL THUMBNAILS */}
          {state !== 'revealed' && (
            <>
              <div className={styles.reelStage}>
                <div className={styles.reelCenterMarker} />

                <div className={styles.reelTrack}>
                  {/* Left Side Thumbnail */}
                  <div className={`${styles.posterThumb} ${styles.sidePoster}`}>
                    <img
                      src={leftItem?.poster || leftItem?.backdrop}
                      alt={leftItem?.title || 'Poster'}
                      className={styles.posterImg}
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.target.src = 'https://picsum.photos/id/10/300/450'; }}
                    />
                  </div>

                  {/* Center Focused Spinning Thumbnail */}
                  <div className={`${styles.posterThumb} ${styles.centerPoster} ${state === 'spinning' ? styles.centerPosterSpinning : ''}`}>
                    <img
                      src={centerItem?.poster || centerItem?.backdrop}
                      alt={centerItem?.title || 'Selected Movie'}
                      className={styles.posterImg}
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.target.src = 'https://picsum.photos/id/10/300/450'; }}
                    />
                  </div>

                  {/* Right Side Thumbnail */}
                  <div className={`${styles.posterThumb} ${styles.sidePoster}`}>
                    <img
                      src={rightItem?.poster || rightItem?.backdrop}
                      alt={rightItem?.title || 'Poster'}
                      className={styles.posterImg}
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.target.src = 'https://picsum.photos/id/10/300/450'; }}
                    />
                  </div>
                </div>

                {state === 'spinning' && (
                  <div className={styles.spinningIndicator}>
                    <RotateCw size={12} color="#ff3844" className="spin" />
                    <span className={styles.spinningText}>Rolling Vault...</span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className={styles.actionsArea}>
                <button
                  className={styles.primaryBtn}
                  onClick={triggerSpin}
                  disabled={state === 'spinning'}
                >
                  {state === 'spinning' ? (
                    <>
                      <RotateCw size={17} className="spin" />
                      <span>Deciphering...</span>
                    </>
                  ) : (
                    <>
                      <Dices size={17} />
                      <span>Spin Roulette</span>
                    </>
                  )}
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
                    onClick={triggerSpin}
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
