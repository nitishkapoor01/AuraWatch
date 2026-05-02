import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Play, X, ChevronDown, Plus, Check, Star, Download, Loader2 } from 'lucide-react';
import styles from './MovieDetail.module.css';
import Row from '../components/Row';
import { fetchWithCache } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const isTVType = (type) => type === 'tv' || type === 'series';

const extractLanguage = (name) => {
  if (!name) return 'English';
  const n = name.toLowerCase();
  if (n.includes('hindi') || n.includes(' hin ') || n.includes('hin-eng')) return 'Hindi';
  if (n.includes('dual audio') || n.includes('dual-audio')) return 'Dual Audio';
  if (n.includes('tamil')) return 'Tamil';
  if (n.includes('telugu')) return 'Telugu';
  if (n.includes('malayalam')) return 'Malayalam';
  if (n.includes('korean')) return 'Korean';
  if (n.includes('japanese')) return 'Japanese';
  if (n.includes('english') || n.includes(' eng ')) return 'English';
  return 'Original / English';
};

const MovieDetail = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'movie';
  const isTV = isTVType(type);
  const navigate = useNavigate();
  const { isLoggedIn, token, user } = useAuth();

  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTrailer, setShowTrailer] = useState(false);
  const [trailerKey, setTrailerKey] = useState(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [playerSeason, setPlayerSeason] = useState(1);
  const [playerEpisode, setPlayerEpisode] = useState(1);
  const [playerEpisodeName, setPlayerEpisodeName] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Download Modal State
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadStep, setDownloadStep] = useState('ad'); // 'ad', 'options', 'error', 'not_found'
  const [adTimer, setAdTimer] = useState(30);
  const [parsedDownloads, setParsedDownloads] = useState({});
  const [selectedQuality, setSelectedQuality] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [downloadErrorMsg, setDownloadErrorMsg] = useState('');
  const [globalSkipAds, setGlobalSkipAds] = useState(false);

  // TV Specific
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [episodes, setEpisodes] = useState([]);

  useEffect(() => {
    const fetchMovie = async () => {
      setLoading(true);
      try {
        const onRevalidate = (data) => {
          if (data && data.id) setMovie(data);
          else setMovie(null);
          setLoading(false);
        };
        const data = await fetchWithCache(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/movies/${id}?type=${type}`, onRevalidate);
        if (data && data.id) setMovie(data);
        else setMovie(null);
      } catch (error) {
        console.error('Error fetching details:', error);
        setMovie(null);
      }
      setLoading(false);
    };

    const fetchGlobalSettings = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/settings/skip_ads_timer`);
        if (res.ok) {
          const data = await res.json();
          setGlobalSkipAds(data.value === 'true' || data.value === true);
        }
      } catch (e) {
        console.error('Failed to fetch global settings', e);
      }
    };

    fetchMovie();
    fetchGlobalSettings();
    setShowTrailer(false);
    setTrailerKey(null);
    setShowPlayer(false);
    setSeasons([]);
    setEpisodes([]);
    setSelectedSeason(1);
    setPlayerSeason(1);
    setPlayerEpisode(1);
  }, [id, type]);

  // Check if favorite
  useEffect(() => {
    if (!isLoggedIn || !id) return;
    const checkFavorite = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/favorites/check/${id}?type=${type}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setIsFavorite(data.isFavorite);
        }
      } catch (err) {
        console.error('Failed to check favorite:', err);
      }
    };
    checkFavorite();
  }, [id, type, isLoggedIn, token]);

  // Fetch seasons for TV
  useEffect(() => {
    if (!isTV) return;
    const fetchSeasons = async () => {
      try {
        const onRevalidate = (data) => {
          if (Array.isArray(data)) {
            setSeasons(data);
            setSelectedSeason(prev => prev || data[0]?.number || 1);
          }
        };
        const data = await fetchWithCache(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/movies/${id}/seasons`, onRevalidate);
        if (Array.isArray(data)) {
          setSeasons(data);
          setSelectedSeason(data[0]?.number || 1);
        }
      } catch (e) { console.error('Error fetching seasons:', e); }
    };
    fetchSeasons();
  }, [id, isTV]);

  // Fetch episodes when season changes
  useEffect(() => {
    if (!isTV) return;
    const fetchEpisodes = async () => {
      try {
        const onRevalidate = (data) => {
          if (Array.isArray(data)) {
            setEpisodes(data);
            // Don't reset selectedEpisode on revalidate if it's already set
          }
        };
        const data = await fetchWithCache(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/movies/${id}/season/${selectedSeason}`, onRevalidate);
        if (Array.isArray(data)) {
          setEpisodes(data);
          setSelectedEpisode(1);
        }
      } catch (e) { console.error('Error fetching episodes:', e); }
    };
    fetchEpisodes();
  }, [id, selectedSeason, isTV]);

  const handleWatchTrailer = async () => {
    if (trailerKey) { setShowTrailer(true); return; }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/movies/${id}/videos?type=${type}`);
      const data = await res.json();
      if (data.key) { setTrailerKey(data.key); setShowTrailer(true); }
      else alert('Trailer not available');
    } catch (error) { console.error('Error fetching trailer:', error); }
  };

  const handlePlayEpisode = (season, episode, epName = '') => {
    setPlayerSeason(season);
    setPlayerEpisode(episode);
    setPlayerEpisodeName(epName);
    setShowPlayer(true);
    trackWatch(season, episode);
  };

  const handleDownload = async () => {
    if (!movie || isDownloading) return;
    setIsDownloading(true);
    setShowDownloadModal(true);
    
    const isAdmin = user?.role === 'admin';
    const shouldSkipTimer = isAdmin || globalSkipAds;
    setDownloadStep('ad');
    setAdTimer(shouldSkipTimer ? 0 : 30);
    setParsedDownloads({});
    setDownloadErrorMsg('');
    
    // Start Ad Timer (only if not bypassed)
    let timerInterval = null;
    if (!shouldSkipTimer) {
      timerInterval = setInterval(() => {
        setAdTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/downloads/movie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: movie.title, 
          year: movie.year,
          type: movie.type,
          season: isTV ? selectedSeason : null,
          episode: isTV ? selectedEpisode : null
        })
      });
      const data = await res.json();
      
      if (data.status === 'success' && data.qualities && data.qualities.length > 0) {
        // Parse and Group Links
        const grouped = {};
        for (const q of data.qualities) {
          const directLinks = q.links.filter(l => l.type === 'direct');
          if (directLinks.length === 0) continue;
          
          grouped[q.quality] = {};
          for (const link of directLinks) {
            const lang = extractLanguage(link.name);
            if (!grouped[q.quality][lang]) grouped[q.quality][lang] = [];
            grouped[q.quality][lang].push(link);
          }
        }
        
        const availableQualities = Object.keys(grouped);
        if (availableQualities.length > 0) {
          setParsedDownloads(grouped);
          setSelectedQuality(availableQualities[0]);
          setSelectedLanguage(Object.keys(grouped[availableQualities[0]])[0]);
          
          if (shouldSkipTimer) {
            if (timerInterval) clearInterval(timerInterval);
            setDownloadStep('options');
          } else {
            // Wait for timer if still running
            const checkTimer = setInterval(() => {
              setAdTimer((currentTimer) => {
                if (currentTimer <= 0) {
                  clearInterval(checkTimer);
                  setDownloadStep('options');
                }
                return currentTimer;
              });
            }, 500);
          }
        } else {
          setDownloadErrorMsg('No direct download links found. (Only torrents/magnets available)');
          setDownloadStep('error');
          if (timerInterval) clearInterval(timerInterval);
        }
      } else {
        setDownloadStep('not_found');
        if (timerInterval) clearInterval(timerInterval);
      }
    } catch (err) {
      console.error(err);
      setDownloadErrorMsg('Failed to search for download links. Please ensure Scrapper is running.');
      setDownloadStep('error');
      if (timerInterval) clearInterval(timerInterval);
    } finally {
      setIsDownloading(false);
    }
  };

  // Track watch history
  const trackWatch = async (season = null, episode = null) => {
    if (!isLoggedIn || !movie) return;
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/watch-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          movieId: id,
          movieType: type,
          title: movie.title,
          poster: movie.poster,
          backdrop: movie.backdrop,
          rating: movie.rating,
          year: movie.year,
          progress: 10,
          duration: 100,
          season,
          episode
        })
      });
    } catch (err) {
      console.error('Failed to track watch:', err);
    }
  };

  const getPlayerUrl = () => {
    if (isTV) {
      return `https://screenscape.me/embed?tmdb=${id}&type=tv&s=${playerSeason}&e=${playerEpisode}`;
    }
    return `https://screenscape.me/embed?tmdb=${id}&type=movie`;
  };

  const handleToggleFavorite = async () => {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }

    try {
      if (isFavorite) {
        await fetch(`${import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}`}/favorites/${id}?type=${type}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        setIsFavorite(false);
      } else {
        await fetch(`${import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` : 'https://aurawatch-1.onrender.com/api')}/favorites`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({
            movieId: id,
            movieType: type,
            title: movie.title,
            poster: movie.poster,
            backdrop: movie.backdrop,
            overview: movie.overview,
            rating: movie.rating,
            year: movie.year
          })
        });
        setIsFavorite(true);
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  if (loading) return <div style={{color:'white', padding:'100px', fontSize: '18px'}}>Loading...</div>;
  if (!movie) return <div style={{color:'white', padding:'100px', fontSize: '18px'}}>Movie not found!</div>;

  return (
    <div className={styles.detailPage}>

      {/* Embed Player Modal */}
      {showPlayer && (
        <div className={styles.trailerModal}>
          <button className={styles.closeTrailerBtn} onClick={() => setShowPlayer(false)}>
            <X size={28} />
          </button>
          <div className={styles.playerEpLabel}>
            {isTV ? `${movie?.title} • S${playerSeason} E${playerEpisode}${playerEpisodeName ? ` • ${playerEpisodeName}` : ''}` : movie?.title}
          </div>
          <iframe
            src={getPlayerUrl()}
            title={movie.title}
            className={styles.trailerIframe}
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
          ></iframe>
        </div>
      )}

      {/* Trailer Modal */}
      {showTrailer && trailerKey && (
        <div className={styles.trailerModal}>
          <button className={styles.closeTrailerBtn} onClick={() => setShowTrailer(false)}>
            <X size={28} />
          </button>
          <iframe
            src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&modestbranding=1&rel=0`}
            title="Trailer"
            className={styles.trailerIframe}
            allow="autoplay; encrypted-media"
            allowFullScreen
          ></iframe>
        </div>
      )}

      {/* Backdrop */}
      <div className={styles.backdropContainer}>
        <img src={movie.backdrop} alt={movie.title} className={styles.backdrop} referrerPolicy="no-referrer" />
        <div className={styles.overlay}></div>
      </div>

      {/* Main Info */}
      <div className={styles.content}>
        <img src={movie.poster} alt={movie.title} className={styles.poster} referrerPolicy="no-referrer" />
        <div className={styles.info}>
          <h1 className={styles.title}>{movie.title}</h1>
          <div className={styles.meta}>
            <div className={styles.ratingBadge}>
              <Star size={16} fill="#f5c518" color="#f5c518" />
              <span className={styles.ratingScore}>{movie.rating}</span>
              <span className={styles.ratingMax}>/10</span>
            </div>
            <span>{movie.year}</span>
            <span>{movie.type}</span>
            {isTV && seasons.length > 0 && (
              <span>{seasons.length} Season{seasons.length > 1 ? 's' : ''}</span>
            )}
          </div>
          <p className={styles.overview}>{movie.overview}</p>

          <div className={styles.actions}>
            <button className={styles.playBtn} onClick={() => {
              if (isTV) {
                const ep = episodes.find(e => e.number === selectedEpisode);
                handlePlayEpisode(selectedSeason, selectedEpisode, ep?.name || '');
              }
              else { setShowPlayer(true); trackWatch(); }
            }}>
              <Play fill="black" size={22} /> Play Now
            </button>
            <button className={styles.trailerBtnDetail} onClick={handleWatchTrailer}>
              Watch Trailer
            </button>
            <button 
              className={`${styles.listBtn} ${isFavorite ? styles.listBtnActive : ''}`} 
              onClick={handleToggleFavorite}
              data-title={isLoggedIn ? (isFavorite ? 'Remove from My List' : 'Add to My List') : 'Login to save'}
            >
              {isFavorite ? <Check size={22} /> : <Plus size={22} />}
            </button>
            <button 
              className={styles.listBtn} 
              onClick={handleDownload} 
              data-title="Download Movie"
              disabled={isDownloading}
            >
              {isDownloading ? <Loader2 size={22} className={styles.spinner} /> : <Download size={22} />}
            </button>
          </div>

          {/* TV: Season + Episode Dropdowns */}
          {isTV && seasons.length > 0 && (
            <div className={styles.tvSelectors}>
              <div className={styles.selectorWrapper}>
                <label className={styles.selectorLabel}>Season</label>
                <div className={styles.seasonDropdownWrapper}>
                  <select
                    className={styles.seasonDropdown}
                    value={selectedSeason}
                    onChange={(e) => setSelectedSeason(Number(e.target.value))}
                  >
                    {seasons.map(s => (
                      <option key={s.number} value={s.number}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className={styles.dropdownIcon} />
                </div>
              </div>

              <div className={styles.selectorWrapper}>
                <label className={styles.selectorLabel}>Episode</label>
                <div className={styles.seasonDropdownWrapper}>
                  <select
                    className={styles.seasonDropdown}
                    value={selectedEpisode}
                    onChange={(e) => setSelectedEpisode(Number(e.target.value))}
                  >
                    {episodes.map(ep => (
                      <option key={ep.number} value={ep.number}>
                        Ep {ep.number}{ep.name ? ` — ${ep.name}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className={styles.dropdownIcon} />
                </div>
              </div>
            </div>
          )}
          
          {/* Cast Section */}
          {movie.cast && movie.cast.length > 0 && (
            <div className={styles.castSection}>
              <h3 className={styles.castTitle}>Top Cast</h3>
              <div className={styles.castList}>
                {movie.cast.map(actor => (
                  <div key={actor.id} className={styles.castMember}>
                    {actor.profile ? (
                      <img src={actor.profile} alt={actor.name} className={styles.castImage} />
                    ) : (
                      <div className={styles.castImagePlaceholder}>{actor.name.charAt(0)}</div>
                    )}
                    <span className={styles.castName}>{actor.name}</span>
                    <span className={styles.castCharacter}>{actor.character}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Episodes Section (Netflix Style) */}
      {isTV && seasons.length > 0 && (
        <div className={styles.seasonsSection}>
          <div className={styles.seasonHeader}>
            <h2 className={styles.episodesTitle}>Episodes</h2>
            <div className={styles.seasonDropdownWrapper}>
              <select
                className={styles.seasonDropdown}
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(Number(e.target.value))}
              >
                {seasons.map(s => (
                  <option key={s.number} value={s.number}>{s.name || `Season ${s.number}`}</option>
                ))}
              </select>
              <ChevronDown size={14} className={styles.dropdownIcon} />
            </div>
          </div>
          
          <div className={styles.episodeList}>
            {episodes.map(ep => (
              <div 
                key={ep.number} 
                className={styles.episodeCard}
                onClick={() => handlePlayEpisode(selectedSeason, ep.number, ep.name)}
              >
                <div className={styles.episodeThumb}>
                  {ep.still ? (
                    <img src={ep.still} alt={ep.name} className={styles.episodeImg} referrerPolicy="no-referrer" />
                  ) : (
                    <div className={styles.episodeNoThumb}>{ep.number}</div>
                  )}
                  <div className={styles.episodePlayOverlay}>
                    <Play fill="white" color="white" size={32} />
                  </div>
                </div>
                <div className={styles.episodeInfo}>
                  <div className={styles.episodeMeta}>
                    <span className={styles.episodeNum}>{ep.number}. {ep.name || `Episode ${ep.number}`}</span>
                    <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
                      {ep.rating ? (
                        <span style={{display: 'flex', alignItems: 'center', gap: '4px', color: '#f5c518', fontSize: '13px', fontWeight: '600'}}>
                          <Star size={12} fill="#f5c518" />
                          {(ep.rating / 10).toFixed(1)}
                        </span>
                      ) : null}
                      {ep.runtime ? <span className={styles.episodeDuration}>{ep.runtime}m</span> : null}
                    </div>
                  </div>
                  <p className={styles.episodeOverview}>
                    {ep.overview || "No description available for this episode."}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* More Like This */}
      <div className={styles.recommendations}>
        <Row title="More Like This" endpoint={`${id}/similar?type=${type}`} />
      </div>

      {/* Download Modal */}
      {showDownloadModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.downloadModal}>
            <button className={styles.closeModalBtn} onClick={() => {
              setShowDownloadModal(false);
              setIsDownloading(false);
            }}>
              <X size={24} />
            </button>

            {downloadStep === 'ad' && (
              <div className={styles.adPhase}>
                <h2>Generating Premium Links</h2>
                <p>Please wait while we securely fetch the best available download links for you.</p>
                
                {(!user || user.role !== 'admin') && !globalSkipAds ? (
                  <>
                    {/* AD PLACEHOLDER */}
                    <div className={styles.adPlaceholder}>
                      <span>ADVERTISEMENT</span>
                      <p>Insert Google AdSense or Custom Script Here</p>
                    </div>
                    
                    <div className={styles.timerBox}>
                      <Loader2 size={24} className={styles.spinner} />
                      <span>Links ready in {adTimer} seconds...</span>
                    </div>
                  </>
                ) : (
                  <div className={styles.timerBox}>
                    <Loader2 size={24} className={styles.spinner} />
                    <span>Fetching links, please wait...</span>
                  </div>
                )}
              </div>
            )}

            {downloadStep === 'error' && (
              <div className={styles.errorPhase}>
                <h2 style={{color: '#e50914'}}>Oops!</h2>
                <p>{downloadErrorMsg}</p>
                <button className={styles.primaryBtn} onClick={() => setShowDownloadModal(false)}>Close</button>
              </div>
            )}

            {downloadStep === 'not_found' && (
              <div className={styles.errorPhase}>
                <h2>No Links Found</h2>
                <p>We couldn't find any direct download links for this title right now. Please check back later.</p>
                <button className={styles.primaryBtn} onClick={() => setShowDownloadModal(false)}>Close</button>
              </div>
            )}

            {downloadStep === 'options' && (
              <div className={styles.optionsPhase}>
                <h2>Download Options</h2>
                <p className={styles.optionsSubtitle}>{movie.title}</p>
                
                <div className={styles.qualityTabs}>
                  {Object.keys(parsedDownloads).map((q) => (
                    <button 
                      key={q} 
                      className={`${styles.tabBtn} ${selectedQuality === q ? styles.activeTab : ''}`}
                      onClick={() => {
                        setSelectedQuality(q);
                        setSelectedLanguage(Object.keys(parsedDownloads[q])[0]); // Reset language
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {selectedQuality && parsedDownloads[selectedQuality] && (
                  <div className={styles.languageTabs}>
                    {Object.keys(parsedDownloads[selectedQuality]).map((lang) => (
                      <button
                        key={lang}
                        className={`${styles.langTabBtn} ${selectedLanguage === lang ? styles.activeLangTab : ''}`}
                        onClick={() => setSelectedLanguage(lang)}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                )}

                <div className={styles.linksList}>
                  {selectedQuality && selectedLanguage && parsedDownloads[selectedQuality]?.[selectedLanguage]?.map((link, idx) => (
                    <div key={idx} className={styles.linkCard}>
                      <div className={styles.linkInfo}>
                        <span className={styles.linkQuality}>{selectedQuality}</span>
                        <span className={styles.linkSize}>{link.size || 'Unknown Size'}</span>
                        <span className={styles.linkName} title={link.name}>
                          {link.name.length > 50 ? link.name.substring(0, 50) + '...' : link.name}
                        </span>
                      </div>
                      <button 
                        className={styles.primaryBtn}
                        onClick={() => window.open(link.url, '_blank')}
                      >
                        <Download size={18} /> Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MovieDetail;
