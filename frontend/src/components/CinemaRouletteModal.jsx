import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, Play, RotateCw, Star, Film, Tv, Sparkles, 
  Bookmark, Check, Flame, Award, Volume2, VolumeX,
  Clapperboard, Sliders, Dices, FolderPlus
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import PlaylistModal from './PlaylistModal';
import styles from './CinemaRouletteModal.module.css';

// Audio Synthesizer (Native Web Audio API - Zero External Network Assets)
const playTickSound = (frequency = 650) => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  } catch (_) {}
};

const playJackpotSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.07);
      gain.gain.setValueAtTime(0.08, ctx.currentTime + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.07 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.07);
      osc.stop(ctx.currentTime + idx * 0.07 + 0.22);
    });
  } catch (_) {}
};

const VIBES = [
  { id: 'all', label: 'Wildcard Roulette', emoji: '🎲', tag: 'Anything Goes', desc: 'Any genre, any era, pure luck', type: 'any', genre: null },
  { id: 'mind_bending', label: 'Mind Bender', emoji: '🧠', tag: 'Mystery & Sci-Fi', desc: 'Twists, puzzles & brain melters', type: 'movie', genre: '9648,878' },
  { id: 'adrenaline', label: 'Adrenaline Rush', emoji: '💥', tag: 'Action & Thrill', desc: 'Explosive pacing & high stakes', type: 'movie', genre: '28,53' },
  { id: 'chill', label: 'Late Night Chill', emoji: '🌙', tag: 'Comfort & Drama', desc: 'Relaxing, heartfelt & atmospheric', type: 'movie', genre: '10749,18' },
  { id: 'horror', label: 'Dark & Spooky', emoji: '👻', tag: 'Pure Horror', desc: 'Jump scares & psychological dread', type: 'movie', genre: '27' },
  { id: 'anime', label: 'Anime Universe', emoji: '🌸', tag: 'Top Animation', desc: 'Shonen, seinen & anime classics', type: 'tv', lang: 'anime', genre: '16' },
  { id: 'top_rated', label: 'Masterpieces Only', emoji: '👑', tag: '8+ IMDb Rated', desc: 'Critically acclaimed crowd pleasers', type: 'top_rated', genre: null }
];

const CinemaRouletteModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { openPlayer } = usePlayer();
  const { isLoggedIn, token } = useAuth();
  const { showToast } = useToast();

  // Machine States: 'vault' (ready/idle) | 'spinning' (active reel) | 'revealed' (jackpot)
  const [machineState, setMachineState] = useState('vault');
  const [selectedVibe, setSelectedVibe] = useState(VIBES[0]);
  const [moviePool, setMoviePool] = useState([]);
  const [currentMovie, setCurrentMovie] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Trailer Peek state
  const [trailerKey, setTrailerKey] = useState(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const [loadingTrailer, setLoadingTrailer] = useState(false);

  // Playlist management modal state
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  // Slot Reel Cycling Display
  const [slotReelText, setSlotReelText] = useState({
    genre: 'MYSTERY',
    runtime: 'FEATURE',
    rating: 'TOP RATED'
  });

  const spinIntervalRef = useRef(null);
  const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' 
    ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` 
    : 'https://aurawatch-1.onrender.com/api');

  // Reset to vault whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setMachineState('vault');
      setShowTrailer(false);
      setTrailerKey(null);
    }
  }, [isOpen]);

  // Keyboard shortcut: Space / Enter to spin, Esc to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showTrailer) {
          setShowTrailer(false);
        } else {
          onClose();
        }
      } else if ((e.key === ' ' || e.key === 'Enter') && !showPlaylistModal) {
        // Prevent page scroll on space
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          if (machineState !== 'spinning') {
            startRouletteSpin();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    };
  }, [isOpen, machineState, selectedVibe, moviePool, showTrailer, showPlaylistModal]);

  // Fetch Pool for Selected Vibe
  const fetchPoolForVibe = async (vibe) => {
    try {
      const randomPage = Math.floor(Math.random() * 5) + 1;
      let endpoint;

      if (vibe.type === 'top_rated') {
        endpoint = `${baseUrl}/movies/top-rated?page=${randomPage}`;
      } else if (vibe.lang === 'anime') {
        endpoint = `${baseUrl}/movies/discover?type=tv&lang=anime&page=${randomPage}`;
      } else if (vibe.genre) {
        endpoint = `${baseUrl}/movies/discover?type=${vibe.type}&genre=${vibe.genre}&page=${randomPage}`;
      } else {
        const type = Math.random() > 0.5 ? 'movie' : 'tv';
        endpoint = `${baseUrl}/movies/discover?type=${type}&page=${randomPage}`;
      }

      const res = await fetch(endpoint);
      const data = await res.json();
      const list = Array.isArray(data) ? data.filter(m => m.poster || m.backdrop) : [];
      return list;
    } catch (err) {
      console.error('Failed to load roulette pool:', err);
      return [];
    }
  };

  // Trigger the Suspenseful Arcade Reel Spin
  const startRouletteSpin = async () => {
    setMachineState('spinning');
    setShowTrailer(false);
    setTrailerKey(null);

    // Fetch pool if needed or re-use existing
    let pool = moviePool;
    if (pool.length === 0) {
      pool = await fetchPoolForVibe(selectedVibe);
      setMoviePool(pool);
    }

    if (pool.length === 0) {
      // Fallback: try top-rated
      try {
        const fallbackRes = await fetch(`${baseUrl}/movies/trending`);
        pool = await fallbackRes.json();
        setMoviePool(pool);
      } catch (_) {}
    }

    if (pool.length === 0) {
      showToast('Could not reach movie vault. Please try again.', 'error');
      setMachineState('vault');
      return;
    }

    // Dynamic slot reel tick labels
    const sampleGenres = ['THRILLER', 'SCI-FI', 'ACTION', 'HORROR', 'COMEDY', 'DRAMA', 'ANIME'];
    const sampleScores = ['9.1 IMDb', '8.7 IMDb', '4K HDR', 'GOLDEN HIT', 'MUST-WATCH', 'MASTERPIECE'];
    const sampleRuntimes = ['118 MIN', '2H 10M', 'SERIES S1', 'LIMITED ED.', 'BLOCKBUSTER'];

    let count = 0;
    const totalTicks = 16;
    let currentDelay = 55; // Initial rapid velocity

    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);

    const runTick = () => {
      count++;
      const randomCandidate = pool[Math.floor(Math.random() * pool.length)];
      setCurrentMovie(randomCandidate);

      // Randomize HUD slot reels
      setSlotReelText({
        genre: sampleGenres[Math.floor(Math.random() * sampleGenres.length)],
        runtime: sampleRuntimes[Math.floor(Math.random() * sampleRuntimes.length)],
        rating: sampleScores[Math.floor(Math.random() * sampleScores.length)]
      });

      // Sound FX tick with escalating frequency
      if (soundEnabled) {
        playTickSound(600 + count * 25);
      }

      // Physics Deceleration easing curve
      if (count > 10) {
        currentDelay += 35; // Slower deceleration build-up
      }

      if (count >= totalTicks) {
        // Final Pick Locked!
        const finalPick = pool[Math.floor(Math.random() * pool.length)];
        setCurrentMovie(finalPick);
        setMachineState('revealed');
        if (soundEnabled) {
          playJackpotSound();
        }
      } else {
        spinIntervalRef.current = setTimeout(runTick, currentDelay);
      }
    };

    runTick();
  };

  // Toggle Trailer Peek
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
          showToast('No official trailer preview available for this title.', 'info');
        }
      } else {
        showToast('Trailer unavailable.', 'info');
      }
    } catch (_) {
      showToast('Could not load trailer preview.', 'error');
    } finally {
      setLoadingTrailer(false);
    }
  };

  // Instant Stream via PlayerContext
  const handleStreamNow = () => {
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

  // View Details Full Page
  const handleViewDetails = () => {
    if (!currentMovie) return;
    const movieType = currentMovie.type === 'Series' || currentMovie.type === 'tv' ? 'tv' : 'movie';
    navigate(`/movie/${currentMovie.id}?type=${movieType}`);
    onClose();
  };

  if (!isOpen) return null;

  const movieType = currentMovie?.type === 'Series' || currentMovie?.type === 'tv' ? 'tv' : 'movie';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header HUD */}
        <div className={styles.header}>
          <div className={styles.brandGroup}>
            <div className={styles.vaultBadge}>
              <Dices size={16} />
              <span>AURA CINEMA VAULT</span>
            </div>
            <div className={styles.statusIndicator} title="Vault Machine Online" />
          </div>

          <div className={styles.headerActions}>
            <button
              className={styles.iconBtn}
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute Sound FX' : 'Enable Sound FX'}
              aria-label="Sound Toggle"
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button 
              className={styles.iconBtn} 
              onClick={onClose} 
              aria-label="Close Vault"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* =========================================
            MACHINE STATE 1 & 2: VAULT SELECTION & SPINNING
            ========================================= */}
        {machineState !== 'revealed' && (
          <div className={styles.vaultBody}>
            {/* Vibe Selection Grid */}
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Step 1 • Calibrate Your Vibe</span>
              <span className={styles.sectionSub}>What kind of cinema trip are you craving tonight?</span>
            </div>

            <div className={styles.vibeGrid}>
              {VIBES.map(vibe => {
                const isActive = selectedVibe.id === vibe.id;
                return (
                  <button
                    key={vibe.id}
                    className={`${styles.vibeCard} ${isActive ? styles.vibeCardActive : ''}`}
                    onClick={() => {
                      if (machineState !== 'spinning') {
                        setSelectedVibe(vibe);
                        setMoviePool([]); // Reset pool to fetch fresh for new vibe
                      }
                    }}
                    disabled={machineState === 'spinning'}
                  >
                    <div className={styles.vibeTopRow}>
                      <span className={styles.vibeEmoji}>{vibe.emoji}</span>
                      <span className={styles.vibeTag}>{vibe.tag}</span>
                    </div>
                    <span className={styles.vibeLabel}>{vibe.label}</span>
                    <span className={styles.vibeDesc}>{vibe.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Arcade Stage (Slot Reel HUD) */}
            <div className={styles.arcadeStage}>
              <div className={styles.reelContainer}>
                <div className={`${styles.reelWindow} ${machineState === 'spinning' ? styles.reelWindowGlow : ''}`}>
                  <span className={styles.reelLabel}>GENRE LOCK</span>
                  <span className={`${styles.reelValue} ${machineState === 'spinning' ? styles.reelValueSpinning : ''}`}>
                    {machineState === 'spinning' ? slotReelText.genre : selectedVibe.tag.toUpperCase()}
                  </span>
                </div>

                <div className={`${styles.reelWindow} ${machineState === 'spinning' ? styles.reelWindowGlow : ''}`}>
                  <span className={styles.reelLabel}>STATUS</span>
                  <span className={`${styles.reelValue} ${machineState === 'spinning' ? styles.reelValueSpinning : ''}`}>
                    {machineState === 'spinning' ? 'DECIPHERING...' : 'ARMED & READY'}
                  </span>
                </div>

                <div className={`${styles.reelWindow} ${machineState === 'spinning' ? styles.reelWindowGlow : ''}`}>
                  <span className={styles.reelLabel}>CALIBRE</span>
                  <span className={`${styles.reelValue} ${machineState === 'spinning' ? styles.reelValueSpinning : ''}`}>
                    {machineState === 'spinning' ? slotReelText.rating : 'AURA SELECT'}
                  </span>
                </div>
              </div>

              {/* Center Movie Reel Strip */}
              <div className={`${styles.centerPosterReel} ${machineState === 'spinning' ? styles.spinningCenterReel : ''}`}>
                {machineState === 'spinning' && currentMovie?.backdrop && (
                  <img 
                    src={currentMovie.backdrop || currentMovie.poster} 
                    alt="Reel Flash" 
                    className={styles.reelBackdropFlash} 
                  />
                )}

                <div className={styles.reelCenterOverlay}>
                  {machineState === 'spinning' ? (
                    <>
                      <RotateCw size={32} color="#ff3844" className="spin" />
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff', letterSpacing: '1px' }}>
                        SCANNING VAULT ARCHIVES...
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={28} color="#e50914" />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                        Press the lever to roll your mystery cinema pick
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Pulsing Action Lever */}
            <button
              className={styles.leverActionBtn}
              onClick={startRouletteSpin}
              disabled={machineState === 'spinning'}
            >
              {machineState === 'spinning' ? (
                <>
                  <RotateCw size={20} className="spin" />
                  <span>ROLLING THE REEL...</span>
                </>
              ) : (
                <>
                  <Dices size={22} />
                  <span>PULL LEVER • SPIN THE VAULT</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* =========================================
            MACHINE STATE 3: JACKPOT REVEAL SHOWCASE
            ========================================= */}
        {machineState === 'revealed' && currentMovie && (
          <div className={styles.revealBody}>
            {/* Jackpot Match Banner */}
            <div className={styles.jackpotBanner}>
              <div className={styles.jackpotTag}>
                <Sparkles size={16} />
                <span>99% AURA MATCH LOCKED</span>
              </div>
              <span className={styles.jackpotVibeTag}>
                {selectedVibe.emoji} {selectedVibe.label}
              </span>
            </div>

            {/* Movie Showcase Hero */}
            <div className={styles.movieHero}>
              <div className={styles.posterCard}>
                <img
                  src={currentMovie.poster || currentMovie.backdrop}
                  alt={currentMovie.title}
                  className={styles.posterImg}
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.target.src = 'https://picsum.photos/id/10/300/450'; }}
                />
              </div>

              <div className={styles.movieInfo}>
                <div className={styles.metaRow}>
                  <span className={`${styles.badge} ${styles.typeBadge}`}>
                    {movieType === 'tv' ? 'Series' : 'Movie'}
                  </span>
                  {currentMovie.year && (
                    <span className={styles.badge}>{currentMovie.year}</span>
                  )}
                  {currentMovie.rating && currentMovie.rating !== 'N/A' && (
                    <span className={`${styles.badge} ${styles.ratingBadge}`}>
                      <Star size={12} fill="#f5c518" />
                      <span>{currentMovie.rating}</span>
                    </span>
                  )}
                  <span className={styles.badge}>4K ULTRA HD</span>
                </div>

                <h2 className={styles.movieTitle}>{currentMovie.title}</h2>

                <p className={styles.overviewText}>
                  {currentMovie.overview || 'Tonight’s mystery feature unlocked from the Aura Vault. Hit Stream Now to begin watching or inspect the trailer.'}
                </p>
              </div>
            </div>

            {/* Inline Trailer Preview (Peek Trailer) */}
            {showTrailer && trailerKey && (
              <div className={styles.trailerSection}>
                <iframe
                  className={styles.trailerIframe}
                  src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0&modestbranding=1`}
                  title={`${currentMovie.title} Trailer`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}

            {/* Control Deck Action Buttons */}
            <div className={styles.actionsDeck}>
              <div className={styles.primaryActionRow}>
                <button 
                  className={styles.streamBtn} 
                  onClick={handleStreamNow}
                >
                  <Play size={18} fill="#fff" />
                  <span>Stream Instantly</span>
                </button>
              </div>

              <div className={styles.secondaryRow}>
                <button 
                  className={`${styles.secondaryBtn} ${showTrailer ? styles.secondaryBtnActive : ''}`}
                  onClick={handleToggleTrailer}
                  disabled={loadingTrailer}
                >
                  <Clapperboard size={15} />
                  <span>{loadingTrailer ? 'Loading...' : showTrailer ? 'Hide Trailer' : 'Peek Trailer'}</span>
                </button>

                <button 
                  className={styles.secondaryBtn}
                  onClick={() => setShowPlaylistModal(true)}
                  title="Add to Playlist or Watchlist"
                >
                  <FolderPlus size={15} />
                  <span>Playlist</span>
                </button>

                <button 
                  className={styles.secondaryBtn}
                  onClick={startRouletteSpin}
                  title="Re-roll another title with this vibe"
                >
                  <RotateCw size={15} />
                  <span>Re-spin</span>
                </button>
              </div>

              {/* Switch Vibe shortcut */}
              <div style={{ textAlign: 'center', marginTop: '2px' }}>
                <button
                  onClick={() => setMachineState('vault')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.45)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  ← Choose another vibe or change mood
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Playlist / Watchlist Modal Integration */}
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
