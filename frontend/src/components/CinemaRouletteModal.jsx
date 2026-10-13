import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { 
  X, Play, RotateCw, Star, Film, Tv, Sparkles, 
  Flame, Award, Clapperboard, Dices, FolderPlus, Compass, Trophy
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useToast } from '../context/ToastContext';
import { fetchWithCache } from '../utils/api';
import PlaylistModal from './PlaylistModal';
import styles from './CinemaRouletteModal.module.css';

// 100% Verified Real TMDB Movie Pool (Zero-Network Instant Fallback)
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

// Read existing cached movies from localStorage
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
      const map = new Map();
      collected.forEach(m => map.set(m.id, m));
      return Array.from(map.values());
    }
  } catch (_) {}
  return CURATED_SEED_POOL;
};

// Audio Synthesizers
const playTick = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(780, ctx.currentTime);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.035);
  } catch (_) {}
};

const playJackpotFanfare = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.07);
      gain.gain.setValueAtTime(0.07, ctx.currentTime + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.07 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.07);
      osc.stop(ctx.currentTime + i * 0.07 + 0.35);
    });
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

const WINNER_INDEX = 28; // The card position in the strip that lands dead-center
const STRIP_LENGTH = 36;

const CinemaRouletteModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { openPlayer } = usePlayer();
  const { showToast } = useToast();

  const [activeCategory, setActiveCategory] = useState('all');
  const [moviePool, setMoviePool] = useState(() => getLocalCachedPool());
  const [currentMovie, setCurrentMovie] = useState(null);
  const [state, setState] = useState('idle'); // 'idle' | 'spinning' | 'revealed'

  // Conveyor Strip & Smooth Physics State
  const [stripMovies, setStripMovies] = useState([]);
  const [trackOffset, setTrackOffset] = useState(0);
  const [hasTransition, setHasTransition] = useState(false);
  const [isWinnerHighlighted, setIsWinnerHighlighted] = useState(false);

  // Trailer Peek
  const [showTrailer, setShowTrailer] = useState(false);
  const [trailerKey, setTrailerKey] = useState(null);
  const [loadingTrailer, setLoadingTrailer] = useState(false);

  // Playlist Modal
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  const stageRef = useRef(null);
  const trackRef = useRef(null);
  const spinTimeoutsRef = useRef([]);

  const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' 
    ? `${import.meta.env.VITE_API_URL || 'http://localhost:10000'}/api` 
    : 'https://aurawatch-1.onrender.com/api');

  // Build a randomized 26-card strip from the pool
  const buildStrip = (pool, forcedWinner = null) => {
    const validPool = pool && pool.length > 0 ? pool : CURATED_SEED_POOL;
    const winner = forcedWinner || validPool[Math.floor(Math.random() * validPool.length)];
    const strip = [];
    for (let i = 0; i < STRIP_LENGTH; i++) {
      if (i === WINNER_INDEX) {
        strip.push(winner);
      } else {
        const rand = validPool[Math.floor(Math.random() * validPool.length)];
        strip.push(rand);
      }
    }
    return { strip, winner };
  };

  // Initialize strip on mount or category change
  useEffect(() => {
    const { strip, winner } = buildStrip(moviePool);
    setStripMovies(strip);
    setCurrentMovie(winner);
    setTrackOffset(0);
    setHasTransition(false);
    setIsWinnerHighlighted(false);
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
      spinTimeoutsRef.current.forEach(t => clearTimeout(t));
    };
  }, [isOpen, activeCategory]);

  // Reset state when opening modal
  useEffect(() => {
    if (isOpen) {
      setState('idle');
      setShowTrailer(false);
      setTrailerKey(null);
      setTrackOffset(0);
      setHasTransition(false);
      setIsWinnerHighlighted(false);
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
  }, [isOpen, state, showTrailer, showPlaylistModal]);

  // Buttery-Smooth Continuous Gliding Spin Animation
  const triggerSpin = () => {
    if (state === 'spinning') return;

    // Clear previous timers
    spinTimeoutsRef.current.forEach(t => clearTimeout(t));
    spinTimeoutsRef.current = [];

    setShowTrailer(false);
    setTrailerKey(null);
    setIsWinnerHighlighted(false);

    // Build fresh strip with newly selected winner
    const { strip, winner } = buildStrip(moviePool);
    setStripMovies(strip);
    setCurrentMovie(winner);

    // Measure DOM width to calculate exact center landing
    const stageWidth = stageRef.current ? stageRef.current.clientWidth : 420;
    const cardWidth = window.innerWidth <= 480 ? 90 : 105;
    const gap = 10;
    const stride = cardWidth + gap;
    const centerPoint = (stageWidth / 2) - (cardWidth / 2);
    const targetOffset = -(WINNER_INDEX * stride - centerPoint);

    // 1. Instantly reset track to 0px without transition
    if (trackRef.current) {
      trackRef.current.style.transition = 'none';
      trackRef.current.style.transform = 'translate3d(0px, 0, 0)';
      // Force layout reflow so the browser is 100% guaranteed to start from 0
      void trackRef.current.offsetHeight;
    }
    setTrackOffset(0);
    setHasTransition(false);
    setState('spinning');

    // 2. Next animation frame: start the 5.0-second suspenseful glide
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setHasTransition(true);
        setTrackOffset(targetOffset);

        if (trackRef.current) {
          trackRef.current.style.transition = 'transform 5.0s cubic-bezier(0.08, 0.85, 0.16, 1)';
          trackRef.current.style.transform = `translate3d(${targetOffset}px, 0, 0)`;
        }

        // 3. Schedule realistic decelerating ticks across 5.0s
        const tickDelays = [
          100, 200, 310, 430, 560, 700, 860, 1040, 1240, 1460, 
          1710, 1990, 2300, 2650, 3050, 3500, 4000, 4550
        ];
        tickDelays.forEach(d => {
          const timer = setTimeout(() => playTick(), d);
          spinTimeoutsRef.current.push(timer);
        });

        // 4. Completion: Triumphant Fanfare + Reward Reveal
        const finishTimer = setTimeout(() => {
          playJackpotFanfare();
          setIsWinnerHighlighted(true);

          // Rewarding pause: let user absorb the winner card under the laser needle
          const revealTimer = setTimeout(() => {
            setState('revealed');
          }, 1200);
          spinTimeoutsRef.current.push(revealTimer);
        }, 5000);

        spinTimeoutsRef.current.push(finishTimer);
      });
    });
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

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleBadge}>
            <Dices size={15} />
            <span>Cinema Roulette</span>
          </div>
          <button 
            type="button" 
            className={styles.closeBtn} 
            onClick={onClose} 
            aria-label="Close Roulette"
          >
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
                type="button"
                className={`${styles.categoryPill} ${isActive ? styles.categoryPillActive : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
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
          {/* STATE 1 & 2: CONTINUOUS GLIDING FILM STRIP STAGE */}
          {state !== 'revealed' && (
            <>
              <div className={styles.reelStage} ref={stageRef}>
                {/* Center Laser Pointer Needles */}
                <div className={styles.reelPointerTop} />
                <div className={styles.centerMarkerLine} />
                <div className={styles.reelPointerBottom} />

                {/* The Conveyor Film Strip */}
                <div 
                  ref={trackRef}
                  className={styles.glideTrack}
                  style={{
                    transform: `translate3d(${trackOffset}px, 0, 0)`
                  }}
                >
                  {stripMovies.map((movie, idx) => {
                    const isWinner = idx === WINNER_INDEX;
                    return (
                      <div 
                        key={`${movie?.id || idx}-${idx}`}
                        className={`${styles.stripCard} ${isWinner && isWinnerHighlighted ? styles.stripCardWinner : ''}`}
                      >
                        <img
                          src={movie?.poster || movie?.backdrop}
                          alt={movie?.title || 'Film'}
                          className={styles.stripImg}
                          referrerPolicy="no-referrer"
                          onError={(e) => { e.target.src = 'https://picsum.photos/id/10/300/450'; }}
                        />
                        <div className={styles.stripCardTitle}>
                          {movie?.title}
                        </div>
                      </div>
                    );
                  })}
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
                  type="button"
                  className={styles.primaryBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerSpin();
                  }}
                  disabled={state === 'spinning'}
                >
                  {state === 'spinning' ? (
                    <>
                      <RotateCw size={17} className="spin" />
                      <span>Rolling the Vault...</span>
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

          {/* STATE 3: CELEBRATION REVEAL CARD */}
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
                      CERTIFIED PICK
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
                    <span className={styles.chip}>4K ULTRA HD</span>
                  </div>
                </div>

                <p className={styles.overviewText}>
                  {currentMovie.overview || 'Tonight’s mystery feature unlocked from the Cinema Roulette vault.'}
                </p>
              </div>

              {/* Actions Area */}
              <div className={styles.actionsArea}>
                <button 
                  type="button" 
                  className={styles.primaryBtn} 
                  onClick={(e) => { e.stopPropagation(); handleWatchNow(); }}
                >
                  <Play size={16} fill="#fff" />
                  <span>Stream Instantly</span>
                </button>

                <div className={styles.secondaryRow}>
                  <button
                    type="button"
                    className={`${styles.secondaryBtn} ${showTrailer ? styles.secondaryBtnActive : ''}`}
                    onClick={(e) => { e.stopPropagation(); handleToggleTrailer(); }}
                    disabled={loadingTrailer}
                  >
                    <Clapperboard size={14} />
                    <span>{loadingTrailer ? 'Loading...' : showTrailer ? 'Close Trailer' : 'Trailer'}</span>
                  </button>

                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={(e) => { e.stopPropagation(); setShowPlaylistModal(true); }}
                  >
                    <FolderPlus size={14} />
                    <span>Playlist</span>
                  </button>

                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={(e) => { e.stopPropagation(); triggerSpin(); }}
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
    </div>,
    document.body
  );
};

export default CinemaRouletteModal;
